import type { Metadata } from "next";
import Link from "next/link";
import { configuredRequisites, npdNameAndInn } from "@/lib/requisites-guard";
import { publicContactEmail } from "@/lib/support-email";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Контакты",
  robots: { index: false, follow: false },
};

export default function ContactsPage() {
  const identity = npdNameAndInn(configuredRequisites());
  const email = publicContactEmail();
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20">
      <h1 className="text-3xl font-semibold text-white md:text-4xl">Контакты</h1>
      {identity ? (
        <p className="mt-4 text-sm leading-relaxed text-white/80">
          {identity.legalName}, плательщик налога на профессиональный доход, ИНН {identity.inn}
        </p>
      ) : null}
      {email ? (
        <p className="mt-4 text-sm">
          <a className="text-amber-300 hover:underline" href={`mailto:${email}`}>
            {email}
          </a>
        </p>
      ) : null}
      <p className="mt-6 text-sm">
        <Link href="/privacy" className="text-amber-300 hover:underline">
          Политика обработки ПДн
        </Link>
      </p>
    </article>
  );
}
