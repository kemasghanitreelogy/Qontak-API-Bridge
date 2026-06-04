/**
 * Deterministic test environment. Set BEFORE any app module (and its `config`)
 * is imported. dotenv (loaded inside config) does not override already-set vars,
 * so these win over any local `.env`, keeping tests reproducible in CI.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.BRIDGE_API_KEY = 'test-bridge-key-1234567890';
process.env.MEKARI_CLIENT_ID = 'test-client-id';
process.env.MEKARI_CLIENT_SECRET = 'test-client-secret';
process.env.QONTAK_BASE_URL = 'https://api.mekari.test';
process.env.QONTAK_BROADCAST_DIRECT_PATH = '/qontak/chat/v1/broadcasts/whatsapp/direct';
process.env.QONTAK_TEMPLATES_PATH = '/qontak/chat/v1/templates/whatsapp';
process.env.QONTAK_CHANNEL_INTEGRATION_ID = 'chan-test-123';
process.env.QONTAK_MESSAGE_TEMPLATE_ID = '';
process.env.QONTAK_LANGUAGE_CODE = 'id';
process.env.BROADCAST_CONCURRENCY = '3';
process.env.BROADCAST_DELAY_MS = '0';
