import axios, { AxiosError, AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../logger';
import { buildMekariAuthHeaders } from './mekariSignature';
import { parseRetryAfterMs, withRetry, type Attempt } from './retry';

/** Shape of a single Qontak "direct" WhatsApp send. */
export interface QontakDirectSend {
  to_name: string;
  to_number: string;
  message_template_id: string;
  channel_integration_id: string;
  language: { code: string };
  parameters?: {
    body?: Array<{ key: string; value: string; value_text: string }>;
    header?: Record<string, unknown>;
    buttons?: Array<Record<string, unknown>>;
  };
}

export interface QontakResult extends Attempt {
  ok: boolean;
  status: number;
  data: unknown;
}

const retryConfig = {
  maxAttempts: config.RETRY_MAX_ATTEMPTS,
  baseDelayMs: config.RETRY_BASE_DELAY_MS,
  maxDelayMs: config.RETRY_MAX_DELAY_MS,
  maxElapsedMs: config.RETRY_MAX_ELAPSED_MS,
};

// We treat any non-2xx as a handled error rather than a thrown exception, so
// axios should never reject purely because of the HTTP status code.
export const acceptAllStatuses = (): boolean => true;

const http: AxiosInstance = axios.create({
  baseURL: config.QONTAK_BASE_URL,
  timeout: 20_000,
  validateStatus: acceptAllStatuses,
});

/**
 * Sends ONE WhatsApp message through the Qontak Mekari direct-broadcast endpoint.
 * Authentication headers are freshly signed per request (the signature embeds the
 * current date, so it cannot be cached).
 */
export async function sendDirectMessage(payload: QontakDirectSend): Promise<QontakResult> {
  const path = config.QONTAK_BROADCAST_DIRECT_PATH;

  // One HTTP attempt. Re-signed each time because the HMAC embeds the current date.
  const attempt = async (): Promise<QontakResult> => {
    const authHeaders = buildMekariAuthHeaders({
      method: 'POST',
      path,
      clientId: config.MEKARI_CLIENT_ID,
      clientSecret: config.MEKARI_CLIENT_SECRET,
    });

    try {
      const res = await http.post(path, payload, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders },
      });

      const ok = res.status >= 200 && res.status < 300;
      if (!ok) {
        logger.warn(
          { status: res.status, to: payload.to_number, data: res.data },
          'Qontak rejected message',
        );
      }
      return {
        ok,
        status: res.status,
        data: res.data,
        retryAfterMs: parseRetryAfterMs(res.headers?.['retry-after']),
      };
    } catch (err) {
      const axErr = err as AxiosError;
      logger.error(
        { to: payload.to_number, message: axErr.message, code: axErr.code },
        'Qontak request failed (network/timeout)',
      );
      return {
        ok: false,
        status: 0,
        data: { error: 'upstream_request_failed', message: axErr.message },
      };
    }
  };

  const result = await withRetry(attempt, retryConfig);
  return { ok: result.ok, status: result.status, data: result.data };
}
