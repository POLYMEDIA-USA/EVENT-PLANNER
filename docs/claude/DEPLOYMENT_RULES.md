# Deployment Rules — FunnelFlow (EVENT PLANNER)

Authoritative deploy commands live in [DEPLOY.md](../../DEPLOY.md). This file is the **checklist** — use it every time code ships to production.

## Infrastructure Snapshot

| Field | Value |
|-------|-------|
| GCP Project | `corpmarketer-app` (#678407058536) |
| Cloud Run Service | `corpmarketer` |
| Region | `us-central1` |
| Container Image | `gcr.io/corpmarketer-app/corpmarketer` |
| GCS Bucket | `corpmarketer-bucket` |
| Live URL | https://corpmarketer-678407058536.us-central1.run.app |
| Min instances | 1 (no cold starts) |

## "Backup and document — follow the rules" Checklist

Dave's shorthand for a full release. Execute every step in order. Do NOT pause between steps to ask permission.

1. **Bump version** in `package.json`
   - Patch (`0.8.2 → 0.8.3`) for bug fixes / small UX tweaks
   - Minor (`0.8.x → 0.9.0`) for new features
2. **Update `TECHNICAL_MANUAL.md`** — API reference (section 8), data schema (section 17), and any affected sections. Bump its header `**App Version:**` and `**Last Updated:**`.
3. **Update user guides** in `public/`:
   - `admin-guide.html`
   - `supervisor-guide.html`
   - `sales-rep-guide.html`
   - `corpmarketer-workflow-guide.html`
   - Update version footer on each, add/revise content for new features. Bump the footer even on a
     release that doesn't touch that guide's content — an operator cross-checking the in-app
     version against a stale footer reads the guide as wrong.
   - **Add a release-notes entry to [README.md](../../README.md)** in the existing
     BUGFIX / IMPROVEMENT / SECURITY / NOTE format. Newest first.
4. **Git commit** — descriptive message like `v0.X.Y: <what changed>`.
5. **Git tag** — `git tag -a vX.Y.Z -m "vX.Y.Z: <summary>"`.
6. **Push** — `git push origin main && git push origin vX.Y.Z`.
7. **Deploy** (only if code changed — not needed for doc-only commits):
   ```bash
   SA=claude-automation@rma-manager-489912.iam.gserviceaccount.com
   gcloud builds submit --tag gcr.io/corpmarketer-app/corpmarketer \
     --project corpmarketer-app --account $SA
   gcloud run deploy corpmarketer \
     --image gcr.io/corpmarketer-app/corpmarketer \
     --region us-central1 \
     --project corpmarketer-app \
     --account $SA \
     --platform managed \
     --allow-unauthenticated \
     --set-env-vars "GCS_BUCKET=corpmarketer-bucket"
   ```
   A successful `builds submit` as the SA still ends with an error about streaming logs (it lacks
   project Viewer). The build is running anyway: poll
   `gcloud builds describe <build-id> --project corpmarketer-app --account $SA
   --format="value(status)"` until SUCCESS rather than trusting the exit code.

   **Always pass `--account` and `--project` explicitly.** `dave@parametrik.net` is a Workspace
   *user* account whose session control forces periodic reauth, which in a headless session fails
   with `Reauthentication failed. cannot prompt during non-interactive execution`. The automation
   service account's credentials refresh forever and never prompt. Its key lives at
   `C:/Users/davee/.gcp/claude-automation-key.json` (never commit or print it) and it is already
   granted six roles on `corpmarketer-app` (2026-09-17): the documented five plus
   `roles/serviceusage.serviceUsageConsumer`, without which `builds submit` fails with a misleading
   `forbidden from accessing the bucket [corpmarketer-app_cloudbuild]`. Never rely on the active gcloud config — its
   default project drifts across ~30 projects, and the default account stays `dave@parametrik.net`
   on purpose. A *permission-denied* (as opposed to a reauth prompt) means the SA lost a grant here;
   re-grant as `dave@parametrik.net`. See global `~/.claude/CLAUDE.md` section 8.

   `--set-env-vars` **replaces** the full env var set, so `GCS_BUCKET` is the only one listed on
   purpose: `VERIFYAI_AUTH_API_URL` and `PORTAL_BASE_URL` have production defaults in code and are
   only ever set to point at staging.

   DNS, domain-mapping and TLS-certificate changes (e.g. mapping `events.verifyai.net`) are **not**
   part of this checklist — `verifyai.net` is verified under `dave@parametrik.net`, so those run
   as Dave, not the SA, and the CNAME is added by hand in Squarespace DNS.
8. **Verify live** — not "the site loads." Name the live revision id, and hit the specific
   thing that changed with a real request, quoting the real response. Examples for auth changes:
   ```bash
   # the SSO exchange route is live and rejects a request carrying no Portal cookie.
   # Content-Length: 0 is required -- a bodyless POST otherwise gets a 411 from Google's frontend
   # before it reaches the app. Browsers set it themselves.
   curl -s -X POST -H "Content-Length: 0" \
     https://corpmarketer-678407058536.us-central1.run.app/api/auth/portal-session
   # -> {"error":"No Portal session","reason":"no_cookie"}

   # VerifyAi-gated registration really reaches VerifyAi's auth-api
   curl -s -X POST https://corpmarketer-678407058536.us-central1.run.app/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"full_name":"T","email":"nobody@example.com","password":"x","organization_name":"T"}'
   # -> 401 "Those VerifyAi credentials were not accepted..."
   ```
9. **Update [SESSION_STATE.md](./SESSION_STATE.md)** — new version, what changed, what's next.
10. **Final commit** for `docs/claude/` updates. Push.

## Rules (from global CLAUDE.md + project experience)

- Never skip version bumps — git tags are the backup mechanism.
- Never deploy without updating manuals. Stale docs = doc bug.
- Never `npm install` during deploy unless `package.json` changed.
- Don't deploy uncommitted code. If it's not in git, it's not in prod.
- **Review Copilot / AI-generated code for broken imports and fake API names before deploying.** (See [FEEDBACK.md](./FEEDBACK.md).)

## Rollback

Tags are the backup mechanism. Two options, fastest first.

**Option A — retarget traffic to the previous revision (no rebuild, seconds):**
```bash
SA=claude-automation@rma-manager-489912.iam.gserviceaccount.com
gcloud run revisions list --service=corpmarketer --region=us-central1 \
  --project=corpmarketer-app --account $SA --limit=5
gcloud run services update-traffic corpmarketer \
  --to-revisions=<previous-revision>=100 \
  --region=us-central1 --project=corpmarketer-app --account $SA
```
Every release's SESSION_STATE.md entry records the live revision id specifically so this is a
copy-paste rather than a hunt through `gcloud run revisions list`.

**Option B — rebuild from the tag (when the bad revision has already been cleaned up):**
```bash
git checkout vX.Y.Z
# run step 7's build + deploy commands as-is
git checkout main
```

## Verify-Only Commands (no side effects)

```bash
# Current active Cloud Run revision
gcloud run revisions list --service=corpmarketer --region=us-central1 \
  --project=corpmarketer-app --limit=5

# Last 50 log lines
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=corpmarketer" \
  --project=corpmarketer-app --limit=50 --format="text"

# Last 5 builds
gcloud builds list --project=corpmarketer-app --limit=5

# Read a data file directly (useful for debugging prod state)
gcloud storage cat gs://corpmarketer-bucket/settings.json --project=corpmarketer-app \
  --account claude-automation@rma-manager-489912.iam.gserviceaccount.com
```
