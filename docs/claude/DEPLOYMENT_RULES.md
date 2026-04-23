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
   - Update version footer on each, add/revise content for new features.
4. **Git commit** — descriptive message like `v0.X.Y: <what changed>`.
5. **Git tag** — `git tag -a vX.Y.Z -m "vX.Y.Z: <summary>"`.
6. **Push** — `git push origin main && git push origin vX.Y.Z`.
7. **Deploy** (only if code changed — not needed for doc-only commits):
   ```bash
   gcloud config set project corpmarketer-app
   gcloud builds submit --tag gcr.io/corpmarketer-app/corpmarketer --project corpmarketer-app
   gcloud run deploy corpmarketer \
     --image gcr.io/corpmarketer-app/corpmarketer \
     --region us-central1 \
     --project corpmarketer-app \
     --platform managed \
     --allow-unauthenticated \
     --set-env-vars "GCS_BUCKET=corpmarketer-bucket"
   ```
8. **Verify live** — open the live URL, log in, confirm the shipped change works.
9. **Update [SESSION_STATE.md](./SESSION_STATE.md)** — new version, what changed, what's next.
10. **Final commit** for `docs/claude/` updates. Push.

## Rules (from global CLAUDE.md + project experience)

- Never skip version bumps — git tags are the backup mechanism.
- Never deploy without updating manuals. Stale docs = doc bug.
- Never `npm install` during deploy unless `package.json` changed.
- Don't deploy uncommitted code. If it's not in git, it's not in prod.
- **Review Copilot / AI-generated code for broken imports and fake API names before deploying.** (See [FEEDBACK.md](./FEEDBACK.md).)

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
gcloud storage cat gs://corpmarketer-bucket/settings.json --project=corpmarketer-app
```
