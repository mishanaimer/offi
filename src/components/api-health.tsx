"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

type Ctx = {
  failures: number;
  banner: boolean;
  recordSuccess: () => void;
  recordFailure: () => void;
};

const HealthContext = createContext<Ctx | null>(null);
const THRESHOLD = 3;

export function ApiHealthProvider({ children }: { children: React.ReactNode }) {
  const [failures, setFailures] = useState(0);
  const counter = useRef(0);

  const recordSuccess = useCallback(() => {
    if (counter.current !== 0) {
      counter.current = 0;
      setFailures(0);
    }
  }, []);

  const recordFailure = useCallback(() => {
    counter.current += 1;
    setFailures(counter.current);
  }, []);

  return (
    <HealthContext.Provider
      value={{ failures, banner: failures >= THRESHOLD, recordSuccess, recordFailure }}
    >
      {children}
    </HealthContext.Provider>
  );
}

export function useApiHealth(): Ctx {
  const ctx = useContext(HealthContext);
  if (!ctx) {
    return { failures: 0, banner: false, recordSuccess: () => {}, recordFailure: () => {} };
  }
  return ctx;
}

/** Видимый баннер — рендерится в AppShell. */
export function ApiErrorBanner() {
  const { banner } = useApiHealth();
  if (!banner) return null;
  return (
    <div
      role="status"
      className="shrink-0 bg-destructive/10 text-destructive border-b border-destructive/20 text-[13px] py-1.5 px-3 flex items-center justify-center gap-2"
    >
      <AlertTriangle className="w-3.5 h-3.5" />
      <span>Технические проблемы. Мы работаем над этим.</span>
    </div>
  );
}
