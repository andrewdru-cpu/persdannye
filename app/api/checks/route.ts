import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheck } from "@/lib/parser-client";
import { normalizeUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z.string().min(3, "Укажите URL сайта"),
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
    const job = await createCheck(url);
    return NextResponse.json(job, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
