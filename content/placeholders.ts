import { company } from "../lib/company";

/**
 * Значения {{плейсхолдеров}} из раздела 8.4.
 * Неизвестные ключи на превью остаются видимой пометкой TODO.
 * Вне превью неизвестное значение не подставляется.
 */
export const placeholders: Record<string, string> = {
  fines_checked_at: "11.10.2026",
  rules_version: "2026-10-11",
  rules_updated_at: "2026-10-11",
  policy_url: "/privacy",
  consent_url: "/consent",
  consent_lead_url: "/consent-lead",
  privacy_contact_email: company.dpoEmail,
  operator_site: company.website,
  operator_short_name: company.shortName,
  operator_full_name: company.legalName,
  operator_legal_name: company.legalName,
  operator_inn: company.inn,
  operator_ogrn: company.ogrn,
  operator_address: company.address,
  operator_email_pd: company.dpoEmail,
  retention_months_goal1: "36 месяцев",
  marketing_consent_term: "3 года",
};

const token = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function fillPlaceholders(input: string, todos: boolean): string {
  return input.replace(token, (match, key: string) => {
    const value = placeholders[key];
    if (value) return value;
    if (todos) return `TODO: ${key}`;
    return "";
  });
}
