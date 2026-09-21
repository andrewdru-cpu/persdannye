import { NextResponse } from "next/server";
import { getCheck } from "@/lib/parser-client";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const job = await getCheck(id);
    if (!job) {
      return NextResponse.json({ error: "Проверка не найдена" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
