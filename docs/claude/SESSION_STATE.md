# Session State

## Current Version
- Version: **0.10.0** (tagged `v0.10.0` at commit `2fc9f5e`)
- Branch: `main`, pushed to `origin/main`
- Last session: 2026-04-23

## Deployed To
- Cloud Run `corpmarketer` / project `corpmarketer-app` / region `us-central1`
- Revision: `corpmarketer-00054-56g`, 100% traffic
- Live URL: https://corpmarketer-678407058536.us-central1.run.app

## Recent Releases
- **v0.10.0** (`2fc9f5e`) — Team Attendance feature. New `user_event_attendance.json` data file. Full flow: invite users to work an event, send email or SMS RSVP links, auto-mint QR codes on confirmation, scan at the event to flip status → present. Integrated into Scanner (shared QR namespace), Reports (new Team tab), Sidebar (Team link). Also added manual status override, per-row resend confirmation, name-search, and Vonage SMS path. Ships as a **minor** release because it's new feature surface.
- **v0.9.3** (`2350dfd`) — QR auto-gen for manually-accepted leads + per-row Resend Confirmation button.
- **v0.9.2** (`da5ab48`) — Approved-to-Invite now sends invitation email directly (token auto-generated).
- **v0.9.1** (`5aa0a27`) — Reports org rollup counts supervisor-assigned leads.
- **v0.9.0** (`00222d4`) — Password reset, role-wide dashboard/reports, walk-in check-ins, inert email preview, two-column Interactions, sales-rep self-claim.

## Team Attendance quick reference
- Data: `user_event_attendance.json` in GCS. Keyed by `(user_id, event_id)`.
- Statuses: `pending` → `invited` → `confirmed` / `declined` → `present`.
- QR codes live in a shared namespace with customer codes — `generateUniqueQRCode` in `src/lib/auth.js` accepts multiple lists.
- Scanner lookup order: customers first, then team attendance. Team scans return `kind='team'` from `/api/interactions` POST.
- SMS invites use existing Vonage config (`vonage_api_key`/`vonage_api_secret`/`vonage_from_number` in settings).
- New API routes under `/api/team/*`: `attendance`, `rsvp` (public), `send` (email), `sms`.
- Public RSVP page: `/team-rsvp?token=...` (Suspense-wrapped, POST-confirm pattern).

## What Was Done Last Session (v0.9.0 shipped)

### Major features
- **Password reset end-to-end**: `/api/auth/forgot-password`, `/api/auth/reset-password`, public `/reset-password` page, "Forgot Password?" link on login. 16-byte base64url token, 1-hour expiry, clears `session_token` on successful reset so other sessions are kicked out.
- **Dashboard**: new "Accepted" stat card; Pipeline Funnel (relabeled "Event Overview" for reps/supervisors) visible to all roles — the admin/supervisor duplicates were collapsed into a single universal block above the role-specific sections.
- **Leads**: sales reps now see unassigned leads in their list; new teal "Claim Selected" bulk button self-assigns them. Backend permits self-claim on unassigned leads.
- **Reports exposed to sales reps**: sidebar link added; admin/supervisor-only guard removed; Post-Event tab hidden for reps. Added "Accepted" column to the org-overview row — "Invited" now means only `status='invited'` (was lumping accepted together).
- **Email log API**: exposed to sales reps and supervisors with customer-visibility scoping (reps see only emails for their own/assigned customers).
- **Interactions — two-column layout**: "My Customers" (role-scoped) and "At Event" (all attendees, event-scoped). Any user can now log notes on walk-up attendees without them being assigned.
- **Check-In Live**: exposed to sales reps; split into "Event Progress" (everyone, event-wide) and "My Leads at this Event" (role-scoped, hidden for admins since it would be redundant).
- **Invited tab — clickable email previews**: email-type badges now open an inert popup modal showing exactly what was sent. Amber banner warns "Preview only — links and buttons are disabled"; `pointer-events: none` on all `<a>`/`<button>`/`<input>`/`<form>` inside the preview.
- **Scanner — Last-Moment Adds (admin only)**: walk-in form (first/last/organization/email) that creates the lead and checks them in via a `qr_scan` interaction in one flow.

### API additions
- `/api/leads?scope=attended` — all attendees event-wide, any role. Used by Interactions page.
- `/api/leads?scope=event` — all customers at an event, any role. Used by Check-In Live for shared event stats.

### Schema
- `users.json` gained `reset_token` and `reset_token_expires` fields.

### Docs
- `TECHNICAL_MANUAL.md` bumped to v0.9.0, new endpoints and schema fields documented.
- `public/admin-guide.html`, `public/supervisor-guide.html`, `public/sales-rep-guide.html` all got a "What's New in v0.9.0" callout and v0.9.0 footer.

## What's Next
No planned work. Release is shipped, verified, and clean.

## Active Blockers
None.

## Local Dev Notes
- Local dev requires `GCS_BUCKET=corpmarketer-bucket npm run dev` — without the env var the app defaults to `event-planner-bucket` (wrong project / billing disabled). Cloud Run sets the var automatically via `--set-env-vars`.
- If the dev server leaves a zombie on port 3000, kill it with the PowerShell `Get-NetTCPConnection` one-liner before restarting.
