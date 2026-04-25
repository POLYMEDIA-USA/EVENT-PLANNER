# Approved & In-Progress Plans — FunnelFlow

## In Flight

### Vonage 10DLC campaign submission
- **Status**: paperwork ready, blocked on Dave funding the wallet + getting the daily spending limit raised by Vonage support.
- **All form answers**: [VONAGE_10DLC_CAMPAIGN_ANSWERS.md](./VONAGE_10DLC_CAMPAIGN_ANSWERS.md)
- **Privacy/Terms URLs**: https://verifyai.net/privacy and https://verifyai.net/terms (live).
- **Brand**: VerifyAi / BAMLKAT verified.

## HSPA 2026 training (Monday April 27)

### Done in production
- Generate Training Leads (admin button, Leads page) — 1-100 dummy leads, realistic SPD names, `.test` emails.
- Reset for Training (bulk action, Leads page) — clears status/tokens/QR/timestamps.
- Training email simulation — invitations and confirmations generate full HTML, store to email_logs, skip SMTP. Print/PDF button on the Invited-tab preview modal for scan-practice.
- Training auto-confirm — admin status-flip to accepted (or RSVP click on a printed invite) auto-generates the confirmation email with QR.
- Training arrival alerts — when a training lead is QR-scanned, the assigned rep + supervisor still get the alert email, tagged `[TRAINING]` in subject and with a purple drill banner in the body.
- in_the_room status — QR scan flips to `in_the_room` (indigo) instead of `attended` (purple). Auto-migrates to attended after event_date passes.

### Suggested but not built
- **Roleplay scripts** — written exercises for trainees (e.g. "Mark Kambeitz walks up — find him, log interaction, scan QR, log note in 90s"). Could be a static `/training-scenarios.html` page.
- **In-app guided tour** for first-time users (intro.js or similar).
- **Onboarding checklist** with "first 5 things to do" per role.
- **Per-role print cheat sheet** PDF.
- **Audit-log filter by trainee** — already possible if the Audit Log page is exposed; just need a user filter.

These are all backlog. Mention to Dave when context fits; don't proactively build.

## Backlog (not started, not promised)

- Custom domain mapping for FunnelFlow → e.g. `app.verifyai.net` (or `verifyai.net/funnel`) so the URLs in invitation emails match the brand.
- Cron-based migration trigger for `in_the_room → attended` (currently lazy on stats fetch). Would need GCP Cloud Scheduler + a webhook.
- Event `event_end_time` field — current closure rule is "event_date < today". Specifying a real end time would let same-day migration work.
- Workspace SMTP relay setup as a fallback for App Password churn (admin-side: admin.google.com → Apps → Gmail → SMTP relay service).
- Optional `is_training` filter on production reports so training data doesn't pollute when trainings overlap with prod use.
