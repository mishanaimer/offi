import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offi — AI-агент для бизнеса",
  description:
    "Загрузи документы и клиентов. Общайся как с ChatGPT, но ассистент знает твой бизнес и умеет действовать: отправлять письма, назначать встречи, генерировать договоры.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Offi — AI-агент для бизнеса",
    description: "Ассистент, который знает твой бизнес и умеет действовать.",
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
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
