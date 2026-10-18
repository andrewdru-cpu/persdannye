import { NextResponse } from "next/server";
import { collectionGateResponse } from "@/lib/collection-gate";
import { isParserUnavailable } from "@/lib/lead-guard";
import { getCheckPdf } from "@/lib/parser-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Proxies parser GET /api/scans/{id}/pdf with server Bearer.
 * The browser never sees PARSER_* or Telegram tokens.
 */
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
    const pdf = await getCheckPdf(id, req.headers);
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
  } catch (e) {
    if (isParserUnavailable(e)) {
      return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
