import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { broadcastSchema, sendMessageSchema } from '../schemas/whatsapp';
import { broadcast, sendSingle } from '../services/whatsappService';

export const whatsappRouter = Router();

/**
 * POST /api/whatsapp/send
 * Send a templated WhatsApp message to a single number.
 */
whatsappRouter.post('/send', validateBody(sendMessageSchema), async (req, res, next) => {
  try {
    const result = await sendSingle(req.body);
    res.status(result.success ? 200 : 502).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/whatsapp/broadcast
 * Send a templated WhatsApp message to many numbers (rate-limited).
 * Returns 200 if all succeeded, 207 (Multi-Status) if partially, 502 if all failed.
 */
whatsappRouter.post('/broadcast', validateBody(broadcastSchema), async (req, res, next) => {
  try {
    const summary = await broadcast(req.body);
    const status = summary.failed === 0 ? 200 : summary.sent === 0 ? 502 : 207;
    res.status(status).json(summary);
  } catch (err) {
    next(err);
  }
});
