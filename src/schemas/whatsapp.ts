import { z } from 'zod';
import { config } from '../config';

/**
 * E.164-ish WhatsApp number: digits only, 8–15 length. We strip a leading "+"
 * and any spaces/dashes before validating so callers can be a little loose.
 */
export const phoneNumber = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s\-()]/g, '').replace(/^\+/, ''))
  .pipe(z.string().regex(/^\d{8,15}$/, 'must be 8–15 digits in international format (e.g. 6281234567890)'));

/** A single template body variable: {{1}} -> "value_text". */
const templateParam = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  value_text: z.string(),
});

const templateParameters = z
  .object({
    body: z.array(templateParam).optional(),
    header: z.record(z.unknown()).optional(),
    buttons: z.array(z.record(z.unknown())).optional(),
  })
  .optional();

/** Fields shared by single-send and broadcast. */
const baseSendFields = {
  message_template_id: z.string().default(config.QONTAK_MESSAGE_TEMPLATE_ID),
  channel_integration_id: z.string().default(config.QONTAK_CHANNEL_INTEGRATION_ID),
  language_code: z.string().min(2).default(config.QONTAK_LANGUAGE_CODE),
  parameters: templateParameters,
};

const requireConfigured = (val: { message_template_id: string; channel_integration_id: string }, ctx: z.RefinementCtx) => {
  if (!val.message_template_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['message_template_id'],
      message: 'required (set in request body or QONTAK_MESSAGE_TEMPLATE_ID env)',
    });
  }
  if (!val.channel_integration_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['channel_integration_id'],
      message: 'required (set in request body or QONTAK_CHANNEL_INTEGRATION_ID env)',
    });
  }
};

/** POST /api/whatsapp/send — one recipient. */
export const sendMessageSchema = z
  .object({
    to_name: z.string().trim().min(1, 'to_name is required'),
    to_number: phoneNumber,
    ...baseSendFields,
  })
  .superRefine(requireConfigured);

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** A recipient inside a broadcast: number + per-recipient overrides. */
const recipientSchema = z.object({
  to_name: z.string().trim().min(1),
  to_number: phoneNumber,
  // Optional per-recipient template variables (personalisation).
  parameters: templateParameters,
});

export type RecipientInput = z.infer<typeof recipientSchema>;

/** POST /api/whatsapp/broadcast — many recipients, shared template. */
export const broadcastSchema = z
  .object({
    recipients: z
      .array(recipientSchema)
      .min(1, 'at least one recipient is required')
      .max(1000, 'maximum 1000 recipients per broadcast'),
    ...baseSendFields,
  })
  .superRefine(requireConfigured);

export type BroadcastInput = z.infer<typeof broadcastSchema>;
