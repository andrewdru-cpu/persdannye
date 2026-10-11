import { NextResponse } from "next/server";
import { z } from "zod";
import { CONSENT_TEXT_VERSION } from "@/lib/consent";
import { addLead } from "@/lib/leads-store";
import { notifyNewLead } from "@/lib/notify";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(2, "Укажите имя"),
  email: z.string().email("Некорректный email"),
  phone: z.string().optional(),
  company: z.string().optional(),
  url: z.string().optional(),
  checkId: z.string().optional(),
  message: z.string().optional(),
  consent: z.boolean(),
  consent_text_version: z.string().trim().max(64).optional(),
  marketing_consent: z.boolean().optional(),
  marketing_consent_text_version: z.string().trim().max(64).optional(),
  source: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = schema.safeParse(json);
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
    const lead = await addLead({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      company: parsed.data.company,
      url: parsed.data.url,
      checkId: parsed.data.checkId,
      message: parsed.data.message,
      consent: true,
      consent_text_version: parsed.data.consent_text_version || CONSENT_TEXT_VERSION,
      ...(parsed.data.marketing_consent === true
        ? {
            marketing_consent: true as const,
            marketing_consent_text_version:
              parsed.data.marketing_consent_text_version || CONSENT_TEXT_VERSION,
          }
        : {}),
      source: parsed.data.source || "landing",
    });

    await notifyNewLead(lead);

    return NextResponse.json({ ok: true, id: lead.id }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
