"use client";

import { useState } from "react";
import Link from "next/link";
import { legalContent } from "@/content/legal";
import { canPostSubjectRequest, postSubjectRequest } from "@/lib/subject-request";
import { Button } from "@/components/ui/Button";
import { SubjectRequestResult } from "@/components/subject/SubjectRequestResult";

/**
 * Confirm button only. Nothing is posted while the page loads, so a GET
 * from a link prefetcher cannot opt the person out.
 */
export function UnsubscribeConfirm({ token }: { token: string }) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [directOnly, setDirectOnly] = useState(false);
  const [networkError, setNetworkError] = useState(false);

  async function confirm() {
    if (pending || done) return;
    if (!canPostSubjectRequest()) {
      setDirectOnly(true);
      return;
    }
    setPending(true);
    setNetworkError(false);
    const result = await postSubjectRequest({ type: "unsubscribe", token });
    if (result.networkError) {
      setNetworkError(true);
      setPending(false);
      return;
    }
    setRequestId(result.requestId);
    setDone(true);
    setPending(false);
  }

  return (
    <div data-needs-legal-review={legalContent.needs_legal_review ? "true" : "false"}>
      <p className="text-sm leading-relaxed text-white/70">{legalContent.unsubscribeLead}</p>
      {token ? (
        <div className="mt-6">
          {done ? (
            <SubjectRequestResult requestId={requestId} />
          ) : (
            <>
              <Button type="button" size="lg" disabled={pending} onClick={confirm}>
                {pending ? "Отправляем…" : legalContent.unsubscribeConfirm}
              </Button>
              {networkError ? (
                <p className="mt-3 text-sm text-rose-300" role="alert">
                  {legalContent.networkError}
                </p>
              ) : null}
              {directOnly ? (
                <p className="mt-3 text-sm text-white/60">{legalContent.directOnly}</p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-white/70">{legalContent.unsubscribeMissingToken}</p>
          <Link href="/privacy/request" rel="noreferrer" className="text-sm text-amber-200 hover:underline">
            {legalContent.privacyRequestTitle}
          </Link>
        </div>
      )}
    </div>
  );
}
