"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useAnimClock } from "./anim-clock";
import type {
  HeadShape,
  AntennaStyle,
  EarStyle,
  MascotEmotion,
  MascotOneshot,
} from "./types";
import { ONESHOT_META } from "./types";

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutElastic = (t: number) =>
  t === 0 || t === 1
    ? t
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const squashStretch = (t: number, f: number, i = 0.01) => ({
  sx: 1 + Math.sin(t * f) * i,
  sy: 1 - Math.sin(t * f) * i,
});

const envelope = (p: number, fadeIn = 0.15, fadeOut = 0.3) => {
  if (p < fadeIn) return easeInOut(p / fadeIn);
  if (p > 1 - fadeOut) return easeInOut((1 - p) / fadeOut);
  return 1;
};

function smoothStep(t: number, speed: number) {
  const r = (t * speed) % 1;
  if (r < 0.1) return easeInOut(r / 0.1);
  if (r < 0.5) return 1;
  if (r < 0.6) return 1 - easeInOut((r - 0.5) / 0.1);
  return 0;
}
function smoothLook(t: number, speed: number, amp: number) {
  return (
    ((smoothStep(t, speed) * 2 - 1) * 0.5 +
      (smoothStep(t + 0.4, speed * 0.67) * 2 - 1) * 0.35 +
      Math.sin(t * speed * 0.31) * 0.15) *
    amp
  );
}

export type RobotMascotProps = {
  color: string;
  bg: string;
  headShape: HeadShape;
  antenna: AntennaStyle;
  ears: EarStyle;
  emotion?: MascotEmotion;
  /** Fires a one-shot emotion; changing value retriggers. */
  oneshotKey?: number;
  oneshotId?: MascotOneshot | null;
  size?: number;
  /** When false, skip the animation loop (useful for static previews). */
  animated?: boolean;
  className?: string;
};

