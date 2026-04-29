"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  Phone,
  Mail,
  User as UserIcon,
  Upload,
  Building2,
  Tag as TagIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ClientCard = {
  id: string;
  name: string;
  short_name: string | null;
  legal_name: string | null;
  client_type: string | null;
  contact: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  inn: string | null;
  status: string;
  tags: string[];
  summary: string | null;
  last_contact_at: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  lead: "Лид",
  active: "Активный",
  partner: "Партнёр",
  archived: "Архив",
};

const STATUS_TONE: Record<string, string> = {
  lead: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  partner: "bg-blue-100 text-blue-800",
  archived: "bg-muted text-muted-foreground",
};

export function ClientsView({ initialClients }: { initialClients: ClientCard[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return initialClients.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!s) return true;
      return [
        c.name,
        c.short_name,
        c.legal_name,
        c.contact,
        c.phone,
        c.email,
        c.inn,
        c.industry,
        c.summary,
      ].some((v) => v && String(v).toLowerCase().includes(s));
    });
  }, [q, statusFilter, initialClients]);

  async function save(form: FormData) {
    const payload: Record<string, unknown> = {
      name: String(form.get("name") ?? "").trim(),
      short_name: form.get("short_name") || null,
      contact: form.get("contact") || null,
      phone: form.get("phone") || null,
      email: form.get("email") || null,
      inn: form.get("inn") || null,
      client_type: form.get("client_type") || "legal",
      status: form.get("status") || "lead",
    };
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const j = await res.json();
      setAdding(false);
      router.push(`/clients/${j.client.id}`);
    } else {
      alert("Не удалось сохранить: " + (await res.text()));
    }
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const rows = text.split("\n").map((l) => l.split(",").map((x) => x.trim()));
    const [header, ...data] = rows;
    const idx = {
      name: header.findIndex((h) => /name|название|имя/i.test(h)),
      contact: header.findIndex((h) => /contact|контакт/i.test(h)),
      phone: header.findIndex((h) => /phone|телефон/i.test(h)),
      email: header.findIndex((h) => /email|почта/i.test(h)),
      inn: header.findIndex((h) => /\binn\b|инн/i.test(h)),
    };
    const rowsOut = data
      .filter((r) => r[idx.name >= 0 ? idx.name : 0])
      .map((r) => ({
        name: r[idx.name >= 0 ? idx.name : 0],
        contact: idx.contact >= 0 ? r[idx.contact] : null,
        phone: idx.phone >= 0 ? r[idx.phone] : null,
        email: idx.email >= 0 ? r[idx.email] : null,
        inn: idx.inn >= 0 ? r[idx.inn] : null,
      }));
    for (const row of rowsOut) {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row),
      });
    }
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-16 glass border-b border-border/60 px-4 md:px-6 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Клиенты</h1>
        <div className="flex items-center gap-2">
          <label>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
            />
            <span className="inline-flex h-9 px-3 items-center gap-1.5 rounded-full border border-border text-sm cursor-pointer hover:bg-muted">
              <Upload className="w-4 h-4" /> CSV
            </span>
          </label>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" /> Новый
          </Button>
        </div>
      </header>

      <div className="container-page max-w-6xl py-6 md:py-8 space-y-4">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по имени, ИНН, телефону, email…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1">
            {([
              ["", "Все"],
              ["lead", "Лиды"],
              ["active", "Активные"],
              ["partner", "Партнёры"],
              ["archived", "Архив"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setStatusFilter(v)}
                className={cn(
                  "h-8 px-3 rounded-lg text-xs font-medium transition",
                  statusFilter === v
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {adding && (
          <form
            action={save}
            className="card-surface p-5 space-y-3 animate-fade-in"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <Input name="name" placeholder="Название / имя*" required />
              <Input name="short_name" placeholder='Краткое имя (например, «ООО Ромашка»)' />
              <Input name="contact" placeholder="Контактное лицо" />
              <Input name="phone" placeholder="Телефон" />
              <Input name="email" type="email" placeholder="Email" />
              <Input name="inn" placeholder="ИНН" />
              <select
                name="client_type"
                defaultValue="legal"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="legal">Юр. лицо</option>
                <option value="individual">Физ. лицо</option>
              </select>
              <select
                name="status"
                defaultValue="lead"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="lead">Лид</option>
                <option value="active">Активный</option>
                <option value="partner">Партнёр</option>
                <option value="archived">Архив</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Отмена
              </Button>
              <Button type="submit">Сохранить</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Полную карточку (реквизиты, банк, подписант) можно будет заполнить на странице клиента — или попросить ассистента в чате.
            </p>
          </form>
        )}

        {filtered.length === 0 ? (
          <div className="card-surface p-8 text-center text-sm text-muted-foreground">
            {q || statusFilter
              ? "По фильтру никого не нашли"
              : "Клиентов пока нет. Добавьте первого или загрузите CSV."}
          </div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clients/${c.id}`}
                  className="block card-surface p-4 hover:border-primary/40 transition group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center text-sm font-medium shrink-0">
                      {c.client_type === "individual" ? (
                        <UserIcon className="w-4 h-4" />
                      ) : (
                        <Building2 className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium truncate">{c.short_name || c.name}</div>
                        <span
                          className={cn(
                            "text-[10px] rounded-full px-2 py-0.5 font-medium shrink-0",
                            STATUS_TONE[c.status] ?? STATUS_TONE.lead
                          )}
                        >
                          {STATUS_LABELS[c.status] ?? c.status}
                        </span>
                      </div>
                      {c.summary && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {c.summary}
                        </p>
                      )}
                      <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                        {c.contact && (
                          <div className="flex items-center gap-1.5 truncate">
                            <UserIcon className="w-3 h-3 shrink-0" /> {c.contact}
                          </div>
                        )}
                        {c.phone && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Phone className="w-3 h-3 shrink-0" /> {c.phone}
                          </div>
                        )}
                        {c.email && (
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3 h-3 shrink-0" /> {c.email}
                          </div>
                        )}
                        {c.inn && (
                          <div className="opacity-70 truncate">ИНН {c.inn}</div>
                        )}
                      </div>
                      {c.tags && c.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center gap-1 text-[10px] rounded-full bg-muted px-2 py-0.5"
                            >
                              <TagIcon className="w-2.5 h-2.5" />
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
