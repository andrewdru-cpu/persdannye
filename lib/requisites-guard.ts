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
