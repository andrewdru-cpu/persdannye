"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cta } from "@/content/landing";

export function StickyCta() {
  const reduce = useReducedMotion();
  const [pastHero, setPastHero] = useState(false);
  const [cookieOpen, setCookieOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [url, setUrl] = useState("");
  const visible = pastHero && !cookieOpen && !dismissed;

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

  function goToChecker(nextUrl: string) {
    const input = document.getElementById("url-check-input");
    if (input instanceof HTMLInputElement) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      proto?.set?.call(input, nextUrl);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    }
    document.getElementById("url-check")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const desktop = window.matchMedia("(min-width: 640px)").matches;
    if (!desktop && !expanded) {
      setExpanded(true);
      return;
    }
    goToChecker(url.trim());
  }

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      initial={false}
      animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 18 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
      style={{ pointerEvents: "none" }}
    >
      <form
        onSubmit={onSubmit}
        role="region"
        aria-label={cta.sticky}
        aria-hidden={!visible}
        inert={!visible}
        className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-amber-200/35 bg-ink-950/92 py-1.5 pl-4 pr-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        style={{ pointerEvents: visible ? "auto" : "none" }}
      >
        <p className="hidden text-sm text-white/80 sm:block">{cta.stickyHint}</p>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={cta.stickyPlaceholder}
          aria-label="Адрес сайта"
          className={`${expanded ? "block" : "hidden"} h-11 w-36 rounded-full border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/40 sm:block sm:w-44`}
        />
        <button type="submit" className="btn-gold min-h-11 rounded-full px-4 py-2 text-sm">
          {cta.sticky}
        </button>
        <button
          type="button"
          aria-label={cta.stickyClose}
          onClick={() => setDismissed(true)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/70 hover:text-white"
        >
          ×
        </button>
      </form>
    </motion.div>
  );
}
