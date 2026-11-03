import { signFormOpened, assertFormTicketSecret } from "@/lib/form-ticket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStore = { "cache-control": "no-store" };

export function GET() {
  if (process.env.PD_COLLECTION_ENABLED !== "true") {
    return Response.json({ error: "collection_disabled" }, { status: 503, headers: noStore });
  }
  try {
    const secret = assertFormTicketSecret();
    return Response.json({ ticket: signFormOpened(Date.now(), secret) }, { headers: noStore });
  } catch {
    return Response.json({ error: "Ошибка сервера" }, { status: 500, headers: noStore });
  }
}
