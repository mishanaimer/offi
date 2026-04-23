"use client";

// BrandMorph — wordmark «offi» + маскот, который морфит между ".ai" (как хвост текста)
// и 3D-роботом на шарнире-антенне. Порт физики из mascot-morph.html.
// Используется в хедере лендинга (subtle, hover-only) и в hero-showcase (auto-cycle, плавает).
// Каждому экземпляру задают `phase` — сдвиг по синусоидам дыхания/покачивания,
// чтобы два маскота на одной странице жили в разном ритме и не выглядели
// синхронными зеркалами друг друга.

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type MorphState = "text" | "robot";

export type BrandMorphProps = {
  /** Font-size в px — задаёт и шрифт букв, и размер SVG-маскота. */
  size?: number;
  /** Цикличный автоморф text↔robot. */
  autoCycle?: boolean;
  /** Период цикла, сек. */
  cycleInterval?: number;
  /** Стартовое состояние. */
  startState?: MorphState;
  /** Морф при наведении: на enter морфит в robot и держит hoverHoldMs, потом возвращает. */
  hoverMorph?: boolean;
  /** Сколько держать robot-state после hover'а, мс. По умолчанию 5000. */
  hoverHoldMs?: number;
  /** Задержка автоморфа (после монтирования), сек. */
  startDelay?: number;
  /** Реакция на hover — прыжок радости, прищур. */
  interactive?: boolean;
  /** Сдвиг фаз для живых синусоид (рад.) — чтобы два маскота не были синхронны. */
  phase?: number;
  /** Цвет бренда. Если не задан — «#0259DD». */
  color?: string;
  /** Фон визора в робот-стейте. По умолчанию «#dfe6ff» (синхронно с CSS-токеном). */
  visorBg?: string;
  /** Большой радиус для showcase: маскот замечает курсор издалека. */
  showcaseMode?: boolean;
  /** Скрыть «offi» — показываем только маскот (напр., компактный хедер). */
  hideWordmark?: boolean;
  /** Кликабельный бренд. */
  onClick?: () => void;
  className?: string;
};

// =============================================
// 1. Spring physics — идентично mascot-morph.html
// =============================================
class Spring {
  k: number;
  c: number;
  m: number;
  v: number;
  t: number;
  vel: number;
  constructor({ stiffness = 170, damping = 20, mass = 1, value = 0 }: Partial<{ stiffness: number; damping: number; mass: number; value: number }> = {}) {
    this.k = stiffness;
    this.c = damping;
    this.m = mass;
    this.v = value;
    this.t = value;
    this.vel = 0;
  }
  setTarget(t: number) {
    this.t = t;
  }
  jump(v: number) {
    this.v = v;
    this.t = v;
    this.vel = 0;
  }
  step(dt: number) {
    const steps = Math.max(1, Math.ceil(dt / 0.008));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const f = (this.t - this.v) * this.k - this.vel * this.c;
      this.vel += (f / this.m) * h;
      this.v += this.vel * h;
    }
  }
}

// Состояния «a» (text) и «голова робота» (robot) в общей системе координат.
// viewBox 0×0→100×120: нижний край = бейзлайн текста, x-height ≈ 53.
type Part = {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
};
const L: Record<string, Part> = {
  body:   { x: 20, y: 67,  w: 48, h: 53, rx: 22 },
  border: { x: 28, y: 76,  w: 20, h: 34, rx: 10 },
  screen: { x: 100, y: 110, w: 0.1, h: 0.1, rx: 0 },
  lEye:   { x: 52, y: 67,  w: 16, h: 53, rx: 3 },
  rEye:   { x: 80, y: 67,  w: 16, h: 53, rx: 3 },
  aBall:  { x: 80, y: 44,  w: 16, h: 16, rx: 8 },
  stick:  { x: -6, y: 110, w: 10, h: 10, rx: 5 },
};
const R: Record<string, Part> = {
  body:   { x: 2,  y: 48, w: 96, h: 72, rx: 20 },
  border: { x: 8,  y: 54, w: 84, h: 60, rx: 16 },
  screen: { x: 16, y: 63, w: 68, h: 38, rx: 12 },
  lEye:   { x: 32, y: 73, w: 10, h: 24, rx: 5 },
  rEye:   { x: 58, y: 73, w: 10, h: 24, rx: 5 },
  aBall:  { x: 48, y: 38, w: 4,  h: 12, rx: 2 },
  stick:  { x: 42, y: 30, w: 16, h: 12, rx: 6 },
};
const Z = ["body", "border", "screen", "stick", "lEye", "rEye", "aBall"] as const;
type PartId = (typeof Z)[number];

