"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { HeroBackdrop } from "@/components/motion/HeroBackdrop";
import { TrustMarquee } from "@/components/motion/Marquee";
import { UrlChecker } from "@/components/check/UrlChecker";
import { LeadForm } from "@/components/landing/LeadForm";
import { Button } from "@/components/ui/Button";

const trustItems = [
  "Данные требований РКН актуализируем каждый день",
  "Уже 1000+ компаний обратились за проверкой",
  "Помогаем любым сайтам найти и устранить несоблюдение правил Роскомнадзора",
];

const howSteps = [
  {
    n: "01",
    t: "Вводите URL",
    d: "Укажите сайт — запускаем экспресс-сканирование без установки кода.",
  },
  {
    n: "02",
    t: "Сканируем по 152-ФЗ",
    d: "Проверяем политики, cookie, формы, согласия и сведения об операторе.",
  },
  {
    n: "03",
    t: "Получаете список рисков",
    d: "Видите статус соответствия и конкретные находки с пояснениями.",
  },
  {
    n: "04",
    t: "Устраняем вместе",
    d: "Юристы и инженеры помогают закрыть нарушения и подготовить документы.",
  },
];

const checkItems = [
  "Политика обработки персональных данных и обязательные сведения",
  "Cookie-баннер: раздельные категории и отказ до согласия",
  "Формы заявок: явное согласие и ссылка на политику",
  "Идентификация оператора ПДн (наименование, контакты, ДПО)",
  "Локализация и трансграничная передача — маркеры риска",
  "Согласие отдельно от принятия оферты / правил сервиса",
];

const audiences = [
  { t: "Интернет-магазины", d: "Корзина, личный кабинет, рассылки и платёжные формы." },
  { t: "Сайты услуг", d: "Заявки на Tilda, WordPress, Bitrix и кастомных CMS." },
  { t: "SaaS и кабинеты", d: "Регистрация, cookies аналитики, интеграции CRM." },
  { t: "Агентства", d: "Быстрый чек-лист перед сдачей проекта клиенту." },
];

const faqs = [
  {
    q: "Это юридическое заключение?",
    a: "Экспресс-проверка — технический скрининг по правилам 152-ФЗ и практике РКН. Полное юридическое заключение готовит юрист после разбора отчёта.",
  },
  {
    q: "Как часто обновляются правила?",
    a: "Базу требований Роскомнадзора и контрольных точек актуализируем ежедневно.",
  },
  {
    q: "Нужен ли доступ в админку сайта?",
    a: "Для экспресс-проверки достаточно публичного URL. Для устранения можем работать с вашей командой или подрядчиком.",
  },
  {
    q: "Что с персональными данными в заявке?",
    a: "Обрабатываем только для связи по запросу, по Политике обработки ПДн, с вашим явным согласием.",
  },
];

const heroEase = [0.22, 1, 0.36, 1] as const;

const heroLine = {
  hidden: { opacity: 0, y: 28, filter: "blur(6px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.08 + i * 0.12, duration: 0.6, ease: heroEase },
  }),
};

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden pb-16 pt-14 md:pb-24 md:pt-20">
      <HeroBackdrop />
      <div className="relative mx-auto max-w-6xl px-4 md:px-6">
        <motion.div
          initial="hidden"
          animate="show"
          className="max-w-3xl"
        >
          <motion.div
            custom={0}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-100"
          >
            Передовая компания · сканер соответствия 152-ФЗ
          </motion.div>
          <motion.h1
            custom={1}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-5 text-4xl font-semibold tracking-tight text-white md:text-6xl"
          >
            Найдите несоблюдение правил{" "}
            <span className="bg-gradient-to-r from-amber-200 to-amber-400 bg-clip-text text-transparent">
              Роскомнадзора
            </span>{" "}
            на сайте за минуты
          </motion.h1>
          <motion.p
            custom={2}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg"
          >
            «ПерсДанные» помогает любым сайтам пройти проверку по 152-ФЗ:
            показываем риски, объясняем факты и помогаем устранить нарушения.
            Требования РКН актуализируем каждый день. Нам доверяют уже 1000+ компаний.
          </motion.p>
        </motion.div>
        <motion.div
          className="mt-8"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <UrlChecker pulseCta />
        </motion.div>
      </div>
    </section>
  );
}

