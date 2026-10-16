import { flags } from "../content/flags";
import { safeHref } from "./safe-href";

export const DBIP_SOURCES_PATH = "/sources";
export const DBIP_SOURCES_LABEL = "Источники данных";

/** Включается флагом show_dbip_attribution. По умолчанию выключен, в том числе на превью. */
export function dbipAttributionEnabled(): boolean {
  return flags.show_dbip_attribution;
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
