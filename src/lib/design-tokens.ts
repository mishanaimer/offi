/**
 * Дизайн-система Offi — источник правды для токенов.
 * Значения дублируются в globals.css как CSS-переменные.
 * Когда появится финальная дизайн-система от Claude Design — обнови оба файла.
 */
export const designTokens = {
  brand: {
    name: "Offi",
    accent: "#1a6eff",
    accentHover: "#0057e0",
  },
  typography: {
    family: { sans: "Geist", mono: "Geist Mono" },
    scale: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "2rem",
      "4xl": "2.5rem",
      "5xl": "3rem",
    },
  },
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 },
  radius: { sm: 6, md: 10, lg: 14, xl: 20, full: 9999 },
  shadow: {
    xs: "0 1px 2px 0 rgb(16 24 40 / 0.04)",
    sm: "0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.04)",
    md: "0 4px 12px -2px rgb(16 24 40 / 0.08)",
    lg: "0 12px 32px -8px rgb(16 24 40 / 0.12)",
  },
  /** Характер продукта: Apple-минимализм, деловой, светлые тона. */
  personality: {
    tone: "calm, confident, helpful",
    visualLanguage: ["mostly light", "soft shadows", "14px radii", "generous spacing", "subtle motion"],
    doNots: ["heavy gradients", "hard shadows", "neon colors", "overlapping badges"],
  },
} as const;

export type DesignTokens = typeof designTokens;
