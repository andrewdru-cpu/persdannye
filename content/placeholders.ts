import { company, privacyContactLabel } from "../lib/company";
import { assertPublishedRequisites } from "../lib/requisites-guard";
import { operatorConsentPhrase } from "./consents";

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
  operator_site: company.website,
  operator_short_name: company.shortName,
  operator_full_name: company.legalName,
  operator_legal_name: company.legalName,
  operator_inn: company.inn,
  operator_ogrn: company.ogrn,
  operator_address: company.address,
  retention_months_goal1: "36 месяцев",
  marketing_consent_term: "3 года",
};

const token = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

function publishedOperatorValue(key: string): string | undefined {
  const published = assertPublishedRequisites(company);
  if (!published) return undefined;
  if (key === "operator_full_name" || key === "operator_legal_name") return published.legalName;
  if (key === "operator_inn") return published.inn;
  if (key === "operator_ogrn") return published.ogrn;
  if (key === "operator_address") return published.address;
  return undefined;
}

export function fillPlaceholders(input: string, todos: boolean): string {
  return input.replace(token, (match, key: string) => {
    // В текстах остаётся только {{privacy_contact_email}}. Старый ключ, если всплывёт, читает то же поле.
    if (key === "privacy_contact_email" || key === "operator_email_pd") {
      return privacyContactLabel() ?? "";
    }
    if (key === "operator_consent") return operatorConsentPhrase("full");
    if (key === "operator_consent_marketing") return operatorConsentPhrase("contact");
    const publishedValue = publishedOperatorValue(key);
    if (publishedValue) return publishedValue;
    const value = placeholders[key];
    if (value) return value;
    if (todos) return `TODO: ${key}`;
    return "";
  });
}
