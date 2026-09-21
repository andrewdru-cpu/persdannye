import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { StickyMobileCta } from "@/components/layout/StickyMobileCta";
import { AnalyticsGate } from "@/components/layout/AnalyticsGate";
import { SiteAtmosphere } from "@/components/motion/SiteAtmosphere";
import { company } from "@/lib/company";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${company.brand} — проверка сайта на 152-ФЗ и требования РКН`,
    template: `%s · ${company.brand}`,
  },
  description:
    "Премиальный сканер соответствия сайтов 152-ФЗ и практике Роскомнадзора. Находите риски и устраняйте их с юристами ПерсДанные.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body
        className={`${manrope.variable} ${display.variable} ${geistMono.variable} relative min-h-screen bg-ink-950 text-foreground antialiased`}
      >
        <SiteAtmosphere />
        <div className="relative z-[1]">
          <Header />
          <main className="pb-24 md:pb-0">{children}</main>
          <Footer />
          <CookieBanner />
          <AnalyticsGate />
          <StickyMobileCta />
        </div>
      </body>
    </html>
  );
}
