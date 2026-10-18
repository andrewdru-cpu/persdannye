export type PublishedRequisites = {
  legalName: string | null;
  inn: string | null;
  ogrn: string | null;
  address: string | null;
  phone: string | null;
  phoneHref: string | null;
};

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

/** ИНН юрлица (10) или физлица (12). Нули и 7700000000 не публикуем. */
function innValid(inn: string): boolean {
  if (!/^\d{10}$|^\d{12}$/.test(inn)) return false;
  if (/^0+$/.test(inn) || BLOCKED_INN.has(inn)) return false;
  if (inn.length === 10) return weighted(inn, INN_10) === Number(inn[9]);
  const n11 = weighted(inn, INN_12_N11);
  const n12 = weighted(inn, INN_12_N12);
  return n11 === Number(inn[10]) && n12 === Number(inn[11]);
}

/** ОГРН (13) или ОГРНИП (15). Остаток 10 даёт контрольную цифру 0. */
function ogrnValid(ogrn: string): boolean {
  if (!/^\d{13}$|^\d{15}$/.test(ogrn)) return false;
  if (/^0+$/.test(ogrn) || BLOCKED_OGRN.has(ogrn)) return false;
  if (ogrn.length === 13) {
    const check = Number((BigInt(ogrn.slice(0, 12)) % BigInt(11)) % BigInt(10));
    return check === Number(ogrn[12]);
  }
  const check = Number((BigInt(ogrn.slice(0, 14)) % BigInt(13)) % BigInt(10));
  return check === Number(ogrn[14]);
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
 * true, только если все поля реквизитов заполнены не-заглушками,
 * а ИНН и ОГРН/ОГРНИП проходят проверку контрольных сумм.
 * Иначе блок реквизитов на /privacy не рендерится.
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
  return (
    innValid(inn) &&
    ogrnValid(ogrn) &&
    addressValid(address) &&
    phoneValid(phone) &&
    phoneHrefValid(phoneHref)
  );
}
