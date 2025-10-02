# E2E Test Script

Manual/scriptable smoke to validate core flows.

## Prereqs

- Server running locally (`npm start`) with `.env` configured (including `CRON_SECRET` for system trigger tests).
- Use seeded agent PIN `1234` unless changed.

## Steps

1. **Login**
   - Navigate to `http://localhost:3000`.
   - Enter PIN `1234`. Expect toast “Signed in”.

2. **Arrival happy path**
   - On Arrival tab, attach sample image (use device camera on mobile).
   - Fill Ticket UID (e.g., `A1001`) and Plate `ABC123`.
   - Submit. Expect success message and toast.

3. **Duplicate ticket validation**
   - Re-submit Arrival with same Ticket UID `A1001`.
   - Expect error `Ticket UID already exists`.

4. **Departure unmatched**
   - Switch to Departure. Search for `ZZZ999`.
   - Expect `No active records` message.

5. **Departure close**
   - Search for `A1001`. Confirm the matching card shows.
   - Tap “Close & release”. Expect duration message + toast.

6. **Admin export** (manager PIN required)
   - Logout → login with manager PIN (default `0000`).
   - Open Admin tab, set date to today.
   - Click “Download CSV” and confirm file downloads.
   - Click “View HTML Summary” and verify summary opens in new window.

7. **Report job**
   - Ensure `.env` contains valid SMTP settings.
   - Call `POST /api/system/reports/daily` with header `x-cron-key: $CRON_SECRET` to trigger an email (verify 200 response and email delivery).
   - Confirm `/api/healthz` returns `status: ok` and `diskWritable: true`.

Document issues with timestamps & console logs.
