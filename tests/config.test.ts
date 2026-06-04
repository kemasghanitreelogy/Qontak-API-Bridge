import { afterEach, describe, expect, it, vi } from 'vitest';

describe('config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('loads and validates the environment (success path)', async () => {
    vi.resetModules();
    const mod = await import('../src/config');
    expect(typeof mod.config.BRIDGE_API_KEY).toBe('string');
    expect(mod.config.QONTAK_BASE_URL).toMatch(/^https?:\/\//);
  });

  it('throws a descriptive error when a required var is invalid', async () => {
    vi.resetModules();
    vi.stubEnv('BRIDGE_API_KEY', 'short'); // fails min(16); dotenv won't override an already-set var

    await expect(import('../src/config')).rejects.toThrow(/Invalid environment configuration/);
    await expect(import('../src/config')).rejects.toThrow(/BRIDGE_API_KEY/);
  });
});
