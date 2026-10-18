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
