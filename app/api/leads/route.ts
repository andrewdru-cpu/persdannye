import { NextResponse } from "next/server";
import { collectionGateResponse } from "@/lib/collection-gate";
import { LEAD_CONSENT_TEXT_VERSION, marketingConsentForParser } from "@/lib/consent";
import {
  allowedOriginsFromEnv,
  isAllowedOrigin,
  isParserUnavailable,
  logLeadIp,
  parserSigningBlocked,
} from "@/lib/lead-guard";
import { leadBodySchema } from "@/lib/lead-schema";
import { addLead } from "@/lib/leads-store";
import { classifyLeadUpstream, postLeadToParser } from "@/lib/leads-upstream";
import { notifyNewLead } from "@/lib/notify";
import { isParserConfigured } from "@/lib/parser-auth";
import { buildPublicLeadBody, exceedsPublicLeadBytes, isIdempotencyKey } from "@/lib/public-lead";

export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}

export async function POST(req: Request) {
  const closed = collectionGateResponse();
  if (closed) return closed;

  if (!isAllowedOrigin(req.headers.get("origin"), allowedOriginsFromEnv())) {
    logLeadIp("origin rejected", req.headers);
    return NextResponse.json({ error: "Запрос отклонён" }, { status: 403 });
  }

  const idempotencyKey = req.headers.get("idempotency-key");
  if (!isIdempotencyKey(idempotencyKey)) {
    return NextResponse.json({ error: "idempotency_key_invalid" }, { status: 400 });
  }

  try {
    const raw = await req.text();
    if (exceedsPublicLeadBytes(raw)) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }
    let json: unknown;
    try {
      json = JSON.parse(raw) as unknown;
    } catch {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }
    const parsed = leadBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      );
    }
    if (parsed.data.consent !== true) {
      return NextResponse.json(
        { error: "Нужно согласие на обработку персональных данных" },
        { status: 400 }
      );
    }
    const email = parsed.data.email?.trim() || undefined;
    const phone = parsed.data.phone?.trim() || undefined;
    if (!email && !phone) {
      return NextResponse.json({ error: "Укажите телефон или e-mail" }, { status: 400 });
    }
    const marketing = parsed.data.marketing_consent === true;
    const leadInput = {
      name: parsed.data.name,
      email,
      phone,
      url: parsed.data.url,
      checkId: parsed.data.checkId,
      message: parsed.data.message,
      consent: true as const,
      consent_text_version: parsed.data.consent_text_version || LEAD_CONSENT_TEXT_VERSION,
      ...marketingConsentForParser(marketing),
      source: parsed.data.source || "landing",
    };
    const publicBody = buildPublicLeadBody({
      name: leadInput.name,
      email,
      phone,
      url: leadInput.url,
      checkId: leadInput.checkId,
      message: leadInput.message,
      source: leadInput.source,
      marketingConsent: marketing,
    });
    if (exceedsPublicLeadBytes(JSON.stringify(publicBody))) {
      return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
    }

    if (parserSigningBlocked()) {
      logLeadIp("signing unavailable", req.headers);
      return unavailable();
    }

    if (isParserConfigured()) {
      const upstream = await postLeadToParser(publicBody, req.headers, idempotencyKey);
      const result = await classifyLeadUpstream(upstream);
      if (result.kind === "response") {
        logLeadIp(`parser ${result.response.status}`, req.headers);
        return result.response;
      }
      if (result.kind === "generic") {
        logLeadIp(`parser ${upstream.status}`, req.headers);
        return NextResponse.json({ error: "Ошибка сервера" }, { status: 502 });
      }
    }

    const lead = await addLead(leadInput);
    await notifyNewLead(lead);
    logLeadIp("accepted", req.headers);
    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (err) {
    if (isParserUnavailable(err)) {
      logLeadIp("signing unavailable", req.headers);
      return unavailable();
    }
    logLeadIp("request failed", req.headers);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
