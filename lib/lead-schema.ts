import { z } from "zod";

/** Limits for the lead form. Marketing text version matches the parser (max 32). */
export const leadBodySchema = z.object({
  name: z.string().min(2, "Укажите имя").max(120),
  email: z.union([z.string().max(200).email("Некорректный email"), z.literal("")]).optional(),
  phone: z.string().max(40).optional(),
  url: z.string().max(2048).optional(),
  checkId: z.string().max(64).optional(),
  consent: z.boolean(),
  consent_text_version: z.string().trim().max(64).optional(),
  marketing_consent: z.boolean().optional(),
  marketing_consent_text_version: z.string().trim().max(32).optional(),
  source: z.string().max(64).optional(),
});
