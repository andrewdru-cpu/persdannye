/**
 * Manager alerts from the Next.js BFF. Never expose Telegram/parser tokens.
 * Messages carry only an id, the site domain, the score, and a cabinet link.
 * Name, email, phone, company, and comment never leave this process for Telegram.
 */

import { company } from "./company";
import { logServerError } from "./safe-log";
import { isTelegramConfigured, sendTelegramMessage } from "./telegram";
import type { CheckJob, Lead } from "./types";

const notifiedScans = new Set<string>();
const skippedScans = new Set<string>();

export function shouldNotifyScan(job: CheckJob): boolean {
  return String(job.phase) === "done";
}

function logTelegramSkipped(kind: "scan" | "lead"): void {
  console.warn(
    `[notify] TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы — пропуск алерта (${kind})`
  );
}

function cabinetBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  return (fromEnv || company.website).replace(/\/$/, "");
}

export function cabinetLink(id: string): string {
  return `${cabinetBase()}/cabinet/${encodeURIComponent(id)}`;
}

function hostnameOnly(value?: string | null): string | null {
  if (!value) return null;
  try {
    const host = new URL(value).hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || !host.includes(".") || host.includes("@")) return null;
    return host;
  } catch {
    return null;
  }
}

function publicDomain(url?: string | null, domain?: string | null): string {
  return hostnameOnly(url) || hostnameOnly(domain ? `https://${domain}` : null) || "—";
}

function scoreLabel(score?: number | null): string {
  return typeof score === "number" && Number.isFinite(score) ? String(score) : "—";
}

export function formatScanMessage(job: CheckJob): string {
  const id = job.scanId || job.id;
  return [
    "Проверка завершена",
    `ID: ${id}`,
    `Домен: ${publicDomain(job.url, job.domain)}`,
    `Балл: ${scoreLabel(job.score)}`,
    `Кабинет: ${cabinetLink(id)}`,
  ].join("\n");
}

export function formatLeadMessage(lead: Lead): string {
  return [
    "Новая заявка",
    `ID: ${lead.id}`,
    `Домен: ${publicDomain(lead.url)}`,
    "Балл: —",
    `Кабинет: ${cabinetLink(lead.id)}`,
  ].join("\n");
}

/** Notify when a landing scan finishes. Text only: id, domain, score, cabinet link. */
export async function notifyScanIfNeeded(job: CheckJob): Promise<void> {
  if (!shouldNotifyScan(job)) return;

  const key = job.scanId || job.id;
  if (!isTelegramConfigured()) {
    if (!skippedScans.has(key)) {
      skippedScans.add(key);
      logTelegramSkipped("scan");
    }
    return;
  }
  if (notifiedScans.has(key)) return;
  notifiedScans.add(key);

  try {
    await sendTelegramMessage(formatScanMessage(job));
  } catch (err) {
    notifiedScans.delete(key);
    logServerError("[notify] scan telegram failed", err);
  }
}

export async function notifyNewLead(lead: Lead): Promise<void> {
  if (!isTelegramConfigured()) {
    logTelegramSkipped("lead");
    return;
  }
  try {
    await sendTelegramMessage(formatLeadMessage(lead));
  } catch (err) {
    logServerError("[notify] lead telegram failed", err);
  }
}
