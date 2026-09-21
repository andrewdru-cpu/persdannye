"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const STORAGE_KEY = "pd_cookie_consent_v1";

function loadConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    return null;
  }
}

function saveConsent(c: CookieConsent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  window.dispatchEvent(new CustomEvent("pd-cookie-consent", { detail: c }));
}

/** Analytics scripts must wait for consent.analytics === true */
export function hasAnalyticsConsent(): boolean {
  return loadConsent()?.analytics === true;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = loadConsent();
    if (!existing) setVisible(true);
  }, []);

  function acceptAll() {
    const c: CookieConsent = {
      necessary: true,
      analytics: true,
      marketing: true,
      updatedAt: new Date().toISOString(),
    };
    saveConsent(c);
    setVisible(false);
  }

  function necessaryOnly() {
    const c: CookieConsent = {
      necessary: true,
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
    };
    saveConsent(c);
    setVisible(false);
  }

  function saveCustom() {
    const c: CookieConsent = {
      necessary: true,
      analytics,
      marketing,
      updatedAt: new Date().toISOString(),
    };
    saveConsent(c);
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl backdrop-blur-xl md:inset-x-auto md:bottom-6 md:p-5"
          role="dialog"
          aria-label="Настройки cookie"
        >
          <p className="text-sm leading-relaxed text-white/80">
            Мы используем необходимые cookie для работы сайта. Аналитические и
            маркетинговые cookie включаем только после вашего согласия. Подробнее — в{" "}
            <Link href="/cookies" className="text-amber-300 underline-offset-2 hover:underline">
              Политике cookie
            </Link>{" "}
            и{" "}
            <Link href="/privacy" className="text-amber-300 underline-offset-2 hover:underline">
              Политике обработки ПДн
            </Link>
            .
          </p>
          {advanced && (
            <div className="mt-3 space-y-2 rounded-xl bg-black/30 p-3 text-sm text-white/75">
              <label className="flex items-center justify-between gap-3">
                <span>Необходимые (всегда активны)</span>
                <input type="checkbox" checked disabled className="accent-amber-400" />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Аналитические</span>
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="accent-amber-400"
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span>Маркетинговые</span>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="accent-amber-400"
                />
              </label>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={acceptAll}>
              Принять все
            </Button>
            <Button size="sm" variant="secondary" onClick={necessaryOnly}>
              Только необходимые
            </Button>
            {!advanced ? (
              <Button size="sm" variant="ghost" onClick={() => setAdvanced(true)}>
                Настроить
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={saveCustom}>
                Сохранить выбор
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
