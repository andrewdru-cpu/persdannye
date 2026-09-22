/**
 * Manager alerts from the Next.js BFF. Never expose Telegram/parser tokens.
 * Every finished landing scan (phase === done) is a new client to pick up.
 */

import { findLeadForCheck } from "./leads-store";
import { getCheckPdf } from "./parser-client";
import { findScanContact, hasScanContact, mergeScanContact } from "./scan-contacts";
import { isTelegramConfigured, sendTelegramDocument, sendTelegramMessage } from "./telegram";
import type { CheckJob, Lead, ScanContact } from "./types";

const notifiedScans = new Set<string>();
const skippedScans = new Set<string>();

function formatTs(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
}

function scanHasRisks(job: CheckJob): boolean {
  return job.push === true || (Array.isArray(job.findings) && job.findings.length > 0);
}

export function shouldNotifyScan(job: CheckJob): boolean {
  return String(job.phase) === "done";
}

function logTelegramSkipped(kind: "scan" | "lead"): void {
  console.warn(
    `[notify] TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы — пропуск алерта (${kind})`
  );
}

type ContactBits = {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
};

async function contactsForJob(job: CheckJob): Promise<ContactBits> {
  const lead = await findLeadForCheck(job.id, job.url);
  let scan: ScanContact | null = hasScanContact(job.contact) ? job.contact || null : null;
  if (!scan) {
    try {
      scan =
        (await findScanContact(job.scanId || job.id)) ||
        (job.scanId && job.scanId !== job.id ? await findScanContact(job.id) : null);
    } catch (err) {
      console.error("[notify] scan contact lookup failed", err);
    }
  }
  const merged = mergeScanContact(
    lead
      ? { name: lead.name, email: lead.email, phone: lead.phone, source: lead.source }
      : null,
    scan
  );
  return {
    name: merged?.name,
    email: merged?.email,
    phone: merged?.phone,
    company: lead?.company,
  };
}

function formatScanMessage(job: CheckJob, contact?: ContactBits | null): string {
  const risks = scanHasRisks(job);
  const lines: string[] = [
    "🆕 Новый клиент с лендинга",
    "",
    "Проверка сайта завершена — возьмите клиента в работу.",
    "",
    `Домен: ${job.domain || "—"}`,
    `Ссылка: ${job.url || "—"}`,
    `Балл: ${typeof job.score === "number" ? job.score : "—"}`,
    `Риски: ${risks ? "да" : "нет"}`,
  ];

  if (job.findings.length > 0) {
    lines.push("", "Находки:");
    job.findings.slice(0, 18).forEach((f, i) => {
      lines.push(`${i + 1}. ${f.rule_id} / ${f.title}`);
      if (f.fact) lines.push(`   ${f.fact}`);
    });
    if (job.findings.length > 18) {
      lines.push(`… ещё ${job.findings.length - 18}`);
    }
  } else {
    lines.push("", "Находки: нет");
  }

  if (contact && (contact.name || contact.phone || contact.email || contact.company)) {
    lines.push("", "Контакты:");
    if (contact.name) lines.push(`Имя: ${contact.name}`);
    if (contact.phone) lines.push(`Телефон: ${contact.phone}`);
    if (contact.email) lines.push(`Email: ${contact.email}`);
    if (contact.company) lines.push(`Компания: ${contact.company}`);
  }

  lines.push("", `Время: ${formatTs(job.updatedAt)}`);
  if (job.mock) lines.push("Режим: mock (PARSER_API_BASE не задан)");
  return lines.join("\n");
}

export function formatLeadMessage(lead: Lead): string {
  const lines = [
    "🆕 Новый клиент с лендинга",
    "",
    "Новая заявка с формы — возьмите клиента в работу.",
    "",
    `Имя: ${lead.name}`,
    lead.phone ? `Телефон: ${lead.phone}` : null,
    `Email: ${lead.email}`,
    lead.company ? `Компания: ${lead.company}` : null,
    lead.url ? `Ссылка: ${lead.url}` : null,
    lead.checkId ? `Check ID: ${lead.checkId}` : null,
    lead.message ? `Комментарий: ${lead.message}` : null,
    `Источник: ${lead.source || "landing"}`,
    `Время: ${formatTs(lead.createdAt)}`,
  ].filter((x): x is string => Boolean(x));
  return lines.join("\n");
}

/**
 * Notify the manager as soon as a landing scan finishes — with or without risks.
 * Text always. PDF via sendDocument only when pdf_ready and the scan has risks.
 */
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
    const contact = await contactsForJob(job);
    await sendTelegramMessage(formatScanMessage(job, contact));

    if (job.pdfReady && !job.mock && scanHasRisks(job)) {
      try {
        const pdf = await getCheckPdf(job.id);
        if (pdf) {
          await sendTelegramDocument(
            pdf.buffer,
            pdf.filename,
            `${job.domain} · риски: да · балл ${job.score ?? "—"} · новый клиент с лендинга`
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
  if (!isTelegramConfigured()) {
    logTelegramSkipped("lead");
    return;
  }
  try {
    await sendTelegramMessage(formatLeadMessage(lead));
  } catch (err) {
    console.error("[notify] lead telegram failed", err);
  }
}
