"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className,
  gold = false,
}: {
  children: ReactNode;
  className?: string;
  gold?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass-card relative rounded-[28px] p-5 md:p-7",
        gold ? "glass-card-gold" : "",
        className
      )}
    >
      <span className="glass-corner glass-corner-tl" aria-hidden />
      <span className="glass-corner glass-corner-tr" aria-hidden />
      <span className="glass-corner glass-corner-bl" aria-hidden />
      <span className="glass-corner glass-corner-br" aria-hidden />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/50 to-transparent" />
      {children}
    </div>
  );
}
