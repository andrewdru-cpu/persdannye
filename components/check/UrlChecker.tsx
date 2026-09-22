"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ACTIVE_POLL_MS, PHASE_STEPS, phaseIndex } from "@/lib/phases";
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

const fieldClass =
  "field-luxury w-full px-4 py-3 text-sm text-white placeholder:text-white/35";

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
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="glass-card p-4"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-amber-100">
          {f.rule_id}
        </span>
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium",
            f.severity === "critical" || f.severity === "high"
              ? "bg-rose-500/20 text-rose-200"
              : f.severity === "medium"
                ? "bg-amber-500/20 text-amber-50"
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
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [job, setJob] = useState<CheckJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

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
    if (status !== "running" || startedAt == null) return;
    const tick = () => setElapsedSec(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status, startedAt]);

  useEffect(() => {
    if (status !== "running" || !job?.id) return;
    const jobId = job.id;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/checks/${jobId}`, { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Ошибка опроса");
        const next = data as CheckJob;
        setJob(next);
        if (["done", "error", "blocked"].includes(String(next.phase))) {
          setStatus(next.phase === "done" ? "done" : "error");
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Ошибка опроса");
        setStatus("error");
      }
    };

    const timer = window.setInterval(poll, ACTIVE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [status, job?.id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setJob(null);
    setStartedAt(Date.now());
    setElapsedSec(0);
    setStatus("running");

    const name = leadName.trim();
    const email = leadEmail.trim();
    const phone = leadPhone.trim();
    const lead =
      name || email || phone
        ? {
            name: name || undefined,
            email: email || undefined,
            phone: phone || undefined,
          }
        : undefined;

    try {
      const res = await fetch("/api/checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead ? { url, lead } : { url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось запустить проверку");
      const next = data as CheckJob;
      setJob(next);
      if (["done", "error", "blocked"].includes(String(next.phase))) {
        setStatus(next.phase === "done" ? "done" : "error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
      setStatus("error");
    }
  }

  const shownPhase = job?.phase || "queued";
  const step = phaseIndex(String(shownPhase));
  const terminal = ["done", "error", "blocked"].includes(String(job?.phase));
  const phaseProgress = terminal
    ? 100
    : Math.max(8, Math.round(((Math.max(step, 0) + 1) / (PHASE_STEPS.length + 1)) * 100));
  const creep = Math.min(92, 10 + elapsedSec * 4);
  const progress = terminal ? 100 : Math.max(phaseProgress, creep);
  const activeStep = PHASE_STEPS[Math.min(Math.max(step, 0), PHASE_STEPS.length - 1)];
  const stepLabel = job?.phase === "done" ? PHASE_STEPS.length : Math.max(step, 0) + 1;

  return (
    <div className={cn("w-full", compact ? "" : "mx-auto max-w-2xl")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.ru или https://example.ru"
            className={cn(fieldClass, "flex-1 text-base")}
            aria-label="URL сайта"
          />
          <Button
            type="submit"
            size="lg"
            disabled={status === "running"}
            pulse={pulseCta && status === "idle"}
            className="w-full sm:w-auto"
          >
            {status === "running" ? "Проверяем…" : "Проверить свой сайт"}
          </Button>
        </div>

        <details className="group rounded-2xl border border-amber-200/15 bg-white/[0.03] px-3 py-2.5">
          <summary className="cursor-pointer list-none text-xs tracking-wide text-white/60 marker:content-none">
            <span className="text-amber-100/90">Контакты для менеджера</span>
            <span className="text-white/40"> — необязательно, если хотите, чтобы вас взяли в работу сразу</span>
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              placeholder="Имя"
              autoComplete="name"
              aria-label="Имя"
              className={fieldClass}
            />
            <input
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              aria-label="Email"
              inputMode="email"
              className={fieldClass}
            />
            <input
              value={leadPhone}
              onChange={(e) => setLeadPhone(e.target.value)}
              placeholder="Телефон"
              autoComplete="tel"
              aria-label="Телефон"
              inputMode="tel"
              className={fieldClass}
            />
          </div>
        </details>
      </form>

      <AnimatePresence initial={false}>
        {status === "running" && (
          <motion.div
            key="progress"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="glass-card relative mt-6 overflow-hidden p-5 md:p-6"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/80">
                  Быстрая проверка · шаг {stepLabel} из {PHASE_STEPS.length}
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
                  Проверяем {domain || "сайт"}…
                </h3>
                <p className="mt-1 text-sm text-white/60">
                  {job?.phaseMessage || "Запускаем проверку. Страницу можно листать — отчёт появится здесь."}
                </p>
              </div>
              <div className="shrink-0 text-right" aria-label={`Прошло ${elapsedSec} секунд`}>
                <div className="font-display text-4xl leading-none text-amber-100">{elapsedSec}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
                  секунд
                </div>
              </div>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={cn(
                  "h-full rounded-full",
                  reduce ? "bg-gradient-to-r from-amber-600 to-amber-100" : "shimmer-bar"
                )}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/45">
              <span>
                {activeStep ? `Сейчас: ${activeStep.label} · обычно ${activeStep.eta}` : "Запуск"}
                {job ? "" : " · соединяемся"}
              </span>
              <span>{progress}%</span>
            </div>

            <ol className={cn("mt-4 grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
              {PHASE_STEPS.map((s, i) => {
                const active = !terminal && (job ? i === step : i === 0);
                const doneStep = Boolean(job) && (i < step || job?.phase === "done");
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-sm transition",
                      doneStep
                        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                        : active
                          ? "border-amber-300/45 bg-amber-400/10 text-amber-50"
                          : "border-white/10 bg-white/[0.02] text-white/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 font-medium">
                      <span className="flex items-center gap-2">
                        {doneStep && <span className="text-emerald-300">✓</span>}
                        {active && !doneStep && (
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5 rounded-full bg-amber-200",
                              reduce ? "" : "scan-dot"
                            )}
                          />
                        )}
                        {s.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider opacity-70">{s.eta}</span>
                    </div>
                    <div className="mt-0.5 text-xs opacity-80">
                      {active && !doneStep ? `${s.description} · идёт ${elapsedSec} с` : s.description}
                    </div>
                  </li>
                );
              })}
            </ol>
            {job?.warning && <p className="mt-3 text-xs text-amber-100/80">{job.warning}</p>}
            <p className="mt-3 text-xs text-white/40">
              {job?.mock
                ? "Демо-режим (PARSER_API_BASE не задан). Подключите парсер через env."
                : job
                  ? "Живой парсер · обновление каждые 1,5 с"
                  : "Отправляем URL. Интерфейс не блокируется."}
            </p>
          </motion.div>
        )}

        {status === "done" && job && (
          <motion.div
            key="done"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative mt-6 space-y-5"
          >
            <div
              className={cn(
                "glass-card relative overflow-hidden p-5 md:p-6",
                job.hasRisks
                  ? "border-rose-400/35 bg-rose-500/10"
                  : "border-emerald-400/35 bg-emerald-500/10"
              )}
            >
              <Burst tone={job.hasRisks ? "risk" : "success"} />
              <div className="relative flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/55">
                    Готово за {elapsedSec} с
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
                    {job.hasRisks ? `${domain} — не соответствует` : `${domain} — соответствует`}
                  </h3>
                  <p className="mt-1 text-sm text-white/70">{job.phaseMessage}</p>
                </div>
                {typeof job.score === "number" && (
                  <div className="text-right">
                    <div className="font-display text-4xl font-semibold text-white">{job.score}</div>
                    <div className="text-xs uppercase tracking-wider text-white/50">балл соответствия</div>
                  </div>
                )}
              </div>
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
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-amber-200/35 bg-amber-400/10 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:border-amber-100/60 hover:bg-amber-400/20"
              >
                Скачать PDF-отчёт
              </a>
            )}

            <div className="glass-card glass-card-gold p-5 md:p-6">
              <h4 className="font-display text-2xl font-semibold text-white md:text-3xl">
                {job.hasRisks ? "Помочь устранить" : "Получить полный отчёт"}
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-white/65">
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
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card relative mt-6 overflow-hidden border-rose-400/30 bg-rose-500/10 p-5 md:p-6"
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
        <p className="mt-3 text-center text-xs leading-relaxed text-white/40">
          Нажимая «Проверить», вы принимаете{" "}
          <Link href="/terms" className="text-amber-200/90 hover:underline">
            условия
          </Link>
          . Экспресс-проверка не заменяет юридический аудит.
        </p>
      )}
    </div>
  );
}