export function RobotMascot({
  color,
  bg,
  headShape,
  antenna,
  ears,
  emotion = "idle",
  oneshotKey,
  oneshotId,
  size = 200,
  animated = true,
  className,
}: RobotMascotProps) {
  const { progress, currentOneshot } = useLocalOneshot(oneshotKey, oneshotId);
  // В статичной позе показываем нейтральный «смотрит прямо» кадр — t=0.
  // Одноразовые эмоции (oneshot) играем всегда, даже в статичном маскоте.
  const t = useAnimClock(animated);

  const sw = Math.max(1.6, size * 0.0275);
  const cx = size / 2;
  const cy = size / 2;
  const hs = 0.9;

  const head = useMemo(() => {
    const b = { x: cx, y: cy };
    switch (headShape) {
      case "soft":
        return { ...b, w: size * 0.37 * hs, h: size * 0.28 * hs, rx: size * 0.14 * hs };
      case "wide":
        return { ...b, w: size * 0.44 * hs, h: size * 0.24 * hs, rx: size * 0.1 * hs };
      case "tall":
        return { ...b, w: size * 0.31 * hs, h: size * 0.34 * hs, rx: size * 0.1 * hs };
      case "capsule":
        return { ...b, w: size * 0.33 * hs, h: size * 0.3 * hs, rx: size * 0.17 * hs };
      default:
        return { ...b, w: size * 0.37 * hs, h: size * 0.27 * hs, rx: size * 0.1 * hs };
    }
  }, [headShape, size, cx, cy]);

  const visor = {
    w: head.w * 0.84,
    h: head.h * 0.75,
    rx: Math.max(head.rx * 0.55, size * 0.03),
  };
  const origVW = (head.w / hs) * 0.84;
  const origVH = (head.h / hs) * 0.75;
  const baseEyeW = origVW * 0.226;
  const baseEyeH = origVH * 0.924;
  const eyeSpacing = origVW * 0.3;
  const eyeY = head.y - visor.h * 0.06;

  const ae: MascotEmotion = (currentOneshot as MascotEmotion) || emotion;
  let eyeScale = 1;
  if (ae === "working") eyeScale = 1.0 + Math.sin(t * 2) * 0.02;
  if (ae === "surprise") eyeScale = 1.22;
  if (ae === "love") eyeScale = 1.08;
  if (ae === "angry") eyeScale = 1.12;
  const eyeW = baseEyeW * eyeScale;
  const eyeH = baseEyeH * eyeScale;

  const ss = squashStretch(t, 1.8, 0.015);
  const breathe = Math.sin(t * 0.9 * Math.PI * 2) * size * 0.007;
  const antLag = Math.sin(t * 1.8 - 0.4) * size * 0.006;
  const antTip = Math.sin(t * 3.2) * size * 0.005;

  let bodyOffY = 0;
  let bodySx = 1;
  let bodySy = 1;
  if (currentOneshot === "joy" && progress !== null) {
    const p = progress;
    if (p < 0.1) {
      const sq = easeInOut(p / 0.1);
      bodySx = 1 + sq * 0.05;
      bodySy = 1 - sq * 0.05;
    } else if (p < 0.4) {
      const jt = (p - 0.1) / 0.3;
      bodyOffY = Math.sin(jt * Math.PI) * size * 0.055;
      const s2 = Math.sin(jt * Math.PI) * 0.04;
      bodySx = 1 - s2;
      bodySy = 1 + s2;
    } else if (p < 0.52) {
      const lt = (p - 0.4) / 0.12;
      const sq = lt < 0.5 ? easeInOut(lt * 2) : easeInOut((1 - lt) * 2);
      bodySx = 1 + sq * 0.05;
      bodySy = 1 - sq * 0.05;
    } else if (p < 0.7) {
      bodyOffY = Math.sin(((p - 0.52) / 0.18) * Math.PI) * size * 0.008;
    }
  }
  if (currentOneshot === "sadness" && progress !== null) {
    const i = envelope(progress, 0.2, 0.35);
    bodyOffY = -size * 0.012 * i;
  }
  if (currentOneshot === "surprise" && progress !== null) {
    const p = progress;
    if (p < 0.1) bodyOffY = easeOutCubic(p / 0.1) * size * 0.025;
    else if (p < 0.3) bodyOffY = size * 0.025 * (1 - easeOutElastic((p - 0.1) / 0.2));
  }
  if (currentOneshot === "angry" && progress !== null) {
    const i = envelope(progress, 0.1, 0.35);
    if (progress < 0.3) {
      const shake = Math.sin(progress * 80) * size * 0.005 * (1 - progress / 0.3) * i;
      bodySx += shake * 0.001;
    }
  }

  const totalSx = ss.sx * bodySx;
  const totalSy = ss.sy * bodySy;
  const antBaseY = head.y - head.h + sw * 0.3;
  const antTopY = head.y - head.h - size * 0.07;
  const antStemY = antTopY + size * 0.02;
  const earOff = head.w + sw;
  const earX = ears !== "none" ? size * 0.08 : 0;
  const antH = antenna !== "none" ? size * 0.1 : 0;
  const fS =
    (Math.max(
      (head.w + earX + sw * 2) * 2,
      (head.h + antH + sw * 2) * 2 + size * 0.025
    ) *
      1.06) /
    2 *
    2;
  const fCx = head.x;
  const fCy =
    (head.y - head.h - antH - sw * 2 + head.y + head.h + sw * 2 + size * 0.025) / 2;
  const vb = `${fCx - fS / 2} ${fCy - fS / 2} ${fS} ${fS}`;

  const uid = useMemo(() => Math.random().toString(36).slice(2, 8), []);
  const visorBg = bg || "#EEF4FF";

  return (
    <svg
      width={size}
      height={size}
      viewBox={vb}
      className={className}
      style={{ overflow: "visible", display: "block" }}
      aria-hidden
    >
      <defs>
        <clipPath id={`vc-${uid}`}>
          <rect
            x={head.x - visor.w}
            y={head.y - visor.h}
            width={visor.w * 2}
            height={visor.h * 2}
            rx={visor.rx}
          />
        </clipPath>
      </defs>
      <g
        transform={`translate(${head.x},${head.y}) scale(${totalSx},${totalSy}) translate(${-head.x},${-head.y + breathe - bodyOffY})`}
      >
        <ellipse
          cx={head.x}
          cy={head.y + head.h + size * 0.025}
          rx={head.w * 0.4}
          ry={size * 0.006}
          fill={color}
          opacity="0.1"
        />

        {antenna !== "none" && (
          <g transform={`translate(${antLag},0)`}>
            {antenna !== "bent" && antenna !== "bolt" && (
              <line
                x1={cx}
                y1={antBaseY}
                x2={cx + antTip}
                y2={antStemY}
                stroke={color}
                strokeWidth={sw * 1.2}
                strokeLinecap="round"
              />
            )}
            {antenna === "bent" && (
              <polyline
                points={`${cx},${antBaseY} ${cx},${antTopY + size * 0.015} ${cx + size * 0.04},${antTopY + size * 0.015}`}
                fill="none"
                stroke={color}
                strokeWidth={sw * 1.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {antenna === "bolt" && (
              <polyline
                points={`${cx},${antBaseY} ${cx + size * 0.015},${antTopY + size * 0.025} ${cx - size * 0.008},${antTopY + size * 0.012} ${cx + size * 0.012},${antTopY - size * 0.005}`}
                fill="none"
                stroke={color}
                strokeWidth={sw * 1.1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            <g transform={`translate(${antTip * 1.5},0)`}>
              {antenna === "ball" && <circle cx={cx} cy={antTopY} r={size * 0.028} fill={color} />}
              {antenna === "pill" && (
                <rect
                  x={cx - size * 0.028}
                  y={antTopY - size * 0.017}
                  width={size * 0.056}
                  height={size * 0.034}
                  rx={size * 0.017}
                  fill={color}
                />
              )}
              {antenna === "dot" && (
                <circle cx={cx} cy={antTopY + size * 0.01} r={size * 0.014} fill={color} />
              )}
              {antenna === "ring" && (
                <circle
                  cx={cx}
                  cy={antTopY}
                  r={size * 0.022}
                  fill="white"
                  stroke={color}
                  strokeWidth={sw * 1.25}
                />
              )}
              {antenna === "bent" && (
                <circle
                  cx={cx + size * 0.04}
                  cy={antTopY + size * 0.015}
                  r={size * 0.015}
                  fill={color}
                />
              )}
            </g>
          </g>
        )}

        {ears !== "none" && (
          <g transform={`translate(0,${Math.sin(t * 1.8 - 0.6) * size * 0.002})`}>
            <Ear x={head.x - earOff} y={head.y} es={ears} size={size} color={color} sw={sw} side="left" />
            <Ear x={head.x + earOff} y={head.y} es={ears} size={size} color={color} sw={sw} side="right" />
          </g>
        )}

        <rect
          x={head.x - head.w}
          y={head.y - head.h}
          width={head.w * 2}
          height={head.h * 2}
          rx={head.rx}
          fill="white"
          stroke={color}
          strokeWidth={sw * 1.5}
          strokeLinejoin="round"
        />

        <rect
          x={head.x - visor.w}
          y={head.y - visor.h}
          width={visor.w * 2}
          height={visor.h * 2}
          rx={visor.rx}
          fill={visorBg}
        />
        <rect
          x={head.x - visor.w}
          y={head.y - visor.h}
          width={visor.w * 2}
          height={visor.h * 2}
          rx={visor.rx}
          fill={color}
          opacity="0.06"
        />

        <g clipPath={`url(#vc-${uid})`}>
          <EyesLids
            emotion={ae}
            oneshotProgress={progress}
            t={t}
            animated={animated}
            cx={cx}
            eyeY={eyeY}
            spacing={eyeSpacing}
            eyeW={eyeW}
            eyeH={eyeH}
            color={color}
            visorBg={visorBg}
          />
        </g>
      </g>
    </svg>
  );
}

function Ear({
  x,
  y,
  es,
  size,
  color,
  sw,
  side,
}: {
  x: number;
  y: number;
  es: EarStyle;
  size: number;
  color: string;
  sw: number;
  side: "left" | "right";
}) {
  const d = side === "right" ? 1 : -1;
  const s = size * 0.052;
  if (es === "round")
    return (
      <g>
        <line
          x1={x}
          y1={y}
          x2={x + d * s * 0.4}
          y2={y}
          stroke={color}
          strokeWidth={sw * 1.15}
          strokeLinecap="round"
        />
        <rect
          x={side === "right" ? x + s * 0.25 : x - s * 1.25}
          y={y - s * 0.7}
          width={s}
          height={s * 1.4}
          rx={s * 0.5}
          fill="white"
          stroke={color}
          strokeWidth={sw * 1.15}
        />
      </g>
    );
  if (es === "rect")
    return (
      <g>
        <line
          x1={x}
          y1={y}
          x2={x + d * s * 0.3}
          y2={y}
          stroke={color}
          strokeWidth={sw * 1.15}
          strokeLinecap="round"
        />
        <rect
          x={side === "right" ? x + s * 0.15 : x - s * 1.15}
          y={y - s * 0.6}
          width={s}
          height={s * 1.2}
          rx={s * 0.16}
          fill="white"
          stroke={color}
          strokeWidth={sw * 1.15}
        />
      </g>
    );
  if (es === "small") return <circle cx={x + d * s * 0.35} cy={y} r={s * 0.38} fill={color} />;
  return null;
}

function EyesLids({
  emotion,
  oneshotProgress,
  t,
  animated,
  cx,
  eyeY,
  spacing,
  eyeW,
  eyeH,
  color,
  visorBg,
}: {
  emotion: MascotEmotion;
  oneshotProgress: number | null;
  t: number;
  animated: boolean;
  cx: number;
  eyeY: number;
  spacing: number;
  eyeW: number;
  eyeH: number;
  color: string;
  visorBg: string;
}) {
  const lx = cx - spacing;
  const rx = cx + spacing;
  const bP = 3.8;
  const bp = (t % bP) / bP;
  let blink = 0;
  if (animated && bp > 0.91) {
    const lt = (bp - 0.91) / 0.09;
    blink = lt < 0.5 ? easeInOut(lt * 2) : easeInOut((1 - lt) * 2);
  }
  if (animated && Math.floor(t / bP) % 4 === 0) {
    const b2 = ((t + bP * 0.12) % bP) / bP;
    if (b2 > 0.91) {
      const lt2 = (b2 - 0.91) / 0.09;
      blink = Math.max(blink, lt2 < 0.5 ? easeInOut(lt2 * 2) : easeInOut((1 - lt2) * 2));
    }
  }

  let eyeOffX = 0;
  let eyeOffY = 0;
  let topL = 0;
  let topR = 0;
  let botL = 0;
  let botR = 0;

  switch (emotion) {
    case "idle":
      if (animated) {
        eyeOffX = Math.sin(t * 0.3) * eyeW * 0.07;
        eyeOffY = Math.sin(t * 0.22 + 1.2) * eyeH * 0.035;
      }
      break;

    case "working": {
      // Даже в статике показываем «концентрированный прищур» — это отличает
      // working от idle без движения.
      topL = 0.18;
      topR = 0.18;
      botL = 0.06;
      botR = 0.06;
      if (animated) {
        eyeOffX = smoothLook(t, 1.0, eyeW * 0.75);
        eyeOffY = smoothLook(t + 5.3, 0.65, eyeH * 0.14);
        const rc = 6.0;
        const rp = (t % rc) / rc;
        if (rp > 0.35 && rp < 0.6) {
          const ri =
            rp < 0.42
              ? easeInOut((rp - 0.35) / 0.07)
              : rp > 0.52
              ? easeInOut((0.6 - rp) / 0.08)
              : 1;
          topL += ri * 0.22;
          topR = Math.max(0, topR - ri * 0.1);
        }
      }
      break;
    }

    case "joy": {
      const p = oneshotProgress ?? 0;
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
        botL = botR = (0.42 + Math.sin(t * 2) * 0.04) * fadeOut;
      }
      break;
    }

    case "sadness": {
      const i = envelope(oneshotProgress ?? 0, 0.15, 0.35);
      topL = topR = 0.35 * i;
      eyeOffY = eyeH * 0.12 * i;
      eyeOffX = Math.sin(t * 0.2) * eyeW * 0.03 * i;
      break;
    }

    case "pensive": {
      const i = envelope(oneshotProgress ?? 0, 0.15, 0.3);
      eyeOffX = (eyeW * 0.4 + Math.sin(t * 0.4) * eyeW * 0.08) * i;
      eyeOffY = -eyeH * 0.15 * i;
      topL = topR = 0.2 * i;
      break;
    }

    case "surprise": {
      const i = envelope(oneshotProgress ?? 0, 0.08, 0.4);
      eyeOffY = -eyeH * 0.06 * i;
      break;
    }

    case "angry": {
      const i = envelope(oneshotProgress ?? 0, 0.12, 0.35);
      topL = 0.38 * i;
      topR = 0.38 * i;
      eyeOffY = eyeH * 0.05 * i;
      break;
    }

    case "sleepy": {
      const i = envelope(oneshotProgress ?? 0, 0.2, 0.3);
      topL = topR = (0.62 + Math.sin(t * 0.8) * 0.08) * i;
      botL = botR = 0.12 * i;
      eyeOffY = eyeH * 0.04 * i;
      break;
    }

    case "love": {
      const i = envelope(oneshotProgress ?? 0, 0.12, 0.3);
      botL = botR = 0.38 * i;
      topL = topR = 0.1 * i;
      eyeOffY = -eyeH * 0.05 * i;
      break;
    }

    case "wink": {
      const p = oneshotProgress ?? 0;
      let w = 0;
      if (p < 0.1) w = easeInOut(p / 0.1);
      else if (p < 0.3) w = 1;
      else if (p < 0.5) w = easeInOut((0.5 - p) / 0.2);
      topR = 0.88 * w;
      botR = 0.08 * w;
      break;
    }
  }

  const fTL = Math.min(1, Math.max(topL, blink));
  const fTR = Math.min(1, Math.max(topR, blink));
  const fBL = Math.min(1, Math.max(botL, blink * 0.25));
  const fBR = Math.min(1, Math.max(botR, blink * 0.25));
  const lo = eyeW * 0.1;
  const lh = eyeH * 1.5;

  let angryAngleL = 0;
  let angryAngleR = 0;
  if (emotion === "angry") {
    const i = envelope(oneshotProgress ?? 0, 0.12, 0.35);
    angryAngleL = 14 * i;
    angryAngleR = -14 * i;
  }

  const Lid = ({
    x: lx2,
    y: ly,
    w,
    h,
    angle = 0,
    pivotX = 0,
    pivotY = 0,
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    angle?: number;
    pivotX?: number;
    pivotY?: number;
  }) => (
    <g transform={angle ? `rotate(${angle}, ${pivotX}, ${pivotY})` : undefined}>
      <rect x={lx2} y={ly} width={w} height={h} fill={visorBg} />
      <rect x={lx2} y={ly} width={w} height={h} fill={color} opacity="0.06" />
    </g>
  );

  return (
    <g>
      <rect
        x={lx - eyeW / 2 + eyeOffX}
        y={eyeY - eyeH / 2 + eyeOffY}
        width={eyeW}
        height={eyeH}
        rx={eyeW / 2}
        fill={color}
      />
      <rect
        x={rx - eyeW / 2 + eyeOffX}
        y={eyeY - eyeH / 2 + eyeOffY}
        width={eyeW}
        height={eyeH}
        rx={eyeW / 2}
        fill={color}
      />
      <Lid
        x={lx - eyeW / 2 - lo + eyeOffX}
        y={eyeY - eyeH / 2 - lh + fTL * eyeH + eyeOffY}
        w={eyeW + lo * 2}
        h={lh}
        angle={angryAngleL}
        pivotX={lx + eyeOffX}
        pivotY={eyeY - eyeH / 2 + eyeOffY}
      />
      <Lid
        x={rx - eyeW / 2 - lo + eyeOffX}
        y={eyeY - eyeH / 2 - lh + fTR * eyeH + eyeOffY}
        w={eyeW + lo * 2}
        h={lh}
        angle={angryAngleR}
        pivotX={rx + eyeOffX}
        pivotY={eyeY - eyeH / 2 + eyeOffY}
      />
      <Lid
        x={lx - eyeW / 2 - lo + eyeOffX}
        y={eyeY + eyeH / 2 - fBL * eyeH + eyeOffY}
        w={eyeW + lo * 2}
        h={lh}
      />
      <Lid
        x={rx - eyeW / 2 - lo + eyeOffX}
        y={eyeY + eyeH / 2 - fBR * eyeH + eyeOffY}
        w={eyeW + lo * 2}
        h={lh}
      />
    </g>
  );
}

function useLocalOneshot(oneshotKey?: number, oneshotId?: MascotOneshot | null) {
  const [progress, setProgress] = useState<number | null>(null);
  const [currentOneshot, setCurrentOneshot] = useState<MascotOneshot | null>(null);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const keyRef = useRef<number | undefined>(undefined);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
    setProgress(null);
    setCurrentOneshot(null);
  }, []);

  useEffect(() => {
    if (oneshotKey === undefined || !oneshotId) return;
    if (keyRef.current === oneshotKey) return;
    keyRef.current = oneshotKey;

    const dur = ONESHOT_META[oneshotId].durMs;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setCurrentOneshot(oneshotId);
    startRef.current = performance.now();

    const loop = (now: number) => {
      if (startRef.current === null) return;
      const p = (now - startRef.current) / dur;
      if (p >= 1) {
        stop();
        return;
      }
      setProgress(p);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [oneshotKey, oneshotId, stop]);

  useEffect(() => () => stop(), [stop]);

  return { progress, currentOneshot };
}
