export function visibleRequisite(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** ИП — «ОГРНИП», пустая форма, ООО и всё остальное — «ОГРН». */
export function ogrnLabel(legalForm: string | null | undefined): "ОГРН" | "ОГРНИП" {
  return legalForm?.trim().toLocaleUpperCase("ru") === "ИП" ? "ОГРНИП" : "ОГРН";
}

/** «ИНН …, ОГРН/ОГРНИП …». Пустые значения в строку не попадают. */
export function requisiteIdLine(inn: string, ogrn: string, legalForm = ""): string | null {
  const parts = [
    inn.trim() ? `ИНН ${inn.trim()}` : "",
    ogrn.trim() ? `${ogrnLabel(legalForm)} ${ogrn.trim()}` : "",
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
