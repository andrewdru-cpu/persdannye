const SAFE_CODE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

/** Name plus a short error code. The message is omitted: it can echo a request body. */
export function errorNameAndCode(err: unknown): { name: string; code: string } {
  const name = err instanceof Error && err.name ? err.name : "Error";
  const raw =
    err && typeof err === "object" && "code" in err
      ? (err as { code?: unknown }).code
      : undefined;
  const code = typeof raw === "string" && SAFE_CODE.test(raw) ? raw : "server_error";
  return { name, code };
}

/** Logs only the error name and code. Returns the code for the HTTP response. */
export function logServerError(scope: string, err: unknown): string {
  const { name, code } = errorNameAndCode(err);
  console.error(scope, name, code);
  return code;
}
