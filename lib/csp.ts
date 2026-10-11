/**
 * Static CSP for next.config headers().
 * Next.js hydration and framer-motion need inline scripts/styles; a per-request
 * nonce would force every page to dynamic rendering (see next CSP guide).
 * Third-party origins are limited to the public API and Yandex SmartCaptcha.
 */

export const SMARTCAPTCHA_ORIGINS = [
  "https://smartcaptcha.yandexcloud.net",
  "https://captcha-api.yandex.ru",
] as const;

export function publicApiOrigin(base: string | undefined | null): string | null {
  const raw = base?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy(
  env: NodeJS.ProcessEnv = process.env
): string {
  const isDev = env.NODE_ENV === "development";
  const apiOrigin = publicApiOrigin(env.NEXT_PUBLIC_PUBLIC_API_BASE);
  const captcha = SMARTCAPTCHA_ORIGINS.join(" ");
  const connect = [
    "'self'",
    ...SMARTCAPTCHA_ORIGINS,
    apiOrigin,
    ...(isDev ? ["ws:", "wss:"] : []),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  const script = [
    "'self'",
    "'unsafe-inline'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    captcha,
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${captcha}`,
    "font-src 'self'",
    `connect-src ${connect}`,
    `frame-src ${captcha}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}