export function Trust() {
  return (
    <>
      <TrustMarquee />
      <section className="border-b border-white/5 bg-white/[0.015] py-10">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <Stagger className="grid gap-4 md:grid-cols-3">
            {trustItems.map((item) => (
              <StaggerItem key={item}>
                <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-5 text-sm leading-relaxed text-white/75 transition hover:border-amber-400/25 hover:bg-ink-900/70">
                  <div className="mb-2 text-amber-300">✦</div>
                  {item}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>
    </>
  );
}

export function HowItWorks() {
  const reduce = useReducedMotion();

  return (
    <section id="how" className="scroll-mt-24 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Как это работает</h2>
          <p className="mt-3 max-w-2xl text-white/60">
            От URL до списка рисков — прозрачный процесс без сюрпризов.
          </p>
        </Reveal>

        <div className="relative mt-10">
          {/* Desktop connector line */}
          <div className="pointer-events-none absolute left-0 right-0 top-8 hidden h-px lg:block">
            <motion.div
              className="h-full origin-left bg-gradient-to-r from-amber-400/0 via-amber-400/50 to-amber-400/0"
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
                  className="relative h-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5"
                  whileHover={reduce ? undefined : { y: -4, borderColor: "rgba(251,191,36,0.35)" }}
                  transition={{ type: "spring", stiffness: 320, damping: 22 }}
                >
                  <motion.div
                    className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 font-mono text-sm text-amber-300"
                    initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 360 }}
                  >
                    {s.n}
                  </motion.div>
                  <div className="mt-3 text-lg font-semibold text-white">{s.t}</div>
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
    <section id="checks" className="scroll-mt-24 border-y border-white/5 bg-ink-975/80 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Что мы проверяем</h2>
          <p className="mt-3 max-w-2xl text-white/60">
            Контрольные точки по 152-ФЗ и практике Роскомнадзора — с акцентом на то,
            за что реально штрафуют.
          </p>
        </Reveal>
        <Stagger className="mt-8 grid gap-3 md:grid-cols-2">
          {checkItems.map((item) => (
            <StaggerItem key={item}>
              <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/75 transition hover:border-amber-400/20">
                <span className="text-amber-300">✓</span>
                <span>{item}</span>
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
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Пример результата</h2>
          <p className="mt-3 max-w-2xl text-white/60">
            Так выглядит экспресс-отчёт: статус, балл и список находок с фактами.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="mt-8">
          <div className="rounded-2xl border border-rose-400/25 bg-rose-500/5 p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm text-rose-200">example-shop.ru — не соответствует</div>
                <div className="mt-1 text-2xl font-semibold text-white">Найдено 4 риска</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">42</div>
                <div className="text-xs text-white/50">балл</div>
              </div>
            </div>
            <ul className="mt-5 space-y-2 text-sm text-white/70">
              <li className="rounded-lg bg-black/20 px-3 py-2">P01 · Нет политики обработки ПДн</li>
              <li className="rounded-lg bg-black/20 px-3 py-2">C02 · Cookie без раздельного согласия</li>
              <li className="rounded-lg bg-black/20 px-3 py-2">F03 · Форма без явного согласия</li>
            </ul>
            <Link href="/check" className="mt-5 inline-block">
              <Button pulse>Проверить свой сайт</Button>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function WhoFor() {
  return (
    <section className="border-y border-white/5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Для кого</h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((a) => (
            <StaggerItem key={a.t}>
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-amber-400/25">
                <div className="font-semibold text-white">{a.t}</div>
                <p className="mt-2 text-sm text-white/60">{a.d}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function FixWithUs() {
  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <div className="overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/15 via-ink-900 to-ink-950 p-8 md:p-10">
            <h2 className="text-3xl font-semibold text-white md:text-4xl">Устраним вместе</h2>
            <p className="mt-3 max-w-2xl text-white/70">
              Не оставляем вас с красным списком. Готовим документы, правим формы и
              cookie-баннер, сопровождаем до устойчивого соответствия.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/#lead">
                <Button size="lg" pulse>
                  Получить полный отчёт
                </Button>
              </Link>
              <Link href="/check">
                <Button size="lg" variant="secondary">
                  Сначала проверить сайт
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-white/5 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">FAQ</h2>
        </Reveal>
        <Stagger className="mt-8 space-y-3">
          {faqs.map((f) => (
            <StaggerItem key={f.q}>
              <details className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 open:bg-white/[0.04]">
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

export function LeadSection() {
  return (
    <section id="lead" className="scroll-mt-24 bg-ink-975 py-16 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2 md:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Оставить заявку</h2>
          <p className="mt-3 text-white/65">
            Расскажите о сайте — пришлём полный отчёт и предложим план устранения.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="rounded-2xl border border-white/10 bg-ink-900/50 p-5">
            <LeadForm source="landing-lead" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
