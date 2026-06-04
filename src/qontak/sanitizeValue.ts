/**
 * Qontak's direct-broadcast substitutes a body parameter's `value` field (NOT
 * `value_text`) into the template, and that field must match Qontak's rule:
 * lowercase letters, digits or underscore, 2–16 characters.
 *
 * This coerces arbitrary input (e.g. a name from Klaviyo like "Kemas Ghani")
 * into a valid value — "kemas_ghani" — so callers can pass raw names without
 * hitting a 422. Falls back to "customer" when nothing usable remains.
 */
export function sanitizeQontakValue(raw: string): string {
  let s = (raw ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (é -> e)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_') // anything not allowed -> underscore
    .replace(/_+/g, '_') // collapse repeats
    .replace(/^_+|_+$/g, ''); // trim leading/trailing underscores

  if (s.length > 16) {
    s = s.slice(0, 16).replace(/_+$/, '');
  }
  if (s.length < 2) {
    s = 'customer';
  }
  return s;
}
