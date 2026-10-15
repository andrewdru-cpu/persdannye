import { flags } from "./flags";

type FlagName = "show_cookie_policy" | "show_terms" | "show_offer" | "show_refund" | "show_data_deletion";

export const footerDocuments: Array<{ href: string; label: string; flag: FlagName | null }> = [
  { href: "/privacy", label: "Политика обработки ПДн", flag: null },
  { href: "/cookies", label: "Политика cookie", flag: "show_cookie_policy" },
  { href: "/terms", label: "Пользовательское соглашение", flag: "show_terms" },
  { href: "/offer", label: "Оферта", flag: "show_offer" },
  { href: "/refund", label: "Возврат", flag: "show_refund" },
  { href: "/data-deletion", label: "Порядок удаления данных", flag: "show_data_deletion" },
  { href: "/applicability", label: "Что к сайту не относится", flag: null },
];

export function visibleFooterDocuments(source: typeof flags = flags) {
  return footerDocuments.filter((item) => item.flag === null || source[item.flag]);
}
