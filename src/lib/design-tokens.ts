/**
 * Offi Design System v2 — source of truth.
 * Синхронизировано с src/app/globals.css (CSS-переменные HSL).
 * Источник: Claude Design handoff, Offi Prototype v2.html.
 */
export const designTokens = {
  brand: {
    name: "Offi",
    accent: "#0259DD",
    accentHover: "#0142A8",
    accentMid: "#84AFFB",
    accentLight: "#EBF2FF",
  },
  colors: {
    bg: "#F8FAFE",
    surface: "#FFFFFF",
    surfaceAlt: "#F0F4FA",
    text: "#0A0A0A",
    textSecondary: "#4B5563",
    textTertiary: "#9CA3AF",
    border: "#D6E4F5",
    borderLight: "#EBF2FF",
    success: "#059669",
    successLight: "#ECFDF5",
    warning: "#D97706",
    warningLight: "#FFFBEB",
  },
  typography: {
    family: { sans: "Onest", mono: "ui-monospace" },
    weights: [300, 400, 500, 600, 700, 800],
    scale: {
      xs: "0.75rem",
      sm: "0.8125rem",
      base: "0.875rem",
      lg: "1rem",
      xl: "1.125rem",
      "2xl": "1.25rem",
      "3xl": "1.625rem",
      "4xl": "2rem",
      "5xl": "2.5rem",
      "6xl": "3.25rem",
    },
    letterSpacing: {
      tight: "-0.04em",
      tighter: "-0.03em",
      normal: "-0.01em",
    },
  },
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 },
  radius: { sm: 8, md: 10, lg: 14, xl: 18, full: 9999 },
  shadow: {
    xs: "0 1px 2px rgba(0,0,0,0.04)",
    card: "0 1px 2px rgba(0,0,0,0.02), 0 16px 48px rgba(2,89,221,0.04)",
    cardHover: "0 8px 30px rgba(2,89,221,0.06)",
    buttonPrimary: "0 2px 8px rgba(2,89,221,0.15)",
    buttonPrimaryHover: "0 4px 16px rgba(2,89,221,0.25)",
  },
  easing: {
    default: "cubic-bezier(0.22, 1, 0.36, 1)",
    back: "cubic-bezier(0.34, 1.3, 0.64, 1)",
  },
  /** Характер продукта */
  personality: {
    tone: "calm, confident, helpful",
    visualLanguage: [
      "blue-tinted light",
      "soft long shadows",
      "14–18px radii",
      "generous spacing",
      "smooth Apple-easing motion",
    ],
    doNots: ["heavy gradients", "hard shadows", "neon colors", "over-rounded pills"],
  },
} as const;

export type DesignTokens = typeof designTokens;
