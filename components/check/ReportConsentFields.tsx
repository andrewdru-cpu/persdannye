"use client";

import Link from "next/link";
import { formCopy } from "@/content/blocks";
import { fillPlaceholders } from "@/content/placeholders";

export function ReportConsentFields({
  consent,
  onConsent,
  marketing,
  onMarketing,
  showMarketing,
}: {
  consent: boolean;
  onConsent: (value: boolean) => void;
  marketing: boolean;
  onMarketing: (value: boolean) => void;
  showMarketing: boolean;
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
          <Link href="/consent" className="text-amber-300 hover:underline">
            согласие на обработку персональных данных
          </Link>{" "}
          {formCopy.consentTail}
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
            {fillPlaceholders(formCopy.marketing, false)}{" "}
            <Link href="/consent-marketing" className="text-amber-300 hover:underline">
              Условия
            </Link>
            .
          </span>
        </label>
      ) : null}
    </div>
  );
}
