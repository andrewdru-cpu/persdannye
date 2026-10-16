import Link from "next/link";
import { footerParagraphs } from "@/content/blocks";
import { flags } from "@/content/flags";
import { footerBlurb } from "@/content/landing";
import { visibleFooterDocuments } from "@/content/legal-nav";
import { fillPlaceholders } from "@/content/placeholders";
import { DbipAttribution } from "@/components/layout/dbip-view";
import { PrivacyContactLink } from "@/components/legal/PrivacyContactLink";
import { company, privacyContactLabel } from "@/lib/company";
import { showPlaceholderTodos } from "@/lib/runtime-flags";

export function Footer() {
  return (
    <footer className="border-t border-amber-200/15 bg-ink-975">
      <div className="gold-hairline" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-3 md:px-6">
        <div>
          <div className="mb-3 font-display text-2xl font-semibold text-white">{company.brand}</div>
          <p className="text-sm leading-relaxed text-white/80">{footerBlurb}</p>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-300/90">
            Документы
          </div>
          <ul className="space-y-2 text-sm text-white/80">
            {visibleFooterDocuments().map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:text-amber-300">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-300/90">
            Оператор
          </div>
          {flags.show_requisites ? (
            <ul className="space-y-1 text-sm text-white/80">
              <li>{company.legalName}</li>
              <li>ИНН {company.inn}</li>
              <li>ОГРН {company.ogrn}</li>
              <li>{company.address}</li>
              {privacyContactLabel() ? (
                <li>
                  ДПО: <PrivacyContactLink className="hover:text-amber-300" />
                </li>
              ) : null}
              <li>
                <a className="hover:text-amber-300" href={company.phoneHref}>
                  {company.phone}
                </a>
              </li>
            </ul>
          ) : (
            <ul className="space-y-1 text-sm text-white/80">
              {privacyContactLabel() ? (
                <li>
                  ДПО: <PrivacyContactLink className="hover:text-amber-300" />
                </li>
              ) : (
                <li>Реквизиты не опубликованы</li>
              )}
            </ul>
          )}
        </div>
      </div>
      <div className="border-t border-white/5 px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-3 text-left text-xs leading-relaxed text-white/70" role="note">
          {footerParagraphs(showPlaceholderTodos()).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p>
            <Link href={fillPlaceholders("{{policy_url}}", false)} className="text-amber-200 hover:underline">
              Политика обработки персональных данных
            </Link>
          </p>
          <DbipAttribution />
        </div>
        <p className="mt-3 text-center text-xs text-white/80">
          © {new Date().getFullYear()} {flags.show_requisites ? company.legalName : company.brand}. Все права защищены.
        </p>
      </div>
    </footer>
  );
}
