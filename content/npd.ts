import { fillPlaceholders } from "./placeholders";

export const NPD_STATUS = "плательщик налога на профессиональный доход";

export const INDEPENDENT_SERVICE_LINE =
  "Независимый частный сервис, не связан с Роскомнадзором и государственными органами.";

export const CHECK_DISCLAIMER =
  "Результаты проверки носят информационный характер и не являются юридической консультацией.";

/** Строка с {{operator_fio}} и {{operator_inn}}. Пустые значения не подменяются выдуманными. */
export function npdIdentityClause(todos: boolean): string {
  const fio = fillPlaceholders("{{operator_fio}}", todos).trim();
  const inn = fillPlaceholders("{{operator_inn}}", todos).trim();
  const ready = (value: string) => value.length > 0 && !value.startsWith("TODO:");
  if (todos && !ready(fio) && !ready(inn)) {
    return `TODO: operator_fio, ${NPD_STATUS}, ИНН TODO: operator_inn`;
  }
  if (ready(fio) && ready(inn)) {
    return `${fio}, ${NPD_STATUS}, ИНН ${inn}`;
  }
  return NPD_STATUS;
}

export function npdIdentitySentence(todos: boolean): string {
  const clause = npdIdentityClause(todos);
  return clause.charAt(0).toUpperCase() + clause.slice(1);
}
