/** Checkbox and direct/BFF `marketing_consent`. `allowed` is both legal flags. */
export function leadMarketingDecision(allowed: boolean, email: string, checked: boolean): {
  visible: boolean;
  checked: boolean;
  send: boolean;
} {
  const visible = allowed === true && email.trim().length > 0;
  const kept = visible && checked === true;
  return { visible, checked: kept, send: kept };
}
