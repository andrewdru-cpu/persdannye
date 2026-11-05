export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Заявка на этот origin не принимается: тело не читается и не логируется. */
function gone(): Response {
  return Response.json({ error: "gone" }, { status: 410, headers: { "cache-control": "no-store" } });
}

export function GET() {
  return gone();
}

export function POST() {
  return gone();
}

export function PUT() {
  return gone();
}

export function PATCH() {
  return gone();
}

export function DELETE() {
  return gone();
}
