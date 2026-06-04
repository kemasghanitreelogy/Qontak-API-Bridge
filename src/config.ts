import 'dotenv/config';
import { z } from 'zod';

/**
 * Centralised, validated configuration. The app refuses to boot if a required
 * secret is missing — fail fast instead of sending broken requests to Qontak.
 */
const envSchema = z.object({
  BRIDGE_API_KEY: z.string().min(16, 'BRIDGE_API_KEY must be at least 16 chars'),

  MEKARI_CLIENT_ID: z.string().min(1, 'MEKARI_CLIENT_ID is required'),
  MEKARI_CLIENT_SECRET: z.string().min(1, 'MEKARI_CLIENT_SECRET is required'),

  QONTAK_BASE_URL: z.string().url().default('https://api.mekari.com'),
  QONTAK_BROADCAST_DIRECT_PATH: z
    .string()
    .startsWith('/')
    .default('/qontak/chat/v1/broadcasts/whatsapp/direct'),
  QONTAK_TEMPLATES_PATH: z
    .string()
    .startsWith('/')
    .default('/qontak/chat/v1/templates/whatsapp'),

  QONTAK_CHANNEL_INTEGRATION_ID: z.string().default(''),
  QONTAK_MESSAGE_TEMPLATE_ID: z.string().default(''),
  QONTAK_LANGUAGE_CODE: z.string().default('id'),

  BROADCAST_CONCURRENCY: z.coerce.number().int().positive().max(50).default(3),
  BROADCAST_DELAY_MS: z.coerce.number().int().min(0).default(250),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // Throw (don't process.exit) so it surfaces cleanly as a serverless
  // function error instead of killing the runtime process.
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const config = parsed.data;
export type Config = typeof config;
