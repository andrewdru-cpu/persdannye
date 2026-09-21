"use client";

import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const DEFAULT_ITEMS = [
  "1000+ компаний",
  "данные РКН каждый день",
  "проверка по 152-ФЗ",
  "cookie · формы · политики",
  "устраняем вместе",
  "экспресс-скан за минуты",
];

export function TrustMarquee({
  items = DEFAULT_ITEMS,
  className,
}: {
  items?: string[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const loop = [...items, ...items];

  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-white/5 bg-white/[0.02] py-4",
        className
      )}
      aria-label="Доверие и факты"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink-950 to-transparent" />

      <div
        className={cn(
          "flex gap-3 px-4",
          reduce ? "flex-wrap justify-center" : "marquee-track"
        )}
      >
        {(reduce ? items : loop).map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-4 py-1.5 text-sm text-amber-50/90"
          >
            <span className="text-amber-300">✦</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
