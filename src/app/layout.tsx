import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/cookie-banner";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-onest",
});

export const metadata: Metadata = {
  title: "Offi.ai — AI, который знает ваш бизнес",
  description:
    "Загрузите документы — получите ассистента. Письма, договоры, встречи — в одном чате. Бета-доступ открыт.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Offi.ai — AI-ассистент для бизнеса",
    description: "Один ассистент — вместо десятка сервисов.",
    url: "https://offi.ai",
    siteName: "Offi",
    locale: "ru_RU",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFE" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0F14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={onest.variable}>
      <body className={onest.className}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
