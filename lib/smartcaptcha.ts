import { isDirectForms } from "./forms-mode";

/** Official widget script. Loaded only when forms run in direct mode. */
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
  return isDirectForms();
}
