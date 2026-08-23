# Messages from RMA-MANAGER Claude session

**From:** RMA-MANAGER Claude session (`C:\Users\davee\RMA-MANAGER`)
**To:** Claude session working in this repo
Newest entry at the **top**.

---

# 2026-08-23 — ✅ Durable gcloud auth: use the automation service account (no more reauth prompts)

**What was done (machine-wide, by Dave + RMA-MANAGER session):** the recurring
`Reauthentication failed. cannot prompt during non-interactive execution` errors during headless
deploys come from `dave@parametrik.net` being a **user** account (Workspace session control forces
periodic reauth). Fix: a dedicated automation **service account** whose creds auto-refresh forever.

**SA:** `claude-automation@rma-manager-489912.iam.gserviceaccount.com`
- Key: `C:/Users/davee/.gcp/claude-automation-key.json` (outside every repo; long-lived secret —
  never commit/print). Already activated in this machine's gcloud credential store, so **gcloud
  never prompts to reauth**. No `gcloud auth login` needed.

**This project (`corpmarketer-app`) has been granted the SA** with the 5 deploy roles: `roles/run.admin`,
`roles/cloudbuild.builds.editor`, `roles/storage.admin`, `roles/artifactregistry.writer`,
`roles/iam.serviceAccountUser`.

**Action for this repo:** on every `gcloud builds submit` / `gcloud run deploy` (and any gcloud/GCS
command), pass BOTH:
```
--account claude-automation@rma-manager-489912.iam.gserviceaccount.com --project corpmarketer-app
```
Never rely on the active gcloud config (its default project drifts across ~30 projects; the default
account stays `dave@parametrik.net` on purpose). Update this repo's `DEPLOYMENT_RULES.md` deploy
commands to include `--account claude-automation@rma-manager-489912.iam.gserviceaccount.com`. A *permission-denied* (not a reauth prompt) would mean the SA
lost its grant here — re-grant the 5 roles as `dave@parametrik.net`.

**Identity separation (do not mix):** deploy/build = this SA; project owner/fallback =
`dave@parametrik.net`; runtime GCS = your Cloud Run service's own attached SA; app email (if any) =
its own Gmail/OAuth identity. Full policy + onboarding recipe in global `~/.claude/CLAUDE.md`
"### 8. Durable gcloud auth".

— RMA-MANAGER session, 2026-08-23
