# Project Setup — FunnelFlow (EVENT PLANNER)

## Machine

- OS: Windows 11 Pro, bash shell available (use Unix syntax, forward slashes).
- Working dir: `c:/Users/davee/EVENT PLANNER`
- Node: 20 (Cloud Run container); local Node must be compatible with Next.js 14.2.
- `gcloud` SDK: `C:\Program Files (x86)\Google\Cloud SDK`.
- No local Docker needed — Cloud Build compiles remotely.

## Credentials & Accounts

| Purpose | Reference |
|---------|-----------|
| Admin login (prod & local) | `dave@verifyai.net` |
| SMTP sender | `rma.manager@verifyai.net` — Gmail App Password `FunnelFlow` (created 2026-04-06). Stored in `settings.json` in GCS, **not** env vars. |
| GCP project | `corpmarketer-app` (#678407058536) |
| Cloud Run auth | Default Cloud Run service account already has GCS bucket access. No keys to manage locally. |

## Repo

- GitHub: `POLYMEDIA-USA/EVENT-PLANNER`
- Default branch: `main` (also the PR base).
- Tags are the backup mechanism — `v0.2.0` through `v0.8.2` currently.

## Common Commands

```bash
# Dev server
cd "C:/Users/davee/EVENT PLANNER"
npm run dev

# Production-like local run (after build)
npm run build
node .next/standalone/server.js

# Lint
npm run lint

# Deploy (see DEPLOYMENT_RULES.md for the full checklist)
gcloud config set project corpmarketer-app
gcloud builds submit --tag gcr.io/corpmarketer-app/corpmarketer --project corpmarketer-app
gcloud run deploy corpmarketer --image gcr.io/corpmarketer-app/corpmarketer \
  --region us-central1 --project corpmarketer-app --platform managed \
  --allow-unauthenticated --set-env-vars "GCS_BUCKET=corpmarketer-bucket"
```

## Data Layout (GCS bucket `corpmarketer-bucket`)

All data persistence is JSON files in one bucket. No RDBMS. Access via `src/lib/gcs.js` (5s in-memory cache + in-flight dedup).

- `users.json`, `customers.json`, `events.json`, `event_assignments.json`,
  `interactions.json`, `tasks.json`, `email_logs.json`, `email_templates.json`,
  `audit_log.json`, `organizations.json`, `settings.json`
- `attachments/*` — binary uploads (images, PDFs) with 7-day signed URLs.

Full schema: [TECHNICAL_MANUAL.md](../../TECHNICAL_MANUAL.md) section 17.

## Key Files (for fast orientation)

| File | Purpose |
|------|---------|
| [src/lib/gcs.js](../../src/lib/gcs.js) | Data access layer (read/write + cache) |
| [src/lib/auth.js](../../src/lib/auth.js) | `hashPassword`, token generation, PBKDF2-SHA512 |
| [src/lib/audit.js](../../src/lib/audit.js) | Audit log helper (1000-entry cap) |
| [src/components/AuthProvider.js](../../src/components/AuthProvider.js) | Client-side auth context |
| [src/components/AppShell.js](../../src/components/AppShell.js) | Authed-page layout wrapper |
| [src/components/Sidebar.js](../../src/components/Sidebar.js) | Role-based nav |
| [src/app/page.js](../../src/app/page.js) | Login/register (+ in-progress Forgot Password panel) |
| [TECHNICAL_MANUAL.md](../../TECHNICAL_MANUAL.md) | Developer manual (API ref, schemas, workflows) |
| [DEPLOY.md](../../DEPLOY.md) | Deploy commands |
