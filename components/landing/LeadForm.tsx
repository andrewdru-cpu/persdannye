"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { SmartCaptcha, type SmartCaptchaHandle } from "@/components/captcha/SmartCaptcha";
import { Button } from "@/components/ui/Button";
import { CONSENT_POLICY_LABEL, CONSENT_TEXT } from "@/content/consent";
import { runLead } from "@/lib/forms-client";
import { isDirectForms } from "@/lib/forms-mode";

export function LeadForm({
  defaultUrl = "",
  checkId,
  source = "landing",
  cta = "Отправить заявку",
}: {
  defaultUrl?: string;
  checkId?: string;
  source?: string;
  cta?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [url, setUrl] = useState(defaultUrl);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const direct = isDirectForms();
  const captchaRef = useRef<SmartCaptchaHandle>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Отметьте согласие на обработку персональных данных");
      return;
    }
    if (direct && !captchaRef.current?.getToken()) {
      setError("Подтвердите, что вы не робот");
      return;
    }
    setStatus("loading");
    try {
      await runLead({
        name,
        email,
        phone: phone || undefined,
        company: companyName || undefined,
        url: url || undefined,
        checkId,
        message: message || undefined,
        source,
        consentAccepted: true,
        smartToken: direct ? captchaRef.current?.getToken() || "" : undefined,
      });
      if (direct) captchaRef.current?.reset();
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
      <label className="flex items-start gap-2 text-xs leading-relaxed text-white/65 sm:col-span-2">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 accent-amber-400"
          required
        />
        <span>
          {CONSENT_TEXT.slice(0, CONSENT_TEXT.indexOf(CONSENT_POLICY_LABEL))}
          <Link href="/privacy" className="text-amber-300 hover:underline">
            {CONSENT_POLICY_LABEL}
          </Link>
          {" *"}
        </span>
      </label>
      {direct && (
        <div className="sm:col-span-2">
          <SmartCaptcha ref={captchaRef} />
        </div>
      )}
      {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={status === "loading"} pulse>
          {status === "loading" ? "Отправляем…" : cta}
        </Button>
      </div>
    </form>
  );
}
