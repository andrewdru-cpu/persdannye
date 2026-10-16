"use client";

import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CheckLink({
  children,
  className,
  pulse = false,
  onNavigate,
}: {
  children: ReactNode;
  className?: string;
  pulse?: boolean;
  onNavigate?: () => void;
}) {
  const reduce = useReducedMotion();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    onNavigate?.();
    const target = document.getElementById("url-check");
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
    const input = document.getElementById("url-check-input");
    if (input instanceof HTMLElement) {
      window.setTimeout(() => input.focus({ preventScroll: true }), reduce ? 0 : 400);
    }
  }

  return (
    <Link
      href="/#url-check"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-2 text-center font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/80",
        pulse && !reduce && "cta-pulse",
        className,
      )}
    >
      {children}
    </Link>
  );
}
