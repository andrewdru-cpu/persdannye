import type { CheckJob } from "./types";

/**
 * What the result screen may keep. Parser scan responses (PII minimization)
 * carry an empty phone and a role-based email or nothing. The UI does not
 * render those fields; an empty value is shown as nothing.
 */
export function checkForDisplay(job: CheckJob): CheckJob {
  const view = { ...job } as CheckJob & {
    phone?: unknown;
    email?: unknown;
    lead?: unknown;
    contacts?: unknown;
  };
  delete view.contact;
  delete view.phone;
  delete view.email;
  delete view.lead;
  delete view.contacts;
  return view;
}
