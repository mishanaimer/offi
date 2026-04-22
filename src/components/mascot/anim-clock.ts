"use client";

// Shared animation clock: one requestAnimationFrame loop feeds all mascots.
// Each mascot re-renders on its own via setState — but we avoid spawning 20
// separate rAF loops when the chat has 20 messages.

import { useEffect, useState } from "react";

type Listener = (t: number) => void;

let listeners: Listener[] = [];
let rafId: number | null = null;
let started = 0;

function tick(now: number) {
  const t = (now - started) / 1000;
  for (const l of listeners) l(t);
  rafId = requestAnimationFrame(tick);
}

function subscribe(l: Listener) {
  listeners.push(l);
  if (rafId === null && typeof performance !== "undefined") {
    started = performance.now();
    rafId = requestAnimationFrame(tick);
  }
  return () => {
    listeners = listeners.filter((x) => x !== l);
    if (listeners.length === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

export function useAnimClock(enabled = true): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    return subscribe(setT);
  }, [enabled]);
  return enabled ? t : 0;
}
