"use client";

import { useEffect, useState } from "react";
import type { CookieConsent } from "@/components/layout/CookieBanner";
import { COOKIE_CONSENT_STORAGE_KEY, readStoredCookieConsent } from "@/lib/cookie-consent";

/**
 * Loads analytics only after cookie consent.analytics === true.
 * Replace the inner effect with your tag manager / metrica snippet.
 */
export function AnalyticsGate() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    function read() {
      try {
        const stored = readStoredCookieConsent(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
        setAllowed(stored?.consent.analytics === true);
      } catch {
        setAllowed(false);
      }
    }
    read();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CookieConsent>).detail;
      setAllowed(detail?.analytics === true);
    };
    window.addEventListener("pd-cookie-consent", handler);
    return () => window.removeEventListener("pd-cookie-consent", handler);
  }, []);

  useEffect(() => {
    if (!allowed) return;
    // Placeholder: mount analytics here (YM / GA) — never before consent.
    if (process.env.NODE_ENV === "development") {
      console.info("[ПерсДанные] analytics consent granted — safe to load tags");
    }
  }, [allowed]);

  return null;
}
