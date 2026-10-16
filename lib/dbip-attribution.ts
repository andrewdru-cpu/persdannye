import { safeHref } from "./safe-href";

/** Включается только явным NEXT_PUBLIC_SHOW_DBIP_ATTRIBUTION=true. На превью тоже выключен. */
export function dbipAttributionEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SHOW_DBIP_ATTRIBUTION === "true";
}

export const DBIP_HOME_HREF = "https://db-ip.com";
export const DBIP_LICENSE_HREF = "https://creativecommons.org/licenses/by/4.0/";
export const DBIP_LINK_REL = "noopener noreferrer";

export type DbipFooterAttribution = {
  before: string;
  homeLabel: string;
  homeHref: string;
  between: string;
  licenseLabel: string;
  licenseHref: string;
  after: string;
  rel: typeof DBIP_LINK_REL;
};

/** Дословная строка футера. null — флаг выключен или ссылка не http(s). */
export function dbipFooterAttribution(): DbipFooterAttribution | null {
  if (!dbipAttributionEnabled()) return null;
  const homeHref = safeHref(DBIP_HOME_HREF);
  const licenseHref = safeHref(DBIP_LICENSE_HREF);
  if (!homeHref || !licenseHref) return null;
  return {
    before: "Данные о стране и сети IP-адресов: ",
    homeLabel: "IP Geolocation by DB-IP",
    homeHref,
    between: ", лицензия ",
    licenseLabel: "CC BY 4.0",
    licenseHref,
    after: ".",
    rel: DBIP_LINK_REL,
  };
}
