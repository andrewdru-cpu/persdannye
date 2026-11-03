import { collectionGateResponse } from "@/lib/collection-gate";
import { formTicketSecret, signFormOpened } from "@/lib/form-ticket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "cache-control": "no-store" };

export function GET() {
  const closed = collectionGateResponse();
  if (closed) return closed;
  const secret = formTicketSecret();
  if (!secret.ok) {
    return Response.json({ error: "ticket_unavailable" }, { status: 503, headers: noStore });
  }
  return Response.json({ ticket: signFormOpened(Date.now(), secret.secret) }, { headers: noStore });
}
