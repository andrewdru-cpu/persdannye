"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { HeroBackdrop } from "@/components/motion/HeroBackdrop";
import { TrustMarquee } from "@/components/motion/Marquee";
import { UrlChecker } from "@/components/check/UrlChecker";
import { LeadForm } from "@/components/landing/LeadForm";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";

const trustItems = [
  {
    k: "1000+",
    t: "компаний",
    d: "Уже обратились за проверкой и сопровождением по 152-ФЗ.",
  },
  {
    k: "24/7",
    t: "актуальность РКН",
    d: "Базу требований Роскомнадзора обновляем каждый день.",
  },
  {
    k: "минуты",
    t: "до списка рисков",
    d: "Экспресс-скан без установки кода — URL достаточно.",
  },
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
  hidden: { opacity: 0, y: 32, filter: "blur(8px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { delay: 0.06 + i * 0.12, duration: 0.7, ease: heroEase },
  }),
};

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden pb-16 pt-12 md:pb-28 md:pt-20">
      <HeroBackdrop />
      <div className="relative mx-auto grid max-w-6xl items-start gap-10 px-4 md:px-6 lg:grid-cols-12">
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
            className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-amber-400/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
            Закрытый контур · 152-ФЗ / РКН
          </motion.div>
          <motion.h1
            custom={1}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-6 font-display text-5xl font-semibold leading-[1.05] text-white md:text-7xl"
          >
            Найдите несоответствие{" "}
            <span className={reduce ? "text-amber-200" : "gold-text-sheen"}>
              Роскомнадзора
            </span>{" "}
            до штрафа, не после
          </motion.h1>
          <motion.div
            custom={2}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-5 h-px w-28 bg-gradient-to-r from-amber-200 via-amber-400 to-transparent"
          />
          <motion.p
            custom={3}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-5 max-w-xl text-base leading-relaxed text-white/70 md:text-lg"
          >
            «ПерсДанные» проводит премиальный экспресс-аудит сайта: политики, cookie,
            формы и согласия. Показываем факты, готовим план устранения. Требования
            РКН актуализируем каждый день. Нам доверяют уже 1000+ компаний.
          </motion.p>
          <motion.div
            custom={4}
            variants={reduce ? undefined : heroLine}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link href="/check">
              <Button size="lg" pulse>
                Проверить свой сайт
              </Button>
            </Link>
            <Link href="/#lead">
              <Button size="lg" variant="secondary">
                Получить полный отчёт
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          className="min-w-0 lg:col-span-5"
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard gold className="p-5 md:p-6 lg:mt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-display text-2xl font-semibold text-white">
                  Экспресс-проверка
                </div>
                <p className="mt-1 text-sm text-white/55">
                  Введите URL — статус и находки за минуты
                </p>
              </div>
              <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-100">
                Live
              </span>
            </div>
            <UrlChecker compact pulseCta />
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
      <section className="border-b border-amber-200/10 bg-white/[0.015] py-12">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <Stagger className="grid gap-4 md:grid-cols-3">
            {trustItems.map((item) => (
              <StaggerItem key={item.t}>
                <GlassCard className="h-full p-6 transition hover:border-amber-300/35">
                  <div className="font-display text-4xl font-semibold text-amber-200">
                    {item.k}
                  </div>
                  <div className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-white/80">
                    {item.t}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{item.d}</p>
                </GlassCard>
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
    <section id="how" className="scroll-mt-24 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Процесс
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            Как это работает
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">
            От URL до списка рисков — прозрачный процесс без сюрпризов.
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
    <section id="checks" className="scroll-mt-24 border-y border-amber-200/10 bg-ink-975/80 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Контроль
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            Что мы проверяем
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">
            Контрольные точки по 152-ФЗ и практике Роскомнадзора — с акцентом на то,
            за что реально штрафуют.
          </p>
        </Reveal>
        <Stagger className="mt-8 grid gap-3 md:grid-cols-2">
          {checkItems.map((item) => (
            <StaggerItem key={item}>
              <div className="glass-card flex gap-3 px-4 py-3.5 text-sm text-white/75 transition hover:border-amber-300/30">
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
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Отчёт
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            Пример результата
          </h2>
          <p className="mt-3 max-w-2xl text-white/60">
            Так выглядит экспресс-отчёт: статус, балл и список находок с фактами.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="mt-8">
          <GlassCard className="border-rose-400/25 bg-rose-500/[0.06] p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-sm uppercase tracking-[0.14em] text-rose-200">
                  example-shop.ru — не соответствует
                </div>
                <div className="mt-2 font-display text-3xl font-semibold text-white">
                  Найдено 4 риска
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-5xl font-semibold text-white">42</div>
                <div className="text-xs uppercase tracking-wider text-white/50">балл</div>
              </div>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-white/70">
              <li className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                P01 · Нет политики обработки ПДн
              </li>
              <li className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                C02 · Cookie без раздельного согласия
              </li>
              <li className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
                F03 · Форма без явного согласия
              </li>
            </ul>
            <Link href="/check" className="mt-6 inline-block">
              <Button size="lg" pulse>
                Проверить свой сайт
              </Button>
            </Link>
          </GlassCard>
        </Reveal>
      </div>
    </section>
  );
}

export function WhoFor() {
  return (
    <section className="border-y border-amber-200/10 py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Аудитория
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            Для кого
          </h2>
        </Reveal>
        <Stagger className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map((a) => (
            <StaggerItem key={a.t}>
              <GlassCard className="h-full p-5 transition hover:border-amber-300/35">
                <div className="font-display text-2xl font-semibold text-white">{a.t}</div>
                <p className="mt-2 text-sm text-white/60">{a.d}</p>
              </GlassCard>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export function FixWithUs() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <GlassCard gold className="p-8 md:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/90">
              Сопровождение
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
              Устраним вместе
            </h2>
            <p className="mt-4 max-w-2xl text-white/70">
              Не оставляем вас с красным списком. Готовим документы, правим формы и
              cookie-баннер, сопровождаем до устойчивого соответствия.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
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
          </GlassCard>
        </Reveal>
      </div>
    </section>
  );
}

export function FAQ() {
  return (
    <section id="faq" className="scroll-mt-24 border-t border-amber-200/10 py-16 md:py-24">
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
          {faqs.map((f) => (
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

export function LeadSection() {
  return (
    <section id="lead" className="scroll-mt-24 bg-ink-975 py-16 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-2 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">
            Консьерж
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl">
            Оставить заявку
          </h2>
          <p className="mt-4 text-white/65">
            Расскажите о сайте — пришлём полный отчёт и предложим план устранения.
            Заявка сразу уходит менеджеру.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <GlassCard gold>
            <LeadForm source="landing-lead" />
          </GlassCard>
        </Reveal>
      </div>
    </section>
  );
}
