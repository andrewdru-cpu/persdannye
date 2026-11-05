import { loadInvoice } from "@/lib/pay-invoice";
import { recurringConsent } from "@/lib/pay-offer";
import { isInvoiceId } from "@/lib/pay-public";
import { robokassaPaymentUrl, robokassaSigner } from "@/lib/robokassa";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Старт оплаты по счёту. ResultURL здесь нет: его принимает парсер
 * на https://api.scanweb.pro/api/pay/robokassa/result
 * Сумму из тела запроса не читаем.
 */

const HEADERS = { "cache-control": "no-store" };

function json(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: HEADERS });
}

export async function POST(req: Request): Promise<Response> {
  const signer = robokassaSigner();
  if (!signer) return json(503, "disabled");

  let text: string;
  try {
    text = await req.text();
  } catch {
    return json(400, "bad_request");
  }
  if (text.length > 4096) return json(400, "bad_request");

  let body: unknown;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    return json(400, "bad_request");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, "bad_request");
  const record = body as Record<string, unknown>;
  if (typeof record.invoiceId !== "string" || !isInvoiceId(record.invoiceId)) return json(400, "bad_request");
  if (record.acceptOffer !== true) return json(400, "offer_required");
  if ("acceptRecurring" in record && typeof record.acceptRecurring !== "boolean") return json(400, "bad_request");

  const loaded = await loadInvoice(record.invoiceId);
  if (!loaded.ok) {
    if (loaded.reason === "not_found") return json(404, "not_found");
    return json(503, "unavailable");
  }
  if (loaded.invoice.status !== "open") return json(409, "not_payable");

  const wantRecurring = record.acceptRecurring === true;
  if (wantRecurring && !recurringConsent(loaded.invoice)) return json(400, "recurring_unavailable");

  const url = robokassaPaymentUrl({
    merchantLogin: signer.merchantLogin,
    outSum: loaded.invoice.amount,
    invId: loaded.invoice.invId,
    invoiceId: loaded.invoice.id,
    description: loaded.invoice.title,
    password: signer.password1,
    algorithm: signer.algorithm,
    isTest: signer.isTest,
    recurring: wantRecurring,
  });
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json(503, "unavailable");
  }
  if (parsed.origin !== "https://auth.robokassa.ru") return json(503, "unavailable");
  if (url.includes(signer.password1)) return json(503, "unavailable");

  return Response.json({ url }, { headers: HEADERS });
}
