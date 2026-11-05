import type { Metadata } from "next";
import Link from "next/link";
import { PrivacyContactLink } from "@/components/legal/PrivacyContactLink";
import {
  ACCESSIBILITY_BADGE,
  ACCESSIBILITY_REVIEW_DATE,
  ACCESSIBILITY_REVIEW_METHOD,
  ACCESSIBILITY_STATEMENT_DATE,
  ACCESSIBILITY_STATUS,
  accessibilityImplemented,
  accessibilityLimitations,
} from "@/content/accessibility";
import { npdOwnerClause } from "@/content/npd";
import { privacyContactLabel } from "@/lib/company";
import { showPlaceholderTodos } from "@/lib/runtime-flags";

export const metadata: Metadata = {
  title: "Заявление о доступности",
  description:
    "Заявление о доступности сайта: цель WCAG 2.2 уровня AA и ГОСТ Р 52872-2019, текущий статус — частичное соответствие.",
};

export default function AccessibilityPage() {
  const todos = showPlaceholderTodos();
  const owner = npdOwnerClause(todos);
  const contact = privacyContactLabel();
  return (
    <article className="mx-auto max-w-5xl px-4 py-14 md:px-6 md:py-20">
      <p>
        <Link href="/" className="text-sm text-amber-200 hover:underline">
          ← на главную
        </Link>
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold text-white md:text-5xl">
        Заявление о доступности
      </h1>
      <p className="mt-4 inline-flex rounded-full border border-amber-200/40 bg-amber-200/10 px-3 py-1 text-sm text-amber-100">
        {ACCESSIBILITY_BADGE}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-white/70">
        Дата заявления: {ACCESSIBILITY_STATEMENT_DATE}. Дата последней проверки:{" "}
        {ACCESSIBILITY_REVIEW_DATE}. Способ: {ACCESSIBILITY_REVIEW_METHOD}.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/70">
        Стандарты: WCAG 2.2 уровень AA, ГОСТ Р 52872-2019.
      </p>

      <section className="glass-card mt-8 rounded-3xl p-5 md:p-6">
        <h2 className="text-xl font-semibold text-white">Коротко</h2>
        {owner ? (
          <p className="mt-3 text-sm leading-relaxed text-white/80">Владелец сайта — {owner}.</p>
        ) : null}
        <p className="mt-3 text-sm leading-relaxed text-white/80">{ACCESSIBILITY_STATUS}</p>
      </section>

      <h2 className="mt-12 text-2xl font-semibold text-white">Что реализовано</h2>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accessibilityImplemented.map((item) => (
          <li key={item.title} className="glass-card rounded-2xl p-4">
            <h3 className="text-base font-semibold text-white">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/75">{item.text}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-2xl font-semibold text-white">Что в работе и ограничения</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-white/75">
        {accessibilityLimitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-white">Контакт</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          {contact ? (
            <>
              Напишите: <PrivacyContactLink className="text-amber-200 hover:underline" />.{" "}
            </>
          ) : (
            <>
              Напишите на контакт для запросов субъектов из{" "}
              <Link href="/privacy" className="text-amber-200 hover:underline">
                Политики обработки персональных данных
              </Link>
              .{" "}
            </>
          )}
          Ответим в течение 10 рабочих дней.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/80">
          ПДн из обращений обрабатываются в цели 4{" "}
          <Link href="/privacy" className="text-amber-200 hover:underline">
            Политики
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
