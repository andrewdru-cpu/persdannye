import { getSmartCaptchaSiteKey, isDirectForms, isMockForms } from "./forms-mode";

/** Official widget script. Loaded in direct mode, and in mock mode when a site key is set. */
export const SMARTCAPTCHA_SCRIPT_SRC =
  "https://smartcaptcha.yandexcloud.net/captcha.js";

/**
 * JSON field for the widget token.
 * Yandex puts the same value in a hidden input named `smart-token`.
 * The public API docs were not readable from this environment; the body uses
 * snake_case to match `check_id`, `report_url`, and `text_version`.
 */
export const SMARTCAPTCHA_TOKEN_FIELD = "smart_token";

export function shouldLoadSmartCaptcha(): boolean {
  if (isDirectForms()) return true;
  return isMockForms() && Boolean(getSmartCaptchaSiteKey());
}
