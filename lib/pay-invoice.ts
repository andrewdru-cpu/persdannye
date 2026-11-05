import { parserApiBase, parserApiToken } from "./lead-bff";
import {
  isInvoiceAmount,
  isInvoiceId,
  isRobokassaInvId,
  type InvoiceLoad,
  type InvoicePayer,
  type InvoiceStatus,
  type PayInvoice,
  type PaySubscription,
} from "./pay-public";

/**
 * Контракт счёта с парсером.
 *
 * GET {PARSER_API_BASE}/api/pay/invoices/{invoiceId}
 * Authorization: Bearer PARSER_API_TOKEN
 *
 * 200 JSON:
 * {
 *   "invoice_id": "<тот же id, что в пути>",
 *   "inv_id": 12345,
 *   "title": "название услуги",
 *   "amount": "1234.56",
 *   "currency": "RUB",
 *   "status": "open" | "paid" | "expired",
 *   "payer": "person" | "org",
 *   "subscription": null | {
 *     "plan_name": "название",
 *     "period": "месяц",
 *     "next_charge_date": "2026-12-05"
 *   }
 * }
 *
 * Сумма, название и статус берутся только отсюда. Клиент их не передаёт.
 * inv_id — числовой InvId Robokassa. Строковый invoice_id уходит в Shp_invoiceId.
 * payer=org покрывает организацию и ИП: автосписания для них не включаются.
 * 404 — счёта нет. Пока эндпоинта нет, страницу можно смотреть с PAY_INVOICE_STUB=true.
 */

const PARSER_TIMEOUT_MS = 20_000;

function plain(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max || /[\u0000-\u001F<>]/.test(trimmed)) return null;
  return trimmed;
}

function invId(value: unknown): string | null {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 1) return null;
    return isRobokassaInvId(String(value)) ? String(value) : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isRobokassaInvId(trimmed) ? trimmed : null;
}

function status(value: unknown): InvoiceStatus | null {
  if (value === "open" || value === "paid" || value === "expired") return value;
  return null;
}

function payer(value: unknown): InvoicePayer {
  return value === "person" ? "person" : "org";
}

function subscription(value: unknown): PaySubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const planName = plain(record.plan_name, 80);
  const period = plain(record.period, 40);
  const nextChargeDate = plain(record.next_charge_date, 40);
  if (!planName || !period || !nextChargeDate) return null;
  return { planName, period, nextChargeDate };
}

/** Разбирает ответ парсера. Чужие поля, включая контакты плательщика, отбрасываются. */
export function parseInvoice(id: string, data: unknown): PayInvoice | null {
  if (!isInvoiceId(id) || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  if (record.invoice_id !== id) return null;
  const numericId = invId(record.inv_id);
  const title = plain(record.title, 120);
  const amount = typeof record.amount === "string" && isInvoiceAmount(record.amount) ? record.amount : null;
  const invoiceStatus = status(record.status);
  if (!numericId || !title || !amount || !invoiceStatus) return null;
  if (record.currency !== undefined && record.currency !== "RUB") return null;
  return {
    id,
    invId: numericId,
    title,
    amount,
    currency: "RUB",
    status: invoiceStatus,
    payer: payer(record.payer),
    subscription: subscription(record.subscription),
  };
}

function stubInvoice(id: string): InvoiceLoad {
  if (process.env.PAY_INVOICE_STUB_ID?.trim() !== id) {
    return { ok: false, reason: "not_found" };
  }
  const plan = process.env.PAY_INVOICE_STUB_PLAN?.trim() ?? "";
  const invoice = parseInvoice(id, {
    invoice_id: id,
    inv_id: process.env.PAY_INVOICE_STUB_INV_ID,
    title: process.env.PAY_INVOICE_STUB_TITLE,
    amount: process.env.PAY_INVOICE_STUB_AMOUNT,
    currency: "RUB",
    status: process.env.PAY_INVOICE_STUB_STATUS?.trim() || "open",
    payer: process.env.PAY_INVOICE_STUB_PAYER?.trim() || "org",
    subscription: plan
      ? {
          plan_name: plan,
          period: process.env.PAY_INVOICE_STUB_PERIOD,
          next_charge_date: process.env.PAY_INVOICE_STUB_NEXT,
        }
      : null,
  });
  if (!invoice) return { ok: false, reason: "unavailable" };
  return { ok: true, invoice };
}

async function discard(res: Response): Promise<void> {
  await res.arrayBuffer().catch(() => undefined);
}

export async function loadInvoice(id: string, fetchImpl: typeof fetch = fetch): Promise<InvoiceLoad> {
  if (!isInvoiceId(id)) return { ok: false, reason: "invalid" };
  if (process.env.PAY_INVOICE_STUB === "true") return stubInvoice(id);

  const token = parserApiToken();
  if (!token) return { ok: false, reason: "unavailable" };
  let base: string;
  try {
    base = parserApiBase();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  let upstream: Response;
  try {
    upstream = await fetchImpl(`${base}/api/pay/invoices/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/json",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(PARSER_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  if (upstream.status === 404) {
    await discard(upstream);
    return { ok: false, reason: "not_found" };
  }
  if (!upstream.ok) {
    await discard(upstream);
    return { ok: false, reason: "unavailable" };
  }

  const text = await upstream.text();
  if (text.length > 100_000) return { ok: false, reason: "unavailable" };
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const invoice = parseInvoice(id, data);
  if (!invoice) return { ok: false, reason: "unavailable" };
  return { ok: true, invoice };
}
