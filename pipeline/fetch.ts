/**
 * Shared HTTP for the loaders.
 *
 * Two rules. Every request is logged with its status so a broken agency is
 * visible in the build output, and every response is retried once on 429/5xx
 * with a short backoff. Federal APIs rate-limit without warning.
 */

export interface FetchOptions {
  retries?: number;
  timeoutMs?: number;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
}

export class FetchError extends Error {
  constructor(message: string, readonly status: number, readonly url: string) {
    super(message);
    this.name = "FetchError";
  }
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { retries = 1, timeoutMs = 45_000, method = "GET", body, headers = {} } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: body ? { "content-type": "application/json", ...headers } : headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        throw new FetchError(`${response.status} ${response.statusText}`, response.status, url);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      const status = error instanceof FetchError ? error.status : 0;
      const retryable = status === 0 || status === 429 || status >= 500;
      if (!retryable || attempt === retries) break;
      await sleep(600 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The date a fact was pulled, in the form every receipt carries. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env and fill it in, or run \`pnpm load --only=usaspending\` for a keyless source.`,
    );
  }
  return value;
}
