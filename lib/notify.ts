/**
 * Manager alerts from the Next.js BFF. Never expose Telegram/parser tokens.
 */

import { findLeadForCheck } from "./leads-store";
import { getCheckPdf } from "./parser-client";
import {
  isTelegramConfigured,
  notifyOnCleanEnabled,
  sendTelegramDocument,
  sendTelegramMessage,
} from "./telegram";
import type { CheckJob, Lead } from "./types";

const notifiedScans = new Set<string>();

function formatTs(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

function scanHasRisks(job: CheckJob): boolean {
  return job.push === true || (Array.isArray(job.findings) && job.findings.length > 0);
}

export function shouldNotifyScan(job: CheckJob): boolean {
  if (String(job.phase) !== "done") return false;
  if (scanHasRisks(job)) return true;
  return notifyOnCleanEnabled();
}

function formatScanMessage(job: CheckJob, lead?: Lead | null): string {
  const risks = scanHasRisks(job);
  const lines: string[] = [
    risks
      ? "⚠️ ПерсДанные · найдены риски"
      : "✅ ПерсДанные · проверка без рисков",
    "",
    `Домен: ${job.domain}`,
    `URL: ${job.url}`,
    `Балл: ${typeof job.score === "number" ? job.score : "—"}`,
    `Фаза: ${job.phase}`,
    `Источник: landing`,
    `Время: ${formatTs(job.updatedAt)}`,
  ];
  if (job.mock) lines.push("Режим: mock (PARSER_API_BASE не задан)");
  if (job.scanId) lines.push(`Scan ID: ${job.scanId}`);

  if (job.findings.length > 0) {
    lines.push("", "Находки:");
    job.findings.slice(0, 18).forEach((f, i) => {
      lines.push(`${i + 1}. ${f.rule_id} / ${f.title}`);
      if (f.fact) lines.push(`   ${f.fact}`);
    });
    if (job.findings.length > 18) {
      lines.push(`… ещё ${job.findings.length - 18}`);
    }
  }

  if (lead && (lead.name || lead.phone || lead.email || lead.company)) {
    lines.push("", "Контакты:");
    if (lead.name) lines.push(`Имя: ${lead.name}`);
    if (lead.phone) lines.push(`Телефон: ${lead.phone}`);
    if (lead.email) lines.push(`Email: ${lead.email}`);
    if (lead.company) lines.push(`Компания: ${lead.company}`);
  }

  return lines.join("\n");
}

export function formatLeadMessage(lead: Lead): string {
  const lines = [
    "🆕 ПерсДанные · новая заявка",
    "",
    `Имя: ${lead.name}`,
    lead.phone ? `Телефон: ${lead.phone}` : null,
    `Email: ${lead.email}`,
    lead.company ? `Компания: ${lead.company}` : null,
    lead.url ? `Сайт: ${lead.url}` : null,
    lead.checkId ? `Check ID: ${lead.checkId}` : null,
    lead.message ? `Комментарий: ${lead.message}` : null,
    `Источник: ${lead.source || "landing"}`,
    `Время: ${formatTs(lead.createdAt)}`,
  ].filter((x): x is string => Boolean(x));
  return lines.join("\n");
}

/**
 * Notify manager as soon as a scan finishes with risks (or clean, if enabled).
 * Sends text first, then PDF via sendDocument if pdf_ready.
 */
export async function notifyScanIfNeeded(job: CheckJob): Promise<void> {
  if (!isTelegramConfigured()) return;
  if (!shouldNotifyScan(job)) return;

  const key = job.scanId || job.id;
  if (notifiedScans.has(key)) return;
  notifiedScans.add(key);

  try {
    const lead = await findLeadForCheck(job.id, job.url);
    await sendTelegramMessage(formatScanMessage(job, lead));

    if (job.pdfReady && !job.mock) {
      try {
        const pdf = await getCheckPdf(job.id);
        if (pdf) {
          await sendTelegramDocument(
            pdf.buffer,
            pdf.filename,
            `${job.domain} · балл ${job.score ?? "—"} · landing`
          );
        }
      } catch (err) {
        console.error("[notify] PDF send failed", err);
      }
    }
  } catch (err) {
    notifiedScans.delete(key);
    console.error("[notify] scan telegram failed", err);
  }
}

export async function notifyNewLead(lead: Lead): Promise<void> {
  if (!isTelegramConfigured()) return;
  try {
    await sendTelegramMessage(formatLeadMessage(lead));
  } catch (err) {
    console.error("[notify] lead telegram failed", err);
  }
}
