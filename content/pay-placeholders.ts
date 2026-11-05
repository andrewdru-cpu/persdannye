/**
 * Цены и сроки, которые юрист оставил плейсхолдерами.
 * Пустые строки на сайт не выводятся. show_prices остаётся выключенным:
 * даже заполненная цена не попадает в HTML, пока флаг не включат отдельно.
 * Реальные тарифы в этот файл не писать.
 */
export const payPlaceholders = {
  plan_features: "",
  trial_terms: "",
  retry_count: "",
  retry_days: "",
  liability_months: "",
  hourly_rate: "",
  subscription_period: "",
  refund_reply_days: "",
  claim_days: "",
  notice_days: "",
  acceptance_days: "",
  check_time: "",
  plan_1_name: "",
  plan_1_period: "",
  plan_1_price: "",
  plan_1_features: "",
  plan_2_name: "",
  plan_2_period: "",
  plan_2_price: "",
  plan_2_features: "",
} as const;

const PRICE = /^\d{1,7}(?:[.,]\d{2})?$/;

/** Цена для витрины. При выключенном флаге и при пустом значении — null. */
export function publishedPrice(showPrices: boolean, value: string): string | null {
  const trimmed = value.trim();
  if (!showPrices || !trimmed || trimmed.includes("TODO")) return null;
  if (!PRICE.test(trimmed)) return null;
  return trimmed;
}

const COUNT = /^\d{1,3}$/;

export function publishedCount(value: string): string | null {
  const trimmed = value.trim();
  if (!COUNT.test(trimmed)) return null;
  return trimmed;
}
