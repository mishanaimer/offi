"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Trash2, Phone, Mail, User as UserIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Client = { id: string; name: string; contact: string | null; phone: string | null; email: string | null; data: any };

export function ClientsView({ initialClients }: { initialClients: Client[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initialClients;
    return initialClients.filter((c) =>
      [c.name, c.contact, c.phone, c.email].some((v) => v && v.toLowerCase().includes(s))
    );
  }, [q, initialClients]);

  async function save(form: FormData) {
    const supabase = createClient();
    await supabase.from("clients").insert({
      name: String(form.get("name") ?? "").trim(),
      contact: (form.get("contact") as string) || null,
      phone: (form.get("phone") as string) || null,
      email: (form.get("email") as string) || null,
    });
    setAdding(false);
    router.refresh();
  }

  async function remove(id: string) {
    const supabase = createClient();
    await supabase.from("clients").delete().eq("id", id);
    router.refresh();
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
    };
    const supabase = createClient();
    const rowsOut = data
      .filter((r) => r[idx.name >= 0 ? idx.name : 0])
      .map((r) => ({
        name: r[idx.name >= 0 ? idx.name : 0],
        contact: idx.contact >= 0 ? r[idx.contact] : null,
        phone: idx.phone >= 0 ? r[idx.phone] : null,
        email: idx.email >= 0 ? r[idx.email] : null,
      }));
    if (rowsOut.length) await supabase.from("clients").insert(rowsOut);
    router.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="h-16 glass border-b border-border/60 px-4 md:px-6 flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Клиенты</h1>
        <div className="flex items-center gap-2">
          <label>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
            <span className="inline-flex h-9 px-3 items-center gap-1.5 rounded-full border border-border text-sm cursor-pointer hover:bg-muted">
              <Upload className="w-4 h-4" /> CSV
            </span>
          </label>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="w-4 h-4" /> Новый</Button>
        </div>
      </header>

      <div className="container-page max-w-4xl py-6 md:py-8 space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени, компании, телефону…" className="pl-9" />
        </div>

        {adding && (
          <form
            action={save}
            className="card-surface p-5 space-y-3 animate-fade-in"
          >
            <div className="grid sm:grid-cols-2 gap-3">
              <Input name="name" placeholder="Название / имя*" required />
              <Input name="contact" placeholder="Контактное лицо" />
              <Input name="phone" placeholder="Телефон" />
              <Input name="email" type="email" placeholder="Email" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Отмена</Button>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        )}

        <div className="card-surface divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{q ? "Не нашли" : "Клиентов пока нет. Добавьте первого."}</div>
          ) : filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-medium">
                {c.name[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                  {c.contact && <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" />{c.contact}</span>}
                  {c.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                  {c.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)} aria-label="Удалить">
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
