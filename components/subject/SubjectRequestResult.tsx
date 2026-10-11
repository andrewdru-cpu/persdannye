import { legalContent } from "@/content/legal";

/** Same copy for every outcome. The id is only a reference when the API sent one. */
export function SubjectRequestResult({ requestId }: { requestId: string | null }) {
  return (
    <div
      className="rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/80"
      role="status"
      data-needs-legal-review={legalContent.needs_legal_review ? "true" : "false"}
    >
      <p>{legalContent.successMessage}</p>
      {requestId ? (
        <p className="mt-2 text-xs text-white/55">
          {legalContent.requestIdLabel}: <span className="font-mono text-white/80">{requestId}</span>
        </p>
      ) : null}
    </div>
  );
}
