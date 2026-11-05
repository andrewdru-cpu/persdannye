import { privacyContactLabel, PRIVACY_CONTACT_TODO } from "./company";

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function realEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 254 || trimmed.startsWith("TODO")) return null;
  if (trimmed === PRIVACY_CONTACT_TODO) return null;
  if (!EMAIL.test(trimmed)) return null;
  return trimmed;
}

/** Почта из SUPPORT_EMAIL. Пустое значение на сайт не выводится. */
export function supportEmail(): string | null {
  return realEmail(process.env.SUPPORT_EMAIL);
}

/**
 * Контакт для страниц оплаты и контактов.
 * Сначала SUPPORT_EMAIL, иначе ящик политики, если он задан.
 * Заглушка превью и телефон сюда не попадают.
 */
export function publicContactEmail(): string | null {
  return supportEmail() ?? realEmail(privacyContactLabel());
}
