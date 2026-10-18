import { flags } from "../content/flags";

export type LegalPublication = "pending" | "published";

/** Старые /privacy и /consent* видны только после включения show_site_legal. */
export function legalPublication(showSiteLegal = flags.show_site_legal): LegalPublication {
  return showSiteLegal ? "published" : "pending";
}

export function unpublishedRobots(showSiteLegal = flags.show_site_legal) {
  if (showSiteLegal) return undefined;
  return { index: false as const, follow: false as const };
}
