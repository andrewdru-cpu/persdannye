"use client";

import { COOKIE_SETTINGS_LABEL } from "@/content/cookies-policy";
import { OPEN_COOKIE_SETTINGS_EVENT } from "@/lib/cookie-consent";

/** Всегда в футере: заново открывает баннер, от флагов публикации не зависит. */
export function CookieSettingsLink() {
  return (
    <button
      type="button"
      className="cursor-pointer border-0 bg-transparent p-0 text-left font-[inherit] text-inherit hover:text-amber-300"
      onClick={() => {
        window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
      }}
    >
      {COOKIE_SETTINGS_LABEL}
    </button>
  );
}
