/**
 * Server-only Telegram Bot API. Never import from client components.
 * Tokens stay in env and are never returned to the browser.
 */

const TELEGRAM_API = "https://api.telegram.org";

export function isTelegramConfigured(): boolean {
  return Boolean(getBotToken() && getChatId());
}

function getBotToken(): string | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return token || null;
}

function getChatId(): string | null {
  const id = process.env.TELEGRAM_CHAT_ID?.trim();
  return id || null;
}

export function notifyOnCleanEnabled(): boolean {
  return process.env.TELEGRAM_NOTIFY_ON_CLEAN === "true";
}

async function telegramCall(
  method: string,
  body: BodyInit,
  headers?: HeadersInit
): Promise<void> {
  const token = getBotToken();
  const chatId = getChatId();
  if (!token || !chatId) return;

  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers,
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Telegram ${method} failed: ${res.status} ${text}`.slice(0, 400));
  }
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const chatId = getChatId();
  if (!isTelegramConfigured() || !chatId) return;

  const payload = JSON.stringify({
    chat_id: chatId,
    text: text.slice(0, 4090),
    disable_web_page_preview: true,
  });

  await telegramCall("sendMessage", payload, {
    "Content-Type": "application/json",
    Accept: "application/json",
  });
}

export async function sendTelegramDocument(
  buffer: Buffer,
  filename: string,
  caption?: string
): Promise<void> {
  const chatId = getChatId();
  if (!isTelegramConfigured() || !chatId) return;

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append(
    "document",
    new Blob([new Uint8Array(buffer)], { type: "application/pdf" }),
    filename
  );
  if (caption) {
    form.append("caption", caption.slice(0, 1024));
  }

  await telegramCall("sendDocument", form);
}
