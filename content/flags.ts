/**
 * Флаги публикации из site-copy v1.1, раздел 0.
 * Все по умолчанию выключены. Суммы, срок и число проверок на превью не показываем.
 * Широкий boolean, чтобы ветки с текстами оставались в исходнике.
 */
export const flags = {
  show_fines: false as boolean,
  show_marketing_consent: false as boolean,
  calc_client_only: false as boolean,
  hero_speed_claim: false as boolean,
  hero_dozens_claim: false as boolean,
  hero_alt_check: false as boolean,
  show_rkn_stats: false as boolean,
  show_rules_update: false as boolean,
  show_methodology: false as boolean,
  show_accuracy: false as boolean,
  show_prices: false as boolean,
  show_monitoring: false as boolean,
  /** Доп. блоки v2. Тексты согласованы, на превью включены. */
  show_sample_report: true as boolean,
  show_who_for: true as boolean,
  show_fix_with_us: true as boolean,
  /** Кнопка «Обсудить исправления» и форма #lead. Включена: форма переведена на 8.1-lead. */
  show_lead_form: true as boolean,
  show_platform_hints: false as boolean,
};
