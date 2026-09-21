import type { Metadata } from "next";
import { UrlChecker } from "@/components/check/UrlChecker";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "Проверить сайт",
  description: "Экспресс-проверка сайта на соответствие 152-ФЗ и требованиям Роскомнадзора.",
};

export default function CheckPage() {
  return (
    <div className="relative overflow-hidden py-14 md:py-20">
      <div className="pointer-events-none absolute left-1/2 top-10 h-72 w-[560px] -translate-x-1/2 rounded-full bg-amber-400/15 blur-[100px]" />
      <div className="relative mx-auto max-w-3xl px-4 md:px-6">
        <Reveal>
          <h1 className="text-3xl font-semibold text-white md:text-5xl">
            Проверить свой сайт
          </h1>
          <p className="mt-4 text-white/65">
            Введите URL — покажем статус соответствия, список находок и предложим
            полный отчёт или помощь с устранением.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="mt-8">
          <UrlChecker />
        </Reveal>
      </div>
    </div>
  );
}
