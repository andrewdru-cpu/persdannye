"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cta } from "@/content/landing";
import { CheckLink } from "@/components/landing/CheckLink";

export function StickyCta() {
  const reduce = useReducedMotion();
  const [pastHero, setPastHero] = useState(false);
  const [cookieOpen, setCookieOpen] = useState(false);
  const visible = pastHero && !cookieOpen;

  useEffect(() => {
    const hero = document.getElementById("hero");
    if (!hero) {
      const onScroll = () => setPastHero(window.scrollY > 520);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      setPastHero(scrolledPast);
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => {
      setCookieOpen(document.documentElement.dataset.cookieOpen === "true");
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-cookie-open"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("has-sticky-cta", visible);
    return () => document.body.classList.remove("has-sticky-cta");
  }, [visible]);

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      initial={false}
      animate={
        visible
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: reduce ? 0 : 18 }
      }
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
      style={{ pointerEvents: "none" }}
    >
      <div
        role="region"
        aria-label={cta.sticky}
        aria-hidden={!visible}
        inert={!visible}
        className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-amber-200/35 bg-ink-950/92 py-1.5 pl-4 pr-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        style={{ pointerEvents: visible ? "auto" : "none" }}
      >
        <p className="hidden text-sm text-white/80 sm:block">{cta.stickyHint}</p>
        <CheckLink
          pulse={visible}
          className="btn-gold min-h-11 rounded-full px-4 py-2 text-sm"
        >
          {cta.sticky}
        </CheckLink>
      </div>
    </motion.div>
  );
}