const DELAYS_TO_ROBOT: Record<PartId, number> = {
  body: 0, border: 110, screen: 170, stick: 230, lEye: 60, rEye: 90, aBall: 150,
};
const DELAYS_TO_TEXT: Record<PartId, number> = {
  body: 180, border: 60, screen: 0, stick: 40, lEye: 140, rEye: 120, aBall: 80,
};
const SPRING_CFG: Record<PartId, { stiffness: number; damping: number }> = {
  body:   { stiffness: 150, damping: 18 },
  border: { stiffness: 180, damping: 22 },
  screen: { stiffness: 200, damping: 24 },
  lEye:   { stiffness: 190, damping: 22 },
  rEye:   { stiffness: 190, damping: 22 },
  aBall:  { stiffness: 210, damping: 20 },
  stick:  { stiffness: 240, damping: 26 },
};

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const easeSin = (t: number) => Math.sin(t * Math.PI);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Цвета по частям: у «a» counter должен быть БЕЛЫМ (дырка в боуле),
// у робота — белый внутренний контур + светло-синий визор. Без этого
// «a» заливается синим полностью и лицо робота пропадает.
type PartColor = { text: string; robot: string };
function partColors(brand: string, visorText: string, visorRobot: string): Record<PartId, PartColor> {
  return {
    body:   { text: brand,      robot: brand },
    border: { text: "#ffffff",  robot: "#ffffff" },
    screen: { text: visorText,  robot: visorRobot },
    lEye:   { text: brand,      robot: brand },
    rEye:   { text: brand,      robot: brand },
    aBall:  { text: brand,      robot: brand },
    stick:  { text: brand,      robot: brand },
  };
}

