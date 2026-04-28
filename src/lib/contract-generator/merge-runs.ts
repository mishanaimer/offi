// Порт contract_tool/office_scripts/helpers/merge_runs.py на TypeScript.
//
// В Word-документах одна логическая фраза часто разбита на несколько
// <w:r> runs (из-за форматирования, авто-сохранений, отслеживания изменений).
// Это ломает любую построчную замену: «ИНН 7801121793» в исходнике может
// быть [<w:t>ИНН </w:t>][<w:t>7801121793</w:t>] — и поиск по строке
// «<w:t>ИНН 7801121793</w:t>» промахнётся.
//
// Тот же предобработчик исполнялся в оригинальном Python-инструменте
// при каждой распаковке, благодаря чему получался канонический XML.
// Без него — никакой ручной/AI-сгенерированный config не работает.
//
// Алгоритм (повторяет merge_runs.py на defusedxml):
//   1. Удалить <w:proofErr> (мешают слиянию)
//   2. Удалить rsid-атрибуты у <w:r> (метаданные ревизий, не влияют на вывод)
//   3. В каждом контейнере с <w:r>: слить соседние runs с одинаковым <w:rPr>
//   4. Внутри получившегося run: слить соседние <w:t> в один (правильно
//      выставляя xml:space="preserve" если есть пробелы)
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function localName(el: Element): string {
  // У xmldom localName может быть пустым, тогда tagName типа "w:r"
  const ln = (el as any).localName as string | undefined;
  if (ln) return ln;
  return el.tagName.includes(":") ? el.tagName.split(":")[1] : el.tagName;
}

function isElement(node: Node | null | undefined): node is Element {
  return !!node && node.nodeType === 1;
}

function findElements(root: Element, name: string): Element[] {
  const out: Element[] = [];
  const walk = (node: Element) => {
    if (localName(node) === name) out.push(node);
    for (const child of Array.from(node.childNodes)) {
      if (isElement(child)) walk(child);
    }
  };
  walk(root);
  return out;
}

function removeAll(root: Element, name: string) {
  for (const el of findElements(root, name)) {
    el.parentNode?.removeChild(el);
  }
}

function stripRsidAttrs(root: Element) {
  for (const r of findElements(root, "r")) {
    const attrs = Array.from((r as any).attributes ?? []) as Attr[];
    for (const a of attrs) {
      if (a.name.toLowerCase().includes("rsid")) r.removeAttributeNode(a);
    }
  }
}

function getChild(parent: Element, name: string): Element | null {
  for (const child of Array.from(parent.childNodes)) {
    if (isElement(child) && localName(child) === name) return child;
  }
  return null;
}

function getChildren(parent: Element, name: string): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (isElement(child) && localName(child) === name) out.push(child);
  }
  return out;
}

function nextElementSibling(node: Node): Element | null {
  let s: Node | null = node.nextSibling;
  while (s) {
    if (isElement(s)) return s;
    s = s.nextSibling;
  }
  return null;
}

function isAdjacent(a: Element, b: Element): boolean {
  // a и b считаются соседними если между ними нет других элементов / нет
  // непустого текста (whitespace-only ноды между <w:t> допустимы — они
  // появляются от pretty-print).
  let n: Node | null = a.nextSibling;
  while (n) {
    if (n === b) return true;
    if (isElement(n)) return false;
    if (n.nodeType === 3 && (n.nodeValue ?? "").trim() !== "") return false;
    n = n.nextSibling;
  }
  return false;
}

function canMerge(r1: Element, r2: Element): boolean {
  const rpr1 = getChild(r1, "rPr");
  const rpr2 = getChild(r2, "rPr");
  if ((rpr1 === null) !== (rpr2 === null)) return false;
  if (rpr1 === null) return true;
  const ser = new XMLSerializer();
  return ser.serializeToString(rpr1 as any) === ser.serializeToString(rpr2 as any);
}

function mergeRunContent(target: Element, source: Element) {
  for (const child of Array.from(source.childNodes)) {
    if (isElement(child) && localName(child) !== "rPr") {
      target.appendChild(child);
    }
  }
}

function setTextNodeValue(textNode: any, value: string) {
  // @xmldom/xmldom хранит текст в `data` и `nodeValue`, но XMLSerializer
  // сериализует только `data`. Обновляем оба, чтобы было детерминированно.
  textNode.data = value;
  textNode.nodeValue = value;
  if (typeof textNode.length === "number") textNode.length = value.length;
}

function consolidateText(run: Element) {
  const ts = getChildren(run, "t");
  for (let i = ts.length - 1; i > 0; i--) {
    const curr = ts[i];
    const prev = ts[i - 1];
    if (isAdjacent(prev, curr)) {
      const prevText = (prev.firstChild as any)?.data ?? prev.firstChild?.nodeValue ?? "";
      const currText = (curr.firstChild as any)?.data ?? curr.firstChild?.nodeValue ?? "";
      const merged = prevText + currText;
      if (prev.firstChild) {
        setTextNodeValue(prev.firstChild, merged);
      } else {
        prev.appendChild(prev.ownerDocument!.createTextNode(merged));
      }
      // xml:space="preserve" нужен только если есть граничные пробелы
      if (merged.startsWith(" ") || merged.endsWith(" ")) {
        prev.setAttribute("xml:space", "preserve");
      } else if (prev.hasAttribute("xml:space")) {
        prev.removeAttribute("xml:space");
      }
      run.removeChild(curr);
    }
  }
}

function mergeRunsIn(container: Element): number {
  let merged = 0;
  let run = firstChildRun(container);
  while (run) {
    while (true) {
      const next = nextElementSibling(run);
      if (next && localName(next) === "r" && canMerge(run, next)) {
        mergeRunContent(run, next);
        container.removeChild(next);
        merged++;
      } else {
        break;
      }
    }
    consolidateText(run);
    run = nextSiblingRun(run);
  }
  return merged;
}

function firstChildRun(container: Element): Element | null {
  for (const child of Array.from(container.childNodes)) {
    if (isElement(child) && localName(child) === "r") return child;
  }
  return null;
}

function nextSiblingRun(node: Element): Element | null {
  let s = node.nextSibling;
  while (s) {
    if (isElement(s)) {
      if (localName(s) === "r") return s;
    }
    s = s.nextSibling;
  }
  return null;
}

export interface MergeRunsResult {
  xml: string;
  merged: number;
}

export function mergeRunsInDocumentXml(xml: string): MergeRunsResult {
  const dom = new DOMParser().parseFromString(xml, "application/xml");
  const root = dom.documentElement as unknown as Element;
  if (!root) throw new Error("Не удалось распарсить document.xml");

  removeAll(root, "proofErr");
  stripRsidAttrs(root);

  // Уникальные контейнеры, в которых живут <w:r> (paragraph, ins, del, sdtContent...)
  const runs = findElements(root, "r");
  const containers = new Set<Element>();
  for (const r of runs) {
    const parent = r.parentNode as unknown as Element | null;
    if (parent && parent.nodeType === 1) containers.add(parent);
  }

  let mergedTotal = 0;
  for (const container of containers) {
    mergedTotal += mergeRunsIn(container);
  }

  return {
    xml: new XMLSerializer().serializeToString(dom as any),
    merged: mergedTotal,
  };
}
