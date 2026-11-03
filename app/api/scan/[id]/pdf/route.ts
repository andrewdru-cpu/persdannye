import { collectionGateResponse } from "@/lib/collection-gate";
import { clientIpFromRealIp, fetchScanPdf } from "@/lib/lead-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const closed = collectionGateResponse();
  if (closed) return closed;
  try {
    const ip = clientIpFromRealIp(req.headers);
    if (!ip) {
      return Response.json({ error: "Не указан адрес клиента" }, { status: 400, headers: { "cache-control": "no-store" } });
    }
    const { id } = await ctx.params;
    return await fetchScanPdf(id, ip);
  } catch {
    return Response.json({ error: "Ошибка сервера" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
