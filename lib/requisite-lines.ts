export function visibleRequisite(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** «ИНН …, ОГРН …». Пустые значения в строку не попадают. */
export function requisiteIdLine(inn: string, ogrn: string): string | null {
  const parts = [
    inn.trim() ? `ИНН ${inn.trim()}` : "",
    ogrn.trim() ? `ОГРН ${ogrn.trim()}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** Телефон в шаблоне. Пустое значение и голый `tel:` ссылкой не становятся. */
export function visiblePhone(phone: string, phoneHref: string): { text: string; href: string | null } | null {
  const text = phone.trim();
  if (!text) return null;
  const href = phoneHref.trim();
  if (!href || href === "tel:") return { text, href: null };
  return { text, href };
}

/** Строка футера про оператора. Пустой ИНН не оставляет подпись «ИНН ». */
export function operatorDisclaimer(legalName: string, inn: string): string | null {
  const name = visibleRequisite(legalName);
  const innValue = inn.trim();
  if (!name && !innValue) return null;
  if (name && innValue) return `Оператор сайта: ${name}, ИНН ${innValue}.`;
  if (name) return `Оператор сайта: ${name}.`;
  return `Оператор сайта: ИНН ${innValue}.`;
}
