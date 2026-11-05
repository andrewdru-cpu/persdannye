export type PublishedRequisites = {
  legalName: string | null;
  inn: string | null;
  /** У плательщика НПД пусто. Непустое значение не публикуется. */
  kpp: string | null;
  /** У плательщика НПД нет ОГРН. Непустое значение не публикуется. */
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  phoneHref: string | null;
};

/** Тестовый ИНН из прежней заглушки. Контрольная сумма у него тоже не сходится. */
const BLOCKED_INN = new Set(["7700000000"]);

/**
 * Чужое здание, которое стояло в заглушке адреса.
 * Наб. и «д. 12» — этого адреса на сайте быть не должно.
 */
const FOREIGN_BUILDING = /пресненская\s+наб(?:ережная)?\.?,?\s*д\.?\s*12/iu;

const COMPANY_LABEL = /ооо|огрн|частная\s+компания|^ип(?:\s|$)/iu;

const INN_12_N11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;
const INN_12_N12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;

function filled(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("{{")) return null;
  return trimmed;
}

function weighted(digits: string, coefficients: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < coefficients.length; i += 1) {
    sum += coefficients[i] * Number(digits[i]);
  }
  return (sum % 11) % 10;
}

/** ИНН физлица: 12 цифр. Для плательщика НПД это единственный допустимый ИНН. */
function inn12Valid(inn: string): boolean {
  if (!/^\d{12}$/.test(inn)) return false;
  if (/^0+$/.test(inn) || BLOCKED_INN.has(inn)) return false;
  const n11 = weighted(inn, INN_12_N11);
  const n12 = weighted(inn, INN_12_N12);
  return n11 === Number(inn[10]) && n12 === Number(inn[11]);
}

export type PublishedOperator = {
  legalName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  address: string;
  phone: string;
  phoneHref: string;
};

function addressValid(address: string): boolean {
  return !FOREIGN_BUILDING.test(address);
}

/** Номер из нулей и городской 495 000-00-00 — заглушка, не телефон. */
function phoneValid(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (!digits || /^0+$/.test(digits)) return false;
  return !/^[78]?4950{7}$/.test(digits);
}

function phoneHrefValid(href: string): boolean {
  if (!href.toLowerCase().startsWith("tel:")) return false;
  return phoneValid(href.slice(4));
}

/**
 * Реквизиты плательщика НПД: ФИО и ИНН физлица, без ОГРН и без КПП.
 * Иначе null. На сайт попадают только эти строки, не сырые поля company.
 * Реальные ФИО и ИНН в репозиторий не подставляются.
 */
export function assertPublishedRequisites(
  requisites: Partial<PublishedRequisites> | null | undefined,
): PublishedOperator | null {
  if (!requisites) return null;
  const legalName = text(requisites.legalName);
  const inn = text(requisites.inn);
  const address = text(requisites.address);
  const phone = text(requisites.phone);
  const phoneHref = text(requisites.phoneHref);
  if (!legalName || !inn || !address || !phone || !phoneHref) return null;
  if (COMPANY_LABEL.test(legalName)) return null;
  if (filled(requisites.ogrn) || filled(requisites.kpp)) return null;
  if (!addressValid(address) || !phoneValid(phone) || !phoneHrefValid(phoneHref)) return null;
  if (!inn12Valid(inn)) return null;
  return { legalName, inn, kpp: "", ogrn: "", address, phone, phoneHref };
}
