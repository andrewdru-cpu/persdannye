import { dbipFooterAttribution } from "@/lib/dbip-attribution";

/** Строка атрибуции DB-IP в футере. Без флага не рендерится. */
export function DbipAttribution() {
  const item = dbipFooterAttribution();
  if (!item) return null;
  return (
    <p>
      {item.before}
      <a href={item.homeHref} target="_blank" rel={item.rel}>
        {item.homeLabel}
      </a>
      {item.between}
      <a href={item.licenseHref} target="_blank" rel={item.rel}>
        {item.licenseLabel}
      </a>
      {item.after}
    </p>
  );
}
