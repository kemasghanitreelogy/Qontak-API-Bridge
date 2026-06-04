/**
 * Vercel serverless entry point.
 *
 * An Express app is a `(req, res)` handler, so we can export the app instance
 * directly as the function handler. `vercel.json` rewrites every path to this
 * function, and Express does the internal routing (/health, /api/whatsapp/*).
 *
 * No `app.listen` and no PORT here — the platform invokes the handler per request.
 */
import { createApp } from '../src/app';

export default createApp();
