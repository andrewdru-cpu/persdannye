"use client";

import { PreviewMockBadge } from "@/components/subject/PreviewMockBadge";
import { legalContent } from "@/content/legal";

/** Same copy for every HTTP outcome. Only a request id may be shown. */
export function SubjectRequestResult({ requestId }: { requestId: string | null }) {
  return (
    <div
      className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80"
      role="status"
      data-needs-legal-review={legalContent.needs_legal_review ? "true" : "false"}
    >
      <PreviewMockBadge />
      <p>{legalContent.successMessage}</p>
      {requestId ? (
        <p className="mt-2 text-xs text-white/55">
          {legalContent.requestIdLabel}: <span className="font-mono text-white/80">{requestId}</span>
        </p>
      ) : null}
    </div>
  );
}
