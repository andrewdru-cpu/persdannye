import { NextResponse } from "next/server";
import { getCheckPdf } from "@/lib/parser-client";

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
  try {
    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "id обязателен" }, { status: 400 });
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
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
