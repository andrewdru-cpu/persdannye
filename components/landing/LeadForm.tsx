"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ReportConsentFields } from "@/components/check/ReportConsentFields";
import { Button } from "@/components/ui/Button";
import { CONSENT_TEXT_VERSION } from "@/lib/consent";

export function LeadForm({
  defaultUrl = "",
  checkId,
  source = "landing",
  cta = "Отправить заявку",
  marketingConsent = false,
}: {
  defaultUrl?: string;
  checkId?: string;
  source?: string;
  cta?: string;
  marketingConsent?: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [url, setUrl] = useState(defaultUrl);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Чтобы прислать отчёт на e-mail, нужно ваше согласие.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          company: companyName || undefined,
          url: url || undefined,
          checkId,
          message: message || undefined,
          consent: true,
          consent_text_version: CONSENT_TEXT_VERSION,
          source,
          ...(marketingConsent && marketingOptIn
            ? { marketing_consent: true, marketing_consent_text_version: CONSENT_TEXT_VERSION }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отправки");
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
        Заявка принята. Мы свяжемся с вами в рабочие часы.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя *"
        className="field-luxury px-3 py-2.5 text-sm"
      />
      <input
        required
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email *"
        className="field-luxury px-3 py-2.5 text-sm"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Телефон"
        className="field-luxury px-3 py-2.5 text-sm"
      />
      <input
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Компания"
        className="field-luxury px-3 py-2.5 text-sm"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Сайт"
        className="field-luxury px-3 py-2.5 text-sm sm:col-span-2"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Комментарий"
        rows={3}
        className="field-luxury px-3 py-2.5 text-sm sm:col-span-2"
      />
      <div className="sm:col-span-2">
        <ReportConsentFields
          consent={consent}
          onConsent={(checked) => {
            setConsent(checked);
            if (checked) setError(null);
          }}
          marketing={marketingOptIn}
          onMarketing={setMarketingOptIn}
          showMarketing={marketingConsent}
        />
      </div>
      <p className="text-xs text-white/45 sm:col-span-2">
        Отправляя форму, вы соглашаетесь с{" "}
        <Link href="/privacy" className="text-amber-300 hover:underline">
          политикой обработки ПДн
        </Link>
      </p>
      {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={status === "loading"} pulse>
          {status === "loading" ? "Отправляем…" : cta}
        </Button>
      </div>
    </form>
  );
}
