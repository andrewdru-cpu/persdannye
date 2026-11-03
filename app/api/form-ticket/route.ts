import { signFormOpened } from "@/lib/form-ticket";
import { parserApiToken } from "@/lib/lead-bff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  const token = parserApiToken();
  if (!token) {
    return Response.json({ error: "Ошибка сервера" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
  return Response.json(
    { ticket: signFormOpened(Date.now(), token) },
    { headers: { "cache-control": "no-store" } },
  );
}
