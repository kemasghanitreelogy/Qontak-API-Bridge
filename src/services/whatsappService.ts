import pLimit from 'p-limit';
import { config } from '../config';
import { logger } from '../logger';
import { sendDirectMessage, QontakDirectSend } from '../qontak/qontakClient';
import type { BroadcastInput, SendMessageInput } from '../schemas/whatsapp';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Maps validated input onto the exact payload Qontak expects. */
function toQontakPayload(args: {
  to_name: string;
  to_number: string;
  message_template_id: string;
  channel_integration_id: string;
  language_code: string;
  parameters?: SendMessageInput['parameters'];
}): QontakDirectSend {
  return {
    to_name: args.to_name,
    to_number: args.to_number,
    message_template_id: args.message_template_id,
    channel_integration_id: args.channel_integration_id,
    language: { code: args.language_code },
    ...(args.parameters ? { parameters: args.parameters } : {}),
  };
}

export async function sendSingle(input: SendMessageInput) {
  const payload = toQontakPayload(input);
  const result = await sendDirectMessage(payload);
  return {
    to_number: input.to_number,
    success: result.ok,
    status: result.status,
    response: result.data,
  };
}

export interface BroadcastRecipientResult {
  to_number: string;
  to_name: string;
  success: boolean;
  status: number;
  response: unknown;
}

export interface BroadcastSummary {
  total: number;
  sent: number;
  failed: number;
  results: BroadcastRecipientResult[];
}

/**
 * Broadcasts to many recipients with bounded concurrency + a per-send delay so
 * we stay within provider rate limits. Each recipient is independent: one
 * failure never aborts the rest, and the caller gets a per-number report.
 */
export async function broadcast(input: BroadcastInput): Promise<BroadcastSummary> {
  const limit = pLimit(config.BROADCAST_CONCURRENCY);

  const tasks = input.recipients.map((r) =>
    limit(async (): Promise<BroadcastRecipientResult> => {
      const payload = toQontakPayload({
        to_name: r.to_name,
        to_number: r.to_number,
        message_template_id: input.message_template_id,
        channel_integration_id: input.channel_integration_id,
        language_code: input.language_code,
        // Per-recipient params win over none; falls back to nothing.
        parameters: r.parameters,
      });

      const result = await sendDirectMessage(payload);
      if (config.BROADCAST_DELAY_MS > 0) await sleep(config.BROADCAST_DELAY_MS);

      return {
        to_number: r.to_number,
        to_name: r.to_name,
        success: result.ok,
        status: result.status,
        response: result.data,
      };
    }),
  );

  const results = await Promise.all(tasks);
  const sent = results.filter((r) => r.success).length;

  const summary: BroadcastSummary = {
    total: results.length,
    sent,
    failed: results.length - sent,
    results,
  };
  logger.info({ total: summary.total, sent: summary.sent, failed: summary.failed }, 'Broadcast finished');
  return summary;
}
