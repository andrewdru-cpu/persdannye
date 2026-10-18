export const COOKIE_FOCUS_CLASS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
].join(", ");

export type CookieFocusPlace = "dialog" | "first" | "middle" | "last" | "outside";

export function cookieFocusable(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => element.tabIndex !== -1);
}

export function cookieFocusPlace(root: Node, active: Node | null, items: HTMLElement[]): CookieFocusPlace {
  if (!active || !root.contains(active)) return "outside";
  if (active === root) return "dialog";
  const index = items.indexOf(active as HTMLElement);
  if (index < 0) return "dialog";
  if (items.length === 1 || index === 0) return "first";
  if (index === items.length - 1) return "last";
  return "middle";
}

/** Esc закрывает диалог. Tab с краёв возвращает фокус внутрь. */
export function cookieDialogKey(
  key: string,
  shiftKey: boolean,
  active: CookieFocusPlace,
  count: number,
): { dismiss: boolean; focus: "first" | "last" | "stay" | null } {
  if (key === "Escape") return { dismiss: true, focus: null };
  if (key !== "Tab") return { dismiss: false, focus: null };
  if (count <= 0) return { dismiss: false, focus: "stay" };
  if (count === 1 || (!shiftKey && (active === "last" || active === "outside"))) {
    return { dismiss: false, focus: "first" };
  }
  if (shiftKey && (active === "first" || active === "dialog" || active === "outside")) {
    return { dismiss: false, focus: "last" };
  }
  return { dismiss: false, focus: null };
}
