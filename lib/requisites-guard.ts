export type PublishedRequisites = {
  legalName: string | null;
  inn: string | null;
  /** Для ООО обязателен, 9 символов. У ИП может быть пустым. */
  kpp: string | null;
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  phoneHref: string | null;
};

/**
 * Ветка ИП (ИНН 12, ОГРНИП 15) есть в страже, но по умолчанию выключена.
 * Пока оператор — ООО, 12-значный ИНН и 15-значный ОГРНИП не публикуются.
 */
export const allowEntrepreneurRequisites = false;

/** Тестовый ИНН из прежней заглушки. Контрольная сумма у него тоже не сходится. */
const BLOCKED_INN = new Set(["7700000000"]);

/** Тестовый ОГРН из прежней заглушки. */
const BLOCKED_OGRN = new Set(["1207700000000"]);

/**
 * Чужое здание, которое стояло в заглушке адреса.
 * Наб. и «д. 12» — этого адреса на сайте быть не должно.
 */
const FOREIGN_BUILDING =
  /пресненская\s+наб(?:ережная)?\.?,?\s*д\.?\s*12/iu;

const INN_10 = [2, 4, 10, 3, 5, 9, 4, 6, 8] as const;
const INN_12_N11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;
const INN_12_N12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8] as const;

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

/** ИНН юрлица: 10 цифр, веса 2, 4, 10, 3, 5, 9, 4, 6, 8. */
function inn10Valid(inn: string): boolean {
  if (!/^\d{10}$/.test(inn)) return false;
  if (/^0+$/.test(inn) || BLOCKED_INN.has(inn)) return false;
  return weighted(inn, INN_10) === Number(inn[9]);
}

/** ИНН физлица: 12 цифр. Используется только при включённой ветке ИП. */
function inn12Valid(inn: string): boolean {
  if (!/^\d{12}$/.test(inn)) return false;
  if (/^0+$/.test(inn)) return false;
  const n11 = weighted(inn, INN_12_N11);
  const n12 = weighted(inn, INN_12_N12);
  return n11 === Number(inn[10]) && n12 === Number(inn[11]);
}

/** ОГРН: (первые 12 цифр mod 11) mod 10 совпадает с 13-й. */
function ogrn13Valid(ogrn: string): boolean {
  if (!/^\d{13}$/.test(ogrn)) return false;
  if (/^0+$/.test(ogrn) || BLOCKED_OGRN.has(ogrn)) return false;
  const check = Number((BigInt(ogrn.slice(0, 12)) % BigInt(11)) % BigInt(10));
  return check === Number(ogrn[12]);
}

/** ОГРНИП: (первые 14 цифр mod 13) mod 10 совпадает с 15-й. */
function ogrnip15Valid(ogrn: string): boolean {
  if (!/^\d{15}$/.test(ogrn)) return false;
  if (/^0+$/.test(ogrn)) return false;
  const check = Number((BigInt(ogrn.slice(0, 14)) % BigInt(13)) % BigInt(10));
  return check === Number(ogrn[14]);
}

/** КПП ООО — ровно 9 символов, не нули. */
function kppValid(kpp: string): boolean {
  if (kpp.length !== 9 || /\s/.test(kpp)) return false;
  return !/^0+$/.test(kpp);
}

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
 * true, только если реквизиты можно публиковать.
 * По умолчанию это ООО: ИНН 10, ОГРН 13, КПП из 9 символов и адрес.
 * Ветка ИП включается вторым аргументом и по умолчанию выключена.
 * Пустые значения и заглушки дают false, и блок на /privacy не рендерится.
 */
export function assertPublishedRequisites(
  requisites: Partial<PublishedRequisites> | null | undefined,
  allowEntrepreneur: boolean = allowEntrepreneurRequisites,
): boolean {
  if (!requisites) return false;
  const legalName = text(requisites.legalName);
  const inn = text(requisites.inn);
  const ogrn = text(requisites.ogrn);
  const address = text(requisites.address);
  const phone = text(requisites.phone);
  const phoneHref = text(requisites.phoneHref);
  const kpp = text(requisites.kpp);
  if (!legalName || !inn || !ogrn || !address || !phone || !phoneHref) return false;
  if (!addressValid(address) || !phoneValid(phone) || !phoneHrefValid(phoneHref)) return false;
  if (kpp && !kppValid(kpp)) return false;

  const entrepreneur = inn.length === 12 || ogrn.length === 15;
  if (entrepreneur) {
    if (!allowEntrepreneur) return false;
    if (inn.length !== 12 || ogrn.length !== 15) return false;
    return inn12Valid(inn) && ogrnip15Valid(ogrn);
  }

  if (!kpp) return false;
  return inn10Valid(inn) && ogrn13Valid(ogrn);
}
