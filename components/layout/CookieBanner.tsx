"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { COOKIE_BANNER_ACTIONS } from "@/content/cookies-policy";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  OPEN_COOKIE_SETTINGS_EVENT,
  consentFromChoice,
  readStoredCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

export type { CookieConsent };

const [acceptLabel, rejectLabel, settingsLabel] = COOKIE_BANNER_ACTIONS;

function loadConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    return readStoredCookieConsent(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))?.consent ?? null;
  } catch {
    return null;
  }
}

function saveConsent(c: CookieConsent) {
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(c));
  window.dispatchEvent(new CustomEvent("pd-cookie-consent", { detail: c }));
}

/** Analytics scripts must wait for consent.analytics === true */
export function hasAnalyticsConsent(): boolean {
  return loadConsent()?.analytics === true;
}

const choiceClass = "min-h-11 w-full flex-1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      const read = readStoredCookieConsent(raw);
      if (!read) {
        setVisible(true);
        return;
      }
      setAnalytics(read.consent.analytics);
      if (read.droppedMarketing) {
        try {
          saveConsent(read.consent);
        } catch {
          // Квота или закрытое хранилище: выбор уже прочитан, исключение не показываем.
        }
      }
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    function open() {
      const read = loadConsent();
      setAnalytics(read?.analytics ?? false);
      setAdvanced(false);
      setVisible(true);
    }
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

  useEffect(() => {
    if (!visible) return;
    dialogRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    const root = document.documentElement;
    if (visible) root.dataset.cookieOpen = "true";
    else delete root.dataset.cookieOpen;
    return () => {
      delete root.dataset.cookieOpen;
    };
  }, [visible]);

  function acceptAll() {
    const c = consentFromChoice("accept", false, new Date().toISOString());
    saveConsent(c);
    setVisible(false);
  }

  function necessaryOnly() {
    const c = consentFromChoice("reject", false, new Date().toISOString());
    saveConsent(c);
    setVisible(false);
  }

  function saveCustom() {
    const c = consentFromChoice("custom", analytics, new Date().toISOString());
    saveConsent(c);
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          ref={dialogRef}
          tabIndex={-1}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl backdrop-blur-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 md:inset-x-auto md:bottom-6 md:p-5"
          role="dialog"
          aria-label="Настройки cookie"
        >
          <p className="text-sm leading-relaxed text-white/85">
            Мы используем необходимые cookie для работы сайта. Аналитические cookie включаем только
            после вашего согласия. Подробнее — в{" "}
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
            <div className="mt-3 space-y-2 rounded-xl bg-black/30 p-3 text-sm text-white/85">
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
            </div>
          )}
          {/* «Отклонить» = только необходимые (analytics false). Обе кнопки одного размера и веса. Аналитика по умолчанию не отмечена. */}
          <div className="mt-4 flex gap-2">
            <Button size="md" variant="secondary" className={choiceClass} onClick={acceptAll}>
              {acceptLabel}
            </Button>
            <Button size="md" variant="secondary" className={choiceClass} onClick={necessaryOnly}>
              {rejectLabel}
            </Button>
          </div>
          <div className="mt-2">
            {!advanced ? (
              <Button size="md" variant="secondary" className="min-h-11 w-full" onClick={() => setAdvanced(true)}>
                {settingsLabel}
              </Button>
            ) : (
              <Button size="md" variant="secondary" className="min-h-11 w-full" onClick={saveCustom}>
                Сохранить выбор
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
