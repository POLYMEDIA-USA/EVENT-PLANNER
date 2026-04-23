# FunnelFlow (EVENT PLANNER) — Claude Rules

## Start-of-Session Protocol

1. Read [docs/claude/SESSION_STATE.md](docs/claude/SESSION_STATE.md) — handoff from previous session.
2. Skim [docs/claude/FEEDBACK.md](docs/claude/FEEDBACK.md) and [docs/claude/KNOWN_BUGS.md](docs/claude/KNOWN_BUGS.md).
3. Check `git log --oneline -10` to confirm current version matches SESSION_STATE.
4. The `docs/claude/` directory is the source of truth for cross-session context. Local `.claude/` memory is supplementary — verify against repo files.

## Non-Negotiable Rules

- **Git tags are the backup mechanism.** Every release MUST have a version bump + tag. Un-tagged code cannot be rolled back cleanly.
- **Stale user guides are a bug.** Every release MUST update `public/*-guide.html` and `TECHNICAL_MANUAL.md`.
- **"Backup and document follow the rules"** = execute the full checklist in [docs/claude/DEPLOYMENT_RULES.md](docs/claude/DEPLOYMENT_RULES.md) without pausing between steps.
- **RSVP mutations are POST-only.** Do not regress this — email scanners pre-fetch GET links and caused false declines pre-v0.7.5.
- **Review AI-drafted code for fake imports / invented API names** before committing. See [docs/claude/FEEDBACK.md](docs/claude/FEEDBACK.md).
- **All data lives in GCS JSON files.** There is no database. Access goes through [src/lib/gcs.js](src/lib/gcs.js).

## Verified Baselines (immutable — don't second-guess)

- **v0.8.2** — known-good production state. Live at https://corpmarketer-678407058536.us-central1.run.app. Mobile viewport fix verified on iPhone.
- **v0.7.5** — RSVP POST-confirm model verified to block email-scanner false declines.
- **SMTP fix 2026-04-06** — `rma.manager@verifyai.net` with Gmail App Password `FunnelFlow` is the current working configuration. Stored in `settings.json` in GCS, configured via the Settings page.

## Project Quickref

- **Live URL:** https://corpmarketer-678407058536.us-central1.run.app
- **Admin login:** `dave@verifyai.net`
- **GCP project:** `corpmarketer-app` / bucket `corpmarketer-bucket` / region `us-central1`
- **Deploy commands:** [DEPLOY.md](DEPLOY.md)
- **Developer manual:** [TECHNICAL_MANUAL.md](TECHNICAL_MANUAL.md)
- **User-facing guides:** `public/admin-guide.html`, `public/supervisor-guide.html`, `public/sales-rep-guide.html`, `public/corpmarketer-workflow-guide.html`
