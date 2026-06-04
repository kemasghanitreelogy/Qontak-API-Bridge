/**
 * Safe retry primitives for talking to Qontak/WhatsApp under load (e.g. a
 * Klaviyo blast hitting this API thousands of times).
 *
 * Design choices that make it "safe at scale":
 *  - Only TRANSIENT failures are retried (network, timeout, 429, 5xx). Permanent
 *    failures (400/401/404/422 — bad data, bad auth, bad template) are returned
 *    immediately: retrying them never succeeds and just wastes the upstream.
 *  - Backoff uses FULL JITTER. When many callers fail at the same instant, a
 *    fixed/synchronised backoff makes them all retry together (a "retry storm")
 *    and keeps the upstream overloaded. Randomising each delay spreads them out.
 *  - A server-provided `Retry-After` always wins over our computed backoff.
 *  - Bounded by both attempt count AND an elapsed-time budget, so a single
 *    request can never hang forever (important inside a serverless function and
 *    within Klaviyo's webhook timeout).
 */

/** A single attempt's outcome. `status === 0` means a network/transport error. */
export interface Attempt {
  ok: boolean;
  status: number;
  retryAfterMs?: number;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  maxElapsedMs: number;
}

export interface RetryDeps {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
  now: () => number;
}

export const defaultRetryDeps: RetryDeps = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
  now: () => Date.now(),
};

/** Retry only transient failures: network errors, timeouts, 429 and 5xx. */
export function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/**
 * "Full jitter" exponential backoff (AWS-recommended): a random delay in
 * `[0, min(maxDelay, base * 2^attempt)]`.
 */
export function backoffDelay(
  attempt: number,
  base: number,
  maxDelay: number,
  random: () => number,
): number {
  const exp = Math.min(maxDelay, base * 2 ** attempt);
  return Math.floor(random() * exp);
}

/** Parses a numeric `Retry-After` header (seconds) into ms; undefined if absent/invalid. */
export function parseRetryAfterMs(header: unknown): number | undefined {
  if (typeof header !== 'string' && typeof header !== 'number') return undefined;
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return Math.floor(seconds * 1000);
}

/**
 * Runs `attempt` and retries transient failures with full-jitter backoff until
 * it succeeds, runs out of attempts, or exceeds the elapsed-time budget.
 */
export async function withRetry<T extends Attempt>(
  attempt: () => Promise<T>,
  cfg: RetryConfig,
  deps: RetryDeps = defaultRetryDeps,
): Promise<T> {
  const start = deps.now();
  let n = 0;
  for (;;) {
    const result = await attempt();
    if (result.ok) return result;

    const hasAttemptsLeft = n + 1 < cfg.maxAttempts;
    const withinBudget = deps.now() - start < cfg.maxElapsedMs;
    if (!isRetryableStatus(result.status) || !hasAttemptsLeft || !withinBudget) {
      return result;
    }

    const delay = result.retryAfterMs ?? backoffDelay(n, cfg.baseDelayMs, cfg.maxDelayMs, deps.random);
    await deps.sleep(delay);
    n += 1;
  }
}
