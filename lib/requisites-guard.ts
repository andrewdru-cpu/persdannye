export type PublishedRequisites = {
  legalName: string;
  inn: string;
  ogrn: string;
  address: string;
  phone: string;
  phoneHref: string;
  legalForm?: string;
};

const inn10Weights = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const inn11Weights = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const inn12Weights = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function weightedDigit(digits: string, weights: number[]): number {
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  return (sum % 11) % 10;
}

/** 10 цифр — организация, 12 — физическое лицо. Иная длина не проходит. */
export function validInnChecksum(inn: string): boolean {
  const digits = digitsOnly(inn);
  if (digits.length === 10) return weightedDigit(digits, inn10Weights) === Number(digits[9]);
  if (digits.length === 12) {
    return (
      weightedDigit(digits, inn11Weights) === Number(digits[10]) &&
      weightedDigit(digits, inn12Weights) === Number(digits[11])
    );
  }
  return false;
}

/** 13 цифр — ОГРН, 15 — ОГРНИП. */
export function validOgrnChecksum(ogrn: string, kind: "ОГРН" | "ОГРНИП"): boolean {
  const digits = digitsOnly(ogrn);
  if (kind === "ОГРН" && digits.length === 13) {
    return Number((BigInt(digits.slice(0, 12)) % BigInt(11)) % BigInt(10)) === Number(digits[12]);
  }
  if (kind === "ОГРНИП" && digits.length === 15) {
    return Number((BigInt(digits.slice(0, 14)) % BigInt(13)) % BigInt(10)) === Number(digits[14]);
  }
  return false;
}

/** Пустые поля, ИНН из нулей, 7700000000, плейсхолдер {{ и неверная контрольная сумма нельзя публиковать. */
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
  const inn = digitsOnly(requisites.inn);
  const ogrn = digitsOnly(requisites.ogrn);
  if (inn === "7700000000" || /^0+$/.test(inn)) return "Тестовый ИНН";
  if (/^0+$/.test(ogrn)) return "Тестовый ОГРН";
  if (fields.some((value) => value.includes("{{"))) return "Плейсхолдер в реквизитах";
  const ip = requisites.legalForm?.trim().toLocaleUpperCase("ru") === "ИП";
  if (!validInnChecksum(inn) || (ip ? inn.length !== 12 : inn.length !== 10)) return "Некорректный ИНН";
  if (!validOgrnChecksum(ogrn, ip ? "ОГРНИП" : "ОГРН")) {
    return ip ? "Некорректный ОГРНИП" : "Некорректный ОГРН";
  }
  return null;
}

export function assertPublishedRequisites(show: boolean, requisites: PublishedRequisites): void {
  if (!show) return;
  const error = publishedRequisitesError(requisites);
  if (error) throw new Error(`${error}. Настоящие реквизиты даёт только Андрей.`);
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
