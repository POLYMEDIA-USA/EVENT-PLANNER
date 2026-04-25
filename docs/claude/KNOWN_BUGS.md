# Known Bugs & Open Items — FunnelFlow

## Open Items

_None currently tracked as bugs._

## Pending External / Out-of-band

- **Vonage 10DLC campaign approval** — gate on US-carrier SMS delivery. Brand `VerifyAi` (BAMLKAT) verified, campaign submission paperwork is drafted in [VONAGE_10DLC_CAMPAIGN_ANSWERS.md](./VONAGE_10DLC_CAMPAIGN_ANSWERS.md), Privacy + Terms pages live at https://verifyai.net/privacy and https://verifyai.net/terms. Dave needs to fund the wallet (auto-reload at $5 trigger / $20-50 reload), wait for spending limit raise from support, then re-run the campaign form. Until approved, `/api/team/sms` returns Vonage status=0 success but US carriers silently drop the message.

## Recurring patterns

- **SMTP `535-5.7.8` Gmail rejection** — happens whenever the `rma.manager@verifyai.net` account password is changed. App Passwords are tied to the account password and revoked on every reset. Fix: regenerate at https://myaccount.google.com/apppasswords (signed in as rma.manager) → paste fresh 16-char code into FunnelFlow Settings → SMTP Password → Save. Last occurrence 2026-04-25 after a Workspace admin password reset by `dave@verifyai.net`.

- **"Failed to save settings" 403** — was a stale-session-token issue (single-token-per-user model kicked out earlier sessions on every login). Fixed in v0.10.2 by switching `user.session_token` → `user.session_tokens` array (FIFO, cap 20). If it ever recurs during the legacy → array migration window, sign out and back in once.

## Recently Closed (for context, not action)

- **v0.10.x train** (April 23-25 2026) — full Team Attendance feature + training/event-fidelity stack for HSPA 2026 prep. See [SESSION_STATE.md](./SESSION_STATE.md) for the per-version rundown.
- **v0.9.0 → v0.9.3** — password reset, role-wide dashboard/reports/check-in, walk-in check-ins, inert email preview, two-column Interactions, sales-rep self-claim of unassigned leads, QR auto-gen for manually-accepted leads + resend-confirmation, supervisor-assigned leads counted in reports rollup, Approved-to-Invite sends invitation email directly.
- **v0.7.5** — RSVP false declines from email scanners. Fixed by moving RSVP mutation from GET to POST-with-confirm-button. Don't regress this.
- **2026-04-06 SMTP outage** — Gmail rejected the old password with `535 BadCredentials`. Fixed by generating a new Google App Password on `rma.manager@verifyai.net`.
