"use client";

import { motion, useReducedMotion } from "framer-motion";

export function HeroBackdrop() {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="hero-grid absolute inset-0 opacity-60" />

      <div
        className={`absolute left-1/2 top-[-10%] h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-amber-400/20 blur-[120px] ${reduce ? "" : "float-orb"}`}
      />
      <div
        className={`absolute bottom-[-5%] right-[-5%] h-72 w-72 rounded-full bg-cyan-500/15 blur-[100px] ${reduce ? "" : "float-orb-alt"}`}
      />
      <div
        className={`absolute left-[8%] top-[40%] h-48 w-48 rounded-full bg-violet-500/12 blur-[80px] ${reduce ? "" : "float-orb"}`}
      />

      {!reduce && (
        <>
          <motion.span
            className="absolute left-[18%] top-[22%] h-2.5 w-2.5 rounded-full bg-amber-300/70 shadow-[0_0_18px_rgba(251,191,36,0.8)]"
            animate={{ y: [0, -14, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="absolute right-[22%] top-[30%] h-2 w-2 rounded-full bg-cyan-300/60 shadow-[0_0_14px_rgba(34,211,238,0.7)]"
            animate={{ y: [0, 12, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />
          <motion.span
            className="absolute left-[55%] top-[58%] h-1.5 w-1.5 rounded-full bg-white/50"
            animate={{ y: [0, -10, 0], opacity: [0.3, 0.9, 0.3] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
          />
        </>
      )}
    </div>
  );
}
