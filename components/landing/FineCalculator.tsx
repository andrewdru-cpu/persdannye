"use client";

import { useMemo, useState } from "react";
import { calculatorUi } from "@/content/landing";
import { LegalDisclaimer } from "@/components/landing/LegalDisclaimer";
import { Reveal } from "@/components/motion/Reveal";
import { formatRub, sumSpans, type RubleSpan } from "@/lib/fine-math";
import { cn } from "@/lib/utils";

type Span = { min: number; max: number };

export type CalculatorIssueProp = {
  id: string;
  label: string;
  hint: string;
  norm: string;
  likely: boolean;
  ip: Span;
  legal: Span;
};

type BusinessKind = "ip" | "legal";

export function FineCalculator({
  issues,
  excludedNote,
  likelyNote,
}: {
  issues: readonly CalculatorIssueProp[];
  excludedNote: string;
  likelyNote: string;
}) {
  const [business, setBusiness] = useState<BusinessKind | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const lines = useMemo(() => {
    if (!business) return [];
    return issues
      .filter((issue) => selected.includes(issue.id))
      .map((issue) => ({
        id: issue.id,
        label: issue.label,
        norm: issue.norm,
        likely: issue.likely,
        ...issue[business],
      }));
  }, [business, issues, selected]);

  const total: RubleSpan | null = lines.length > 0 ? sumSpans(lines) : null;

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  return (
    <section
      id="fine-calculator"
      aria-labelledby="fine-calculator-title"
      className="scroll-mt-24 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">
            {calculatorUi.eyebrow}
          </p>
          <h2
            id="fine-calculator-title"
            className="mt-2 font-display text-4xl font-semibold text-white md:text-5xl"
          >
            {calculatorUi.title}
          </h2>
          <p className="mt-3 max-w-2xl text-white/70">{calculatorUi.lead}</p>
        </Reveal>

        <div className="glass-card mt-8 p-5 md:p-8">
          <fieldset>
            <legend className="text-sm font-semibold text-white">{calculatorUi.businessLegend}</legend>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:max-w-md">
              {(
                [
                  ["ip", calculatorUi.ip],
                  ["legal", calculatorUi.legal],
                ] as const
              ).map(([id, label]) => (
                <label
                  key={id}
                  className={cn(
                    "flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border px-3 text-sm font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-300",
                    business === id
                      ? "border-amber-200/70 bg-amber-200/15 text-amber-50"
                      : "border-white/15 text-white/80 hover:border-amber-200/40",
                  )}
                >
                  <input
                    type="radio"
                    name="fine-business-kind"
                    value={id}
                    checked={business === id}
                    onChange={() => setBusiness(id)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-white">{calculatorUi.issuesLegend}</legend>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {issues.map((issue) => {
                const checked = selected.includes(issue.id);
                return (
                  <label
                    key={issue.id}
                    className={cn(
                      "flex min-h-12 cursor-pointer gap-3 rounded-2xl border px-3 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-300",
                      checked
                        ? "border-amber-200/50 bg-amber-200/[0.07]"
                        : "border-white/10 hover:border-amber-200/30",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(issue.id)}
                      className="mt-1 size-4 shrink-0 accent-amber-400"
                    />
                    <span>
                      <span className="block text-sm font-medium text-white">{issue.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-white/80">
                        {issue.hint}
                      </span>
                      {issue.likely ? (
                        <span className="mt-1 block text-xs leading-relaxed text-amber-100/85">
                          {likelyNote}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div
            className="mt-6 rounded-2xl border border-amber-200/25 bg-black/25 p-4 md:p-5"
            aria-live="polite"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-100/80">
              {calculatorUi.resultLabel}
            </p>
            {!business ? (
              <p className="mt-2 text-sm text-white/75">{calculatorUi.needBusiness}</p>
            ) : !total ? (
              <p className="mt-2 text-sm text-white/75">{calculatorUi.needIssues}</p>
            ) : (
              <>
                <p className="mt-2 font-display text-3xl font-semibold text-white md:text-4xl">
                  {formatRub(total.min)} — {formatRub(total.max)}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-white/80">{calculatorUi.resultHint}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-white/80">
                  {lines.map((line) => (
                    <li key={line.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                      <span>
                        {line.label}{" "}
                        <span className="text-white/80">· {line.norm}</span>
                        {line.likely ? (
                          <span className="mt-0.5 block text-xs text-amber-100/85">{likelyNote}</span>
                        ) : null}
                      </span>
                      <span className="tabular-nums">
                        {formatRub(line.min)} — {formatRub(line.max)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-4 text-xs leading-relaxed text-white/80">{excludedNote}</p>
            <LegalDisclaimer className="mt-3" />
          </div>
        </div>
      </div>
    </section>
  );
}
