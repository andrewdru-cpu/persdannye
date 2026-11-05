/** Публичные правила счёта. Без секретов, без чтения паролей Robokassa. */

export const INVOICE_ID = /^[A-Za-z0-9_-]{22,80}$/;
const AMOUNT = /^\d{1,7}\.\d{2}$/;
const INV_ID = /^[1-9]\d{0,18}$/;
/** Верхняя граница InvId Robokassa. Сравнение строковое: длина одинаковая, ведущих нулей нет. */
const MAX_INV_ID = "9223372036854775807";

export type InvoiceStatus = "open" | "paid" | "expired";
export type InvoicePayer = "person" | "org";

export type PaySubscription = {
  planName: string;
  period: string;
  nextChargeDate: string;
};

export type PayInvoice = {
  id: string;
  /** Числовой InvId Robokassa. Строковый invoice_id в него не подставляется. */
  invId: string;
  title: string;
  /** Сумма с сервера, две цифры после точки. Клиент её не задаёт. */
  amount: string;
  currency: "RUB";
  status: InvoiceStatus;
  payer: InvoicePayer;
  subscription: PaySubscription | null;
};

export type InvoiceLoad =
  | { ok: true; invoice: PayInvoice }
  | { ok: false; reason: "invalid" | "not_found" | "unavailable" };

export function isInvoiceId(value: string): boolean {
  return INVOICE_ID.test(value);
}

export function formatInvoiceAmount(amount: string): string {
  const [rub, kop] = amount.split(".");
  return `${rub},${kop} ₽`;
}

export function isInvoiceAmount(value: string): boolean {
  if (!AMOUNT.test(value) || value === "0.00") return false;
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

export function isRobokassaInvId(value: string): boolean {
  if (!INV_ID.test(value)) return false;
  if (value.length < MAX_INV_ID.length) return true;
  if (value.length > MAX_INV_ID.length) return false;
  return value <= MAX_INV_ID;
}
