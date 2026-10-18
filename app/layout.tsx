import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/layout/CookieBanner";
import { StickyCta } from "@/components/layout/StickyCta";
import { AnalyticsGate } from "@/components/layout/AnalyticsGate";
import { SiteAtmosphere } from "@/components/motion/SiteAtmosphere";
import { isPdCollectionEnabled } from "@/lib/collection-gate";
import { company } from "@/lib/company";

const manrope = localFont({
  src: "./fonts/Manrope-wght.ttf",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
  adjustFontFallback: "Arial",
});

const display = localFont({
  src: "./fonts/CormorantGaramond-wght.ttf",
  variable: "--font-cormorant",
  weight: "300 700",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-wght.ttf",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
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
        <a className="skip-link" href="#content">
          К содержанию
        </a>
        <SiteAtmosphere />
        <div className="relative z-[1]">
          <Header />
          <main id="content">{children}</main>
          <Footer />
          {isPdCollectionEnabled() ? <CookieBanner /> : null}
          {isPdCollectionEnabled() ? <AnalyticsGate /> : null}
          {isPdCollectionEnabled() ? <StickyCta /> : null}
        </div>
      </body>
    </html>
  );
}
