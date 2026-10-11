import { getPublicApiBase, isDirectForms } from "./forms-mode";
import { joinPublicApi } from "./public-api";

export const SUBJECT_REQUEST_PATH = "/public/subject-request";

export const SUBJECT_REQUEST_TYPES = ["unsubscribe", "access", "delete"] as const;

export type SubjectRequestType = (typeof SUBJECT_REQUEST_TYPES)[number];

export type SubjectRequestInput = {
  type: SubjectRequestType;
  email?: string;
  token?: string;
  captchaToken?: string;
};

/** These pages must not be indexed, must not send a referrer, and must not load analytics. */
export const SUBJECT_PAGE_REFERRER = "no-referrer" as const;

export const SUBJECT_PAGE_ROBOTS = { index: false, follow: false } as const;

export function isAnalyticsFreePath(pathname: string): boolean {
  const path = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  return path === "/unsubscribe" || path === "/privacy/request";
}

export function canPostSubjectRequest(): boolean {
  return isDirectForms() && Boolean(getPublicApiBase());
}

export function buildSubjectRequestBody(input: SubjectRequestInput): Record<string, string> {
  const body: Record<string, string> = { type: input.type };
  const email = input.email?.trim();
  const token = input.token?.trim();
  const captcha = input.captchaToken?.trim();
  if (email) body.email = email;
  if (token) body.token = token;
  if (captcha) body.captcha_token = captcha;
  return body;
}

export function readRequestId(status: number, body: unknown): string | null {
  if (status !== 202 || !body || typeof body !== "object") return null;
  const id = (body as { request_id?: unknown }).request_id;
  if (typeof id !== "string") return null;
  const token = id.trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(token)) return null;
  return token;
}

/**
 * Posts only in direct mode. Any HTTP status or network failure becomes
 * `{ requestId: null }` so the screen can stay neutral.
 */
export async function postSubjectRequest(
  input: SubjectRequestInput,
  fetchImpl: typeof fetch = fetch
): Promise<{ requestId: string | null }> {
  if (!canPostSubjectRequest()) return { requestId: null };
  try {
    const res = await fetchImpl(joinPublicApi(SUBJECT_REQUEST_PATH), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(buildSubjectRequestBody(input)),
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { requestId: readRequestId(res.status, json) };
  } catch {
    return { requestId: null };
  }
}
