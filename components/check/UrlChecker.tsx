"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { PHASE_STEPS, phaseIndex } from "@/lib/phases";
import type { CheckJob, Finding } from "@/lib/types";
import { cn, domainFromUrl } from "@/lib/utils";
import { LeadForm } from "@/components/landing/LeadForm";

type Status = "idle" | "running" | "done" | "error";

const severityRu: Record<string, string> = {
  critical: "Критично",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий",
  info: "Инфо",
};

function Burst({ tone }: { tone: "success" | "error" | "risk" }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  const color =
    tone === "success"
      ? "bg-emerald-400"
      : tone === "risk"
        ? "bg-rose-400"
        : "bg-rose-500";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={i}
          className={cn("absolute left-1/2 top-1/3 h-1.5 w-1.5 rounded-full", color)}
          initial={{ opacity: 1, scale: 0.4, x: 0, y: 0 }}
          animate={{
            opacity: 0,
            scale: 1,
            x: (Math.cos((i / 10) * Math.PI * 2) * 70) | 0,
            y: (Math.sin((i / 10) * Math.PI * 2) * 48) | 0,
          }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      className="glass-card p-4"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-amber-200">
          {f.rule_id}
        </span>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium",
            f.severity === "critical" || f.severity === "high"
              ? "bg-rose-500/20 text-rose-200"
              : f.severity === "medium"
                ? "bg-amber-500/20 text-amber-100"
                : "bg-white/10 text-white/70"
          )}
        >
          {severityRu[f.severity] || f.severity}
        </span>
      </div>
      <div className="font-medium text-white">{f.title}</div>
      <p className="mt-1 text-sm text-white/65">{f.fact}</p>
    </motion.li>
  );
}

