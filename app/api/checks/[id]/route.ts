import { NextResponse } from "next/server";
import { collectionGateResponse } from "@/lib/collection-gate";
import { getCheck, isPublicScanId, publicCheckJob } from "@/lib/parser-client";
import { notifyScanIfNeeded } from "@/lib/notify";
import { logServerError } from "@/lib/safe-log";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const closed = collectionGateResponse();
  if (closed) return closed;
  try {
    const { id } = await ctx.params;
    if (!isPublicScanId(id)) {
      return NextResponse.json({ error: "invalid_id" }, { status: 400 });
    }
    const job = await getCheck(id);
    if (!job) {
      return NextResponse.json({ error: "Проверка не найдена" }, { status: 404 });
    }

    // Every finished landing scan alerts the manager (risks or not).
    await notifyScanIfNeeded(job);

    return NextResponse.json(publicCheckJob(job));
  } catch (err) {
    const code = logServerError("[checks] status failed", err);
    return NextResponse.json({ error: code }, { status: 500 });
  }
}
