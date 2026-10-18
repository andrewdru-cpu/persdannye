import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { collectionGateResponse } from "@/lib/collection-gate";
import { LEAD_CONSENT_TEXT_VERSION, marketingConsentForParser } from "@/lib/consent";
import { leadBodySchema } from "@/lib/lead-schema";
import { notifyNewLead } from "@/lib/notify";
import { logServerError } from "@/lib/safe-log";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const closed = collectionGateResponse();
  if (closed) return closed;
  try {
    const json = await req.json();
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
    const consent_text_version = LEAD_CONSENT_TEXT_VERSION;
    const lead: Lead = {
      id: randomUUID(),
      name: parsed.data.name,
      email,
      phone,
      url: parsed.data.url,
      checkId: parsed.data.checkId,
      message: parsed.data.message,
      consent: true,
      consent_text_version,
      ...marketingConsentForParser(parsed.data.marketing_consent === true),
      createdAt: new Date().toISOString(),
      source: parsed.data.source || "landing",
    };

    await notifyNewLead(lead);

    return NextResponse.json({ ok: true, id: lead.id, consent_text_version }, { status: 201 });
  } catch (err) {
    logServerError("[leads] request failed", err);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
