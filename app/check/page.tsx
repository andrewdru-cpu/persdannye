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
    <div className="relative overflow-hidden py-16 md:py-28">
      <div className="pointer-events-none absolute left-1/2 top-0 h-80 w-[680px] -translate-x-1/2 rounded-full bg-amber-200/15 blur-[120px]" />
      <div className="relative mx-auto max-w-3xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-200/80">
            Экспресс-аудит
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.02] text-white md:text-6xl">
            Проверить свой сайт
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">
            Введите URL — статус, балл и находки обновляются по ходу. Страницу
            можно листать: проверка не блокирует экран.
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
