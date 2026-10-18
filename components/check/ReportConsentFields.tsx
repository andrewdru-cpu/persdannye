"use client";

import Link from "next/link";
import { formCopy } from "@/content/blocks";

export function ReportConsentFields({
  consent,
  onConsent,
  marketing,
  onMarketing,
  showMarketing,
  consentHref = "/consent",
  consentTail = formCopy.consentTail,
}: {
  consent: boolean;
  onConsent: (value: boolean) => void;
  marketing: boolean;
  onMarketing: (value: boolean) => void;
  showMarketing: boolean;
  consentHref?: string;
  consentTail?: string;
}) {
  return (
    <div className="grid gap-3">
      <label className="flex items-start gap-2 text-xs leading-relaxed text-white/70">
        <input
          type="checkbox"
          name="consent"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
          className="mt-0.5 accent-amber-400"
        />
        <span>
          Я даю{" "}
          <Link href={consentHref} className="text-amber-300 hover:underline">
            согласие на обработку персональных данных
          </Link>{" "}
          {consentTail}
        </span>
      </label>
      {showMarketing ? (
        <label className="flex items-start gap-2 text-xs leading-relaxed text-white/70">
          <input
            type="checkbox"
            name="marketing"
            checked={marketing}
            onChange={(e) => onMarketing(e.target.checked)}
            className="mt-0.5 accent-amber-400"
          />
          <span>
            Соглашаюсь получать рекламные и информационные письма на условиях{" "}
            <Link href="/consent-marketing" className="text-amber-300 hover:underline">
              согласия
            </Link>
          </span>
        </label>
      ) : null}
    </div>
  );
}

export function PolicyLine({ className = "" }: { className?: string }) {
  return (
    <p className={className}>
      {formCopy.policyLead}{" "}
      <Link href="/privacy" className="text-amber-300 hover:underline">
        {formCopy.policyLink}
      </Link>
    </p>
  );
}
