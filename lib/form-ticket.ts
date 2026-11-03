import { createHmac, timingSafeEqual } from "crypto";
import { FORM_OPEN_MIN_MS } from "./form-open";

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 60 * 1000;

/** Подпись времени открытия. Секрет — только PARSER_API_TOKEN, в браузер не попадает. */
export function signFormOpened(openedAtMs: number, secret: string): string {
  const payload = String(openedAtMs);
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function readFormOpened(
  token: string,
  secret: string,
  now: number,
): { ok: true; openedAt: number } | { ok: false } {
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return { ok: false };
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d{12,16}$/.test(payload)) return { ok: false };
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false };
  const openedAt = Number(payload);
  if (!Number.isSafeInteger(openedAt)) return { ok: false };
  if (openedAt - now > MAX_FUTURE_MS) return { ok: false };
  if (now - openedAt > MAX_AGE_MS) return { ok: false };
  return { ok: true, openedAt };
}

export function formOpenedTooFast(openedAt: number, now: number): boolean {
  return now - openedAt < FORM_OPEN_MIN_MS;
}
