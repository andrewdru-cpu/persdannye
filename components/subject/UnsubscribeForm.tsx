"use client";

import { FormEvent, useRef, useState } from "react";
import { SmartCaptcha, type SmartCaptchaHandle } from "@/components/captcha/SmartCaptcha";
import { PreviewMockBadge } from "@/components/subject/PreviewMockBadge";
import { Button } from "@/components/ui/Button";
import { legalContent } from "@/content/legal";
import { shouldLoadSmartCaptcha } from "@/lib/smartcaptcha";
import { canPostSubjectRequest, postSubjectRequest } from "@/lib/subject-request";

const fieldClass = "field-luxury w-full px-4 py-3 text-sm text-white placeholder:text-white/35";

/**
 * Manual opt-out. The address stays in component state only until submit.
 * The browser posts it straight to the public API. It is not written to
 * browser storage, and no analytics event carries the address.
 */
export function UnsubscribeForm() {
  const captchaRef = useRef<SmartCaptchaHandle>(null);
  const captcha = shouldLoadSmartCaptcha();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [directOnly, setDirectOnly] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending || done) return;
    setFieldError(null);
    setDirectOnly(false);
    setNetworkError(false);
    const address = email.trim();
    if (!address || !address.includes("@")) {
      setFieldError(legalContent.emailRequired);
      return;
    }
    if (!canPostSubjectRequest()) {
      setDirectOnly(true);
      return;
    }
    const captchaToken = captchaRef.current?.getToken().trim() || "";
    if (captcha && !captchaToken) {
      setFieldError(legalContent.captchaRequired);
      return;
    }
    setPending(true);
    const result = await postSubjectRequest({
      type: "unsubscribe",
      email: address,
      captchaToken,
    });
    captchaRef.current?.reset();
    if (result.networkError) {
      setNetworkError(true);
      setPending(false);
      return;
    }
    setEmail("");
    setRequestId(result.requestId);
    setDone(true);
    setPending(false);
  }

  if (done) {
    return (
      <div
        className="mt-6 grid gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80"
        role="status"
        data-needs-legal-review={legalContent.needs_legal_review ? "true" : "false"}
      >
        <PreviewMockBadge />
        <p>{legalContent.unsubscribeNeutral}</p>
        {requestId ? (
          <p className="text-xs text-white/55">
            {legalContent.requestIdLabel}: <span className="font-mono text-white/80">{requestId}</span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      method="post"
      onSubmit={onSubmit}
      className="mt-6 grid gap-3"
      data-needs-legal-review={legalContent.needs_legal_review ? "true" : "false"}
    >
      <PreviewMockBadge />
      <p className="text-sm leading-relaxed text-white/70">{legalContent.unsubscribeManualLead}</p>
      <label className="grid gap-1 text-sm text-white/70">
        Электронная почта
        <input
          type="email"
          autoComplete="email"
          aria-label="Электронная почта"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className={fieldClass}
        />
      </label>
      <p className="text-sm leading-relaxed text-white/60">{legalContent.unsubscribeNoConfirmation}</p>
      {captcha ? <SmartCaptcha ref={captchaRef} /> : null}
      {fieldError ? <p className="text-sm text-rose-300">{fieldError}</p> : null}
      {networkError ? (
        <p className="text-sm text-rose-300" role="alert">
          {legalContent.networkError}
        </p>
      ) : null}
      {directOnly ? <p className="text-sm text-white/60">{legalContent.directOnly}</p> : null}
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Отправляем…" : legalContent.unsubscribeSubmit}
        </Button>
      </div>
    </form>
  );
}
