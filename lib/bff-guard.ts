import { NextResponse } from "next/server";
import { isDirectForms } from "./forms-mode";

/**
 * Direct mode: the browser calls the public API. These handlers must return
 * before reading the body, so Vercel does not persist contacts, write /tmp,
 * send Telegram, or call /api/scans/*.
 *
 * BFF mode stays on /api/scans/* with the service login. The public contract
 * described for /public/* is a SmartCaptcha browser API (CORS + IP limit),
 * not a service-to-service login, so the BFF is not switched onto /public/*.
 */
export function rejectDirectModeBff(): NextResponse | null {
  if (!isDirectForms()) return null;
  return NextResponse.json(
    { error: "Формы отправляются напрямую в публичный API" },
    { status: 410 }
  );
}
