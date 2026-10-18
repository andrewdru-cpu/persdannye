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
