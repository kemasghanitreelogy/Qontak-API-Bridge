import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Force the service layer to throw so we exercise the route try/catch path and
// the global error handler returning 500.
const { sendSingle, broadcast } = vi.hoisted(() => ({
  sendSingle: vi.fn(),
  broadcast: vi.fn(),
}));
vi.mock('../src/services/whatsappService', () => ({ sendSingle, broadcast }));

import { createApp } from '../src/app';
import { config } from '../src/config';

const app = createApp();
const KEY = config.BRIDGE_API_KEY;
const TEMPLATE = '11111111-2222-3333-4444-555555555555';

describe('error propagation (500)', () => {
  it('send: a thrown service error becomes a 500', async () => {
    sendSingle.mockRejectedValue(new Error('kaboom'));
    const res = await request(app)
      .post('/api/whatsapp/send')
      .set('X-Api-Key', KEY)
      .send({ to_name: 'Budi', to_number: '6281234567890', message_template_id: TEMPLATE });
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'internal_error', message: 'kaboom' });
  });

  it('broadcast: a thrown service error becomes a 500', async () => {
    broadcast.mockRejectedValue(new Error('kaboom'));
    const res = await request(app)
      .post('/api/whatsapp/broadcast')
      .set('X-Api-Key', KEY)
      .send({
        message_template_id: TEMPLATE,
        recipients: [{ to_name: 'Budi', to_number: '6281234567890' }],
      });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('internal_error');
  });
});
