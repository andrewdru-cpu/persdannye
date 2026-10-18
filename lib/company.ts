/** Строка в блоке «Оператор», пока флаг реквизитов выключен. */
export const OPERATOR_REQUISITES_PENDING =
  "Реквизиты оператора будут опубликованы до начала обработки";

/** Реквизиты оператора ПДн — замените перед продакшеном */
export const company = {
  brand: "ПерсДанные",
  legalName: 'ООО «ПерсДанные»',
  shortName: "ПерсДанные",
  inn: "7700000000",
  ogrn: "1207700000000",
  address: "123112, г. Москва, Пресненская наб., д. 12, этаж 1, офис 1",
  /**
   * Временный общий ящик. Конкретного адреса нет, поле пустое и на сайт не выводится.
   * Запросы субъектов — только privacy_contact_email.
   */
  email: "",
  /**
   * Contact for subject requests. Keep empty until the mailbox domain is owned.
   * Empty: nothing in production, `TODO: privacy_contact_email` on Vercel preview.
   */
  privacy_contact_email: "",
  phone: "+7 (495) 000-00-00",
  phoneHref: "tel:+74950000000",
  website: "https://persdannye.ru",
  /** Часы обработки обращений */
  supportHours: "пн–пт, 10:00–19:00 (МСК)",
} as const;

export type Company = typeof company;

export const PRIVACY_CONTACT_TODO = "TODO: privacy_contact_email";

/** Address to show, the preview TODO, or null when production has no address. */
export function privacyContactLabel(
  email: string = company.privacy_contact_email,
  vercelEnv: string | undefined = process.env.VERCEL_ENV
): string | null {
  const value = email.trim();
  if (value) return value;
  if (vercelEnv === "preview") return PRIVACY_CONTACT_TODO;
  return null;
}
