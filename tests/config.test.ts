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
    expect(typeof mod.config.PORT).toBe('number');
    expect(mod.config.QONTAK_BASE_URL).toMatch(/^https?:\/\//);
  });

  it('prints errors and exits(1) when a required var is invalid', async () => {
    vi.resetModules();
    vi.stubEnv('BRIDGE_API_KEY', 'short'); // fails min(16); dotenv won't override an already-set var
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`process.exit:${code}`);
      }) as never);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(import('../src/config')).rejects.toThrow('process.exit:1');
    expect(exit).toHaveBeenCalledWith(1);
    expect(errorLog).toHaveBeenCalled();
  });
});
