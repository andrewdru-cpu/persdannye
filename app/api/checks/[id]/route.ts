import { NextResponse } from "next/server";
import { collectionGateResponse } from "@/lib/collection-gate";
import { getCheck, publicCheckJob } from "@/lib/parser-client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const closed = collectionGateResponse();
  if (closed) return closed;
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const job = await getCheck(id);
    if (!job) {
      return NextResponse.json({ error: "Проверка не найдена" }, { status: 404 });
    }

    return NextResponse.json(publicCheckJob(job));
  } catch {
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
