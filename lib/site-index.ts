import { flags } from "../content/flags";

/** Продовый fallback, если NEXT_PUBLIC_SITE_URL не задан. */
export const SITE_URL_FALLBACK = "https://persdannye.vercel.app";

export function siteBaseUrl(raw: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  const value = raw?.trim() || SITE_URL_FALLBACK;
  return value.replace(/\/+$/, "");
}

export type SitePage = {
  path: string;
  index: boolean;
};

type IndexFlags = Pick<typeof flags, "show_site_legal" | "show_cookie_policy" | "show_terms">;

/** Все страницы приложения. В sitemap попадают только index: true. */
export function sitePages(source: IndexFlags = flags): SitePage[] {
  const legal = source.show_site_legal;
  return [
    { path: "/", index: true },
    { path: "/check", index: true },
    { path: "/privacy", index: legal },
    { path: "/consent", index: legal },
    { path: "/consent-lead", index: legal },
    { path: "/consent-marketing", index: legal },
    { path: "/cookies", index: source.show_cookie_policy },
    { path: "/terms", index: source.show_terms },
    { path: "/offer", index: false },
    { path: "/refund", index: false },
    { path: "/data-deletion", index: false },
    { path: "/applicability", index: false },
  ];
}

export function indexablePaths(source: IndexFlags = flags): string[] {
  return sitePages(source)
    .filter((page) => page.index)
    .map((page) => page.path);
}

export function robotsDocument(base = siteBaseUrl()) {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

export function sitemapEntries(base = siteBaseUrl(), source: IndexFlags = flags) {
  return indexablePaths(source).map((path) => ({
    url: `${base}${path === "/" ? "/" : path}`,
  }));
}
