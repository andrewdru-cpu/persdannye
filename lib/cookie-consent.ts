export type CookieConsent = {
  necessary: true;
  analytics: boolean;
  updatedAt: string;
};

export const COOKIE_CONSENT_STORAGE_KEY = "pd_cookie_consent_v1";
export const OPEN_COOKIE_SETTINGS_EVENT = "pd-open-cookie-settings";

export function consentFromChoice(
  choice: "accept" | "reject" | "custom",
  analytics: boolean,
  updatedAt: string,
): CookieConsent {
  return {
    necessary: true,
    analytics: choice === "accept" ? true : choice === "reject" ? false : analytics,
    updatedAt,
  };
}

/**
 * Старый выбор с категорией `marketing` не роняет чтение: поле отбрасывается.
 * Нет `analytics` или битый JSON — выбора нет, баннер можно показать снова.
 */
export function readStoredCookieConsent(raw: string | null): {
  consent: CookieConsent;
  droppedMarketing: boolean;
} | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.analytics !== "boolean") return null;
  const updatedAt = typeof record.updatedAt === "string" && record.updatedAt ? record.updatedAt : "";
  if (!updatedAt) return null;
  return {
    consent: {
      necessary: true,
      analytics: record.analytics,
      updatedAt,
    },
    droppedMarketing: Object.prototype.hasOwnProperty.call(record, "marketing"),
  };
}
