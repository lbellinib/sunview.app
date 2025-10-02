# Sunview Valet Runbook

## Overview

Sunview Valet is a lightweight Node.js + SQLite stack for capturing arrival/departure events from mobile valet attendants. It exposes:

- `/api/arrivals` – create new arrival records with server-side timestamps and processed images
- `/api/departures` – close open tickets with duration metrics
- `/api/records/search` – lookup open tickets by UID or plate
- `/api/admin/*` – manager endpoints for reporting and exports
- `/` – mobile-first landing page with Arrival/Departure/Admin panels

## Prerequisites

- Node.js 18+
- npm
- Writable directories `data/` and `uploads/` for SQLite DB and image assets
- SMTP credentials for daily email summary (optional for local dev)

## Setup

1. Copy `.env.sample` to `.env` and set values. Important:
   - `AUTH_SECRET` – 32-byte random string for JWT signing (server exits if shorter)
   - `CORS_ORIGINS` – comma-separated list of allowed origins (e.g., `https://sunview.app,https://staging.sunview.app`)
   - `HOTEL_TZ` – IANA timezone (e.g., `America/New_York`)
   - `MANAGER_EMAIL` / SMTP\_\* – configure if daily email is required
   - `CRON_SECRET` – shared secret so the Cloudflare Worker can trigger daily reports
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm run start
   ```

### Cloudflare Worker deployment

- `npx wrangler deploy` publishes the SPA assets and Worker proxy under Cloudflare.
- Set the Worker environment variables in Cloudflare: `API_ORIGIN`, `CRON_SECRET`, and `HOTEL_TZ` (matching server config).
- `/api/*` requests are proxied to the Express backend defined by `API_ORIGIN`. Ensure the backend allows the Worker IPs (TLS certs, firewall, etc.).
- A scheduled trigger (`59 23 * * *`) invokes the Worker daily. When a D1 binding named `VALET_D1` is configured the Worker will read data directly; otherwise it securely posts to `/api/system/reports/daily` on the backend which sends email and purges stale records.

The first boot seeds two accounts:

- Agent: **Lino Bellini** (PIN `1234`)
- Manager: **Hotel Manager** (PIN from `MANAGER_PIN` env)

## Daily Operations

- Agents scan the QR code that points to the deployed root URL.
- Login with PIN → tap **Arrival** or **Departure**.
- Offline arrivals queue in the browser and retry every 10s/on reconnect.
- Managers log in, switch to **Admin** tab for exports and open/closed lists.

## Reporting

- Cloudflare Worker scheduled event (23:59 hotel time) triggers the daily report and purge via `/api/system/reports/daily`.
- Local development still uses `node-cron` (enabled when `NODE_ENV !== 'production'` or `ENABLE_LOCAL_CRON=true`).
- Manual export via Admin tab (`Download CSV` or `View HTML Summary`) for any date.

## Maintenance

- Images stored under `uploads/` (served with long-lived cache headers). Consider migrating to Cloudflare R2 by swapping the file writers in `server/fs-utils.js`; document R2 bucket name + bindings before enabling.
- Records older than `DATA_RETENTION_DAYS` are purged nightly (via Worker or local cron).
- To rotate agent PINs, update `agents` table using SQLite CLI or extend the API.
- `/api/healthz` verifies DB availability and disk write access; integrate with uptime monitors.

## Migration Notes

- The data-access logic lives in `server/store.js`. When ready to migrate to Cloudflare D1, replace the SQLite calls in this module with D1 queries and wire the Worker binding `VALET_D1` (see commented section in `wrangler.toml`).
- For R2 migration, update `server/fs-utils.js` + `processImage` to write to R2 and adjust `/uploads` routes to proxy signed URLs. Document the bucket + credentials once provisioned.

## Troubleshooting

- **No login**: verify `AUTH_SECRET` consistent, JWT clock drift, or reset agent PIN by updating DB.
- **Email fails**: check SMTP credentials; logs show `Email send error` with provider message.
- **Image upload errors**: confirm file size under `MAX_IMAGE_MB` and MIME detection.
- **Cron timezone**: confirm `HOTEL_TZ` is valid IANA string; invalid tz logs errors and disables cron.

## Backup & Export

- DB file: `data/valet.db`. Include in nightly backups.
- On-demand full export: run `sqlite3 data/valet.db .dump > backup.sql`.

## Testing

Run the bundled E2E smoke script (see `tests/e2e.md`) after deployments.
