"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Phone, Ban } from "lucide-react";

export function StatusControls({
  id,
  status,
  targetPlan,
  companyPlan,
}: {
  id: string;
  status: string;
  targetPlan: string;
  companyPlan: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(next: "contacted" | "activated" | "cancelled") {
    setBusy(true);
    try {
      await fetch(`/api/admin/plan-requests?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, activate_plan: next === "activated" ? targetPlan : null }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const color =
    status === "activated"
      ? "bg-[#059669]/10 text-[#047857]"
      : status === "cancelled"
      ? "bg-muted text-muted-foreground"
      : status === "contacted"
      ? "bg-[#F59E0B]/10 text-[#B45309]"
      : "bg-destructive/10 text-destructive";

  const label =
    status === "activated"
      ? "Активирован"
      : status === "cancelled"
      ? "Отменён"
      : status === "contacted"
      ? "Связались"
      : "Новый";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
      {status !== "activated" && status !== "cancelled" && (
        <>
          <button
            onClick={() => set("contacted")}
            disabled={busy || status === "contacted"}
            className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border border-border hover:bg-muted disabled:opacity-40"
          >
            <Phone className="w-3 h-3" /> Связались
          </button>
          <button
            onClick={() => set("activated")}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border border-[#059669]/30 text-[#047857] hover:bg-[#059669]/10 disabled:opacity-40"
          >
            <Check className="w-3 h-3" /> Активировать ({targetPlan})
          </button>
          <button
            onClick={() => set("cancelled")}
            disabled={busy}
            className="inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <Ban className="w-3 h-3" /> Отменить
          </button>
        </>
      )}
    </div>
  );
}
