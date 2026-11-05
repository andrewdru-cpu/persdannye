import os from "os";
import path from "path";

/**
 * Where best-effort JSON stores live. On Vercel/Lambda the bundle dir
 * (/var/task) is read-only, so use the writable temp dir there.
 */
export function dataFilePath(file: string): string {
  const serverless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
  );
  const dir = serverless
    ? path.join(os.tmpdir(), "persdannye-data")
    : path.join(process.cwd(), "data");
  return path.join(dir, file);
}
