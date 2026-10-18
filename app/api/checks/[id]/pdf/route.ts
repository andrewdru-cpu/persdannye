import { NextResponse } from "next/server";
import { collectionGateResponse } from "@/lib/collection-gate";
import { getCheckPdf, isPublicScanId } from "@/lib/parser-client";
import { logServerError } from "@/lib/safe-log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Proxies parser GET /api/scans/{id}/pdf with server Bearer.
 * The browser never sees PARSER_* or Telegram tokens.
 */
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
    const pdf = await getCheckPdf(id);
    if (!pdf) {
      return NextResponse.json(
        { error: "PDF ещё не готов или проверка в демо-режиме" },
        { status: 404 }
      );
    }
    return new NextResponse(new Uint8Array(pdf.buffer), {
      status: 200,
      headers: {
        "Content-Type": pdf.contentType,
        "Content-Disposition": `attachment; filename="${pdf.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const code = logServerError("[checks] pdf failed", err);
    return NextResponse.json({ error: code }, { status: 500 });
  }
}
