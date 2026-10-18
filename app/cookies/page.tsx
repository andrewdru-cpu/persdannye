import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  COOKIE_SECTION_CATEGORIES,
  COOKIE_SECTION_CONSENT,
  COOKIE_SECTION_RETENTION,
  COOKIE_SECTION_WHAT,
  cookieContactsText,
} from "@/content/cookies-policy";
import { flags } from "@/content/flags";
import { editionCaption } from "@/content/placeholders";
import { LegalPending } from "@/components/legal/LegalPending";
import { PrivacyContactLink } from "@/components/legal/PrivacyContactLink";
import { company, privacyContactLabel } from "@/lib/company";
import { visibleRequisite } from "@/lib/requisite-lines";

export const metadata: Metadata = {
  title: "Политика cookie",
  robots: flags.show_cookie_policy ? undefined : { index: false, follow: false },
};

export default function CookiesPage() {
  if (!flags.show_cookie_policy) {
    return <LegalPending title="Политика cookie" />;
  }
  const legalName = visibleRequisite(company.legalName);
  const contact = privacyContactLabel();
  const contacts = cookieContactsText(contact);
  const edition = editionCaption("{{cookie_policy_edition_date}}");
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">Политика cookie</h1>
      {edition || legalName ? (
        <p className="mt-2 text-sm text-white/80">
          {edition}
          {edition && legalName ? " · " : ""}
          {legalName}
        </p>
      ) : null}

      <Sec title="1. Что это">
        <p>{COOKIE_SECTION_WHAT}</p>
      </Sec>

      <Sec title="2. Категории">
        <p>{COOKIE_SECTION_CATEGORIES}</p>
      </Sec>

      <Sec title="3. Согласие и отзыв">
        <p>{COOKIE_SECTION_CONSENT}</p>
      </Sec>

      <Sec title="4. Срок хранения">
        <p>{COOKIE_SECTION_RETENTION}</p>
      </Sec>

      <Sec title="5. Управление в браузере">
        <p>
          Вы можете ограничить или удалить cookie в настройках браузера. Отключение
          необходимых cookie может повлиять на работу форм.
        </p>
      </Sec>

      <Sec title="6. Связь с обработкой ПДн">
        <p>
          Подробнее — в{" "}
          <Link href="/privacy" className="text-amber-300 hover:underline">
            Политике обработки ПДн
          </Link>
          .
        </p>
      </Sec>

      <Sec title="7. Контакты">
        <p>
          {contact && contacts.includes(contact) ? (
            <>
              Вопросы — <PrivacyContactLink />.
            </>
          ) : (
            contacts
          )}
        </p>
      </Sec>
    </article>
  );
}

function Sec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/70 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
