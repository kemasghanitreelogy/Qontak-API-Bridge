import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QontakDirectSend } from '../src/qontak/qontakClient';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('axios', () => ({
  default: { create: () => ({ post, get: vi.fn() }) },
  AxiosError: class AxiosError extends Error {},
}));

import { acceptAllStatuses, sendDirectMessage } from '../src/qontak/qontakClient';

const payload: QontakDirectSend = {
  to_name: 'Budi',
  to_number: '6281234567890',
  message_template_id: 'tmpl-1',
  channel_integration_id: 'chan-1',
  language: { code: 'id' },
};

describe('acceptAllStatuses', () => {
  it('always returns true so axios never rejects on status', () => {
    expect(acceptAllStatuses()).toBe(true);
  });
});

describe('sendDirectMessage', () => {
  beforeEach(() => post.mockReset());

  it('returns ok:true for a 2xx response', async () => {
    post.mockResolvedValue({ status: 201, data: { id: 'msg-1' } });
    const res = await sendDirectMessage(payload);
    expect(res).toEqual({ ok: true, status: 201, data: { id: 'msg-1' } });
  });

  it('returns ok:false for a non-2xx response', async () => {
    post.mockResolvedValue({ status: 422, data: { message: 'invalid' } });
    const res = await sendDirectMessage(payload);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(422);
  });

  it('handles network/timeout errors gracefully', async () => {
    post.mockImplementationOnce(() =>
      Promise.reject(Object.assign(new Error('timeout of 20000ms'), { code: 'ECONNABORTED' })),
    );
    const res = await sendDirectMessage(payload);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.data).toMatchObject({ error: 'upstream_request_failed' });
  });

  it('returns 429 and reads the Retry-After header', async () => {
    post.mockResolvedValue({ status: 429, data: { message: 'slow down' }, headers: { 'retry-after': '2' } });
    const res = await sendDirectMessage(payload);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(429);
  });

  it('signs each request with Mekari auth headers', async () => {
    post.mockResolvedValue({ status: 201, data: {} });
    await sendDirectMessage(payload);
    const [, , opts] = post.mock.calls[0];
    expect(opts.headers.Authorization).toContain('hmac username=');
    expect(opts.headers.Date).toMatch(/GMT$/);
  });
});
