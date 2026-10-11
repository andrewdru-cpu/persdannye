"use client";

import { FormEvent, useRef, useState } from "react";
import { SmartCaptcha, type SmartCaptchaHandle } from "@/components/captcha/SmartCaptcha";
import { PreviewMockBadge } from "@/components/subject/PreviewMockBadge";
import { SubjectRequestResult } from "@/components/subject/SubjectRequestResult";
import { Button } from "@/components/ui/Button";
import { legalContent } from "@/content/legal";
import { shouldLoadSmartCaptcha } from "@/lib/smartcaptcha";
import {
  canPostSubjectRequest,
  postSubjectRequest,
  SUBJECT_REQUEST_TYPES,
  type SubjectRequestType,
} from "@/lib/subject-request";

const fieldClass =
  "field-luxury w-full px-4 py-3 text-sm text-white placeholder:text-white/35";

export function PrivacyRequestForm() {
  const captchaRef = useRef<SmartCaptchaHandle>(null);
  const captcha = shouldLoadSmartCaptcha();
  const [type, setType] = useState<SubjectRequestType>("access");
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
      type,
      email: address,
      captchaToken,
    });
    captchaRef.current?.reset();
    if (result.networkError) {
      setNetworkError(true);
      setPending(false);
      return;
    }
    setRequestId(result.requestId);
    setDone(true);
    setPending(false);
  }

  if (done) return <SubjectRequestResult requestId={requestId} />;

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 grid gap-3"
      data-needs-legal-review={legalContent.needs_legal_review ? "true" : "false"}
    >
      <PreviewMockBadge />
      <label className="grid gap-1 text-sm text-white/70">
        Тип запроса
        <select
          value={type}
          onChange={(event) => setType(event.target.value as SubjectRequestType)}
          className={fieldClass}
        >
          {SUBJECT_REQUEST_TYPES.map((value) => (
            <option key={value} value={value}>
              {legalContent.types[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm text-white/70">
        Электронная почта
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className={fieldClass}
        />
      </label>
      <p className="text-sm leading-relaxed text-white/60">{legalContent.privacyNotice}</p>
      {type === "delete" ? (
        <p className="text-sm leading-relaxed text-white/60">{legalContent.deleteStopList}</p>
      ) : null}
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
          {pending ? "Отправляем…" : legalContent.privacySubmit}
        </Button>
      </div>
    </form>
  );
}
