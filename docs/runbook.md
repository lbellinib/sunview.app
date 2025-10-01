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
   - `AUTH_SECRET` – random string for JWT signing
   - `HOTEL_TZ` – IANA timezone (e.g., `America/New_York`)
   - `MANAGER_EMAIL` / SMTP_* – configure if daily email is required
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm run start
   ```

The first boot seeds two accounts:
- Agent: **Lino Bellini** (PIN `1234`)
- Manager: **Hotel Manager** (PIN from `MANAGER_PIN` env)

## Daily Operations
- Agents scan the QR code that points to the deployed root URL.
- Login with PIN → tap **Arrival** or **Departure**.
- Offline arrivals queue in the browser and retry every 10s/on reconnect.
- Managers log in, switch to **Admin** tab for exports and open/closed lists.

## Reporting
- Cron runs 23:59 hotel time to email CSV + HTML summary to `MANAGER_EMAIL` when SMTP configured.
- Manual export via Admin tab (`Download CSV` or `View HTML Summary`) for any date.

## Maintenance
- Images stored under `uploads/`. Ensure sufficient disk and configure backup/purge policies as needed.
- Records older than `DATA_RETENTION_DAYS` are purged nightly.
- To rotate agent PINs, update `agents` table using SQLite CLI or extend the API.

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
