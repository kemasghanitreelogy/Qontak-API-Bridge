import crypto from 'node:crypto';

export interface MekariSignatureInput {
  method: string;
  /** Path the request is sent to, including any query string, e.g. "/qontak/chat/v1/broadcasts/whatsapp/direct". */
  path: string;
  clientId: string;
  clientSecret: string;
  /** RFC 7231 / RFC 1123 date string (GMT). Defaults to now. Override only for testing. */
  date?: string;
}

/**
 * Builds the Mekari HMAC-SHA256 authentication headers.
 *
 * Mekari (Jurnal, Talenta, Qontak, …) all share the same scheme: the signature
 * is computed over a two-line string referencing the `date` header and the HTTP
 * request line, then base64-encoded with the client secret. This is exactly what
 * the Postman "pre-request script" in the onboarding slides produces.
 *
 *   Signing string:
 *     date: <Date header value>\n<METHOD> <path> HTTP/1.1
 *
 *   Authorization:
 *     hmac username="<clientId>", algorithm="hmac-sha256",
 *          headers="date request-line", signature="<base64(hmacSha256(signingString, secret))>"
 */
export function buildMekariAuthHeaders(input: MekariSignatureInput): {
  Date: string;
  Authorization: string;
} {
  const { method, path, clientId, clientSecret } = input;
  const date = input.date ?? new Date().toUTCString();

  const requestLine = `${method.toUpperCase()} ${path} HTTP/1.1`;
  const signingString = `date: ${date}\n${requestLine}`;

  const signature = crypto
    .createHmac('sha256', clientSecret)
    .update(signingString, 'utf8')
    .digest('base64');

  const authorization =
    `hmac username="${clientId}", algorithm="hmac-sha256", ` +
    `headers="date request-line", signature="${signature}"`;

  return { Date: date, Authorization: authorization };
}
