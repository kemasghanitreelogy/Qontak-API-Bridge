import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable mocked config so we can flip BROADCAST_DELAY_MS to cover both branches.
const { cfg, sendDirectMessage } = vi.hoisted(() => ({
  cfg: { NODE_ENV: 'test', BROADCAST_CONCURRENCY: 2, BROADCAST_DELAY_MS: 0 },
  sendDirectMessage: vi.fn(),
}));

vi.mock('../src/config', () => ({ config: cfg }));
vi.mock('../src/qontak/qontakClient', () => ({ sendDirectMessage }));

import { broadcast, sendSingle } from '../src/services/whatsappService';
import type { BroadcastInput, SendMessageInput } from '../src/schemas/whatsapp';

const baseSend: SendMessageInput = {
  to_name: 'Budi',
  to_number: '6281234567890',
  message_template_id: 'tmpl-1',
  channel_integration_id: 'chan-1',
  language_code: 'id',
} as SendMessageInput;

beforeEach(() => {
  sendDirectMessage.mockReset();
  cfg.BROADCAST_DELAY_MS = 0;
});

describe('sendSingle', () => {
  it('maps input to a Qontak payload and reports success (no parameters)', async () => {
    sendDirectMessage.mockResolvedValue({ ok: true, status: 201, data: { id: 'x' } });
    const res = await sendSingle(baseSend);
    expect(res.success).toBe(true);
    const payload = sendDirectMessage.mock.calls[0][0];
    expect(payload).toMatchObject({ to_number: '6281234567890', language: { code: 'id' } });
    expect(payload).not.toHaveProperty('parameters');
  });

  it('forwards template parameters and sanitises the body value', async () => {
    sendDirectMessage.mockResolvedValue({ ok: true, status: 201, data: {} });
    await sendSingle({
      ...baseSend,
      parameters: { body: [{ key: '1', value: 'Kemas Ghani', value_text: 'Kemas Ghani' }] },
    } as SendMessageInput);
    const payload = sendDirectMessage.mock.calls[0][0];
    // raw "Kemas Ghani" -> valid Qontak slug
    expect(payload.parameters.body[0].value).toBe('kemas_ghani');
  });

  it('passes through parameters that have no body (e.g. header/buttons only)', async () => {
    sendDirectMessage.mockResolvedValue({ ok: true, status: 201, data: {} });
    await sendSingle({
      ...baseSend,
      parameters: { buttons: [{ index: '0', type: 'url', value: 'track123' }] },
    } as unknown as SendMessageInput);
    const payload = sendDirectMessage.mock.calls[0][0];
    expect(payload.parameters).toHaveProperty('buttons');
    expect(payload.parameters.body).toBeUndefined();
  });

  it('reports failure when Qontak rejects', async () => {
    sendDirectMessage.mockResolvedValue({ ok: false, status: 422, data: {} });
    const res = await sendSingle(baseSend);
    expect(res.success).toBe(false);
  });
});

describe('broadcast', () => {
  const makeInput = (count: number): BroadcastInput =>
    ({
      message_template_id: 'tmpl-1',
      channel_integration_id: 'chan-1',
      language_code: 'id',
      recipients: Array.from({ length: count }, (_, i) => ({
        to_name: `User${i}`,
        to_number: `62810000000${i}`,
        ...(i === 0 ? { parameters: { body: [{ key: '1', value: 'n', value_text: 'x' }] } } : {}),
      })),
    }) as BroadcastInput;

  it('summarises all-success', async () => {
    sendDirectMessage.mockResolvedValue({ ok: true, status: 201, data: {} });
    const summary = await broadcast(makeInput(3));
    expect(summary).toMatchObject({ total: 3, sent: 3, failed: 0 });
  });

  it('reports partial failures per recipient', async () => {
    sendDirectMessage.mockImplementation((p: { to_number: string }) =>
      Promise.resolve(
        p.to_number === '628100000001'
          ? { ok: false, status: 422, data: {} }
          : { ok: true, status: 201, data: {} },
      ),
    );
    const summary = await broadcast(makeInput(3));
    expect(summary.total).toBe(3);
    expect(summary.sent).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.results.find((r) => r.to_number === '628100000001')?.success).toBe(false);
  });

  it('applies the inter-message delay when configured (>0)', async () => {
    cfg.BROADCAST_DELAY_MS = 1;
    sendDirectMessage.mockResolvedValue({ ok: true, status: 201, data: {} });
    const summary = await broadcast(makeInput(2));
    expect(summary.sent).toBe(2);
  });
});
