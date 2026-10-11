"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { getSmartCaptchaSiteKey } from "@/lib/forms-mode";
import { shouldLoadSmartCaptcha, SMARTCAPTCHA_SCRIPT_SRC } from "@/lib/smartcaptcha";

type SmartCaptchaApi = {
  render: (
    container: HTMLElement,
    params: {
      sitekey: string;
      hl?: "ru" | "en";
      callback?: (token: string) => void;
    }
  ) => number;
  reset: (widgetId?: number) => void;
  destroy: (widgetId?: number) => void;
  getResponse: (widgetId?: number) => string;
  subscribe: (
    widgetId: number,
    event: "token-expired" | "network-error" | "javascript-error",
    callback: () => void
  ) => () => void;
};

declare global {
  interface Window {
    smartCaptcha?: SmartCaptchaApi;
  }
}

export type SmartCaptchaHandle = {
  getToken: () => string;
  reset: () => void;
};

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.smartCaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src^="${SMARTCAPTCHA_SCRIPT_SRC}"]`
    );
    const script = existing ?? document.createElement("script");
    const done = () => {
      if (window.smartCaptcha) resolve();
      else reject(new Error("Не удалось загрузить проверку"));
    };
    script.addEventListener("load", done, { once: true });
    script.addEventListener(
      "error",
      () => {
        scriptPromise = null;
        reject(new Error("Не удалось загрузить проверку"));
      },
      { once: true }
    );
    if (!existing) {
      script.src = SMARTCAPTCHA_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (window.smartCaptcha) {
      resolve();
    }
  });
  return scriptPromise;
}

/**
 * Yandex SmartCaptcha. Renders nothing and does not load the script unless
 * shouldLoadSmartCaptcha() is true (direct mode, or mock mode with a site key).
 */
export const SmartCaptcha = forwardRef<SmartCaptchaHandle>(function SmartCaptcha(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const tokenRef = useRef("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const siteKey = getSmartCaptchaSiteKey();
  const enabled = shouldLoadSmartCaptcha();

  useImperativeHandle(ref, () => ({
    getToken: () => {
      const fromWidget =
        widgetId.current != null
          ? window.smartCaptcha?.getResponse(widgetId.current) || ""
          : "";
      return fromWidget || tokenRef.current;
    },
    reset: () => {
      tokenRef.current = "";
      if (widgetId.current != null) window.smartCaptcha?.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!enabled || !siteKey || !containerRef.current) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    loadScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.smartCaptcha) return;
        const id = window.smartCaptcha.render(containerRef.current, {
          sitekey: siteKey,
          hl: "ru",
          callback: (token) => {
            tokenRef.current = token;
          },
        });
        widgetId.current = id;
        unsubscribe = window.smartCaptcha.subscribe(id, "token-expired", () => {
          tokenRef.current = "";
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Не удалось загрузить проверку");
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (widgetId.current != null) {
        window.smartCaptcha?.destroy(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [enabled, siteKey]);

  if (!enabled) return null;

  if (!siteKey) {
    return (
      <p className="text-sm text-rose-300" role="alert">
        Капча не настроена
      </p>
    );
  }

  return (
    <div>
      <div ref={containerRef} className="min-h-[118px]" />
      {loadError && (
        <p className="mt-1 text-sm text-rose-300" role="alert">
          {loadError}
        </p>
      )}
    </div>
  );
});
