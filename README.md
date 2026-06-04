# Qontak API Bridge

A small, production-grade REST API that automates sending **WhatsApp** messages
through your **WABA connected to Qontak (Mekari Omnichannel)**.

It exposes two clean endpoints — **send to one number** and **broadcast to many**
— and handles the tricky parts for you: Mekari **HMAC authentication**, input
validation, rate limiting, and per-recipient delivery reporting.

```
Your app ──HTTP──▶ Qontak API Bridge ──HMAC-signed──▶ api.mekari.com (Qontak) ──▶ WhatsApp
```

---

## 1. Setup

```bash
npm install
cp .env.example .env
# then edit .env with your real credentials
npm run dev          # starts on http://localhost:3000
```

### Required environment variables

| Variable | What it is |
|---|---|
| `BRIDGE_API_KEY` | Secret that protects *this* bridge. Generate: `openssl rand -hex 32` |
| `MEKARI_CLIENT_ID` / `MEKARI_CLIENT_SECRET` | From the Mekari Developer portal (slides up to page 9) |
| `QONTAK_BASE_URL` | Mekari gateway, default `https://api.mekari.com` |
| `QONTAK_BROADCAST_DIRECT_PATH` | Direct-send endpoint path — **verify against your Postman collection** |
| `QONTAK_CHANNEL_INTEGRATION_ID` | Your connected WABA channel in Qontak |
| `QONTAK_MESSAGE_TEMPLATE_ID` | An *approved* WhatsApp template id |
| `QONTAK_LANGUAGE_CODE` | Template language, e.g. `id` |

> ⚠️ **Verify the path.** Mekari gateway path prefixes can differ per account.
> Open your Postman collection, copy the exact path of the “WhatsApp Broadcast
> Direct” request, and set `QONTAK_BROADCAST_DIRECT_PATH`. The HMAC signature is
> computed over this path, so a mismatch causes `401`.

---

## 2. Authentication (Mekari HMAC)

Every request to Qontak is signed exactly like the Postman *pre-request script*
in the onboarding slides:

```
signing string:
  date: <RFC1123 GMT date>
  POST /qontak/chat/v1/broadcasts/whatsapp/direct HTTP/1.1

Authorization:
  hmac username="<CLIENT_ID>", algorithm="hmac-sha256",
       headers="date request-line", signature="<base64( HMAC-SHA256(signing string, CLIENT_SECRET) )>"
```

Implemented in [`src/qontak/mekariSignature.ts`](src/qontak/mekariSignature.ts)
and covered by tests.

---

## 3. API

All `/api/*` endpoints require the header **`X-Api-Key: <BRIDGE_API_KEY>`**.

### Health
```
GET /health  ->  { "status": "ok" }
```

### Send to one number
```
POST /api/whatsapp/send
Content-Type: application/json
X-Api-Key: <BRIDGE_API_KEY>
```
```json
{
  "to_name": "Budi",
  "to_number": "6281234567890",
  "parameters": {
    "body": [
      { "key": "1", "value": "full_name", "value_text": "Budi" }
    ]
  }
}
```
`message_template_id`, `channel_integration_id` and `language_code` fall back to
your env defaults if omitted, or can be passed per request.

**Response `200`**
```json
{ "to_number": "6281234567890", "success": true, "status": 201, "response": { "...": "qontak payload" } }
```

### Broadcast to many numbers
```
POST /api/whatsapp/broadcast
```
```json
{
  "recipients": [
    { "to_name": "Budi", "to_number": "6281234567890",
      "parameters": { "body": [ { "key": "1", "value": "full_name", "value_text": "Budi" } ] } },
    { "to_name": "Sari", "to_number": "6289876543210",
      "parameters": { "body": [ { "key": "1", "value": "full_name", "value_text": "Sari" } ] } }
  ]
}
```
Sent with bounded concurrency (`BROADCAST_CONCURRENCY`) and a per-message delay
(`BROADCAST_DELAY_MS`). One failure never stops the rest.

**Response** — `200` all sent · `207` partial · `502` all failed:
```json
{
  "total": 2,
  "sent": 1,
  "failed": 1,
  "results": [
    { "to_number": "6281234567890", "to_name": "Budi", "success": true,  "status": 201, "response": {} },
    { "to_number": "6289876543210", "to_name": "Sari", "success": false, "status": 422, "response": {} }
  ]
}
```

### Quick test with curl
```bash
curl -X POST http://localhost:3000/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: $BRIDGE_API_KEY" \
  -d '{"to_name":"Budi","to_number":"6281234567890"}'
```

---

## 4. Scripts

| Command | Does |
|---|---|
| `npm run dev` | Hot-reload dev server |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type-check only |
| `npm test` | Run unit tests (Vitest) |

---

## 5. Project structure

```
src/
  config.ts                 # env loading + validation (fails fast)
  logger.ts                 # pino logger, redacts secrets
  app.ts                    # express app (helmet, rate limit, routes)
  index.ts                  # server bootstrap + graceful shutdown
  qontak/
    mekariSignature.ts      # HMAC-SHA256 signing (tested)
    qontakClient.ts         # signed axios call to Qontak
  schemas/whatsapp.ts       # zod request validation
  services/whatsappService.ts # single send + rate-limited broadcast
  middleware/               # auth, validate, error handling
  routes/whatsapp.ts        # /api/whatsapp/send + /broadcast
tests/
  mekariSignature.test.ts
```

## 6. Notes & next steps
- Numbers must be international format without `+` (e.g. `6281234567890`).
  The validator strips spaces/dashes and a leading `+` automatically.
- For very large broadcasts, run this behind a queue (BullMQ/Redis) and return a
  job id instead of waiting synchronously.
- Templates must be **approved** in Qontak before they can be sent.
