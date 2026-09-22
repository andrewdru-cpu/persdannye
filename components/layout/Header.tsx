"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { company } from "@/lib/company";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/#how", label: "Как работает" },
  { href: "/#checks", label: "Что проверяем" },
  { href: "/#faq", label: "FAQ" },
  { href: "/check", label: "Проверка" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-amber-200/15 bg-ink-950/75 backdrop-blur-2xl">
      <div className="gold-hairline" />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 md:px-6 md:py-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 via-amber-300 to-amber-600 text-sm font-bold text-ink-950 shadow-glow">
            ПД
          </span>
          <span className="font-display text-xl font-semibold text-white">{company.brand}</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-white/70 transition hover:text-amber-300"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/check">
            <Button size="sm" pulse>
              Проверить свой сайт
            </Button>
          </Link>
        </nav>
        <button
          type="button"
          className="md:hidden rounded-lg border border-white/10 px-3 py-2 text-sm text-white/80"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Меню"
        >
          Меню
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5 md:hidden"
          >
            <div className="flex flex-col gap-2 px-4 py-3">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/5")}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <Link href="/check" onClick={() => setOpen(false)}>
                <Button className="w-full" size="md">
                  Проверить свой сайт
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
