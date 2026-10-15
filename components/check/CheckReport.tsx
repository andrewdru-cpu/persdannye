"use client";

import { motion, useReducedMotion } from "framer-motion";
import { flags } from "@/content/flags";
import { presentCheckReport } from "@/lib/check-report";
import type { CheckJob } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CheckReport({ job }: { job: CheckJob }) {
  const reduce = useReducedMotion();
  const report = presentCheckReport(job, { showFines: flags.show_fines });

  return (
    <div className="space-y-5">
      {report.findings.length > 0 ? (
        <ul className="space-y-3">
          {report.findings.map((finding) => {
            const alertTone =
              !finding.statusLabel &&
              !finding.informational &&
              (finding.severity === "critical" || finding.severity === "high");
            return (
              <motion.li
                key={finding.key}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-card p-4"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono text-xs text-amber-100">
                    {finding.ruleId}
                  </span>
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      alertTone
                        ? "bg-rose-500/20 text-rose-100"
                        : finding.severity === "medium"
                          ? "bg-amber-500/20 text-amber-50"
                          : "bg-white/10 text-white/80"
                    )}
                  >
                    {finding.severityLabel}
                  </span>
                  {finding.statusLabel ? (
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/80">
                      {finding.statusLabel}
                    </span>
                  ) : null}
                  {finding.basisLabel ? (
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/80">
                      {finding.basisLabel}
                    </span>
                  ) : null}
                </div>
                <div className="font-medium text-white">{finding.title}</div>
                <p className="mt-1 text-sm text-white/80">{finding.fact}</p>
                {finding.remediation ? (
                  <p className="mt-2 text-sm text-white/80">
                    <span className="font-medium text-white">Что сделать. </span>
                    {finding.remediation}
                  </p>
                ) : null}
                {finding.fineLabel ? (
                  <p className="mt-2 text-sm text-white/80">Сумма: {finding.fineLabel} ₽</p>
                ) : null}
              </motion.li>
            );
          })}
        </ul>
      ) : (
        <p className="glass-card border-emerald-400/20 bg-emerald-500/5 p-4 text-sm text-emerald-50">
          {report.clearLine}
        </p>
      )}

      {report.recommendations.length > 0 ? (
        <section aria-label="Рекомендации" className="glass-card p-4 md:p-5">
          <h4 className="font-display text-2xl font-semibold text-white">Рекомендации</h4>
          <ul className="mt-3 space-y-4">
            {report.recommendations.map((item) => (
              <li key={item.id} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                <div className="font-medium text-white">{item.title}</div>
                <p className="mt-1 text-sm text-white/80">{item.text}</p>
                {item.evidence.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-white/80">
                    {item.evidence.map((entry, index) => (
                      <li key={`${item.id}-${index}`}>
                        {entry.note ? <p>{entry.note}</p> : null}
                        {entry.selector ? <p className="font-mono">{entry.selector}</p> : null}
                        {entry.href ? (
                          <a
                            href={entry.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-200 underline-offset-2 hover:underline"
                          >
                            {entry.href}
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
