/** Разделы, которые есть на сайте: страницы app/ или якоря на главной. */
export const footerSectionLinks = [
  { href: "/", label: "Главная" },
  { href: "/check", label: "Проверка" },
  { href: "/#checks", label: "Что проверяем" },
  { href: "/#faq", label: "FAQ" },
] as const;

/** Юридические страницы. Все пути есть в app/. */
export const footerLegalLinks = [
  { href: "/offer", label: "Оферта" },
  { href: "/terms", label: "Пользовательское соглашение" },
  { href: "/consent", label: "Согласие на обработку ПДн" },
  { href: "/cookies", label: "Политика cookie" },
  { href: "/privacy", label: "Политика обработки ПДн" },
  { href: "/accessibility", label: "Заявление о доступности" },
] as const;

export const footerLinks = [...footerSectionLinks, ...footerLegalLinks] as const;
