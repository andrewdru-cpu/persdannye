import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CookieConsentDialog } from "../components/layout/CookieBanner.tsx";
import { COOKIE_FOCUS_CLASS, cookieDialogKey, cookieFocusPlace } from "../lib/cookie-dialog.ts";

function dialog(advanced = false): string {
  return renderToStaticMarkup(
    createElement(CookieConsentDialog, {
      advanced,
      analytics: false,
      onAnalytics: () => undefined,
      onAccept: () => undefined,
      onReject: () => undefined,
      onSettings: () => undefined,
      onSave: () => undefined,
      onDismiss: () => undefined,
    }),
  );
}

describe("cookie banner dialog", () => {
  it("renders a modal with a visible focus style", () => {
    const html = dialog(true);
    assert.equal(html.includes('role="dialog"'), true);
    assert.equal(html.includes('aria-modal="true"'), true);
    assert.equal(html.includes('aria-label="Настройки cookie"'), true);
    assert.equal(html.includes('tabindex="-1"'), true);
    assert.equal(html.includes(COOKIE_FOCUS_CLASS), true);
    assert.equal(html.includes("focus-visible:ring-2"), true);
    assert.equal(html.includes('href="/cookies"'), true);
    assert.equal(html.includes(">Принять<"), true);
    assert.equal(html.includes(">Отклонить<"), true);
    assert.equal(html.includes(">Сохранить выбор<"), true);
    assert.equal(html.includes("disabled"), true);
  });

  it("closes on Escape and keeps Tab inside the dialog", () => {
    assert.deepEqual(cookieDialogKey("Escape", false, "first", 3), { dismiss: true, focus: null });
    assert.deepEqual(cookieDialogKey("Tab", false, "last", 3), { dismiss: false, focus: "first" });
    assert.deepEqual(cookieDialogKey("Tab", true, "first", 3), { dismiss: false, focus: "last" });
    assert.deepEqual(cookieDialogKey("Tab", true, "dialog", 3), { dismiss: false, focus: "last" });
    assert.deepEqual(cookieDialogKey("Tab", false, "outside", 3), { dismiss: false, focus: "first" });
    assert.deepEqual(cookieDialogKey("Tab", false, "middle", 3), { dismiss: false, focus: null });
    assert.deepEqual(cookieDialogKey("Tab", false, "dialog", 0), { dismiss: false, focus: "stay" });
    assert.deepEqual(cookieDialogKey("Tab", true, "first", 1), { dismiss: false, focus: "first" });

    const root = {};
    const first = {};
    const middle = {};
    const last = {};
    const items = [first, middle, last] as HTMLElement[];
    const contains = (node: Node | null) => node === root || items.includes(node as HTMLElement);
    Object.assign(root, { contains });
    assert.equal(cookieFocusPlace(root as Node, first as Node, items), "first");
    assert.equal(cookieFocusPlace(root as Node, last as Node, items), "last");
    assert.equal(cookieFocusPlace(root as Node, middle as Node, items), "middle");
    assert.equal(cookieFocusPlace(root as Node, root as Node, items), "dialog");
    assert.equal(cookieFocusPlace(root as Node, {} as Node, items), "outside");
  });
});
