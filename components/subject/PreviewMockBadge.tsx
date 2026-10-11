"use client";

import { legalContent } from "@/content/legal";
import { isMockForms } from "@/lib/forms-mode";

/** Visible only when this build uses the preview mock instead of the API. */
export function PreviewMockBadge() {
  if (!isMockForms()) return null;
  return (
    <p className="inline-flex w-fit rounded-full border border-amber-200/40 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-200/80">
      {legalContent.previewMockBadge}
    </p>
  );
}
