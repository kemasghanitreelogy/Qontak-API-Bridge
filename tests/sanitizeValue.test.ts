import { describe, expect, it } from 'vitest';
import { sanitizeQontakValue } from '../src/qontak/sanitizeValue';

describe('sanitizeQontakValue', () => {
  it('lowercases and replaces spaces with underscore', () => {
    expect(sanitizeQontakValue('Kemas Ghani')).toBe('kemas_ghani');
    expect(sanitizeQontakValue('Budi')).toBe('budi');
  });

  it('strips diacritics', () => {
    expect(sanitizeQontakValue('Café')).toBe('cafe');
  });

  it('collapses and trims underscores / strips symbols', () => {
    expect(sanitizeQontakValue('  John  -- Doe!! ')).toBe('john_doe');
    expect(sanitizeQontakValue('@@hi@@')).toBe('hi');
  });

  it('truncates to 16 chars and trims a trailing underscore', () => {
    // "abcdefghijklmno p" -> first 16 "abcdefghijklmno_" -> trim -> "abcdefghijklmno"
    expect(sanitizeQontakValue('abcdefghijklmno p')).toBe('abcdefghijklmno');
    expect(sanitizeQontakValue('supercalifragilisticexpialidocious')).toHaveLength(16);
  });

  it('falls back to "customer" when nothing usable remains', () => {
    expect(sanitizeQontakValue('')).toBe('customer');
    expect(sanitizeQontakValue('!!!')).toBe('customer');
    expect(sanitizeQontakValue('a')).toBe('customer'); // below 2-char minimum
    expect(sanitizeQontakValue(undefined as unknown as string)).toBe('customer');
  });

  it('keeps an already-valid slug unchanged', () => {
    expect(sanitizeQontakValue('full_name')).toBe('full_name');
    expect(sanitizeQontakValue('promo12')).toBe('promo12');
  });
});
