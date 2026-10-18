/**
 * Реквизиты оператора. Пусто, пока Андрей не передал настоящие значения.
 * Наименование, ИНН, ОГРН, адрес и телефон сюда не подставляем.
 */
export const company = {
  brand: "ПерсДанные",
  legalName: "",
  shortName: "ПерсДанные",
  inn: "",
  ogrn: "",
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

export type PublishedRequisites = {
  legalName: string;
  inn: string;
  ogrn: string;
  address: string;
  phone: string;
  phoneHref: string;
};

/** Пустые поля, ИНН из нулей, 7700000000 и плейсхолдер {{ нельзя публиковать. */
export function publishedRequisitesError(requisites: PublishedRequisites): string | null {
  const fields = [
    requisites.legalName,
    requisites.inn,
    requisites.ogrn,
    requisites.address,
    requisites.phone,
    requisites.phoneHref,
  ];
  if (fields.some((value) => value.trim() === "")) return "Реквизиты пустые";
  const inn = requisites.inn.replace(/\D/g, "");
  if (inn === "7700000000" || /^0+$/.test(inn)) return "Тестовый ИНН";
  if (fields.some((value) => value.includes("{{"))) return "Плейсхолдер в реквизитах";
  return null;
}

export function assertPublishedRequisites(show: boolean, requisites: PublishedRequisites): void {
  if (!show) return;
  const error = publishedRequisitesError(requisites);
  if (error) throw new Error(`${error}. Настоящие реквизиты даёт только Андрей.`);
}

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
