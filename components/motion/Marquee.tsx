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
        "relative overflow-hidden border-y border-amber-200/15 bg-gradient-to-r from-amber-400/[0.07] via-[#14110c]/40 to-amber-400/[0.07] py-4 md:py-5",
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
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-200/30 bg-amber-100/[0.06] px-4 py-2 text-sm tracking-wide text-amber-50 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
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
