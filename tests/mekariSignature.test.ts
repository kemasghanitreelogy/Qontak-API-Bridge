import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildMekariAuthHeaders } from '../src/qontak/mekariSignature';

describe('buildMekariAuthHeaders', () => {
  const fixedDate = 'Wed, 04 Jun 2026 10:00:00 GMT';
  const clientId = 'test-client-id';
  const clientSecret = 'super-secret';
  const path = '/qontak/chat/v1/broadcasts/whatsapp/direct';

  it('produces the exact signature for a known signing string', () => {
    const expectedSigningString = `date: ${fixedDate}\nPOST ${path} HTTP/1.1`;
    const expectedSignature = crypto
      .createHmac('sha256', clientSecret)
      .update(expectedSigningString, 'utf8')
      .digest('base64');

    const headers = buildMekariAuthHeaders({
      method: 'POST',
      path,
      clientId,
      clientSecret,
      date: fixedDate,
    });

    expect(headers.Date).toBe(fixedDate);
    expect(headers.Authorization).toContain(`username="${clientId}"`);
    expect(headers.Authorization).toContain('algorithm="hmac-sha256"');
    expect(headers.Authorization).toContain('headers="date request-line"');
    expect(headers.Authorization).toContain(`signature="${expectedSignature}"`);
  });

  it('uppercases the HTTP method in the request line', () => {
    const lower = buildMekariAuthHeaders({ method: 'post', path, clientId, clientSecret, date: fixedDate });
    const upper = buildMekariAuthHeaders({ method: 'POST', path, clientId, clientSecret, date: fixedDate });
    expect(lower.Authorization).toBe(upper.Authorization);
  });

  it('changes the signature when the path changes', () => {
    const a = buildMekariAuthHeaders({ method: 'POST', path: '/a', clientId, clientSecret, date: fixedDate });
    const b = buildMekariAuthHeaders({ method: 'POST', path: '/b', clientId, clientSecret, date: fixedDate });
    expect(a.Authorization).not.toBe(b.Authorization);
  });

  it('defaults the Date header to a valid RFC1123/GMT string', () => {
    const headers = buildMekariAuthHeaders({ method: 'POST', path, clientId, clientSecret });
    expect(headers.Date).toMatch(/GMT$/);
    expect(Number.isNaN(Date.parse(headers.Date))).toBe(false);
  });
});
