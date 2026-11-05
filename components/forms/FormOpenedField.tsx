"use client";

import { useEffect, useState } from "react";
import { FORM_OPEN_MIN_MS, FORM_OPENED_FIELD } from "@/lib/form-open";

/** Билет с сервера: подписанное время открытия. Кнопка ждёт ту же паузу, что проверяет сервер. */
export function useFormOpened() {
  const [ticket, setTicket] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    let timer = 0;
    const started = Date.now();
    fetch("/api/form-ticket", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ticket?: unknown } | null) => {
        if (cancel || !data || typeof data.ticket !== "string") return;
        setTicket(data.ticket);
        const wait = Math.max(0, FORM_OPEN_MIN_MS - (Date.now() - started));
        timer = window.setTimeout(() => {
          if (!cancel) setReady(true);
        }, wait);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, []);

  return { ticket, ready };
}

export function FormOpenedField({ value }: { value: string }) {
  return (
    <input type="hidden" name={FORM_OPENED_FIELD} value={value} readOnly autoComplete="off" tabIndex={-1} />
  );
}
