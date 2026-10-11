import { z } from "zod";

/**
 * GET /public/check/{id}. `inn` and `org_name` are nullable (null for a sole
 * proprietor). Unknown keys are kept by the loose object and then dropped
 * by the mapper, so they do not fail parsing and are not shown.
 */
const publicFindingSchema = z.looseObject({
  rule_id: z.string().nullish(),
  title: z.string().nullish(),
  fact: z.string().nullish(),
  severity: z.string().nullish(),
});

export const publicCheckResponseSchema = z.looseObject({
  check_id: z.string().nullish(),
  url: z.string().nullish(),
  status: z.string().nullish(),
  phase: z.string().nullish(),
  score: z.number().nullish(),
  pdf_ready: z.boolean().nullish(),
  show_amounts: z.boolean().nullish(),
  push: z.boolean().nullish(),
  mode: z.string().nullish(),
  rules_version: z.string().nullish(),
  report_url: z.string().nullish(),
  inn: z.string().nullish(),
  org_name: z.string().nullish(),
  findings: z.array(publicFindingSchema).nullish(),
  inventory: z.array(z.unknown()).nullish(),
});

export type PublicCheckResponse = z.infer<typeof publicCheckResponseSchema>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Parsed check body without org fields. A schema miss falls back to the raw object. */
export function publicCheckRecord(body: unknown): Record<string, unknown> {
  const parsed = publicCheckResponseSchema.safeParse(body);
  const record = parsed.success ? { ...parsed.data } : { ...(asRecord(body) ?? {}) };
  delete record.inn;
  delete record.org_name;
  return record;
}
