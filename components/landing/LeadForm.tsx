"use client";

import { FormEvent, useState } from "react";
import { PolicyLine, ReportConsentFields } from "@/components/check/ReportConsentFields";
import { Button } from "@/components/ui/Button";
import { formCopy } from "@/content/blocks";
import { CONSENT_TEXT_VERSION, LEAD_CONSENT_TEXT_VERSION } from "@/lib/consent";

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
  const [url, setUrl] = useState(defaultUrl);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) return;
    const mail = email.trim();
    const tel = phone.trim();
    if (!mail && !tel) {
      setError("Укажите телефон или e-mail.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: mail || undefined,
          phone: tel || undefined,
          url: url.trim() || undefined,
          checkId,
          message: message.trim() || undefined,
          consent: true,
          consent_text_version: LEAD_CONSENT_TEXT_VERSION,
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
        aria-label="Имя"
        autoComplete="name"
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75 sm:col-span-2"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Телефон"
        aria-label="Телефон"
        autoComplete="tel"
        inputMode="tel"
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail"
        aria-label="E-mail"
        autoComplete="email"
        inputMode="email"
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Сайт"
        aria-label="Сайт"
        inputMode="url"
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75 sm:col-span-2"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Сообщение"
        aria-label="Сообщение"
        rows={3}
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75 sm:col-span-2"
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
          consentHref="/consent-lead"
          consentTail={formCopy.leadConsentTail}
        />
      </div>
      {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={!consent || status === "loading"} pulse>
          {status === "loading" ? "Отправляем…" : cta}
        </Button>
      </div>
      <PolicyLine className="text-xs text-white/80 sm:col-span-2" />
    </form>
  );
}
