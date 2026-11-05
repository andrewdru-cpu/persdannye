import { collectionGateResponse } from "@/lib/collection-gate";
import { submitLead } from "@/lib/lead-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const closed = collectionGateResponse();
  if (closed) return closed;
  try {
    return await submitLead(req);
  } catch {
    return Response.json({ error: "Ошибка сервера" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
