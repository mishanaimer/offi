"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Check, Play, Ban, ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Report = {
  id: string;
  subject: string | null;
  message: string;
  severity: "low" | "normal" | "high" | "critical";
  status: "new" | "in_progress" | "resolved" | "dismissed";
  email: string | null;
  page_url: string | null;
  details: Record<string, unknown> | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  companies: { name: string } | null;
  users: { full_name: string | null; email: string | null } | null;
};

const SEV_COLOR: Record<Report["severity"], string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-[#1a6eff]/10 text-[#1a6eff]",
  high: "bg-[#F59E0B]/10 text-[#B45309]",
  critical: "bg-destructive/10 text-destructive",
};
const SEV_LABEL: Record<Report["severity"], string> = {
  low: "Низкая",
  normal: "Обычная",
  high: "Высокая",
  critical: "Критично",
};
const STATUS_COLOR: Record<Report["status"], string> = {
  new: "bg-destructive/10 text-destructive",
  in_progress: "bg-[#F59E0B]/10 text-[#B45309]",
  resolved: "bg-[#059669]/10 text-[#047857]",
  dismissed: "bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<Report["status"], string> = {
  new: "Новая",
  in_progress: "В работе",
  resolved: "Решено",
  dismissed: "Отклонено",
};

export function BugRow({ r }: { r: Report }) {
  const router = useRouter();
  const [open, setOpen] = useState(r.status === "new");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(r.admin_notes ?? "");

  async function set(status: Report["status"], adminNotes?: string) {
    setBusy(true);
    try {
      await fetch(`/api/admin/bug-reports?id=${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          admin_notes: adminNotes ?? notes,
        }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const who =
    r.users?.full_name || r.users?.email || r.email || "Анонимный пользователь";

  return (
    <article className="card-surface overflow-hidden">
      <header
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <button
          type="button"
          className="mt-0.5 text-muted-foreground shrink-0"
          aria-label={open ? "Свернуть" : "Развернуть"}
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-[10px] rounded-full px-2 py-0.5 font-medium", SEV_COLOR[r.severity])}>
              {SEV_LABEL[r.severity]}
            </span>
            <span className={cn("text-[10px] rounded-full px-2 py-0.5 font-medium", STATUS_COLOR[r.status])}>
              {STATUS_LABEL[r.status]}
            </span>
            {r.companies?.name && (
              <span className="text-[11px] text-muted-foreground">· {r.companies.name}</span>
            )}
            <span className="text-[11px] text-muted-foreground">· {formatDate(r.created_at)}</span>
          </div>
          <div className="mt-1 font-medium text-[14px]">
            {r.subject || r.message.slice(0, 80)}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground truncate">
            {who}
          </div>
        </div>
      </header>

      {open && (
        <div className="border-t border-border/60 p-4 space-y-3 text-[13px]">
          <div>
            <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Описание
            </div>
            <div className="mt-1 whitespace-pre-wrap text-foreground/90">{r.message}</div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Fact label="Страница">
              {r.page_url ? (
                <a
                  href={r.page_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 break-all"
                >
                  {r.page_url}
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Fact>
            <Fact label="Email">{r.users?.email ?? r.email ?? "—"}</Fact>
            <Fact label="User agent">
              <span className="break-all">
                {(r.details as any)?.user_agent ?? "—"}
              </span>
            </Fact>
            <Fact label="Экран">
              {(() => {
                const s = (r.details as any)?.screen;
                return s ? `${s.w}×${s.h}, DPR ${s.dpr}` : "—";
              })()}
            </Fact>
          </div>

          {Array.isArray((r.details as any)?.console_errors) &&
            (r.details as any).console_errors.length > 0 && (
              <div>
                <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                  Последние ошибки консоли
                </div>
                <pre className="mt-1 rounded-lg bg-muted/60 p-2.5 text-[11px] whitespace-pre-wrap overflow-x-auto">
                  {((r.details as any).console_errors as string[]).join("\n")}
                </pre>
              </div>
            )}

          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Заметки администратора
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] outline-none focus:border-foreground/40 resize-none"
              placeholder="Что выяснили, что сделали…"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              onClick={() => set("in_progress")}
              disabled={busy || r.status === "in_progress"}
              className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 border border-border hover:bg-muted text-[12px] disabled:opacity-40"
            >
              <Play className="w-3 h-3" /> Взять в работу
            </button>
            <button
              onClick={() => set("resolved")}
              disabled={busy || r.status === "resolved"}
              className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 border border-[#059669]/30 text-[#047857] hover:bg-[#059669]/10 text-[12px] disabled:opacity-40"
            >
              <Check className="w-3 h-3" /> Решено
            </button>
            <button
              onClick={() => set("dismissed")}
              disabled={busy || r.status === "dismissed"}
              className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 border border-border text-muted-foreground hover:bg-muted text-[12px] disabled:opacity-40"
            >
              <Ban className="w-3 h-3" /> Отклонить
            </button>
            <button
              onClick={() => set(r.status)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 border border-border hover:bg-muted text-[12px] disabled:opacity-40 ml-auto"
            >
              Сохранить заметки
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-0.5 text-[13px]">{children}</div>
    </div>
  );
}
