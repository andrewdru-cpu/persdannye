"use client";

import { motion, useReducedMotion } from "framer-motion";

export function HeroBackdrop() {
  const reduce = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="hero-grid absolute inset-0 opacity-70" />
      {!reduce && <div className="hero-rays" />}

      <div
        className={`absolute left-1/2 top-[-18%] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-amber-400/25 blur-[130px] ${reduce ? "" : "float-orb"}`}
      />
      <div
        className={`absolute bottom-[-8%] right-[-8%] h-80 w-80 rounded-full bg-amber-500/15 blur-[110px] ${reduce ? "" : "float-orb-alt"}`}
      />
      <div
        className={`absolute left-[4%] top-[36%] h-56 w-56 rounded-full bg-violet-500/12 blur-[90px] ${reduce ? "" : "float-orb"}`}
      />
      <div
        className={`absolute right-[18%] top-[12%] h-40 w-40 rounded-full bg-yellow-200/10 blur-[70px] ${reduce ? "" : "float-orb-alt"}`}
      />

      {!reduce && (
        <>
          <motion.span
            className="absolute left-[14%] top-[18%] h-2.5 w-2.5 rounded-full bg-amber-200/80 shadow-[0_0_22px_rgba(251,191,36,0.9)]"
            animate={{ y: [0, -16, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.span
            className="absolute right-[16%] top-[26%] h-2 w-2 rounded-full bg-yellow-100/70 shadow-[0_0_16px_rgba(253,224,71,0.8)]"
            animate={{ y: [0, 14, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />
          <motion.span
            className="absolute left-[48%] top-[62%] h-1.5 w-1.5 rounded-full bg-white/60"
            animate={{ y: [0, -12, 0], opacity: [0.25, 0.95, 0.25] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut", delay: 1.4 }}
          />
        </>
      )}
    </div>
  );
}
