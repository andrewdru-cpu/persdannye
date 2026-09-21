"use client";

import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MouseEvent, ReactNode } from "react";
import { useRef } from "react";

type Props = {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  /** Soft glow pulse for primary CTAs */
  pulse?: boolean;
};

const variants = {
  primary:
    "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-ink-950 shadow-glow hover:brightness-110",
  secondary:
    "bg-white/5 text-white border border-white/15 hover:bg-white/10 hover:border-amber-400/40",
  ghost: "bg-transparent text-white/80 hover:text-white hover:bg-white/5",
  danger: "bg-rose-600/90 text-white hover:bg-rose-500",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm rounded-lg",
  md: "px-5 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3.5 text-base rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  type = "button",
  onClick,
  pulse = false,
}: Props) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 280, damping: 18, mass: 0.4 });

  function onMove(e: MouseEvent<HTMLButtonElement>) {
    if (disabled || reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    x.set(dx * 0.22);
    y.set(dy * 0.22);
  }

  function onLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={reduce || disabled ? undefined : { x: springX, y: springY }}
      whileHover={disabled || reduce ? undefined : { scale: 1.045 }}
      whileTap={disabled || reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        pulse && variant === "primary" && !disabled && !reduce ? "cta-pulse" : "",
        className
      )}
      disabled={disabled}
    >
      {children}
    </motion.button>
  );
}
