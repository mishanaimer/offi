"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  UserPlus,
  Trash2,
  Lock,
  Mail,
  Pencil,
  Check,
  X,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsTabs } from "@/components/settings-tabs";
import { useBranding } from "@/components/branding-provider";
import { UsageBar } from "@/components/usage-bar";
import { getPlan } from "@/lib/plans";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "admin" | "member";
  position: string | null;
  department_id: string | null;
  bio: string | null;
  created_at: string;
};

type Department = { id: string; name: string; color: string; created_at: string };

const DEPT_COLORS = ["#1a6eff", "#7C3AED", "#00A082", "#F59E0B", "#E11D48", "#111827", "#0EA5E9", "#84CC16"];

export function TeamView({
  company,
  currentUser,
  initialMembers,
  initialDepartments,
}: {
  company: { id: string; plan: string };
  currentUser: { id: string; role: "owner" | "admin" | "member" };
  initialMembers: Member[];
  initialDepartments: Department[];
}) {
  const router = useRouter();
  const brand = useBranding();
  const isAdmin = currentUser.role === "owner" || currentUser.role === "admin";
  const plan = getPlan(company.plan);

  // invite form
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [deptId, setDeptId] = useState<string>("");
  const [position, setPosition] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // editing member
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "member">("member");
  const [editDept, setEditDept] = useState<string>("");
  const [editPos, setEditPos] = useState("");

  // new department
  const [deptName, setDeptName] = useState("");
  const [deptColor, setDeptColor] = useState(DEPT_COLORS[0]);
  const [deptBusy, setDeptBusy] = useState(false);

  const deptsById = useMemo(() => new Map(initialDepartments.map((d) => [d.id, d])), [initialDepartments]);

  async function invite() {
    setBusy(true);
    setErr(null);
    setToast(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          full_name: fullName || null,
          role,
          department_id: deptId || null,
          position: position || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail ?? j.error ?? "failed");
      setToast(`Приглашение отправлено на ${email}`);
      setEmail("");
      setFullName("");
      setPosition("");
      setRole("member");
      setDeptId("");
      setInviteOpen(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/team/member?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: editRole,
          department_id: editDept || null,
          position: editPos || "",
        }),
      });
      setEditingId(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(id: string) {
    if (!confirm("Удалить сотрудника из компании?")) return;
    await fetch(`/api/team/member?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function createDepartment() {
    if (!deptName.trim()) return;
    setDeptBusy(true);
    try {
      const supabase = createClient();
      await supabase.from("departments").insert({ name: deptName.trim(), color: deptColor });
      setDeptName("");
      setDeptColor(DEPT_COLORS[0]);
      router.refresh();
    } finally {
      setDeptBusy(false);
    }
  }

  async function removeDepartment(id: string) {
    if (!confirm("Удалить отдел? У сотрудников пропадёт привязка.")) return;
    const supabase = createClient();
    await supabase.from("departments").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <header className="h-16 sticky top-0 z-10 glass border-b border-border/60 px-4 md:px-6 flex items-center">
        <h1 className="text-lg font-semibold">Настройки</h1>
        {!isAdmin && (
          <span className="ml-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5" /> только просмотр
          </span>
        )}
      </header>
      <SettingsTabs />

      <div className="container-page max-w-3xl py-6 md:py-8 space-y-6">
        {/* quota */}
        <section className="card-surface p-5">
          <UsageBar
            label="Сотрудников"
            used={initialMembers.length}
            limit={plan.limits.employees}
            accent={brand.accentColor}
            hint={`Тариф «${plan.name}»`}
          />
        </section>

        {/* members */}
        <section className="card-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Сотрудники ({initialMembers.length})</h2>
              <p className="text-xs text-muted-foreground">
                Роль admin может управлять брендом, тарифом и командой.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setInviteOpen((v) => !v)} style={{ background: brand.accentColor }}>
                <UserPlus className="w-4 h-4" /> Пригласить
              </Button>
            )}
          </div>

          {inviteOpen && isAdmin && (
            <div className="mt-4 rounded-xl border border-border p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ivan@company.ru"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Имя</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Иван Иванов"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Роль</Label>
                  <select
                    className="h-11 w-full rounded-[10px] border-[1.5px] border-border bg-card px-3"
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                  >
                    <option value="member">Сотрудник</option>
                    <option value="admin">Админ</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Отдел</Label>
                  <select
                    className="h-11 w-full rounded-[10px] border-[1.5px] border-border bg-card px-3"
                    value={deptId}
                    onChange={(e) => setDeptId(e.target.value)}
                  >
                    <option value="">— не указан —</option>
                    {initialDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Позиция</Label>
                  <Input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Менеджер по продажам"
                  />
                </div>
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>
                  Отмена
                </Button>
                <Button disabled={busy || !email} onClick={invite} style={{ background: brand.accentColor }}>
                  <Mail className="w-4 h-4" /> {busy ? "Отправляем…" : "Отправить инвайт"}
                </Button>
              </div>
            </div>
          )}

          {toast && (
            <div
              className="mt-3 rounded-lg px-3 py-2 text-sm"
              style={{
                background: `color-mix(in srgb, ${brand.accentColor} 8%, transparent)`,
                color: brand.accentColor,
              }}
            >
              {toast}
            </div>
          )}

          <div className="mt-4 divide-y divide-border">
            {initialMembers.map((m) => {
              const dept = m.department_id ? deptsById.get(m.department_id) : null;
              const isEditing = editingId === m.id;
              return (
                <div key={m.id} className="py-3 flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full grid place-items-center text-xs font-medium text-white shrink-0"
                    style={{ background: `color-mix(in srgb, ${brand.accentColor} 80%, #000 0%)` }}
                  >
                    {(m.full_name ?? m.email)[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {m.full_name ?? m.email}
                      {m.id === currentUser.id && (
                        <span className="ml-2 text-[11px] text-muted-foreground">(вы)</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    {!isEditing && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full px-2 h-5 inline-flex items-center bg-muted text-muted-foreground">
                          {roleLabel(m.role)}
                        </span>
                        {dept && (
                          <span
                            className="rounded-full px-2 h-5 inline-flex items-center text-white"
                            style={{ background: dept.color }}
                          >
                            {dept.name}
                          </span>
                        )}
                        {m.position && (
                          <span className="text-muted-foreground">· {m.position}</span>
                        )}
                      </div>
                    )}

                    {isEditing && (
                      <div className="mt-2 grid sm:grid-cols-3 gap-2">
                        <select
                          className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as any)}
                          disabled={m.role === "owner"}
                        >
                          <option value="member">Сотрудник</option>
                          <option value="admin">Админ</option>
                        </select>
                        <select
                          className="h-9 rounded-lg border border-border bg-card px-2 text-sm"
                          value={editDept}
                          onChange={(e) => setEditDept(e.target.value)}
                        >
                          <option value="">— без отдела —</option>
                          {initialDepartments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                        <Input
                          className="h-9"
                          value={editPos}
                          onChange={(e) => setEditPos(e.target.value)}
                          placeholder="Позиция"
                        />
                      </div>
                    )}
                  </div>

                  {isAdmin && m.role !== "owner" && m.id !== currentUser.id && (
                    <div className="flex gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => saveEdit(m.id)}
                            disabled={busy}
                            aria-label="Сохранить"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingId(null)}
                            aria-label="Отмена"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(m.id);
                              setEditRole(m.role === "admin" ? "admin" : "member");
                              setEditDept(m.department_id ?? "");
                              setEditPos(m.position ?? "");
                            }}
                            aria-label="Изменить"
                          >
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeMember(m.id)}
                            aria-label="Удалить"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* departments */}
        <section className="card-surface p-5">
          <h2 className="font-semibold">Отделы</h2>
          <p className="text-xs text-muted-foreground">
            Группируют сотрудников и помогают ассистенту понимать контекст.
          </p>

          {isAdmin && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Input
                className="flex-1 min-w-[180px]"
                placeholder="Название отдела"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
              />
              <div className="flex gap-1.5">
                {DEPT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDeptColor(c)}
                    className={cn(
                      "w-7 h-7 rounded-full border-2 transition",
                      deptColor === c ? "border-foreground" : "border-transparent"
                    )}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
              <Button onClick={createDepartment} disabled={!deptName.trim() || deptBusy}>
                <Plus className="w-4 h-4" /> Создать
              </Button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {initialDepartments.length === 0 && (
              <p className="text-sm text-muted-foreground">Пока нет отделов.</p>
            )}
            {initialDepartments.map((d) => {
              const count = initialMembers.filter((m) => m.department_id === d.id).length;
              return (
                <div
                  key={d.id}
                  className="inline-flex items-center gap-2 rounded-full pl-2 pr-1 h-8 border border-border bg-card text-sm"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <span className="text-xs text-muted-foreground">· {count}</span>
                  {isAdmin && (
                    <button
                      onClick={() => removeDepartment(d.id)}
                      className="w-6 h-6 rounded-full grid place-items-center text-muted-foreground hover:bg-muted"
                      aria-label="Удалить"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function roleLabel(r: string) {
  if (r === "owner") return "Owner";
  if (r === "admin") return "Admin";
  return "Сотрудник";
}
