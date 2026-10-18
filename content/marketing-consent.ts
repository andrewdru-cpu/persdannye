import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MARKETING_CONSENT_TEXT_VERSION } from "../lib/consent";
import { safeHref } from "../lib/safe-href";
import { fillPlaceholders } from "./placeholders";

/** Имя файла — строка версии. Другого источника версии нет. */
export const MARKETING_CONSENT_FILE = `content/consents/${MARKETING_CONSENT_TEXT_VERSION}.md`;

export function readMarketingConsentTemplate(): string {
  return readFileSync(join(process.cwd(), MARKETING_CONSENT_FILE), "utf8");
}

/** Подстановка из placeholders.ts. Пустое значение оставляет {{ключ}}. */
export function fillMarketingConsent(template: string, extra: Record<string, string> = {}): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(extra, key)) {
      const override = extra[key].trim();
      return override ? override : match;
    }
    const filled = fillPlaceholders(match, false);
    if (!filled.trim() || filled.includes("{{")) return match;
    return filled;
  });
}

export class UnresolvedMarketingConsentError extends Error {
  constructor() {
    super("В рекламном согласии остались незаполненные реквизиты");
    this.name = "UnresolvedMarketingConsentError";
  }
}

/** Публикация запрещена, пока после подстановки в тексте остаётся {{. */
export function publishMarketingConsent(template: string, extra: Record<string, string> = {}): string {
  const text = fillMarketingConsent(template, extra);
  if (text.includes("{{")) throw new UnresolvedMarketingConsentError();
  return text;
}

/** SHA-256 итогового текста с реквизитами. Эталон появится вместе с настоящими реквизитами. */
export function hashFilledMarketingConsent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export type MarketingInline =
  | { kind: "text"; value: string }
  | { kind: "bold"; value: string }
  | { kind: "link"; value: string; href: string };

export type MarketingBlock =
  | { kind: "p"; inlines: MarketingInline[] }
  | { kind: "ol"; items: MarketingInline[][] };

export function parseMarketingInlines(input: string): MarketingInline[] {
  const items: MarketingInline[] = [];
  let cursor = 0;
  for (const match of input.matchAll(/\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g)) {
    const start = match.index ?? 0;
    if (start > cursor) items.push({ kind: "text", value: input.slice(cursor, start) });
    if (match[1] !== undefined) items.push({ kind: "bold", value: match[1] });
    else items.push({ kind: "link", value: match[2] ?? "", href: match[3] ?? "" });
    cursor = start + match[0].length;
  }
  if (cursor < input.length) items.push({ kind: "text", value: input.slice(cursor) });
  return items;
}

export function parseMarketingMarkdown(source: string): MarketingBlock[] {
  const lines = source.replace(/\n+$/, "").split("\n");
  const blocks: MarketingBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    if (lines[index].trim() === "") {
      index += 1;
      continue;
    }
    if (/^\d+\.\s+/.test(lines[index])) {
      const items: MarketingInline[][] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(parseMarketingInlines(lines[index].replace(/^\d+\.\s+/, "")));
        index += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() !== "" && !/^\d+\.\s+/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ kind: "p", inlines: parseMarketingInlines(paragraph.join(" ")) });
  }
  return blocks;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInlines(items: MarketingInline[]): string {
  return items
    .map((item) => {
      if (item.kind === "bold") return `<strong>${escapeHtml(item.value)}</strong>`;
      if (item.kind === "link") {
        const href = safeHref(item.href);
        if (!href) return escapeHtml(item.value);
        return `<a href="${escapeHtml(href)}" class="text-amber-300 hover:underline">${escapeHtml(item.value)}</a>`;
      }
      return escapeHtml(item.value);
    })
    .join("");
}

/** HTML страницы: жирный, нумерованный список и ссылка. */
export function renderMarketingConsentHtml(source: string): string {
  return parseMarketingMarkdown(source)
    .map((block, index) => {
      if (block.kind === "ol") {
        const items = block.items.map((item) => `<li>${renderInlines(item)}</li>`).join("");
        return `<ol class="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-white/75">${items}</ol>`;
      }
      const onlyBold = block.inlines.length === 1 && block.inlines[0].kind === "bold";
      if (index === 0 && onlyBold && block.inlines[0].kind === "bold") {
        return `<h1 class="text-3xl font-semibold text-white md:text-4xl">${escapeHtml(block.inlines[0].value)}</h1>`;
      }
      return `<p class="mt-4 text-sm leading-relaxed text-white/75">${renderInlines(block.inlines)}</p>`;
    })
    .join("");
}
