import { createElement, type ReactNode } from "react";
import {
  DBIP_SOURCES_LABEL,
  dbipAttributionEnabled,
  dbipFooterAttribution,
} from "../../lib/dbip-attribution";

const linkClass = "text-amber-200 underline underline-offset-2";

/** Строка атрибуции. Без флага не рендерится. */
export function DbipAttribution(): ReactNode {
  const item = dbipFooterAttribution();
  if (!item) return null;
  return createElement(
    "p",
    null,
    item.before,
    createElement(
      "a",
      { href: item.homeHref, target: "_blank", rel: item.rel, className: linkClass },
      item.homeLabel,
    ),
    item.between,
    createElement(
      "a",
      { href: item.licenseHref, target: "_blank", rel: item.rel, className: linkClass },
      item.licenseLabel,
    ),
    item.after,
  );
}

export function sourcesArticle(): ReactNode {
  return createElement(
    "article",
    { className: "mx-auto max-w-3xl px-4 py-14 md:px-6 md:py-20" },
    createElement(
      "h1",
      { className: "text-3xl font-semibold text-white md:text-4xl" },
      DBIP_SOURCES_LABEL,
    ),
    createElement(
      "div",
      { className: "mt-6 text-sm leading-relaxed text-white/80" },
      createElement(DbipAttribution),
    ),
  );
}

/** Флаг выключен — notFound() и HTTP 404. Флаг включён — та же строка, что в футере. */
export function renderSourcesPage(notFound: () => never): ReactNode {
  if (!dbipAttributionEnabled()) notFound();
  return sourcesArticle();
}
