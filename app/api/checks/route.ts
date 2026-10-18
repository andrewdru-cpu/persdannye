import { NextResponse } from "next/server";
import { z } from "zod";
import { rejectDirectModeBff } from "@/lib/bff-guard";
import { isScanConsentRequiredError } from "@/lib/consent";
import { createCheck, publicCheckJob } from "@/lib/parser-client";
import { normalizeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z.string().min(3, "Укажите URL сайта"),
  lead: z
    .object({
      name: z.string().trim().max(120).optional(),
      email: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(40).optional(),
      consent: z.boolean().optional(),
      consent_text_version: z.string().trim().max(64).optional(),
      marketing_consent: z.boolean().optional(),
      marketing_consent_text_version: z.string().trim().max(64).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const blocked = rejectDirectModeBff();
  if (blocked) return blocked;
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Некорректные данные" },
        { status: 400 }
      );
    }
    let url: string;
    try {
      url = normalizeUrl(parsed.data.url);
    } catch {
      return NextResponse.json({ error: "Некорректный URL" }, { status: 400 });
    }
    const lead = parsed.data.lead;
    const name = lead?.name || undefined;
    const email = lead?.email || undefined;
    const phone = lead?.phone || undefined;
    const hasContact = Boolean(name || email || phone);
    const job = await createCheck(
      url,
      hasContact
        ? {
            name,
            email,
            phone,
            consent: lead?.consent,
            consent_text_version: lead?.consent_text_version,
            marketing_consent: lead?.marketing_consent,
            marketing_consent_text_version: lead?.marketing_consent_text_version,
          }
        : undefined
    );
    return NextResponse.json(publicCheckJob(job), { status: 201 });
  } catch (e) {
    if (isScanConsentRequiredError(e)) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
