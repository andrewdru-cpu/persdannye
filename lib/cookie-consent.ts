export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  textVersion: string;
  updatedAt: string;
};

export const COOKIE_CONSENT_V1_KEY = "pd_cookie_consent_v1";
export const COOKIE_CONSENT_STORAGE_KEY = "pd_cookie_consent_v2";
export const COOKIE_CONSENT_TEXT_VERSION = "2026-10-19-cookie";
export const OPEN_COOKIE_SETTINGS_EVENT = "pd-open-cookie-settings";

export type CookieLoadDecision = {
  removeV1: boolean;
  showBanner: boolean;
  analyticsConsented: boolean;
};

type CookieStorage = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
};

/** Пока на этой загрузке видели v1, аналитику не считаем согласованной. */
let holdAnalyticsForV1 = false;

export function resetCookieConsentSession(): void {
  holdAnalyticsForV1 = false;
}

export function noteCookieChoiceSaved(): void {
  holdAnalyticsForV1 = false;
}

export function consentFromChoice(
  choice: "accept" | "reject" | "custom",
  analytics: boolean,
  updatedAt: string,
): CookieConsent {
  return {
    necessary: true,
    analytics: choice === "accept" ? true : choice === "reject" ? false : analytics,
    textVersion: COOKIE_CONSENT_TEXT_VERSION,
    updatedAt,
  };
}

export function parseCookieConsentV2(raw: string | null): CookieConsent | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (record.necessary !== true) return null;
  if (typeof record.analytics !== "boolean") return null;
  if (typeof record.textVersion !== "string" || record.textVersion.trim() === "") return null;
  if (typeof record.updatedAt !== "string" || record.updatedAt.trim() === "") return null;
  return {
    necessary: true,
    analytics: record.analytics,
    textVersion: record.textVersion,
    updatedAt: record.updatedAt,
  };
}

/** v1 не переносится. Чужой textVersion не даёт согласия на аналитику. */
export function evaluateCookieConsent(v1: string | null, v2: string | null): CookieLoadDecision {
  if (v1 !== null) {
    return { removeV1: true, showBanner: true, analyticsConsented: false };
  }
  const consent = parseCookieConsentV2(v2);
  if (!consent || consent.textVersion !== COOKIE_CONSENT_TEXT_VERSION) {
    return { removeV1: false, showBanner: true, analyticsConsented: false };
  }
  return {
    removeV1: false,
    showBanner: false,
    analyticsConsented: consent.analytics === true,
  };
}

export function loadCookieConsent(storage: CookieStorage): CookieLoadDecision {
  let v1: string | null = null;
  try {
    v1 = storage.getItem(COOKIE_CONSENT_V1_KEY);
  } catch {
    v1 = null;
  }
  if (v1 !== null) {
    holdAnalyticsForV1 = true;
    try {
      storage.removeItem(COOKIE_CONSENT_V1_KEY);
    } catch {
      // Хранилище закрыто: баннер всё равно показываем, аналитику не включаем.
    }
  }
  if (holdAnalyticsForV1) {
    return { removeV1: v1 !== null, showBanner: true, analyticsConsented: false };
  }
  let v2: string | null = null;
  try {
    v2 = storage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    v2 = null;
  }
  return evaluateCookieConsent(null, v2);
}

export function savedAnalyticsChoice(v2: string | null): boolean {
  return evaluateCookieConsent(null, v2).analyticsConsented;
}
