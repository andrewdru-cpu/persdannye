"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { formCopy } from "@/content/blocks";
import { flags } from "@/content/flags";
import { scanTermsNotice } from "@/content/terms-copy";
import { CONSENT_TEXT_VERSION, MARKETING_CONSENT_TEXT_VERSION } from "@/lib/consent";
import { ACTIVE_POLL_MS, PHASE_STEPS, phaseIndex } from "@/lib/phases";
import type { CheckJob } from "@/lib/types";
import { CheckReport } from "@/components/check/CheckReport";
import { cn, domainFromUrl } from "@/lib/utils";
import { PolicyLine, ReportConsentFields } from "@/components/check/ReportConsentFields";
import { CollectionClosed } from "@/components/collection/CollectionClosed";
import { LeadForm } from "@/components/landing/LeadForm";

type Status = "idle" | "running" | "done" | "error";

const fieldClass =
  "field-luxury w-full px-4 py-3 text-sm text-white placeholder:text-white/75";

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

export function UrlChecker({
  compact = false,
  initialUrl = "",
  pulseCta = false,
  ctaLabel = formCopy.button,
  heroSurface = false,
  marketingConsent = false,
  collectionEnabled = false,
}: {
  compact?: boolean;
  initialUrl?: string;
  pulseCta?: boolean;
  ctaLabel?: string;
  /** Герой: без таймера и без слова «РКН» в ходе проверки. */
  heroSurface?: boolean;
  marketingConsent?: boolean;
  /** Сервер передаёт boolean. При false нет поля e-mail и самой проверки. */
  collectionEnabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const [url, setUrl] = useState(initialUrl);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadConsent, setLeadConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
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
    if (window.location.hash !== "#url-check") return;
    const input = document.getElementById("url-check-input");
    if (input instanceof HTMLElement) input.focus({ preventScroll: true });
  }, []);

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
    const email = leadEmail.trim();
    if (!url.trim()) {
      setError(formCopy.emptyUrl);
      return;
    }
    if (!/^([\w.-]+\.)+[a-zа-я]{2,}([/?#].*)?$/i.test(url.trim()) && !/^https?:\/\//i.test(url.trim())) {
      setError(formCopy.badUrl);
      return;
    }
    if (email && !leadConsent) {
      setError(formCopy.emailWithoutConsent);
      return;
    }
    setError(null);
    setJob(null);
    setStartedAt(Date.now());
    setElapsedSec(0);
    setStatus("running");

    const lead = email
      ? {
          email,
          consent: true,
          consent_text_version: CONSENT_TEXT_VERSION,
          ...(marketingConsent && marketingOptIn
            ? {
                marketing_consent: true,
                marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION,
              }
            : {}),
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

  if (!collectionEnabled) {
    return <CollectionClosed />;
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
  const termsNotice = scanTermsNotice(ctaLabel, flags.show_terms);

  return (
    <div className={cn("w-full", compact ? "" : "mx-auto max-w-2xl")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="url-check-input"
            name="url"
            type="text"
            required
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={formCopy.urlPlaceholder}
            className={cn(fieldClass, "flex-1 text-base")}
            aria-label={formCopy.urlLabel}
          />
          <Button
            type="submit"
            size="lg"
            disabled={status === "running"}
            pulse={pulseCta && status === "idle"}
            className="w-full sm:w-auto"
          >
            {status === "running" ? formCopy.pending : ctaLabel}
          </Button>
        </div>
        {termsNotice ? (
          <p className="text-xs leading-relaxed text-white/80">
            {termsNotice.before}
            <Link href={termsNotice.href} className="text-amber-300 hover:underline">
              {termsNotice.linkText}
            </Link>
          </p>
        ) : null}

        <label className="grid gap-1 text-xs text-white/80">
          {formCopy.emailLabel}
          <input
            value={leadEmail}
            onChange={(e) => setLeadEmail(e.target.value)}
            placeholder="name@example.ru"
            autoComplete="email"
            aria-label={formCopy.emailLabel}
            inputMode="email"
            className={fieldClass}
          />
          <span>{formCopy.emailHint}</span>
        </label>
        {leadEmail.trim() ? (
          <ReportConsentFields
            consent={leadConsent}
            onConsent={(checked) => {
              setLeadConsent(checked);
              if (checked) setError(null);
            }}
            marketing={marketingOptIn}
            onMarketing={setMarketingOptIn}
            showMarketing={marketingConsent}
          />
        ) : null}
        <PolicyLine className="text-xs text-white/80" />
        {error && status !== "running" && status !== "error" && (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
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
                  {heroSurface ? "Проверка" : "Быстрая проверка"} · шаг {stepLabel} из {PHASE_STEPS.length}
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
                  Проверяем {domain || "сайт"}…
                </h3>
                <p className="mt-1 text-sm text-white/80">
                  {job?.phaseMessage || "Запускаем проверку. Страницу можно листать — отчёт появится здесь."}
                </p>
              </div>
              {heroSurface ? null : (
                <div className="shrink-0 text-right" aria-label={`Прошло ${elapsedSec} секунд`}>
                  <div className="font-display text-4xl leading-none text-amber-100">{elapsedSec}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/80">
                    секунд
                  </div>
                </div>
              )}
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
            <div className="mt-2 flex items-center justify-between text-xs text-white/80">
              <span>
                {activeStep
                  ? heroSurface
                    ? `Сейчас: ${activeStep.label}`
                    : `Сейчас: ${activeStep.label} · обычно ${activeStep.eta}`
                  : "Запуск"}
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
                          : "border-white/10 bg-white/[0.02] text-white/80"
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
                      {heroSurface ? null : (
                        <span className="text-[10px] uppercase tracking-wider opacity-70">{s.eta}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs opacity-80">
                      {active && !doneStep && !heroSurface
                        ? `${s.description} · идёт ${elapsedSec} с`
                        : heroSurface
                          ? s.description.replace(/\s*РКН/gu, "")
                          : s.description}
                    </div>
                  </li>
                );
              })}
            </ol>
            {job?.warning && <p className="mt-3 text-xs text-amber-100/80">{job.warning}</p>}
            <p className="mt-3 text-xs text-white/80">
              {job?.mock
                ? "Демо-режим (PARSER_API_BASE не задан). Подключите парсер через env."
                : job
                  ? heroSurface
                    ? "Живой парсер"
                    : "Живой парсер · обновление каждые 1,5 с"
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
            <div className="glass-card relative overflow-hidden p-5 md:p-6">
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
                  {heroSurface ? "Готово" : `Готово за ${elapsedSec} с`}
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold text-white md:text-3xl">
                  {domain || "Проверка завершена"}
                </h3>
                <p className="mt-1 text-sm text-white/70">{job.phaseMessage}</p>
              </div>
            </div>

            <CheckReport job={job} />

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
                Обсудить исправления
              </h4>
              <p className="mt-1 text-sm leading-relaxed text-white/80">
                Оставьте имя и телефон или e-mail, если хотите ответ по этому сайту.
              </p>
              <div className="mt-4">
                <LeadForm
                  defaultUrl={job.url}
                  checkId={job.id}
                  source="check-result"
                  marketingConsent={marketingConsent}
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
                marketingConsent={marketingConsent}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!compact && status === "idle" ? (
        <p className="mt-3 text-center text-xs leading-relaxed text-white/80">
          Экспресс-проверка не заменяет юридический аудит.
        </p>
      ) : null}
    </div>
  );
}
