import { describe, expect, it } from 'vitest';
import { broadcastSchema, sendMessageSchema, phoneNumber } from '../src/schemas/whatsapp';

describe('phoneNumber', () => {
  it('strips +, spaces and dashes then accepts valid numbers', () => {
    expect(phoneNumber.parse('+62 812-3456-7890')).toBe('6281234567890');
    expect(phoneNumber.parse('6281234567890')).toBe('6281234567890');
    expect(phoneNumber.parse(' (628) 1397-3336 ')).toBe('62813973336');
  });

  it('rejects too-short or non-numeric numbers', () => {
    expect(() => phoneNumber.parse('123')).toThrow();
    expect(() => phoneNumber.parse('not-a-number')).toThrow();
    expect(() => phoneNumber.parse('1234567890123456')).toThrow(); // 16 digits
  });
});

describe('sendMessageSchema', () => {
  it('accepts a valid payload and applies env defaults', () => {
    const parsed = sendMessageSchema.parse({
      to_name: 'Budi',
      to_number: '6281234567890',
      message_template_id: 'tmpl-1',
    });
    expect(parsed.channel_integration_id).toBe('chan-test-123'); // from env default
    expect(parsed.language_code).toBe('id');
  });

  it('requires a name', () => {
    const r = sendMessageSchema.safeParse({ to_number: '6281234567890', message_template_id: 't' });
    expect(r.success).toBe(false);
  });

  it('requires message_template_id when not set in env', () => {
    const r = sendMessageSchema.safeParse({ to_name: 'Budi', to_number: '6281234567890' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('message_template_id'))).toBe(true);
    }
  });

  it('accepts optional template parameters', () => {
    const parsed = sendMessageSchema.parse({
      to_name: 'Budi',
      to_number: '6281234567890',
      message_template_id: 'tmpl-1',
      parameters: { body: [{ key: '1', value: 'full_name', value_text: 'Budi' }] },
    });
    expect(parsed.parameters?.body?.[0].value_text).toBe('Budi');
  });
});

describe('broadcastSchema', () => {
  it('accepts a list of recipients', () => {
    const parsed = broadcastSchema.parse({
      message_template_id: 'tmpl-1',
      recipients: [
        { to_name: 'Budi', to_number: '6281234567890' },
        { to_name: 'Sari', to_number: '6289876543210' },
      ],
    });
    expect(parsed.recipients).toHaveLength(2);
  });

  it('rejects an empty recipient list', () => {
    const r = broadcastSchema.safeParse({ message_template_id: 'tmpl-1', recipients: [] });
    expect(r.success).toBe(false);
  });

  it('requires channel + template (both missing) reports both', () => {
    // Force both defaults to be empty by passing empty strings.
    const r = broadcastSchema.safeParse({
      message_template_id: '',
      channel_integration_id: '',
      recipients: [{ to_name: 'Budi', to_number: '6281234567890' }],
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fields = r.error.issues.map((i) => i.path.join('.'));
      expect(fields).toContain('message_template_id');
      expect(fields).toContain('channel_integration_id');
    }
  });
});
