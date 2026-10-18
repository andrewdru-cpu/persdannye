/** Реквизиты оператора ПДн — замените перед продакшеном */
export const company = {
  brand: "ПерсДанные",
  legalName: "",
  /**
   * Пусто — ООО: ОГРН из 13 цифр и ИНН из 10. «ИП» включает ОГРНИП и ИНН из 12 цифр.
   * Ветка ИП по умолчанию выключена.
   */
  legalForm: "",
  shortName: "ПерсДанные",
  inn: "",
  ogrn: "",
  /** КПП юрлица, 9 символов. Пусто, пока нет настоящего значения. */
  kpp: "",
  address: "",
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
  phone: "",
  phoneHref: "",
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
