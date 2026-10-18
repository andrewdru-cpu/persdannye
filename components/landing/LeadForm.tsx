"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SmartCaptcha, type SmartCaptchaHandle } from "@/components/captcha/SmartCaptcha";
import { ReportConsentFields } from "@/components/check/ReportConsentFields";
import { Button } from "@/components/ui/Button";
import { formCopy } from "@/content/blocks";
import { LEAD_CONSENT_TEXT_VERSION, MARKETING_CONSENT_TEXT_VERSION } from "@/lib/consent";
import { runLead } from "@/lib/forms-client";
import { isDirectForms } from "@/lib/forms-mode";
import { createIdempotencyKey, PublicApiError } from "@/lib/public-api";

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
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const direct = isDirectForms();
  const captchaRef = useRef<SmartCaptchaHandle>(null);
  const idempotencyKey = useRef<string | null>(null);
  const payloadSig = useRef("");
  const mail = email.trim();
  const showMarketing = marketingConsent && mail.length > 0;
  const marketingOn = showMarketing && marketingOptIn;

  useEffect(() => {
    if (!showMarketing) setMarketingOptIn(false);
  }, [showMarketing]);

  const signature = JSON.stringify({
    name: name.trim(),
    email: mail,
    phone: phone.trim(),
    url: url.trim(),
    message: message.trim(),
    consent,
    marketing: marketingOn,
    checkId: checkId || "",
    source,
  });

  useEffect(() => {
    if (payloadSig.current && payloadSig.current !== signature) idempotencyKey.current = null;
    payloadSig.current = signature;
  }, [signature]);

  function invalid(field: string) {
    return fieldErrors.includes(field);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors([]);
    if (!consent) {
      setError("Отметьте согласие на обработку персональных данных");
      return;
    }
    const tel = phone.trim();
    if (!mail && !tel) {
      setError("Укажите телефон или e-mail.");
      setFieldErrors(["email", "phone"]);
      return;
    }
    if (direct && !captchaRef.current?.getToken()) {
      setError("Подтвердите, что вы не робот");
      return;
    }
    if (!idempotencyKey.current) idempotencyKey.current = createIdempotencyKey();
    const key = idempotencyKey.current;
    setStatus("loading");
    try {
      if (direct) {
        await runLead({
          name,
          email: mail || undefined,
          phone: tel || undefined,
          url: url.trim() || undefined,
          checkId,
          message: message.trim() || undefined,
          source,
          consentAccepted: true,
          marketingAccepted: marketingOn,
          smartToken: captchaRef.current?.getToken() || "",
          idempotencyKey: key,
        });
        captchaRef.current?.reset();
      } else {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
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
            ...(marketingOn
              ? {
                  marketing_consent: true,
                  marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION,
                }
              : {}),
          }),
        });
        if (!res.ok) {
          let messageText = "Ошибка отправки";
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) messageText = data.error;
          } catch {
            /* keep the generic message */
          }
          throw new Error(messageText);
        }
      }
      idempotencyKey.current = null;
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      if (err instanceof PublicApiError) {
        if (err.code === "captcha_failed" || err.code === "captcha_required") captchaRef.current?.reset();
        if (err.code === "idempotency_key_reused") idempotencyKey.current = createIdempotencyKey();
        if (err.code === "validation_failed" && err.fields?.length) setFieldErrors(err.fields);
        setError(err.message);
        return;
      }
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
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2" noValidate>
      <input
        required
        minLength={2}
        maxLength={120}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Имя *"
        aria-label="Имя"
        aria-invalid={invalid("name")}
        autoComplete="name"
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75 sm:col-span-2"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Телефон"
        aria-label="Телефон"
        aria-invalid={invalid("phone")}
        autoComplete="tel"
        inputMode="tel"
        maxLength={40}
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-mail"
        aria-label="E-mail"
        aria-invalid={invalid("email")}
        autoComplete="email"
        inputMode="email"
        maxLength={200}
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75"
      />
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Сайт"
        aria-label="Сайт"
        aria-invalid={invalid("url")}
        inputMode="url"
        className="field-luxury px-3 py-2.5 text-sm text-white placeholder:text-white/75 sm:col-span-2"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Сообщение"
        aria-label="Сообщение"
        aria-invalid={invalid("message")}
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
          showMarketing={showMarketing}
          consentHref="/consent-lead"
          consentTail={formCopy.leadConsentTail}
        />
      </div>
      {direct ? (
        <div className="sm:col-span-2">
          <SmartCaptcha ref={captchaRef} />
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-rose-300 sm:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={!consent || status === "loading"} pulse>
          {status === "loading" ? "Отправляем…" : cta}
        </Button>
      </div>
      <p className="text-xs text-white/80 sm:col-span-2">
        Как мы обрабатываем данные — в{" "}
        <Link href="/privacy" className="text-amber-300 hover:underline">
          Политике
        </Link>
      </p>
    </form>
  );
}
