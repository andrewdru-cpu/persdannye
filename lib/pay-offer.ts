import { npdNameAndInn, configuredRequisites } from "./requisites-guard";
import { robokassaRecurringEnabled } from "./runtime-flags";
import type { PayInvoice } from "./pay-public";
import { publicContactEmail } from "./support-email";

export type RecurringConsent = {
  fio: string;
  inn: string;
  amount: string;
  period: string;
  planName: string;
  nextChargeDate: string;
  email: string | null;
};

/**
 * Текст чекбокса автосписания. null — чекбокс не показываем:
 * флаг выключен, плательщик не физлицо, это не подписка или нет ФИО и ИНН.
 */
export function recurringConsent(invoice: PayInvoice): RecurringConsent | null {
  if (!robokassaRecurringEnabled()) return null;
  if (invoice.payer !== "person" || !invoice.subscription) return null;
  const identity = npdNameAndInn(configuredRequisites());
  if (!identity) return null;
  return {
    fio: identity.legalName,
    inn: identity.inn,
    amount: invoice.amount,
    period: invoice.subscription.period,
    planName: invoice.subscription.planName,
    nextChargeDate: invoice.subscription.nextChargeDate,
    email: publicContactEmail(),
  };
}

export function offerHref(invoice: PayInvoice): string {
  return invoice.subscription ? "/subscription" : "/offer/one-time";
}
