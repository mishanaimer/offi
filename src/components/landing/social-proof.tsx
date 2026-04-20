import { Reveal } from "./reveal";

const STATS = [
  { n: "500+", l: "компаний", e: "🏢" },
  { n: "12K", l: "задач в день", e: "⚡" },
  { n: "4.9", l: "из 5 оценка", e: "⭐" },
];

export function LandingSocialProof() {
  return (
    <Reveal className="max-w-[600px] mx-auto px-6 md:px-8 mt-[72px]">
      <div className="flex justify-center gap-6 md:gap-12 py-7 border-y border-[hsl(var(--border-light))]">
        {STATS.map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-[26px] font-extrabold text-foreground tracking-[-0.03em]">{s.n}</div>
            <div className="text-xs text-[hsl(var(--text-tertiary))] mt-0.5">{s.e} {s.l}</div>
          </div>
        ))}
      </div>
    </Reveal>
  );
}
