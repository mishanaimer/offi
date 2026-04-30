"use client";

import { Crown } from "lucide-react";
import { useEffect, useState } from "react";

type FoundersStatus = { used: number; total: number; remaining: number };

export function FoundersCounter() {
  const [status, setStatus] = useState<FoundersStatus | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/founders/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setStatus(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const remaining = status?.remaining ?? 50;
  const total = status?.total ?? 50;
  const used = status?.used ?? 0;
  const pct = Math.min(100, Math.round((used / Math.max(total, 1)) * 100));

  return (
    <div className="mx-auto max-w-[820px] px-6 md:px-8 mb-8">
      <div className="rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-orange-50/60 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <Crown className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-full bg-amber-200/60 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-900">
              Founders Programme
            </span>
            <span className="text-[12px] text-amber-900/70 font-medium">осталось {remaining} из {total} мест</span>
          </div>
          <h3 className="mt-1.5 text-[15px] sm:text-[16px] font-bold text-amber-950 leading-snug">
            Первые {total} клиентов фиксируют скидку 50% — пожизненно
          </h3>
          <p className="mt-1 text-[13px] leading-[1.5] text-amber-900/80">
            При непрерывной подписке цена не растёт никогда. Вводите код{" "}
            <code className="rounded bg-amber-200/60 px-1.5 py-0.5 font-mono font-semibold tracking-wide">FOUNDER</code>
            {" при апгрейде с пилота или при первом платеже."}
          </p>
          <div className="mt-3 h-1.5 w-full max-w-[420px] rounded-full bg-amber-200/60 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
