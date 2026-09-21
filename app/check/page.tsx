import type { Metadata } from "next";
import { UrlChecker } from "@/components/check/UrlChecker";
import { Reveal } from "@/components/motion/Reveal";
import { GlassCard } from "@/components/ui/GlassCard";

export const metadata: Metadata = {
  title: "Проверить сайт",
  description: "Экспресс-проверка сайта на соответствие 152-ФЗ и требованиям Роскомнадзора.",
};

export default function CheckPage() {
  return (
    <div className="relative overflow-hidden py-14 md:py-24">
      <div className="pointer-events-none absolute left-1/2 top-6 h-80 w-[640px] -translate-x-1/2 rounded-full bg-amber-400/18 blur-[110px]" />
      <div className="relative mx-auto max-w-3xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Экспресс-аудит
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-white md:text-6xl">
            Проверить свой сайт
          </h1>
          <p className="mt-4 text-white/65">
            Введите URL — покажем статус соответствия, список находок и предложим
            полный отчёт или помощь с устранением.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="mt-8">
          <GlassCard gold>
            <UrlChecker />
          </GlassCard>
        </Reveal>
      </div>
    </div>
  );
}
