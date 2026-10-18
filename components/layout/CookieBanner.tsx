"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { COOKIE_BANNER_ACTIONS } from "@/content/cookies-policy";
import {
  COOKIE_FOCUS_CLASS,
  cookieDialogKey,
  cookieFocusPlace,
  cookieFocusable,
} from "@/lib/cookie-dialog";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  OPEN_COOKIE_SETTINGS_EVENT,
  consentFromChoice,
  loadCookieConsent,
  noteCookieChoiceSaved,
  savedAnalyticsChoice,
  type CookieConsent,
} from "@/lib/cookie-consent";

export type { CookieConsent };

const [acceptLabel, rejectLabel, settingsLabel] = COOKIE_BANNER_ACTIONS;

function saveConsent(c: CookieConsent) {
  localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(c));
  noteCookieChoiceSaved();
  window.dispatchEvent(new CustomEvent("pd-cookie-consent", { detail: c }));
}

/** Analytics scripts must wait for a current v2 choice with analytics === true. */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return loadCookieConsent(localStorage).analyticsConsented;
  } catch {
    return false;
  }
}

const choiceClass = "min-h-11 w-full flex-1";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    try {
      const decision = loadCookieConsent(localStorage);
      setAnalytics(decision.analyticsConsented);
      setVisible(decision.showBanner);
    } catch {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    function open() {
      let raw: string | null = null;
      try {
        raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
      } catch {
        raw = null;
      }
      setAnalytics(savedAnalyticsChoice(raw));
      setAdvanced(false);
      setVisible(true);
    }
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, open);
  }, []);

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
        <CookieConsentDialog
          advanced={advanced}
          analytics={analytics}
          onAnalytics={setAnalytics}
          onAccept={acceptAll}
          onReject={necessaryOnly}
          onSettings={() => setAdvanced(true)}
          onSave={saveCustom}
          onDismiss={() => setVisible(false)}
        />
      )}
    </AnimatePresence>
  );
}

export function CookieConsentDialog({
  advanced,
  analytics,
  onAnalytics,
  onAccept,
  onReject,
  onSettings,
  onSave,
  onDismiss,
}: {
  advanced: boolean;
  analytics: boolean;
  onAnalytics: (value: boolean) => void;
  onAccept: () => void;
  onReject: () => void;
  onSettings: () => void;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = dialogRef.current;
    root?.focus();
    function onFocusIn(event: FocusEvent) {
      const current = dialogRef.current;
      if (!current) return;
      const target = event.target;
      if (target instanceof Node && current.contains(target)) return;
      const items = cookieFocusable(current);
      (items[0] ?? current).focus();
    }
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const root = dialogRef.current;
    if (!root) return;
    const items = cookieFocusable(root);
    const result = cookieDialogKey(
      event.key,
      event.shiftKey,
      cookieFocusPlace(root, document.activeElement, items),
      items.length,
    );
    if (result.dismiss) {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (!result.focus) return;
    event.preventDefault();
    if (result.focus === "stay") {
      root.focus();
      return;
    }
    const target = result.focus === "first" ? items[0] : items[items.length - 1];
    (target ?? root).focus();
  }

  return (
    <motion.div
      ref={dialogRef}
      tabIndex={-1}
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      className={`fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-white/10 bg-ink-900/95 p-4 shadow-2xl backdrop-blur-xl md:inset-x-auto md:bottom-6 md:p-5 ${COOKIE_FOCUS_CLASS}`}
      role="dialog"
      aria-modal="true"
      aria-label="Настройки cookie"
      onKeyDown={onKeyDown}
    >
      <p className="text-sm leading-relaxed text-white/85">
        Мы используем необходимые cookie для работы сайта. Аналитические cookie включаем только
        после вашего согласия. Подробнее — в{" "}
        <Link href="/cookies" className={`text-amber-300 underline-offset-2 hover:underline ${COOKIE_FOCUS_CLASS}`}>
          Политике cookie
        </Link>{" "}
        и{" "}
        <Link href="/privacy" className={`text-amber-300 underline-offset-2 hover:underline ${COOKIE_FOCUS_CLASS}`}>
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
              onChange={(e) => onAnalytics(e.target.checked)}
              className={`accent-amber-400 ${COOKIE_FOCUS_CLASS}`}
            />
          </label>
        </div>
      )}
      {/* «Отклонить» = только необходимые (analytics false). Обе кнопки одного размера и веса. Аналитика по умолчанию не отмечена. */}
      <div className="mt-4 flex gap-2">
        <Button size="md" variant="secondary" className={choiceClass} onClick={onAccept}>
          {acceptLabel}
        </Button>
        <Button size="md" variant="secondary" className={choiceClass} onClick={onReject}>
          {rejectLabel}
        </Button>
      </div>
      <div className="mt-2">
        {!advanced ? (
          <Button size="md" variant="secondary" className="min-h-11 w-full" onClick={onSettings}>
            {settingsLabel}
          </Button>
        ) : (
          <Button size="md" variant="secondary" className="min-h-11 w-full" onClick={onSave}>
            Сохранить выбор
          </Button>
        )}
      </div>
    </motion.div>
  );
}
