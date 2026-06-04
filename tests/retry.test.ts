import { describe, expect, it, vi } from 'vitest';
import {
  backoffDelay,
  defaultRetryDeps,
  isRetryableStatus,
  parseRetryAfterMs,
  withRetry,
  type Attempt,
  type RetryConfig,
  type RetryDeps,
} from '../src/qontak/retry';

describe('isRetryableStatus', () => {
  it('retries transient failures', () => {
    for (const s of [0, 408, 429, 500, 503]) expect(isRetryableStatus(s)).toBe(true);
  });
  it('does not retry success or permanent client errors', () => {
    for (const s of [200, 201, 400, 401, 403, 404, 422]) expect(isRetryableStatus(s)).toBe(false);
  });
});

describe('backoffDelay (full jitter)', () => {
  it('returns 0 when random is 0', () => {
    expect(backoffDelay(0, 500, 8000, () => 0)).toBe(0);
  });
  it('grows exponentially with the attempt number', () => {
    const r = () => 1; // upper bound of the jitter window (floored)
    expect(backoffDelay(0, 500, 8000, r)).toBe(500);
    expect(backoffDelay(1, 500, 8000, r)).toBe(1000);
    expect(backoffDelay(2, 500, 8000, r)).toBe(2000);
  });
  it('caps the window at maxDelay', () => {
    // base*2^10 huge -> capped at 8000
    expect(backoffDelay(10, 500, 8000, () => 1)).toBe(8000);
  });
  it('scales by the random value', () => {
    expect(backoffDelay(2, 500, 8000, () => 0.5)).toBe(1000); // 0.5 * 2000
  });
});

describe('parseRetryAfterMs', () => {
  it('parses numeric seconds (string or number) to ms', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
    expect(parseRetryAfterMs(3)).toBe(3000);
    expect(parseRetryAfterMs('0')).toBe(0);
  });
  it('returns undefined for missing/invalid/negative values', () => {
    expect(parseRetryAfterMs(undefined)).toBeUndefined();
    expect(parseRetryAfterMs('not-a-number')).toBeUndefined();
    expect(parseRetryAfterMs(-5)).toBeUndefined();
    expect(parseRetryAfterMs({} as unknown)).toBeUndefined();
  });
});

describe('withRetry', () => {
  const cfg: RetryConfig = { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 1000, maxElapsedMs: 60_000 };

  const fakeDeps = (overrides: Partial<RetryDeps> = {}): RetryDeps & { sleptFor: number[] } => {
    const sleptFor: number[] = [];
    return {
      sleep: vi.fn(async (ms: number) => {
        sleptFor.push(ms);
      }),
      random: () => 1,
      now: () => 0,
      sleptFor,
      ...overrides,
    };
  };

  it('returns immediately on success without sleeping', async () => {
    const deps = fakeDeps();
    const attempt = vi.fn(async (): Promise<Attempt> => ({ ok: true, status: 201 }));
    const res = await withRetry(attempt, cfg, deps);
    expect(res.ok).toBe(true);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(deps.sleptFor).toHaveLength(0);
  });

  it('retries a transient failure then succeeds', async () => {
    const deps = fakeDeps();
    const attempt = vi
      .fn<[], Promise<Attempt>>()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    const res = await withRetry(attempt, cfg, deps);
    expect(res.ok).toBe(true);
    expect(attempt).toHaveBeenCalledTimes(3);
    expect(deps.sleptFor).toEqual([100, 200]); // full-jitter upper bound (random=1)
  });

  it('does not retry a permanent failure', async () => {
    const deps = fakeDeps();
    const attempt = vi.fn(async (): Promise<Attempt> => ({ ok: false, status: 422 }));
    const res = await withRetry(attempt, cfg, deps);
    expect(res.status).toBe(422);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(deps.sleptFor).toHaveLength(0);
  });

  it('gives up after maxAttempts', async () => {
    const deps = fakeDeps();
    const attempt = vi.fn(async (): Promise<Attempt> => ({ ok: false, status: 500 }));
    const res = await withRetry(attempt, cfg, deps);
    expect(res.ok).toBe(false);
    expect(attempt).toHaveBeenCalledTimes(4); // maxAttempts
    expect(deps.sleptFor).toHaveLength(3);
  });

  it('stops when the elapsed-time budget is exceeded', async () => {
    let t = 0;
    const deps = fakeDeps({ now: () => (t += 5000) }); // each check jumps 5s
    const tight: RetryConfig = { ...cfg, maxElapsedMs: 4000 };
    const attempt = vi.fn(async (): Promise<Attempt> => ({ ok: false, status: 500 }));
    const res = await withRetry(attempt, tight, deps);
    expect(res.status).toBe(500);
    expect(attempt).toHaveBeenCalledTimes(1); // budget blown before a second try
  });

  it('honours Retry-After over computed backoff', async () => {
    const deps = fakeDeps();
    const attempt = vi
      .fn<[], Promise<Attempt>>()
      .mockResolvedValueOnce({ ok: false, status: 429, retryAfterMs: 1500 })
      .mockResolvedValueOnce({ ok: true, status: 201 });
    await withRetry(attempt, cfg, deps);
    expect(deps.sleptFor).toEqual([1500]);
  });

  it('uses default deps when none are provided', async () => {
    const attempt = vi.fn(async (): Promise<Attempt> => ({ ok: true, status: 200 }));
    const res = await withRetry(attempt, cfg); // exercises the default-deps path (now())
    expect(res.ok).toBe(true);
  });
});

describe('defaultRetryDeps', () => {
  it('provides working sleep, random and now', async () => {
    await defaultRetryDeps.sleep(1);
    expect(defaultRetryDeps.random()).toBeGreaterThanOrEqual(0);
    expect(defaultRetryDeps.random()).toBeLessThan(1);
    expect(defaultRetryDeps.now()).toBeGreaterThan(0);
  });
});
