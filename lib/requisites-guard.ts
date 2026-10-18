export type PublishedRequisites = {
  legalName: string | null;
  inn: string | null;
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  phoneHref: string | null;
  /** ООО: 9 символов. У ИП нет. */
  kpp?: string | null;
  /** Пусто и «ООО» — юрлицо. «ИП» включает ОГРНИП и ИНН из 12 цифр. */
  legalForm?: string | null;
};

/** Тестовый ИНН из прежней заглушки. Контрольная сумма у него тоже не сходится. */
const BLOCKED_INN = new Set(["7700000000"]);

/** Тестовый ОГРН из прежней заглушки. */
const BLOCKED_OGRN = new Set(["1207700000000"]);

/**
 * Чужое здание, которое стояло в заглушке адреса.
 * Наб. и «д. 12» — этого адреса на сайте быть не должно.
 */
const FOREIGN_BUILDING = /пресненская\s+наб(?:ережная)?\.?,?\s*д\.?\s*12/iu;

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

/** ИНН юрлица: 10 цифр, веса 2,4,10,3,5,9,4,6,8. Нули и 7700000000 не публикуем. */
export function validInn10(inn: string): boolean {
  if (!/^\d{10}$/.test(inn)) return false;
  if (/^0+$/.test(inn) || BLOCKED_INN.has(inn)) return false;
  return weighted(inn, INN_10) === Number(inn[9]);
}

/** ИНН физлица: 12 цифр. Ветка ИП, по умолчанию выключена. */
export function validInn12(inn: string): boolean {
  if (!/^\d{12}$/.test(inn)) return false;
  if (/^0+$/.test(inn) || BLOCKED_INN.has(inn)) return false;
  return weighted(inn, INN_12_N11) === Number(inn[10]) && weighted(inn, INN_12_N12) === Number(inn[11]);
}

/** ОГРН: (первые 12 цифр mod 11) mod 10 = 13-я. Остаток 10 даёт контрольную цифру 0. */
export function validOgrn13(ogrn: string): boolean {
  if (!/^\d{13}$/.test(ogrn)) return false;
  if (/^0+$/.test(ogrn) || BLOCKED_OGRN.has(ogrn)) return false;
  const check = Number((BigInt(ogrn.slice(0, 12)) % BigInt(11)) % BigInt(10));
  return check === Number(ogrn[12]);
}

/** ОГРНИП: (первые 14 цифр mod 13) mod 10 = 15-я. */
export function validOgrnip15(ogrn: string): boolean {
  if (!/^\d{15}$/.test(ogrn)) return false;
  if (/^0+$/.test(ogrn)) return false;
  const check = Number((BigInt(ogrn.slice(0, 14)) % BigInt(13)) % BigInt(10));
  return check === Number(ogrn[14]);
}

/** КПП: ровно 9 символов, не нули и не плейсхолдер. */
export function validKpp(kpp: string): boolean {
  if (!/^\d{4}[\dA-Z]{2}\d{3}$/i.test(kpp)) return false;
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

/** По умолчанию выключено: пустая форма и «ООО» — не ИП. */
export function entrepreneurRequisites(legalForm: string | null | undefined): boolean {
  return text(legalForm)?.toLocaleUpperCase("ru") === "ИП";
}

/**
 * true, только если реквизиты не заглушки.
 * По умолчанию это ООО: ИНН из 10 цифр, ОГРН из 13, КПП из 9 символов, адрес и телефон.
 * ИП (ИНН 12, ОГРНИП 15) проходит только при legalForm «ИП».
 * Иначе блок реквизитов не рендерится. Контракт тот же, что в PR #16: один аргумент, boolean.
 */
export function assertPublishedRequisites(
  requisites: Partial<PublishedRequisites> | null | undefined,
): boolean {
  if (!requisites) return false;
  const legalName = text(requisites.legalName);
  const inn = text(requisites.inn);
  const ogrn = text(requisites.ogrn);
  const address = text(requisites.address);
  const phone = text(requisites.phone);
  const phoneHref = text(requisites.phoneHref);
  if (!legalName || !inn || !ogrn || !address || !phone || !phoneHref) return false;
  if (!addressValid(address) || !phoneValid(phone) || !phoneHrefValid(phoneHref)) return false;
  if (entrepreneurRequisites(requisites.legalForm)) {
    return validInn12(inn) && validOgrnip15(ogrn);
  }
  const kpp = text(requisites.kpp);
  if (!kpp || !validKpp(kpp)) return false;
  return validInn10(inn) && validOgrn13(ogrn);
}

export type RequisiteIdentity = {
  legalName: string;
  inn: string;
  ogrn: string;
  address: string;
};

const identityFields = ["legalName", "inn", "ogrn", "address"] as const;

export function emptyRequisiteFields(identity: RequisiteIdentity): Array<(typeof identityFields)[number]> {
  return identityFields.filter((field) => identity[field].trim() === "");
}

/**
 * `show_requisites` и `show_terms` нельзя включать, пока пусты наименование, ИНН, ОГРН или адрес.
 * Телефон публикацию не блокирует: пустой номер просто не выводится.
 */
export function assertRequisiteFlags(
  publication: { show_requisites: boolean; show_terms: boolean },
  identity: RequisiteIdentity,
): void {
  const enabled = (
    [
      ["show_requisites", publication.show_requisites],
      ["show_terms", publication.show_terms],
    ] as const
  )
    .filter(([, on]) => on)
    .map(([name]) => name);
  if (enabled.length === 0) return;
  const missing = emptyRequisiteFields(identity);
  if (missing.length === 0) return;
  throw new Error(`Нельзя включать ${enabled.join(" и ")} при пустых реквизитах: ${missing.join(", ")}`);
}

/**
 * `show_terms` только вместе с `show_site_legal`.
 * `show_cookie_policy` — вместе с `show_site_legal`, наименованием и privacy_contact_email.
 */
export function assertTermsAndCookieFlags(
  publication: { show_terms: boolean; show_cookie_policy: boolean; show_site_legal: boolean },
  identity: { legalName: string; privacy_contact_email: string },
): void {
  if (publication.show_terms && !publication.show_site_legal) {
    throw new Error("Нельзя включать show_terms без show_site_legal");
  }
  if (!publication.show_cookie_policy) return;
  const missing: string[] = [];
  if (!publication.show_site_legal) missing.push("show_site_legal");
  if (identity.legalName.trim() === "") missing.push("legalName");
  if (identity.privacy_contact_email.trim() === "") missing.push("privacy_contact_email");
  if (missing.length > 0) {
    throw new Error(`Нельзя включать show_cookie_policy без: ${missing.join(", ")}`);
  }
}
