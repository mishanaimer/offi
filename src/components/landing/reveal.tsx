"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type From = "bottom" | "left" | "right" | "scale";

const TRANSFORMS: Record<From, string> = {
  bottom: "translateY(24px)",
  left: "translateX(-20px)",
  right: "translateX(20px)",
  scale: "scale(0.96)",
};

export function Reveal({
  children,
  delay = 0,
  from = "bottom",
  className,
}: {
  children: ReactNode;
  delay?: number;
  from?: From;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translate(0) scale(1)" : TRANSFORMS[from],
        transition: `opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.8s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
