import { createHmac, timingSafeEqual } from "crypto";
import { FORM_OPEN_MIN_MS } from "./form-open";

export const FORM_TICKET_SECRET_MIN_BYTES = 32;
export const FORM_TICKET_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const MAX_FUTURE_MS = 60 * 1000;

export class FormTicketSecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormTicketSecretError";
  }
}

/**
 * Секрет подписи. Пустая строка, короткий ключ и совпадение с PARSER_API_TOKEN
 * не используются: запасного ключа нет.
 */
export function formTicketSecret(): { ok: true; secret: string } | { ok: false } {
  const secret = process.env.FORM_TICKET_SECRET?.trim() ?? "";
  if (Buffer.byteLength(secret, "utf8") < FORM_TICKET_SECRET_MIN_BYTES) return { ok: false };
  const parserToken = process.env.PARSER_API_TOKEN?.trim() ?? "";
  if (parserToken.length > 0 && secret === parserToken) return { ok: false };
  return { ok: true, secret };
}

/** Падает, если секрет пуст, короче 32 байт или совпадает с токеном парсера. */
export function assertFormTicketSecret(): string {
  const secret = process.env.FORM_TICKET_SECRET?.trim() ?? "";
  if (Buffer.byteLength(secret, "utf8") < FORM_TICKET_SECRET_MIN_BYTES) {
    throw new FormTicketSecretError("FORM_TICKET_SECRET must be at least 32 bytes");
  }
  const parserToken = process.env.PARSER_API_TOKEN?.trim() ?? "";
  if (parserToken.length > 0 && secret === parserToken) {
    throw new FormTicketSecretError("FORM_TICKET_SECRET must not equal PARSER_API_TOKEN");
  }
  return secret;
}

/** Проверка при старте только когда сбор включён флагом PD_COLLECTION_ENABLED. */
export function enforceFormTicketSecretAtStartup(): void {
  if (process.env.PD_COLLECTION_ENABLED !== "true") return;
  assertFormTicketSecret();
}

/** Подпись времени открытия. Секрет только FORM_TICKET_SECRET, в браузер не попадает. */
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
  if (now - openedAt > FORM_TICKET_MAX_AGE_MS) return { ok: false };
  return { ok: true, openedAt };
}

export function formOpenedTooFast(openedAt: number, now: number): boolean {
  return now - openedAt < FORM_OPEN_MIN_MS;
}
