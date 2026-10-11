"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { CookieConsent } from "@/components/layout/CookieBanner";
import { isAnalyticsFreePath } from "@/lib/subject-request";

/**
 * Loads analytics only after cookie consent.analytics === true.
 * Replace the inner effect with your tag manager / metrica snippet.
 */
export function AnalyticsGate() {
  const pathname = usePathname() || "";
  const quiet = isAnalyticsFreePath(pathname);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (quiet) {
      setAllowed(false);
      return;
    }
    function read() {
      try {
        const raw = localStorage.getItem("pd_cookie_consent_v1");
        if (!raw) return setAllowed(false);
        const c = JSON.parse(raw) as CookieConsent;
        setAllowed(c.analytics === true);
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
  }, [quiet]);

  useEffect(() => {
    if (quiet || !allowed) return;
    // Placeholder: mount analytics here (YM / GA) — never before consent.
    if (process.env.NODE_ENV === "development") {
      console.info("[ПерсДанные] analytics consent granted — safe to load tags");
    }
  }, [allowed, quiet]);

  return null;
}
