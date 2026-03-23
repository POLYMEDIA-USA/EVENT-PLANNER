# EVENT PLANNER (CorpMarketer) — Deployment Instructions

## Production Details

| Field | Value |
|-------|-------|
| **GCP Project ID** | `corpmarketer-app` |
| **GCP Project Number** | `678407058536` |
| **Cloud Run Service** | `corpmarketer` |
| **Region** | `us-central1` |
| **Container Image** | `gcr.io/corpmarketer-app/corpmarketer` |
| **GCS Bucket** | `corpmarketer-bucket` |
| **Live URL** | https://corpmarketer-678407058536.us-central1.run.app |

## Quick Deploy (copy-paste)

No local Docker required. Cloud Build compiles remotely.

```bash
# 1. Set project
gcloud config set project corpmarketer-app

# 2. Build container in the cloud (from the EVENT PLANNER directory)
cd "C:/Users/davee/EVENT PLANNER"
gcloud builds submit --tag gcr.io/corpmarketer-app/corpmarketer --project corpmarketer-app

# 3. Deploy to Cloud Run
gcloud run deploy corpmarketer \
  --image gcr.io/corpmarketer-app/corpmarketer \
  --region us-central1 \
  --project corpmarketer-app \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "GCS_BUCKET=corpmarketer-bucket"
```

The service URL will be printed at the end:
`https://corpmarketer-678407058536.us-central1.run.app`

## Prerequisites

- Google Cloud SDK installed (`gcloud`) — already at `C:\Program Files (x86)\Google\Cloud SDK`
- Cloud Run API and Cloud Build API enabled (already done)
- Default Cloud Run service account has GCS access (already configured)
- No Docker needed locally — Cloud Build handles it

## Environment Variables

| Variable | Value | Notes |
|----------|-------|-------|
| `GCS_BUCKET` | `corpmarketer-bucket` | Set via Cloud Run env vars |
| SMTP settings | stored in `settings.json` in GCS | Configured via app Settings page, not env vars |

## GCS Data Files

The app reads/writes these JSON files in the `corpmarketer-bucket` bucket:

- `users.json`
- `organizations.json`
- `events.json`
- `customers.json`
- `event_assignments.json`
- `interactions.json`
- `settings.json` (includes SMTP config, app_url, company branding)
- `email_logs.json`

## Local Development

```bash
cd "C:/Users/davee/EVENT PLANNER"
npm ci
npm run dev
```

For production-like local testing:
```bash
npm run build
node .next/standalone/server.js
```

## Verify After Deploy

Open the live URL and check:

- Login page loads
- `/api/settings/users` returns user list (needs admin Bearer token)
- `/api/email/send-users` accepts POST with `{ user_ids, subject, message }`
- `/api/leads/import` handles CSV/XLSX file uploads

## Troubleshooting

- **Check Cloud Run logs:** `gcloud logs read --service=corpmarketer --project=corpmarketer-app --limit=50`
- **Check build logs:** `gcloud builds list --project=corpmarketer-app --limit=5`
- **Redeploy same image:** Just run step 3 above (skips rebuild)
- **Force fresh build:** Run steps 2 and 3
