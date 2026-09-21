import Link from "next/link";
import { company } from "@/lib/company";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-ink-975">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3 md:px-6">
        <div>
          <div className="mb-3 text-lg font-semibold text-white">{company.brand}</div>
          <p className="text-sm leading-relaxed text-white/60">
            Сканер соответствия сайтов требованиям Роскомнадзора и 152-ФЗ.
            Актуализируем базу требований каждый день.
          </p>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-300/90">
            Документы
          </div>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link href="/privacy" className="hover:text-amber-300">
                Политика обработки ПДн
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="hover:text-amber-300">
                Политика cookie
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-amber-300">
                Пользовательское соглашение
              </Link>
            </li>
            <li>
              <Link href="/cabinet" className="hover:text-amber-300">
                Кабинет (MVP)
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-300/90">
            Оператор
          </div>
          <ul className="space-y-1 text-sm text-white/70">
            <li>{company.legalName}</li>
            <li>ИНН {company.inn}</li>
            <li>ОГРН {company.ogrn}</li>
            <li>{company.address}</li>
            <li>
              <a className="hover:text-amber-300" href={`mailto:${company.email}`}>
                {company.email}
              </a>
            </li>
            <li>
              ДПО:{" "}
              <a className="hover:text-amber-300" href={`mailto:${company.dpoEmail}`}>
                {company.dpoEmail}
              </a>
            </li>
            <li>
              <a className="hover:text-amber-300" href={company.phoneHref}>
                {company.phone}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-white/40">
        © {new Date().getFullYear()} {company.legalName}. Все права защищены.
      </div>
    </footer>
  );
}
