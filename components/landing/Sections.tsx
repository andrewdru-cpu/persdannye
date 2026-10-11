"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { HeroBackdrop } from "@/components/motion/HeroBackdrop";
import { TrustMarquee } from "@/components/motion/Marquee";
import { UrlChecker } from "@/components/check/UrlChecker";
import { LeadForm } from "@/components/landing/LeadForm";
import { GlassCard } from "@/components/ui/GlassCard";
import { CheckLink } from "@/components/landing/CheckLink";
import {
  checkGroups,
  checkGroupsTitle,
  checkWorkPoints,
  dataCallouts,
  faqItems,
  howSteps,
} from "@/content/blocks";
import { flags } from "@/content/flags";
import { sampleFinesNote, sampleReport, sampleRulesLine } from "@/content/extra-blocks";
import { cta, fixWithUs, heroChrome, trustItems, whoFor } from "@/content/landing";

const heroEase = [0.22, 1, 0.36, 1] as const;

function HeroHeadline({
  headline,
  highlight,
  sheen,
}: {
  headline: string;
  highlight: string | null;
  sheen: boolean;
}) {
  if (!highlight || !headline.includes(highlight)) return headline;
  const start = headline.indexOf(highlight);
  return (
    <>
      {headline.slice(0, start)}
      <span className={sheen ? "gold-text-sheen" : "text-amber-100"}>{highlight}</span>
      {headline.slice(start + highlight.length)}
    </>
  );
}

const heroLine = {
  hidden: { opacity: 0, y: 32, filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.06 + i * 0.12, duration: 0.7, ease: heroEase },
  }),
};