function hexRGB(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const s = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function interpColor(a: string, b: string, t: number) {
  const A = hexRGB(a);
  const B = hexRGB(b);
  const r = Math.round(A[0] + (B[0] - A[0]) * t);
  const g = Math.round(A[1] + (B[1] - A[1]) * t);
  const bl = Math.round(A[2] + (B[2] - A[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// Веки для «joy» — улыбка прищуром (как в mascot-generator.jsx).
function joyLidProfile(p: number, T: number) {
  let topL = 0, topR = 0, botL = 0, botR = 0;
  const fadeOut = p > 0.65 ? easeInOut((1 - p) / 0.35) : 1;
  if (p < 0.1) {
    const sq = easeInOut(p / 0.1);
    topL = topR = 0.5 * sq;
    botL = botR = 0.5 * sq;
  } else if (p < 0.4) {
    const o = easeOutCubic(Math.min(1, ((p - 0.1) / 0.3) * 3));
    topL = topR = 0.5 * (1 - o);
    botL = botR = 0.42 * fadeOut;
  } else {
    botL = botR = (0.42 + Math.sin(T * 2) * 0.04) * fadeOut;
  }
  return { topL, topR, botL, botR };
}

const JOY_DUR = 2.4;

class PartRect {
  id: PartId;
  el: SVGRectElement;
  springs: {
    x: Spring;
    y: Spring;
    w: Spring;
    h: Spring;
    rx: Spring;
    rot: Spring;
  };
  ox = 0;
  oy = 0;
  sx = 1;
  sy = 1;
  rotateFromBottom = false;

  constructor(svg: SVGSVGElement, id: PartId) {
    this.id = id;
    const cfg = SPRING_CFG[id];
    this.springs = {
      x: new Spring(cfg),
      y: new Spring(cfg),
      w: new Spring(cfg),
      h: new Spring(cfg),
      rx: new Spring(cfg),
      rot: new Spring({ stiffness: 240, damping: 22 }),
    };
    this.el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    svg.appendChild(this.el);
    const t = L[id];
    this.springs.x.jump(t.x);
    this.springs.y.jump(t.y);
    this.springs.w.jump(t.w);
    this.springs.h.jump(t.h);
    this.springs.rx.jump(t.rx);
    this.springs.rot.jump(0);
  }

  setTarget(state: MorphState) {
    const tgt = state === "robot" ? R[this.id] : L[this.id];
    this.springs.x.setTarget(tgt.x);
    this.springs.y.setTarget(tgt.y);
    this.springs.w.setTarget(tgt.w);
    this.springs.h.setTarget(tgt.h);
    this.springs.rx.setTarget(tgt.rx);
  }

  jumpTo(state: MorphState) {
    const tgt = state === "robot" ? R[this.id] : L[this.id];
    this.springs.x.jump(tgt.x);
    this.springs.y.jump(tgt.y);
    this.springs.w.jump(tgt.w);
    this.springs.h.jump(tgt.h);
    this.springs.rx.jump(tgt.rx);
  }

  setRot(deg: number) {
    this.springs.rot.setTarget(deg);
  }

  step(dt: number) {
    for (const s of Object.values(this.springs)) s.step(dt);
  }

  render(fill: string) {
    const s = this.springs;
    const w = Math.max(0.01, s.w.v * this.sx);
    const h = Math.max(0.01, s.h.v * this.sy);
    const cx = s.x.v + s.w.v / 2 + this.ox;
    const cy = s.y.v + s.h.v / 2 + this.oy;
    const x = cx - w / 2;
    const y = cy - h / 2;
    const rx = Math.max(0, Math.min(s.rx.v, w / 2, h / 2));
    this.el.setAttribute("x", x.toFixed(3));
    this.el.setAttribute("y", y.toFixed(3));
    this.el.setAttribute("width", w.toFixed(3));
    this.el.setAttribute("height", h.toFixed(3));
    this.el.setAttribute("rx", rx.toFixed(3));
    this.el.setAttribute("fill", fill);
    const rot = s.rot.v;
    if (Math.abs(rot) > 0.08) {
      const pvx = cx;
      const pvy = this.rotateFromBottom ? y + h : cy;
      this.el.setAttribute("transform", `rotate(${rot.toFixed(2)} ${pvx.toFixed(2)} ${pvy.toFixed(2)})`);
    } else if (this.el.hasAttribute("transform")) {
      this.el.removeAttribute("transform");
    }
  }
}

type MascotInstance = {
  host: HTMLElement;
  svg: SVGSVGElement;
  parts: Record<PartId, PartRect>;
  lids: { lLidTop: SVGRectElement; rLidTop: SVGRectElement; lLidBot: SVGRectElement; rLidBot: SVGRectElement };
  state: MorphState;
  brand: HTMLElement;
  letters: HTMLElement[];
  blinkTimer: number;
  nextBlinkIn: number;
  blinkingAt: number;
  surpriseAt: number;
  cx: number;
  cy: number;
  mx: number;
  my: number;
  proximity: number;
  proximityS: number;
  directHover: number;
  directHoverS: number;
  brandHover: number;
  brandHoverS: number;
  emotionId: string | null;
  emotionAt: number;
  morphAt: number;
  phase: number;
  showcase: boolean;
};

function partBounds(part: PartRect) {
  const s = part.springs;
  const w = Math.max(0.01, s.w.v * part.sx);
  const h = Math.max(0.01, s.h.v * part.sy);
  const cx = s.x.v + s.w.v / 2 + part.ox;
  const cy = s.y.v + s.h.v / 2 + part.oy;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function BrandMorph({
  size = 22,
  autoCycle = false,
  cycleInterval = 5.2,
  startState = "text",
  hoverMorph = false,
  hoverHoldMs = 5000,
  startDelay = 0.9,
  interactive = true,
  phase = 0,
  color,
  visorBg,
  showcaseMode = false,
  hideWordmark = false,
  onClick,
  className,
}: BrandMorphProps) {
  const brandRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLSpanElement>(null);
  const instRef = useRef<MascotInstance | null>(null);

  // Применяем свежие параметры в живой инстанс без пересоздания.
  const optsRef = useRef({ autoCycle, hoverMorph, interactive, showcaseMode, cycleInterval, startDelay, color, visorBg, hoverHoldMs });
  optsRef.current = { autoCycle, hoverMorph, interactive, showcaseMode, cycleInterval, startDelay, color, visorBg, hoverHoldMs };

  useEffect(() => {
    if (!hostRef.current || !brandRef.current) return;
    const brandEl = brandRef.current;
    const hostEl = hostRef.current;

    // -------- build SVG --------
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 120");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Offi mascot");
    svg.style.display = "inline-block";
    svg.style.verticalAlign = "baseline";
    svg.style.overflow = "visible";
    svg.style.willChange = "transform, filter";
    svg.style.transition = "filter .3s ease";
    const fs = size;
    const h = fs * 1.2;
    const w = fs * 1.0;
    svg.style.width = `${w.toFixed(2)}px`;
    svg.style.height = `${h.toFixed(2)}px`;
    svg.style.margin = `0 0 0 ${(fs * 0.18).toFixed(2)}px`;
    hostEl.appendChild(svg);

    const parts = {} as Record<PartId, PartRect>;
    for (const id of Z) parts[id] = new PartRect(svg, id);
    parts.aBall.rotateFromBottom = true;

    const NS = "http://www.w3.org/2000/svg";
    const lids = {
      lLidTop: document.createElementNS(NS, "rect"),
      rLidTop: document.createElementNS(NS, "rect"),
      lLidBot: document.createElementNS(NS, "rect"),
      rLidBot: document.createElementNS(NS, "rect"),
    };
    for (const el of Object.values(lids)) {
      el.setAttribute("fill", optsRef.current.visorBg || "#dfe6ff");
      el.setAttribute("opacity", "0");
      el.setAttribute("rx", "2");
      svg.appendChild(el);
    }

    const letters = Array.from(brandEl.querySelectorAll<HTMLElement>(".bm-letter"));

    const inst: MascotInstance = {
      host: hostEl,
      svg,
      parts,
      lids,
      state: startState,
      brand: brandEl,
      letters,
      blinkTimer: 0,
      nextBlinkIn: 3,
      blinkingAt: -1,
      surpriseAt: -1,
      cx: 0,
      cy: 0,
      mx: 0,
      my: 0,
      proximity: 0,
      proximityS: 0,
      directHover: 0,
      directHoverS: 0,
      brandHover: 0,
      brandHoverS: 0,
      emotionId: null,
      emotionAt: -1,
      morphAt: -99,
      phase,
      showcase: showcaseMode,
    };
    instRef.current = inst;

    // Если стартовое состояние — robot, прыгаем сразу (без анимации).
    if (startState === "robot") {
      for (const id of Z) parts[id].jumpTo("robot");
    }

    // -------- morph + events --------
    function morphTo(state: MorphState) {
      if (inst.state === state) return;
      inst.state = state;
      inst.morphAt = performance.now() / 1000;
      const delays = state === "robot" ? DELAYS_TO_ROBOT : DELAYS_TO_TEXT;
      const PREP = 140;
      for (const id of Z) {
        const p = parts[id];
        const d = (delays[id] || 0) + PREP;
        setTimeout(() => p.setTarget(state), d);
      }
      if (state === "robot") {
        setTimeout(() => {
          parts.stick.springs.y.vel -= 45;
          parts.aBall.springs.y.vel -= 25;
        }, PREP);
      }
    }

    function fireJoy() {
      if (inst.emotionId) return;
      inst.emotionId = "joy";
      inst.emotionAt = performance.now() / 1000;
    }

    function fireSurprise() {
      const now = performance.now() / 1000;
      if (inst.surpriseAt < 0 || now - inst.surpriseAt > 0.6) {
        inst.surpriseAt = now;
        parts.stick.springs.y.vel -= 25;
        parts.stick.springs.x.vel += (Math.random() - 0.5) * 30;
        parts.aBall.springs.x.vel += (Math.random() - 0.5) * 15;
      }
    }

    // Hover-hold: при наведении — морф в robot и удерживаем robot-state на
    // hoverHoldMs, независимо от того, ушёл курсор или нет. Новый hover в этот
    // промежуток — перезапускает таймер (даём пользователю ещё 5 секунд).
    let hoverRevertTimer: number | null = null;
    const clearHoverTimer = () => {
      if (hoverRevertTimer !== null) {
        window.clearTimeout(hoverRevertTimer);
        hoverRevertTimer = null;
      }
    };
    const onEnter = () => {
      inst.brandHover = 1;
      if (optsRef.current.hoverMorph) {
        morphTo("robot");
        clearHoverTimer();
        hoverRevertTimer = window.setTimeout(() => {
          morphTo("text");
          hoverRevertTimer = null;
        }, optsRef.current.hoverHoldMs);
      }
      if (optsRef.current.interactive) {
        fireSurprise();
        fireJoy();
      }
    };
    const onLeave = () => {
      inst.brandHover = 0;
      // Специально НЕ морфим обратно — держим robot hoverHoldMs.
    };
    const onSvgEnter = () => {
      inst.directHover = 1;
      if (optsRef.current.interactive) {
        fireSurprise();
        fireJoy();
      }
    };
    const onSvgLeave = () => {
      inst.directHover = 0;
    };
    const onMove = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect();
      inst.cx = r.left + r.width / 2;
      inst.cy = r.top + r.height / 2;
      const dx = e.clientX - inst.cx;
      const dy = e.clientY - inst.cy;
      inst.mx = clamp(dx / 260, -1, 1);
      inst.my = clamp(dy / 260, -1, 1);
      const radius = optsRef.current.showcaseMode ? 420 : 220;
      const dist = Math.sqrt(dx * dx + dy * dy);
      inst.proximity = clamp(1 - dist / radius, 0, 1);
    };

    brandEl.addEventListener("pointerenter", onEnter);
    brandEl.addEventListener("pointerleave", onLeave);
    svg.addEventListener("pointerenter", onSvgEnter);
    svg.addEventListener("pointerleave", onSvgLeave);
    window.addEventListener("pointermove", onMove);

    // -------- auto morph --------
    let autoStartAt = performance.now() / 1000 + (optsRef.current.startDelay || 0.9);
    let autoNext = autoStartAt;

    // -------- loop --------
    let lastT = 0;
    let rafId = 0;
    const loop = (ts: number) => {
      if (!lastT) lastT = ts;
      let dt = (ts - lastT) / 1000;
      if (dt > 0.05) dt = 0.05;
      lastT = ts;
      const T = ts / 1000;

      if (optsRef.current.autoCycle) {
        if (T >= autoStartAt && autoStartAt > 0) {
          morphTo(inst.state === "text" ? "robot" : "text");
          autoNext = T + (optsRef.current.cycleInterval || 5.2);
          autoStartAt = 0;
        } else if (T >= autoNext && autoStartAt === 0) {
          morphTo(inst.state === "text" ? "robot" : "text");
          autoNext = T + (optsRef.current.cycleInterval || 5.2);
        }
      }

      const smooth = 1 - Math.exp(-dt * 8);
      inst.proximityS += (inst.proximity - inst.proximityS) * smooth;
      inst.directHoverS += (inst.directHover - inst.directHoverS) * smooth;
      inst.brandHoverS += (inst.brandHover - inst.brandHoverS) * (1 - Math.exp(-dt * 6));

      const rness = clamp((inst.state === "robot" ? 1 : 0), 0, 1) * 0 + clamp(progressToRobot(inst), 0, 1);
      const excite = optsRef.current.interactive
        ? clamp(inst.proximityS * 0.7 + inst.directHoverS * 1.1, 0, 1.2)
        : 0;

      const TP = T + inst.phase;
      const breath = Math.sin(TP * (1.6 + excite * 0.6)) * (0.02 + excite * 0.015) * rness;
      const floatAmp = 2.0 + excite * 1.8;
      const float = Math.sin(TP * 1.15 + 0.3) * floatAmp * rness;
      const swayFreq = 0.85 + excite * 0.3;
      const swayAmp = 1.3 + excite * 1.7;
      const sway = Math.sin(TP * swayFreq) * swayAmp * rness;
      const textWobble = (1 - rness) * Math.sin(TP * 0.9) * (0.35 + excite * 0.5);
      const textDotPulse = (1 - rness) * (1 + Math.sin(TP * 1.6) * 0.08 + excite * 0.12);

      // blinking
      inst.blinkTimer += dt;
      if (inst.state === "robot" && rness > 0.8) {
        const interval = Math.max(1.2, inst.nextBlinkIn - excite * 1.2);
        if (inst.blinkTimer > interval) {
          inst.blinkingAt = T;
          inst.blinkTimer = 0;
          inst.nextBlinkIn = 2.6 + Math.random() * 2.2;
        }
      }
      const blinkDur = 0.16;
      let blink = 0;
      if (inst.blinkingAt >= 0) {
        const bt = T - inst.blinkingAt;
        if (bt < blinkDur) blink = easeSin(bt / blinkDur);
        else inst.blinkingAt = -1;
      }

      // surprise kick
      let surpriseAmt = 0;
      if (inst.surpriseAt >= 0) {
        const st = T - inst.surpriseAt;
        if (st < 0.55) surpriseAmt = 1 - easeOutCubic(st / 0.55);
        else inst.surpriseAt = -1;
      }

      // emotion body effects (joy)
      let bodyOffY = 0,
        bodyOffX = 0,
        bodySx = 1,
        bodySy = 1;
      if (inst.emotionId === "joy") {
        const p = (T - inst.emotionAt) / JOY_DUR;
        if (p >= 1) {
          inst.emotionId = null;
          inst.emotionAt = -1;
        } else if (rness >= 0.45) {
          if (p < 0.1) {
            const sq = easeInOut(p / 0.1);
            bodySx = 1 + sq * 0.035;
            bodySy = 1 - sq * 0.035;
          } else if (p < 0.42) {
            const jt = (p - 0.1) / 0.32;
            bodyOffY = -Math.sin(jt * Math.PI) * 3.5;
            const s2 = Math.sin(jt * Math.PI) * 0.028;
            bodySx = 1 - s2;
            bodySy = 1 + s2;
          } else if (p < 0.55) {
            const lt = (p - 0.42) / 0.13;
            const sq = lt < 0.5 ? easeInOut(lt * 2) : easeInOut((1 - lt) * 2);
            bodySx = 1 + sq * 0.025;
            bodySy = 1 - sq * 0.025;
          }
        }
      }

      // eye tracking
      const look = rness;
      const jitterX = Math.sin(TP * 2.1) * 0.25 * look * (1 + excite);
      const jitterY = Math.sin(TP * 1.7 + 1.3) * 0.18 * look * (1 + excite);
      const lookX = (inst.mx * (3.0 + excite * 1.8) + jitterX) * look;
      const lookY = (inst.my * (1.8 + excite * 1.2) + jitterY) * look;

      // whole-svg transform
      const tiltX = inst.mx * (2 + excite * 2.5) * look;
      const tiltY = inst.my * (1.2 + excite * 2) * look;
      const scaleUp = 1 + excite * 0.02 * rness + inst.directHoverS * 0.015;
      const totalSx = scaleUp * bodySx;
      const totalSy = scaleUp * bodySy;
      svg.style.transform =
        `translate(${(tiltX + bodyOffX).toFixed(2)}px, ${(tiltY + bodyOffY).toFixed(2)}px) ` +
        `scale(${totalSx.toFixed(3)}, ${totalSy.toFixed(3)})`;
      svg.style.filter = inst.directHoverS > 0.05
        ? `drop-shadow(0 ${(4 + inst.directHoverS * 8).toFixed(1)}px ${(10 + inst.directHoverS * 20).toFixed(1)}px rgba(26,86,255,${(0.1 + inst.directHoverS * 0.18).toFixed(3)}))`
        : "none";

      const P = inst.parts;
      P.body.ox = 0;
      P.body.oy = float + textWobble;
      P.body.sx = 1 + excite * 0.02;
      P.body.sy = 1 + breath + excite * 0.02;

      P.border.ox = 0;
      P.border.oy = float;
      P.border.sx = 1 + excite * 0.015;
      P.border.sy = 1 + breath + excite * 0.015;

      P.screen.ox = 0;
      P.screen.oy = float;
      P.screen.sx = 1 + excite * 0.01;
      P.screen.sy = 1 + breath;

      const eyeScale = 1 + surpriseAmt * 0.12 + excite * 0.04 * rness;
      P.lEye.ox = lookX;
      P.lEye.oy = lookY + float - surpriseAmt * 1.2;
      P.lEye.sx = eyeScale;
      P.lEye.sy = eyeScale;
      P.rEye.ox = lookX;
      P.rEye.oy = lookY + float - surpriseAmt * 1.2;
      P.rEye.sx = eyeScale;
      P.rEye.sy = eyeScale;

      const stemLen = R.aBall.h;
      const stemAngleDeg = rness * (Math.atan2(sway, stemLen) * 180) / Math.PI;
      P.aBall.springs.rot.setTarget(stemAngleDeg);
      P.aBall.ox = 0;
      P.aBall.oy = float;
      const stemPulse = (1 - rness) * (1 + Math.sin(TP * 1.9) * 0.09 + excite * 0.15);
      P.aBall.sx = (1 - rness) * stemPulse + rness * 1;
      P.aBall.sy = (1 - rness) * stemPulse + rness * 1;

      const ballSway = sway * rness;
      P.stick.ox = ballSway;
      P.stick.oy = float - surpriseAmt * 2.5;
      P.stick.sx = (1 - rness) * textDotPulse + rness * (1 + Math.abs(sway) * 0.012);
      P.stick.sy = (1 - rness) * textDotPulse + rness * (1 + Math.abs(sway) * 0.012);

      // step + render (цвет частей интерполируется text↔robot по rness)
      const brandColor = optsRef.current.color || "#0259DD";
      const visorRobot = optsRef.current.visorBg || "#dfe6ff";
      const visorText = "#e7edff"; // ближе к фону — в тексте почти невидим
      const colors = partColors(brandColor, visorText, visorRobot);
      for (const id of Z) {
        P[id].step(dt);
        const c = colors[id];
        const fill = c.text === c.robot ? c.text : interpColor(c.text, c.robot, rness);
        P[id].render(fill);
      }

      // lids (joy + blink)
      updateLids(inst, T, rness, blink);

      // letters animation
      animateLetters(inst, T);

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      clearHoverTimer();
      brandEl.removeEventListener("pointerenter", onEnter);
      brandEl.removeEventListener("pointerleave", onLeave);
      svg.removeEventListener("pointerenter", onSvgEnter);
      svg.removeEventListener("pointerleave", onSvgLeave);
      window.removeEventListener("pointermove", onMove);
      if (svg.parentElement) svg.parentElement.removeChild(svg);
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, phase, startState]);

  return (
    <div
      ref={brandRef}
      onClick={onClick}
      className={cn(
        "inline-flex items-baseline font-extrabold tracking-[-0.045em] text-foreground select-none whitespace-nowrap leading-[1.2]",
        onClick && "cursor-pointer",
        className
      )}
      style={{ fontSize: size }}
    >
      {!hideWordmark && (
        <span className="inline-block leading-[inherit]">
          {["o", "f", "f", "i"].map((l, i) => (
            <span
              key={i}
              className="bm-letter inline-block will-change-transform"
              style={{
                transformOrigin: "50% 100%",
                transition: "transform 0s",
              }}
            >
              {l}
            </span>
          ))}
        </span>
      )}
      <span
        ref={hostRef}
        className="inline-flex items-baseline relative leading-[inherit]"
      />
    </div>
  );
}

// progressToRobot: 0..1 — насколько body ушёл в robot-позицию (через основной Y-spring body).
function progressToRobot(inst: MascotInstance) {
  const by = inst.parts.body.springs.y.v;
  const L_y = L.body.y;
  const R_y = R.body.y;
  if (Math.abs(L_y - R_y) < 0.01) return inst.state === "robot" ? 1 : 0;
  return clamp((L_y - by) / (L_y - R_y), 0, 1);
}

function updateLids(inst: MascotInstance, T: number, rness: number, blinkV: number) {
  let topL = 0,
    topR = 0,
    botL = 0,
    botR = 0;
  if (inst.emotionId === "joy") {
    const p = (T - inst.emotionAt) / JOY_DUR;
    if (p >= 0 && p < 1) {
      const lp = joyLidProfile(p, T);
      topL = lp.topL;
      topR = lp.topR;
      botL = lp.botL;
      botR = lp.botR;
    }
  }
  topL = Math.min(1, Math.max(topL, blinkV));
  topR = Math.min(1, Math.max(topR, blinkV));
  botL = Math.min(1, Math.max(botL, blinkV * 0.25));
  botR = Math.min(1, Math.max(botR, blinkV * 0.25));

  const lb = partBounds(inst.parts.lEye);
  const rb = partBounds(inst.parts.rEye);
  const PAD = 0.8;
  const op = Math.max(0, Math.min(1, rness));

  const set = (el: SVGRectElement, x: number, y: number, w: number, h: number) => {
    el.setAttribute("x", x.toFixed(2));
    el.setAttribute("y", y.toFixed(2));
    el.setAttribute("width", Math.max(0.01, w).toFixed(2));
    el.setAttribute("height", Math.max(0.01, h).toFixed(2));
    el.setAttribute("opacity", op.toFixed(3));
  };

  set(inst.lids.lLidTop, lb.x - PAD, lb.y, lb.w + PAD * 2, topL * lb.h);
  set(inst.lids.rLidTop, rb.x - PAD, rb.y, rb.w + PAD * 2, topR * rb.h);
  set(inst.lids.lLidBot, lb.x - PAD, lb.y + lb.h - botL * lb.h, lb.w + PAD * 2, botL * lb.h);
  set(inst.lids.rLidBot, rb.x - PAD, rb.y + rb.h - botR * rb.h, rb.w + PAD * 2, botR * rb.h);
}

function animateLetters(inst: MascotInstance, T: number) {
  if (!inst.letters.length) return;
  const sinceMorph = T - inst.morphAt;
  inst.letters.forEach((letter, i) => {
    const stagger = i * 0.055;
    const tLocal = sinceMorph - stagger;

    let y = 0, rot = 0, sx = 1, sy = 1;
    if (tLocal > 0 && tLocal < 0.9) {
      if (tLocal < 0.12) {
        const p = tLocal / 0.12;
        const sq = easeInOut(p);
        sy = 1 - 0.14 * sq;
        sx = 1 + 0.08 * sq;
        y = 0.6 * sq;
      } else if (tLocal < 0.48) {
        const p = (tLocal - 0.12) / 0.36;
        const arc = Math.sin(p * Math.PI);
        y = -arc * 16;
        sy = 1 + arc * 0.08;
        sx = 1 - arc * 0.04;
        rot = Math.sin(p * Math.PI * 2) * 1.5;
      } else {
        const p = (tLocal - 0.48) / 0.42;
        const wiggle = Math.sin(p * Math.PI * 2.2) * (1 - p) * (1 - p);
        y = wiggle * 2.5;
        sy = 1 - wiggle * 0.05;
        sx = 1 + wiggle * 0.03;
      }
    }

    if (inst.brandHoverS > 0.01) {
      const k = inst.brandHoverS;
      const ph = i * 1.3 + inst.phase;
      const f1 = 3.2 + i * 0.35;
      const f2 = 5.1 + i * 0.5;
      y += (Math.sin(T * f1 + ph) * 0.55 + Math.sin(T * f2 + ph * 0.7) * 0.3) * k;
      rot += (Math.sin(T * (f1 - 0.6) + ph) * 1.4 + Math.sin(T * (f2 - 1.1) + ph * 1.1) * 0.7) * k;
      sy += Math.sin(T * 3.4 + ph) * 0.012 * k;
      sx -= Math.sin(T * 3.4 + ph) * 0.008 * k;
    }

    letter.style.transform =
      `translateY(${y.toFixed(2)}%) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  });
}
