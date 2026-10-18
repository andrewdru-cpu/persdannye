"use client";

import { useEffect, useState } from "react";
import type { CookieConsent } from "@/components/layout/CookieBanner";
import { COOKIE_CONSENT_TEXT_VERSION, loadCookieConsent } from "@/lib/cookie-consent";

/**
 * Loads analytics only after cookie consent.analytics === true.
 * `enabled` is a boolean prop from the server. This file does not read env.
 * Replace the inner effect with your tag manager / metrica snippet.
 */
export function AnalyticsGate({ enabled }: { enabled: boolean }) {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    function read() {
      try {
        setAllowed(loadCookieConsent(localStorage).analyticsConsented);
      } catch {
        setAllowed(false);
      }
    }
    read();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CookieConsent>).detail;
      setAllowed(detail?.analytics === true && detail.textVersion === COOKIE_CONSENT_TEXT_VERSION);
    };
    window.addEventListener("pd-cookie-consent", handler);
    return () => window.removeEventListener("pd-cookie-consent", handler);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !allowed) return;
    // Placeholder: mount analytics here (YM / GA) — never before consent.
    if (process.env.NODE_ENV === "development") {
      console.info("[ПерсДанные] analytics consent granted — safe to load tags");
    }
  }, [allowed, enabled]);

  return null;
}
