import { NextResponse } from "next/server";
import { collectionGateResponse } from "@/lib/collection-gate";
import { isParserUnavailable } from "@/lib/lead-guard";
import { getCheck, publicCheckJob } from "@/lib/parser-client";
import { notifyScanIfNeeded } from "@/lib/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const closed = collectionGateResponse();
  if (closed) return closed;
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
    }
    const job = await getCheck(id, req.headers);
    if (!job) {
      return NextResponse.json({ error: "Проверка не найдена" }, { status: 404 });
    }

    // Every finished landing scan alerts the manager (risks or not).
    await notifyScanIfNeeded(job, req.headers);

    return NextResponse.json(publicCheckJob(job));
  } catch (e) {
    if (isParserUnavailable(e)) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
