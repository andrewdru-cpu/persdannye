export type RubleSpan = { min: number; max: number };

export function formatRub(value: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(value)}\u00a0₽`;
}

export function sumSpans(spans: readonly RubleSpan[]): RubleSpan {
  return spans.reduce(
    (total, span) => ({ min: total.min + span.min, max: total.max + span.max }),
    { min: 0, max: 0 },
  );
}