export function UrlChecker({
  compact = false,
  initialUrl = "",
  pulseCta = false,
}: {
  compact?: boolean;
  initialUrl?: string;
  pulseCta?: boolean;
}) {
  const reduce = useReducedMotion();
  const [url, setUrl] = useState(initialUrl);
  const [status, setStatus] = useState<Status>("idle");
  const [job, setJob] = useState<CheckJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const domain = useMemo(() => {
    if (job?.domain) return job.domain;
    if (!url.trim()) return "";
    try {
      return domainFromUrl(url.includes("://") ? url : `https://${url}`);
    } catch {
      return url.trim();
    }
  }, [job, url]);

  useEffect(() => {
    if (!job || status !== "running") return;
    const terminal = ["done", "error", "blocked"].includes(String(job.phase));
    if (terminal) {
      setStatus(job.phase === "done" ? "done" : "error");
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/checks/${job.id}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка опроса");
        setJob(data as CheckJob);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка опроса");
        setStatus("error");
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [job, status]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setJob(null);
    setStatus("running");
    try {
      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось запустить проверку");
      setJob(data as CheckJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setStatus("error");
    }
  }

  const step = job ? phaseIndex(String(job.phase)) : -1;
  const progress =
    job?.phase === "done"
      ? 100
      : job?.phase === "error" || job?.phase === "blocked"
        ? 100
        : Math.max(8, Math.round(((step + 1) / (PHASE_STEPS.length + 1)) * 100));

  return (
    <div className={cn("w-full", compact ? "" : "mx-auto max-w-2xl")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.ru или https://example.ru"
          className="flex-1 rounded-2xl border border-amber-200/20 bg-white/[0.06] px-4 py-3 text-white placeholder:text-white/35 outline-none ring-amber-400/40 focus:ring-2"
          aria-label="URL сайта"
        />
        <Button
          type="submit"
          size="lg"
          disabled={status === "running"}
          pulse={pulseCta && status === "idle"}
        >
          {status === "running" ? "Проверяем…" : "Проверить свой сайт"}
        </Button>
      </form>

      <AnimatePresence mode="wait">
        {status === "running" && job && (
          <motion.div
            key="progress"
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="glass-card relative mt-6 overflow-hidden p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold text-white">
                  Проверяем {domain}…
                </h3>
                <p className="mt-1 text-sm text-white/60">{job.phaseMessage}</p>
              </div>
              {!reduce && (
                <div className="flex items-center gap-1.5 pt-1" aria-hidden>
                  <span className="scan-dot h-2 w-2 rounded-full bg-amber-300" />
                  <span className="scan-dot h-2 w-2 rounded-full bg-amber-300" />
                  <span className="scan-dot h-2 w-2 rounded-full bg-amber-300" />
                </div>
              )}
            </div>

            <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  reduce
                    ? "bg-gradient-to-r from-amber-400 to-yellow-200"
                    : "shimmer-bar"
                )}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="mt-1.5 text-right text-xs text-white/40">{progress}%</div>

            <ol className="mt-4 grid gap-2 sm:grid-cols-2">
              {PHASE_STEPS.map((s, i) => {
                const active = i === step;
                const doneStep = i < step || job.phase === "done";
                return (
                  <motion.li
                    key={s.id}
                    layout
                    animate={
                      reduce
                        ? undefined
                        : active
                          ? { scale: 1.02, borderColor: "rgba(251,191,36,0.45)" }
                          : { scale: 1 }
                    }
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm transition",
                      doneStep
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                        : active
                          ? "border-amber-400/40 bg-amber-400/10 text-amber-50 shadow-[0_0_24px_rgba(251,191,36,0.12)]"
                          : "border-white/5 bg-white/[0.02] text-white/40"
                    )}
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {doneStep && <span className="text-emerald-300">✓</span>}
                      {active && !doneStep && (
                        <motion.span
                          className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300"
                          animate={reduce ? undefined : { opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                      {s.label}
                    </div>
                    <div className="text-xs opacity-80">{s.description}</div>
                  </motion.li>
                );
              })}
            </ol>
            {job.warning && (
              <p className="mt-3 text-xs text-amber-200/80">{job.warning}</p>
            )}
            {job.mock && (
              <p className="mt-3 text-xs text-white/40">
                Демо-режим (PARSER_API_BASE не задан). Подключите парсер через env.
              </p>
            )}
          </motion.div>
        )}

        {status === "done" && job && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-6 space-y-5"
          >
            <div
              className={cn(
                "glass-card relative overflow-hidden p-5",
                job.hasRisks
                  ? "border-rose-400/35 bg-rose-500/10"
                  : "border-emerald-400/35 bg-emerald-500/10"
              )}
            >
              <Burst tone={job.hasRisks ? "risk" : "success"} />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative flex flex-wrap items-end justify-between gap-3"
              >
                <div>
                  <h3 className="font-display text-2xl font-semibold text-white md:text-3xl">
                    {job.hasRisks
                      ? `${domain} — не соответствует`
                      : `${domain} — соответствует`}
                  </h3>
                  <p className="mt-1 text-sm text-white/70">{job.phaseMessage}</p>
                </div>
                {typeof job.score === "number" && (
                  <motion.div
                    className="text-right"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.15 }}
                  >
                    <div className="font-display text-4xl font-semibold text-white">{job.score}</div>
                    <div className="text-xs text-white/50">балл соответствия</div>
                  </motion.div>
                )}
              </motion.div>
            </div>

            {job.findings.length > 0 ? (
              <ul className="space-y-3">
                {job.findings.map((f) => (
                  <FindingCard key={f.rule_id + f.title} f={f} />
                ))}
              </ul>
            ) : (
              <p className="glass-card border-emerald-400/20 bg-emerald-500/5 p-4 text-sm text-emerald-100">
                Критичных нарушений в экспресс-проверке не найдено. Полный аудит
                юриста может выявить дополнительные риски.
              </p>
            )}

            {job.pdfReady && !job.mock && (
              <a
                href={`/api/checks/${job.id}/pdf`}
                className="inline-flex items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:border-amber-200/50 hover:bg-amber-400/20"
              >
                Скачать PDF-отчёт
              </a>
            )}

            <div className="glass-card glass-card-gold p-5">
              <h4 className="font-display text-2xl font-semibold text-white">
                {job.hasRisks ? "Помочь устранить" : "Получить полный отчёт"}
              </h4>
              <p className="mt-1 text-sm text-white/65">
                Оставьте контакты — подготовим детальный отчёт по {domain} и
                предложим план устранения несоответствий 152-ФЗ.
              </p>
              <div className="mt-4">
                <LeadForm
                  defaultUrl={job.url}
                  checkId={job.id}
                  source="check-result"
                  cta={job.hasRisks ? "Помочь устранить" : "Получить полный отчёт"}
                />
              </div>
            </div>
          </motion.div>
        )}

        {(status === "error" || job?.phase === "blocked") && (
          <motion.div
            key="err"
            initial={{ opacity: 0, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            className="glass-card relative mt-6 overflow-hidden border-rose-400/30 bg-rose-500/10 p-5"
          >
            <Burst tone="error" />
            <h3 className="relative font-display text-2xl font-semibold text-white">
              {domain ? `Не удалось проверить ${domain}` : "Ошибка проверки"}
            </h3>
            <p className="relative mt-1 text-sm text-white/70">
              {error || job?.error || job?.phaseMessage || "Попробуйте позже"}
            </p>
            <div className="relative mt-4">
              <LeadForm
                defaultUrl={url}
                checkId={job?.id}
                source="check-error"
                cta="Помочь с проверкой"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!compact && status === "idle" && (
        <p className="mt-3 text-center text-xs text-white/40">
          Нажимая «Проверить», вы принимаете{" "}
          <Link href="/terms" className="text-amber-300/80 hover:underline">
            условия
          </Link>
          . Экспресс-проверка не заменяет юридический аудит.
        </p>
      )}
    </div>
  );
}
