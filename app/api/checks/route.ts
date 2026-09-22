import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheck } from "@/lib/parser-client";
import { normalizeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z.string().min(3, "Укажите URL сайта"),
  lead: z
    .object({
      name: z.string().trim().max(120).optional(),
      email: z.string().trim().max(200).optional(),
      phone: z.string().trim().max(40).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
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
    const job = await createCheck(
      url,
      name || email || phone ? { name, email, phone } : undefined
    );
    return NextResponse.json(job, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
