import { NextResponse } from "next/server";
import { LEAD_CONSENT_TEXT_VERSION, marketingConsentForParser } from "@/lib/consent";
import { allowedOriginsFromEnv, isAllowedOrigin, logLeadIp } from "@/lib/lead-guard";
import { leadBodySchema } from "@/lib/lead-schema";
import { addLead } from "@/lib/leads-store";
import { postLeadToParser, unchanged429 } from "@/lib/leads-upstream";
import { notifyNewLead } from "@/lib/notify";
import { isParserConfigured } from "@/lib/parser-auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAllowedOrigin(req.headers.get("origin"), allowedOriginsFromEnv())) {
    logLeadIp("origin rejected", req.headers);
    return NextResponse.json({ error: "Запрос отклонён" }, { status: 403 });
  }

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
    const leadInput = {
      name: parsed.data.name,
      email,
      phone,
      url: parsed.data.url,
      checkId: parsed.data.checkId,
      message: parsed.data.message,
      consent: true as const,
      consent_text_version: parsed.data.consent_text_version || LEAD_CONSENT_TEXT_VERSION,
      ...marketingConsentForParser(parsed.data.marketing_consent === true),
      source: parsed.data.source || "landing",
    };

    if (isParserConfigured()) {
      const upstream = await postLeadToParser(leadInput, req.headers);
      if (upstream.status === 429) {
        logLeadIp("parser 429", req.headers);
        return unchanged429(upstream);
      }
      if (!upstream.ok) {
        await upstream.arrayBuffer().catch(() => undefined);
        logLeadIp(`parser ${upstream.status}`, req.headers);
        return NextResponse.json({ error: "Ошибка сервера" }, { status: 502 });
      }
      await upstream.arrayBuffer().catch(() => undefined);
    }

    const lead = await addLead(leadInput);
    await notifyNewLead(lead);
    logLeadIp("accepted", req.headers);
    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch {
    logLeadIp("request failed", req.headers);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
