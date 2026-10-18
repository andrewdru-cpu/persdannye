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
