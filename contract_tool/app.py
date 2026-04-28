"""
app.py — Flask-приложение для генерации договоров.

Запуск:
    pip install flask
    python app.py
    # Открой http://127.0.0.1:5000

Структура страниц:
  GET  /              — выбор шаблона
  GET  /fill/<tpl>    — форма заполнения
  POST /parse         — парсинг текста реквизитов (AJAX)
  POST /preview       — генерация и превью (returns json with download id)
  GET  /download/<id> — скачивание готового файла
  GET  /preview/<id>  — превью HTML-версии договора
"""
from __future__ import annotations
import json
import subprocess
import sys
import uuid
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, abort

sys.path.insert(0, str(Path(__file__).parent))
from generator import (
    load_config, generate_contract, parse_requisites
)

BASE_DIR = Path(__file__).parent
TEMPLATES_DOCX = BASE_DIR / "templates_docx"
CONFIGS = BASE_DIR / "configs"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

# Папка для сгенерированных файлов сессии
GENERATED: dict[str, dict] = {}  # id -> {"path": str, "html_preview": str}

app = Flask(__name__, template_folder=str(BASE_DIR / "templates_html"))


def list_templates() -> list[dict]:
    """Все доступные конфиги (по одному JSON-файлу = один шаблон)."""
    out = []
    for cfg_path in sorted(CONFIGS.glob("*.json")):
        cfg = load_config(cfg_path)
        out.append({
            "id": cfg_path.stem,
            "name": cfg.get("name", cfg_path.stem),
            "description": cfg.get("description", ""),
        })
    return out


def get_config(template_id: str) -> dict:
    cfg_path = CONFIGS / f"{template_id}.json"
    if not cfg_path.exists():
        abort(404, "Шаблон не найден")
    return load_config(cfg_path)


def docx_to_html_preview(docx_path: Path) -> str:
    """Конвертирует .docx → HTML для превью через LibreOffice."""
    out_dir = docx_path.parent / "preview"
    out_dir.mkdir(exist_ok=True)
    result = subprocess.run(
        [sys.executable, "/mnt/skills/public/docx/scripts/office/soffice.py",
         "--headless", "--convert-to", "html",
         str(docx_path), "--outdir", str(out_dir)],
        capture_output=True, text=True, timeout=60
    )
    if result.returncode != 0:
        return f"<p style='color:red'>Не удалось сгенерировать превью: {result.stderr}</p>"

    html_file = out_dir / (docx_path.stem + ".html")
    if not html_file.exists():
        return "<p style='color:red'>HTML-файл не создан.</p>"

    html = html_file.read_text(encoding="utf-8", errors="ignore")
    # Извлекаем содержимое <body>
    import re
    m = re.search(r"<body[^>]*>(.*)</body>", html, re.DOTALL | re.IGNORECASE)
    body = m.group(1) if m else html
    return body


# ------------- ROUTES -------------

@app.route("/")
def index():
    return render_template("index.html", templates=list_templates())


@app.route("/fill/<template_id>")
def fill(template_id: str):
    config = get_config(template_id)
    return render_template(
        "fill.html",
        template_id=template_id,
        config=config,
        fields_json=json.dumps(config.get("fields", []), ensure_ascii=False),
    )


@app.route("/parse", methods=["POST"])
def parse_endpoint():
    """Парсит реквизиты из произвольного текста."""
    text = request.json.get("text", "")
    parsed = parse_requisites(text)
    return jsonify(parsed)


@app.route("/preview", methods=["POST"])
def preview_endpoint():
    """Генерирует договор и возвращает ID для скачивания + HTML-превью."""
    payload = request.json
    template_id = payload["template_id"]
    data = payload["data"]

    config = get_config(template_id)
    template_docx = TEMPLATES_DOCX / config["docx_file"]

    gen_id = uuid.uuid4().hex[:12]
    out_path = OUTPUT_DIR / f"{template_id}_{gen_id}.docx"

    result = generate_contract(
        template_docx=template_docx,
        config=config,
        data=data,
        output_docx=out_path,
    )

    # Превью в HTML
    html_preview = docx_to_html_preview(out_path)

    suggested_name = f"Договор_{data.get('client_short_name', 'без_названия').replace(' ', '_').replace('«', '').replace('»', '')}.docx"

    GENERATED[gen_id] = {
        "path": str(out_path),
        "suggested_name": suggested_name,
    }

    return jsonify({
        "id": gen_id,
        "warnings": result["warnings"],
        "html_preview": html_preview,
        "suggested_name": suggested_name,
    })


@app.route("/download/<gen_id>")
def download(gen_id: str):
    if gen_id not in GENERATED:
        abort(404, "Файл не найден или сессия истекла")
    info = GENERATED[gen_id]
    return send_file(
        info["path"],
        as_attachment=True,
        download_name=info["suggested_name"],
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )


if __name__ == "__main__":
    import os
    debug_mode = os.environ.get("FLASK_DEBUG", "1") == "1"
    app.run(debug=debug_mode, host="127.0.0.1", port=5000, use_reloader=False)
