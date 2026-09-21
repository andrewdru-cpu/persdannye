"use client";

import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const DEFAULT_ITEMS = [
  "1000+ компаний",
  "правила РКН — каждый день",
  "аудит 152-ФЗ",
  "cookie · формы · политики",
  "устраняем вместе с юристами",
  "экспресс-скан за минуты",
  "закрытый контур проверки",
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
        "relative overflow-hidden border-y border-amber-200/10 bg-gradient-to-r from-amber-400/[0.06] via-white/[0.03] to-amber-400/[0.06] py-4",
        className
      )}
      aria-label="Доверие и факты"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-ink-950 to-transparent" />

      <div
        className={cn(
          "flex gap-3 px-4",
          reduce ? "flex-wrap justify-center" : "marquee-track"
        )}
      >
        {(reduce ? items : loop).map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/[0.07] px-4 py-1.5 text-sm text-amber-50/95 shadow-[0_0_20px_rgba(212,175,55,0.08)]"
          >
            <span className="text-amber-300" aria-hidden>
              ✦
            </span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
