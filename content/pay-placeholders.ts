/**
 * Сроки и тарифы. Пустые строки на сайт не выводятся.
 * Утверждённый месячный тариф можно хранить здесь при выключенном show_prices:
 * его читают оферта подписки, политика возврата и описание тарифа на /pay.
 * Витрина лендинга эту цену не показывает. publishedPrice остаётся пустым, пока флаг выключен.
 * Годовой тариф (plan_2), разовые цены, пробный период и почасовая ставка не заполнены.
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
  plan_1_name: "Месячный",
  plan_1_period: "месяц",
  plan_1_price: "390",
  plan_1_features: "Доступ к кабинету, проверки сайта и отчёты в объёме тарифа",
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

export type MonthlyPlan = {
  name: string;
  /** Короткий период из плейсхолдера: «месяц». */
  period: string;
  /** Цифры, как принимает publishedPrice. */
  price: string;
  features: string;
};

/**
 * Месячный тариф для оферты, возврата и /pay.
 * Не смотрит на show_prices: это утверждённый текст, не витрина.
 */
export function approvedMonthlyPlan(): MonthlyPlan | null {
  const name = payPlaceholders.plan_1_name.trim();
  const period = payPlaceholders.plan_1_period.trim();
  const price = payPlaceholders.plan_1_price.trim();
  const features = payPlaceholders.plan_1_features.trim();
  if (!name || !period || !PRICE.test(price)) return null;
  return { name, period, price, features };
}

/** «месяц» и «мес» в текстах оферты — один календарный месяц. */
export function monthlyPeriodLabel(period: string): string {
  if (period === "месяц" || period === "мес") return "1 календарный месяц";
  return period;
}

/**
 * Фраза автосписания для месячного периода.
 * Годовой тариф не подставляется: его цена не утверждена.
 */
export function monthlyRecurringCharge(period: string): { phrase: string; planName: string } | null {
  const plan = approvedMonthlyPlan();
  if (!plan) return null;
  const normalized = period.trim().toLowerCase();
  if (normalized !== "месяц" && normalized !== "мес" && !normalized.includes("календарн")) return null;
  return { phrase: `${plan.price} ₽ раз в календарный месяц`, planName: plan.name };
}

const COUNT = /^\d{1,3}$/;

export function publishedCount(value: string): string | null {
  const trimmed = value.trim();
  if (!COUNT.test(trimmed)) return null;
  return trimmed;
}
