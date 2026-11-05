import Link from "next/link";
import { DbipAttribution } from "@/components/layout/DbipAttribution";
import { PrivacyContactLink } from "@/components/legal/PrivacyContactLink";
import { footerLegalLinks, footerSectionLinks } from "@/content/footer-nav";
import { footerBlurb } from "@/content/landing";
import { CHECK_DISCLAIMER, INDEPENDENT_SERVICE_LINE, npdIdentitySentence } from "@/content/npd";
import { company, privacyContactLabel } from "@/lib/company";
import { showPlaceholderTodos } from "@/lib/runtime-flags";

export function Footer() {
  const todos = showPlaceholderTodos();
  const email = privacyContactLabel();
  return (
    <footer className="border-t border-amber-200/15 bg-ink-975">
      <div className="gold-hairline" />
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="max-w-md">
          <div className="font-display text-2xl font-semibold text-white">{company.brand}</div>
          <p className="mt-3 text-sm leading-relaxed text-white/75">{footerBlurb}</p>
          {email ? (
            <p className="mt-3 text-sm">
              <PrivacyContactLink className="text-amber-200 hover:underline" />
            </p>
          ) : null}
        </div>

        <nav aria-label="Разделы сайта" className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
          {footerSectionLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-white/75 transition hover:text-amber-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Документы" className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          {footerLegalLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-white/75 transition hover:text-amber-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10 px-4 py-4 md:px-6">
        <div className="mx-auto max-w-6xl space-y-1.5 text-xs leading-relaxed text-white/60">
          <p>
            © {new Date().getFullYear()} {company.brand}
          </p>
          <p>{CHECK_DISCLAIMER}</p>
          <p>{npdIdentitySentence(todos)}.</p>
          <p>{INDEPENDENT_SERVICE_LINE}</p>
          <DbipAttribution />
        </div>
      </div>
    </footer>
  );
}
