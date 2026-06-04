import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// Mock only the outbound HTTP boundary. Everything else (routes → service →
// qontakClient → signing) runs for real: a true end-to-end test with no live call.
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => ({
  default: { create: () => ({ post, get: vi.fn() }) },
  AxiosError: class AxiosError extends Error {},
}));

import { createApp } from '../src/app';
import { config } from '../src/config';

const app = createApp();
const KEY = config.BRIDGE_API_KEY;
const TEMPLATE = '11111111-2222-3333-4444-555555555555';

const okOnce = () => post.mockResolvedValue({ status: 201, data: { id: 'msg' } });

beforeEach(() => post.mockReset());

describe('GET /health', () => {
  it('returns ok without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('unknown route', () => {
  it('returns 404', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});

describe('auth', () => {
  it('rejects requests without the API key', async () => {
    const res = await request(app).post('/api/whatsapp/send').send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/whatsapp/send', () => {
  it('422 on an invalid phone number', async () => {
    const res = await request(app)
      .post('/api/whatsapp/send')
      .set('X-Api-Key', KEY)
      .send({ to_name: 'Budi', to_number: '123', message_template_id: TEMPLATE });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_failed');
  });

  it('200 on a successful send and normalises the number', async () => {
    okOnce();
    const res = await request(app)
      .post('/api/whatsapp/send')
      .set('X-Api-Key', KEY)
      .send({ to_name: 'Budi', to_number: '+62 812-3456-7890', message_template_id: TEMPLATE });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(post.mock.calls[0][1].to_number).toBe('6281234567890');
  });

  it('502 when Qontak rejects the message', async () => {
    post.mockResolvedValue({ status: 401, data: { message: 'Unauthorized' } });
    const res = await request(app)
      .post('/api/whatsapp/send')
      .set('X-Api-Key', KEY)
      .send({ to_name: 'Budi', to_number: '6281234567890', message_template_id: TEMPLATE });
    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/whatsapp/broadcast', () => {
  const recipients = [
    { to_name: 'Budi', to_number: '6281111111111' },
    { to_name: 'Sari', to_number: '6282222222222' },
  ];

  it('422 on empty recipients', async () => {
    const res = await request(app)
      .post('/api/whatsapp/broadcast')
      .set('X-Api-Key', KEY)
      .send({ message_template_id: TEMPLATE, recipients: [] });
    expect(res.status).toBe(422);
  });

  it('200 when every recipient succeeds', async () => {
    okOnce();
    const res = await request(app)
      .post('/api/whatsapp/broadcast')
      .set('X-Api-Key', KEY)
      .send({ message_template_id: TEMPLATE, recipients });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 2, sent: 2, failed: 0 });
  });

  it('207 on partial success', async () => {
    post.mockImplementation((_url?: unknown, body?: { to_number?: string }) =>
      Promise.resolve(
        body?.to_number === '6282222222222'
          ? { status: 422, data: { message: 'bad' } }
          : { status: 201, data: { id: 'ok' } },
      ),
    );
    const res = await request(app)
      .post('/api/whatsapp/broadcast')
      .set('X-Api-Key', KEY)
      .send({ message_template_id: TEMPLATE, recipients });
    expect(res.status).toBe(207);
    expect(res.body).toMatchObject({ sent: 1, failed: 1 });
  });

  it('502 when all recipients fail', async () => {
    post.mockResolvedValue({ status: 500, data: { message: 'down' } });
    const res = await request(app)
      .post('/api/whatsapp/broadcast')
      .set('X-Api-Key', KEY)
      .send({ message_template_id: TEMPLATE, recipients });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ sent: 0, failed: 2 });
  });
});