export function Hero({
  headline,
  highlight,
  subline,
  ctaLabel = cta.primary,
  marketingConsent = false,
}: {
  headline: string;
  highlight: string | null;
  subline: string;
  ctaLabel?: string;
  marketingConsent?: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    <section id="hero" className="relative overflow-hidden pb-20 pt-14 md:pb-32 md:pt-24">
      <HeroBackdrop />
      <div className="relative mx-auto grid max-w-6xl items-start gap-12 px-4 md:px-6 lg:grid-cols-12 lg:gap-16">
        <motion.div
          initial="hidden"
          animate="show"
          className="lg:col-span-7"
        >
          <motion.div
            custom={0}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="inline-flex items-center gap-2 rounded-full border border-amber-200/35 bg-amber-100/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(231,211,161,0.9)]" />
            {heroChrome.badge}
          </motion.div>
          <motion.p
            custom={1}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-6 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/80"
          >
            {heroChrome.kicker}
          </motion.p>
          <motion.h1
            custom={2}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-3 max-w-2xl text-balance font-display text-[2.15rem] font-semibold leading-[1.05] text-white sm:text-5xl md:text-6xl"
          >
            <HeroHeadline headline={headline} highlight={highlight} sheen={!reduce} />
          </motion.h1>
          <motion.div
            custom={3}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-6 h-px w-36 bg-gradient-to-r from-amber-100 via-amber-400/80 to-transparent"
          />
          <motion.p
            custom={4}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-6 max-w-xl text-base leading-relaxed text-white/72 md:text-lg"
          >
            {subline}
          </motion.p>
          <motion.div
            custom={5}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap"
          >
            <CheckLink
              pulse
              className="btn-gold min-h-12 w-full rounded-2xl px-7 py-3.5 text-base sm:w-auto"
            >
              {ctaLabel}
            </CheckLink>
          </motion.div>
          <motion.dl
            custom={6}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-8 grid grid-cols-3 gap-3 border-t border-amber-200/15 pt-5"
          >
            {heroChrome.facts.map(({ k, v }) => (
              <div key={v}>
                <dt className="font-display text-2xl text-amber-100 sm:text-3xl">{k}</dt>
                <dd className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/50 sm:text-xs">
                  {v}
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <motion.div
          id="url-check"
          className="min-w-0 scroll-mt-28 lg:col-span-5"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduce ? { duration: 0 } : { delay: 0.35, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard gold className="p-5 md:p-7 lg:mt-4">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="font-display text-3xl font-semibold text-white">
                  {heroChrome.checkerTitle}
                </div>
                <p className="mt-1 max-w-xs text-sm leading-relaxed text-white/55">
                  {heroChrome.checkerText}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-amber-200/35 bg-amber-100/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-50">
                {heroChrome.checkerBadge}
              </span>
            </div>
            <UrlChecker compact pulseCta ctaLabel={ctaLabel} heroSurface marketingConsent={marketingConsent} />
          </GlassCard>
        </motion.div>
      </div>
    </section>
  );
}

export function Trust() {
  return (
    <>
      <TrustMarquee />
      <section className="trust-bar" aria-label="Почему нам доверяют">
        <div className="mx-auto grid max-w-6xl md:grid-cols-3">
          {trustItems.map((item, i) => (
            <div
              key={item.t}
              className={`px-5 py-8 md:px-8 md:py-10 ${
                i > 0 ? "border-t border-amber-200/15 md:border-t-0 md:border-l" : ""
              }`}
            >
              <div className="font-display text-4xl font-semibold text-amber-100 md:text-5xl">
                {item.k}
              </div>
              <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
                {item.t}
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">{item.d}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section id="how" className="scroll-mt-24 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Процесс
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            Как это работает
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">
            Три шага: адрес, отчёт и план, что исправить.
          </p>
        </Reveal>

        <div className="relative mt-10">
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px lg:block">
            <motion.div
              className="h-full origin-left bg-gradient-to-r from-amber-400/0 via-amber-400/60 to-amber-400/0"
              initial={reduce ? { scaleX: 1 } : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
          </div>

          <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {howSteps.map((s, i) => (
              <StaggerItem key={s.n}>
                <motion.div
                  className="glass-card relative h-full p-5"
                  whileHover={reduce ? undefined : { y: -6, borderColor: "rgba(212,175,55,0.45)" }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                >
                  <motion.div
                    className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/45 bg-amber-400/10 font-mono text-sm text-amber-200"
                    initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 360 }}
                  >
                    {s.n}
                  </motion.div>
                  <div className="mt-4 font-display text-2xl font-semibold text-white">{s.t}</div>
                  <p className="mt-2 text-sm text-white/60">{s.d}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}

export function WhatWeCheck() {
  return (
    <section id="checks" className="scroll-mt-24 border-y border-amber-200/10 bg-ink-975/80 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Контроль
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            {checkGroupsTitle}
          </h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-3 md:grid-cols-2">
          {checkGroups.map((item) => (
            <StaggerItem key={item.t}>
              <div className="glass-card px-4 py-4 text-sm text-white/75">
                <div className="font-display text-2xl text-white">{item.t}</div>
                <p className="mt-2 text-white/65">{item.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function ExampleResult() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            {sampleReport.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            {sampleReport.title}
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">{sampleReport.lead}</p>
        </Reveal>
        <p className="mt-6 rounded-2xl border border-amber-200/30 bg-amber-200/10 px-4 py-3 text-sm font-medium text-amber-50">
          {sampleReport.banner}
        </p>
        <Reveal delay={0.08} className="mt-4">
          <GlassCard className="p-6 md:p-8">
            <p className="text-sm text-white/80">
              {sampleReport.domainLabel}:{" "}
              <span className="font-medium text-white">{sampleReport.domain}</span>
            </p>
            <p className="mt-1 text-sm text-white/60">{sampleReport.checkedAt}</p>
            {sampleRulesLine ? <p className="mt-1 text-sm text-white/60">{sampleRulesLine}</p> : null}
            <p className="mt-4 text-white/85">{sampleReport.summary}</p>
            <ul className="mt-6 space-y-3">
              {sampleReport.observations.map((item) => (
                <li key={item.text} className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm">
                  <p className={item.tone === "important" ? "font-medium text-amber-200" : "font-medium text-white/50"}>
                    {item.level}
                  </p>
                  <p className="mt-1 text-white/85">{item.text}</p>
                  <p className="mt-2 text-white/55">Где: {item.where}</p>
                  <p className="text-white/55">Насколько уверены: {item.confidence}</p>
                  <p className="mt-2 text-white/75">Что исправить: {item.fix}</p>
                  <p className="mt-2 text-white/55">
                    Норма:{" "}
                    {item.norms.map((norm, index) => (
                      <span key={`${norm.label}-${index}`}>
                        {index > 0 ? "; " : null}
                        {"href" in norm && norm.href ? (
                          <a href={norm.href} className="text-amber-200 hover:underline" target="_blank" rel="noreferrer">
                            {norm.label}
                          </a>
                        ) : (
                          norm.label
                        )}
                        {"note" in norm && norm.note ? ` (${norm.note})` : null}
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 font-medium text-white">{sampleReport.okTitle}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
              {sampleReport.ok.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3 className="mt-6 font-medium text-white">{sampleReport.moreTitle}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/70">
              {sampleReport.more.map((item) => (
                <li key={item}>{item}</li>
              ))}
              {sampleFinesNote ? <li>{sampleFinesNote}</li> : null}
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-white/45">{sampleReport.caption}</p>
            <CheckLink pulse className="btn-gold mt-6 min-h-12 rounded-2xl px-7 py-3.5 text-base">
              {sampleReport.cta}
            </CheckLink>
          </GlassCard>
        </Reveal>
      </div>
    </section>
  );
}

export function WhoFor() {
  return (
    <section className="border-y border-amber-200/10 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            {whoFor.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            {whoFor.title}
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">{whoFor.lead}</p>
        </Reveal>
        <Stagger className="mt-8 grid gap-4 sm:grid-cols-2">
          {whoFor.items.map((a) => (
            <StaggerItem key={a.t}>
              <GlassCard className="h-full p-5 transition hover:border-amber-300/35">
                <div className="font-display text-2xl font-semibold text-white">{a.t}</div>
                <p className="mt-2 text-sm text-white/60">{a.d}</p>
              </GlassCard>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-8 max-w-3xl text-sm leading-relaxed text-white/70">{whoFor.lawyer}</p>
        <CheckLink pulse className="btn-gold mt-6 inline-flex min-h-12 items-center rounded-2xl px-7 py-3.5 text-base">
          {whoFor.cta}
        </CheckLink>
      </div>
    </section>
  );
}

export function FixWithUs() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <GlassCard gold className="p-8 md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/90">
              {fixWithUs.eyebrow}
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
              {fixWithUs.title}
            </h2>
            <p className="mt-4 max-w-2xl text-white/70">{fixWithUs.lead}</p>
            <ul className="mt-8 grid gap-3">
              {fixWithUs.services.map((service) => (
                <li key={service.t} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <div className="font-medium text-white">{service.t}</div>
                  <p className="mt-1 text-sm text-white/65">{service.d}</p>
                </li>
              ))}
            </ul>
            <h3 className="mt-8 font-medium text-white">{fixWithUs.dutiesTitle}</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/70">
              {fixWithUs.duties.map((duty) => (
                <li key={duty}>{duty}</li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-white/60">{fixWithUs.disclaimer}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <CheckLink className="btn-gold inline-flex min-h-12 items-center rounded-2xl px-7 py-3.5 text-base">
                {fixWithUs.cta}
              </CheckLink>
              {flags.show_lead_form ? (
                <Link
                  href="/#lead"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-amber-200/40 bg-[#14110c]/80 px-7 py-3.5 text-base text-[#f7f1e6] hover:border-amber-100/70 hover:bg-amber-200/10"
                >
                  {fixWithUs.discuss}
                </Link>
              ) : null}
            </div>
          </GlassCard>
        </Reveal>
      </div>
    </section>
  );
}

export function HowCheckWorks() {
  return (
    <section id="method" className="scroll-mt-24 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">Проверка</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">Как устроена проверка</h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-3">
          {checkWorkPoints.map((point) => (
            <StaggerItem key={point}>
              <div className="glass-card px-4 py-4 text-sm leading-relaxed text-white/75">{point}</div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function DataOnSite() {
  return (
    <section id="personal-data" className="scroll-mt-24 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">На сайте</p>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-semibold text-white md:text-5xl">
            Что на сайте считается персональными данными
          </h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-3 md:grid-cols-2">
          {dataCallouts.map((item) => (
            <StaggerItem key={item.k}>
              <div className="glass-card h-full p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-amber-200/80">{item.k}</div>
                <p className="mt-2 text-white/85">{item.t}</p>
                <p className="mt-3 text-xs leading-relaxed text-white/45">{item.s}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function FAQ({
  todos = false,
  showFinesTable = false,
}: {
  todos?: boolean;
  showFinesTable?: boolean;
}) {
  const items = faqItems(todos, showFinesTable);
  return (
    <section id="faq" className="scroll-mt-24 border-t border-amber-200/10 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Вопросы
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            FAQ
          </h2>
        </Reveal>
        <Stagger className="mt-8 space-y-3">
          {items.map((f) => (
            <StaggerItem key={f.q}>
              <details className="glass-card group p-5 open:border-amber-300/30">
                <summary className="cursor-pointer list-none font-medium text-white marker:content-none">
                  {f.q}
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-white/65">{f.a}</p>
              </details>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function LeadSection({ marketingConsent = false }: { marketingConsent?: boolean }) {
  return (
    <section id="lead" className="scroll-mt-24 bg-ink-975 py-20 md:py-28">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Заявка
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            Обсудить исправления
          </h2>
          <p className="mt-4 text-white/65">
            Имя и телефон или e-mail. Ответим по заявке.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <GlassCard gold>
            <LeadForm source="landing-lead" marketingConsent={marketingConsent} />
          </GlassCard>
        </Reveal>
      </div>
    </section>
  );
}
