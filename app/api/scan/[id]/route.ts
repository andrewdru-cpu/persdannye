import { collectionGateResponse } from "@/lib/collection-gate";
import { fetchScan } from "@/lib/lead-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const closed = collectionGateResponse();
  if (closed) return closed;
  try {
    const { id } = await ctx.params;
    return await fetchScan(id);
  } catch {
    return Response.json({ error: "Ошибка сервера" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
