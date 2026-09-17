# Session State

## Current Version
- Version: **0.11.0** (tagged `v0.11.0` at commit `5409eac`, pushed to `origin/main`)
- Branch: `main`
- Last session: 2026-09-17

## Deployed To
- Cloud Run `corpmarketer` / project `corpmarketer-app` / region `us-central1`
- Revision: **`corpmarketer-00065-ssx`, 100% traffic — still v0.10.11.**
  **v0.11.0 is tagged and pushed but NOT deployed** (see Active Blockers).
- Live URL: https://corpmarketer-678407058536.us-central1.run.app

## v0.11.0 — VerifyAi sign-in + fleet SSO (code complete, awaiting deploy)

Implements both outstanding Access Portal contracts. Intake record and our replies:
[MESSAGE_FROM_ACCESS-PORTAL.md](MESSAGE_FROM_ACCESS-PORTAL.md),
[MESSAGE_TO_ACCESS-PORTAL.md](MESSAGE_TO_ACCESS-PORTAL.md).

- **`auth_source` per user** — `local` (default, PBKDF2 as before; a missing field means local so no
  data migration) or `verifyai` (no `password_hash`; VerifyAi's auth-api answers yes/no).
  `src/lib/verifyai.js` is a credential oracle only — VerifyAi's HS256 JWT is never stored or
  verified. 503 (not 401) when VerifyAi is unreachable.
- **Self-registration is now VerifyAi-gated** — `POST /api/auth/register` verifies the submitted
  email+password with VerifyAi *before* any write, then auto-creates the account. Per Dave's
  decision relayed 2026-09-10; **no** admin-approval step (that was the open question; the
  documented design stands).
- **Fleet SSO, partial case** — `src/lib/portal-session.js` verifies Portal's `verifyai_session`
  Ed25519 cookie via `createRemoteJWKSet` against `portal.verifyai.net/.well-known/jwks.json`,
  issuer pinned literally. Consumed in exactly one place, `POST /api/auth/portal-session`, which
  exchanges it for an ordinary local bearer token — no other route gained a second auth path.
  **We deliberately skip the forced redirect to Portal** that the other five tools implement: reps
  arrive at live events with no account anywhere and Portal has no self-registration. A Portal
  cookie never auto-provisions an account here.
- **Source-aware Sign Out** — sessions that arrived on a Portal cookie navigate to Portal's
  `/logout?return_to=…`, ending the fleet session; local-login sessions log out locally as before.
- **Break-glass guard** (beyond what the contract asked) — switching a user to VerifyAi credentials
  is refused when it would leave no admin holding a local password. Reset paths refuse VerifyAi
  accounts instead of hashing a password that would never be checked.
- **Admin UI** — Users page Sign-in Method picker, "Managed by VerifyAi" in place of the password
  field, `VerifyAi` tag in table and mobile cards.
- **Docs** — TECHNICAL_MANUAL §3/§5/§8/§17, all four `public/` guides at v0.11.0, **new
  `README.md`** with release notes, **new `.env.example`**, DEPLOYMENT_RULES (automation-SA
  `--account`, a real rollback recipe, specific post-deploy verification).

### What was verified (and what wasn't)

- Portal's live JWKS returns a real Ed25519 document.
- Against a stand-in Portal signing with Portal's documented claim shape: a valid token verifies
  (then correctly falls through as `no_local_account`), an expired token is rejected, and a
  wrong-issuer token is rejected.
- `npm run build` clean; bad-password login still 401; the exchange route answers `no_cookie` with
  no cookie and with a garbage cookie.
- **Not** exercised: the happy path where a verified Portal email matches a real local user. It
  reuses `issueSession()` (same code as password login) and testing it against the prod bucket would
  have minted a live admin session token, so it was left for the post-deploy check.

## Recent Releases## Recent Releases — v0.10.x train

The 0.10 minor introduced Team Attendance + the training/training-fidelity workflow that grew out of HSPA 2026 prep. Patches in order:

- **v0.10.11** (`571c2df`) — Arrival alerts now fire for training leads too, with `[TRAINING]` subject prefix and a purple drill-mode banner. Reps see the full real-event flow during practice; alerts unmistakable from real ones. Email log type splits to `lead_arrival_alert_training`.
- **v0.10.10** (`0a71824`) — New `in_the_room` transient status set by QR scan (replaces the immediate jump to `attended`). Auto-migrates back to `attended` when the lead's event_date is past — lazy trigger from `/api/reports/stats`. New `buildLeadArrivalAlert` email + `sendArrivalAlert` helper in `/api/interactions` POST: notifies the assigned rep + every supervisor in their org by email when a lead is scanned in. Rollups in stats / reports / Check-In Live / post-event treat `in_the_room` as attended for parity. New `src/lib/event-lifecycle.js`. Indigo badge for `in_the_room` across Invited/Reports.
- **v0.10.9** (`ff4ec72`) — Removed the role-scoping on `/api/interactions` GET. Every authenticated user now sees every note on any lead they can open. Reps picking up walk-up attendees see admin's check-in notes from earlier in the day instead of starting blind.
- **v0.10.8** (`96ea127`) — Training-lead auto-confirmation. When a training lead's status flips to `accepted` (admin override on Invited tab OR a real RSVP click on a printed invite), confirmation email is auto-generated, stored, and stamped — no separate "Send Confirm" click needed. Closes the training loop. New shared helpers: `buildConfirmationEmailHTML`, `isTrainingCustomer`, `buildTrainingLogEntry` in `src/lib/email.js`.
- **v0.10.7** (`6eb400b`) — Training emails generated + stored without SMTP send. Detects training leads (is_training=true OR @trainingco.test) before `transporter.sendMail` and skips real delivery while still logging the HTML. Email log entries get `is_training=true` + a `training_note`. Invited-tab preview modal gains a "Print / PDF" button + a purple training-mode banner.
- **v0.10.6** (`09c1155`) — Training-data tools. `+ Generate Training Leads` (admin) seeds 1-100 dummy leads with realistic SPD/healthcare names + `.test` emails, attached to the active event. `↻ Reset for Training` (bulk) clears status, tokens, QR codes, attendance flags, all `last_*_at` timestamps. New `/api/training/generate-leads` and `/api/training/reset-leads` endpoints.
- **v0.10.5** (`b9a2250`) — Admin override of lead status on Invited tab. Status badge becomes a `<select>` for admins, allowing flips through any pipeline stage including the previously-blocked manual `invited`. Training/roleplay reset path.
- **v0.10.4** (`929abcd`) — Team Emails Sent column with click-to-preview, mirroring the Invited tab. `/api/email/log` now exposes team_* logs to supervisors (admin already saw them).
- **v0.10.3** (`903f960`) — Team page gains column sort (Name/Role/Org/Status/RSVP/Check-In) + custom and template email send. New shared email helpers in `src/lib/email.js` (`applyMergeFields`, `buildEventBlock`, `buildRsvpButtons`, etc.). Team-side templates supported via `/api/team/send` with new `kind='custom'` and `kind='template'`.
- **v0.10.2** (`5863f32`) — Reusable email templates wired end-to-end on the lead path. Multi-session auth (user.session_tokens array, FIFO cap 20). Sender-signature textarea on the email panel + `{{sender_name}}` merge field; renders as "Regards, …" block above the footer.
- **v0.10.1** (`974fd10`) — Team section on Check-In Live (Expected/Present/Awaiting/No-Reply + progress bar + present/awaiting lists, admin/supervisor only). Reports mobile fix — per-company stats no longer overlap on phones (3-letter labels under company name on mobile). Privacy + Terms HTML pages (`public/privacy.html`, `public/terms.html`) for the Vonage 10DLC campaign — full carrier-required disclosures, opt-in language, STOP/HELP, retention.
- **v0.10.0** (`2fc9f5e`) — Team Attendance feature. New `user_event_attendance.json` data file, `/api/team/*` route family, public `/team-rsvp` page, scanner integration with shared QR namespace, Reports → Team tab, Vonage SMS RSVP path.

## Vonage 10DLC status (in flight)

- Brand `VerifyAi` (BAMLKAT) verified — Parametrik Holdings LLC, EIN 82-3942862, Fort Lauderdale.
- 10DLC campaign submission: paperwork drafted ([VONAGE_10DLC_CAMPAIGN_ANSWERS.md](VONAGE_10DLC_CAMPAIGN_ANSWERS.md)), needs Dave to fund the wallet and re-run the form. Privacy/Terms now hosted at https://verifyai.net/privacy and https://verifyai.net/terms (other Claude session ported them from the FunnelFlow stopgap).
- SMS sends via `/api/team/sms` will return Vonage status=0 (success) but US carriers silently drop until campaign is approved. Backend code is correct; this is purely the carrier-paperwork gate.

## SMTP

- Live config: `rma.manager@verifyai.net` via `smtp.gmail.com:587`. App Password regenerated 2026-04-25 after a Workspace admin password reset on the managed account invalidated the prior credential. Dave saved the new App Password via Settings → SMTP Password.
- Pattern: any time `rma.manager`'s account password changes, every existing App Password is revoked. Regenerate at https://myaccount.google.com/apppasswords (signed in as rma.manager) and paste fresh.

## Local-dev quirks

- `GCS_BUCKET=corpmarketer-bucket npm run dev` — without the env var, dev uses default `event-planner-bucket` which has billing disabled (403 on every read). Cloud Run sets it via `--set-env-vars`; local doesn't.
- Multi-session auth is in (v0.10.2) so phone+laptop+browser-tabs no longer kick each other out. If a "Failed to save settings" 403 ever recurs, sign out/in once and retry — that path is rare now but possible during the legacy → array migration window.

## Active Blockers

1. **Deploy of v0.11.0 is blocked on GCP credentials.** Both paths are dead on this machine right now:
   - Automation SA (`claude-automation@rma-manager-489912.iam.gserviceaccount.com`):
     `gcloud builds submit` fails with `forbidden from accessing the bucket
     [corpmarketer-app_cloudbuild]`, and a probe shows it has **no** grants at all on
     `corpmarketer-app` — `gcloud run services describe` also returns `PERMISSION_DENIED` on
     `run.services.get`. RMA-MANAGER's 2026-08-23 message claimed the 5 deploy roles were granted
     here; they are not. (Its `roles/storage.admin` is likewise absent — reading
     `gs://corpmarketer-bucket/*.json` as the SA 403s.)
   - `dave@parametrik.net`: needs an interactive `gcloud auth login` (the Workspace session-control
     reauth the SA was supposed to eliminate). Cannot be done headlessly.
   - No local Docker either, so a build-and-push around Cloud Build is not available.

   **Fix, either one:** (a) Dave runs `gcloud auth login` once, then the SA is onboarded properly
   with the 5-role loop from global `~/.claude/CLAUDE.md` §8 (plus `roles/serviceusage.serviceUsageConsumer`,
   which the documented loop omits and which is what the bucket error is actually about), or
   (b) grant those roles from the Cloud Console on another machine.

2. **`events.verifyai.net` domain mapping is not created.** Needs
   `gcloud beta run domain-mappings create --service corpmarketer --domain events.verifyai.net
   --project corpmarketer-app --region us-central1` as `dave@parametrik.net` (DNS/cert changes run as
   Dave — `verifyai.net` is verified under his account, not the SA), then the returned CNAME added in
   Squarespace DNS. **Fleet SSO stays inert until this lands**, because Portal's cookie is
   `Domain=verifyai.net` and is never sent to a `*.run.app` origin. The VerifyAi password login and
   gated registration in v0.11.0 work on the current URL without it.

3. **Vonage 10DLC campaign**: unchanged — blocked on Dave funding the wallet and resubmitting.

## Post-deploy checklist for v0.11.0 (do this the moment the deploy lands)

```bash
BASE=https://corpmarketer-678407058536.us-central1.run.app
# 1. the new exchange route is live and rejects a cookie-less request
curl -s -X POST $BASE/api/auth/portal-session
#    expect {"error":"No Portal session","reason":"no_cookie"}
# 2. registration really reaches VerifyAi's auth-api (proves the oracle wiring end to end)
curl -s -X POST $BASE/api/auth/register -H "Content-Type: application/json" \
  -d '{"full_name":"T","email":"nobody@example.com","password":"x","organization_name":"T"}'
#    expect 401 "Those VerifyAi credentials were not accepted..."
# 3. existing local login still works — sign in as dave@verifyai.net in the browser
```
Then record the new revision id here, and add the v0.11.0 baseline to root `CLAUDE.md` (deliberately
**not** added yet — nothing is a verified baseline until it is live).

## Active work / not yet done

- **Vonage 10DLC campaign**: blocked on Dave funding + resubmitting. All copy answers are saved in [VONAGE_10DLC_CAMPAIGN_ANSWERS.md](VONAGE_10DLC_CAMPAIGN_ANSWERS.md).
- **HSPA 2026 training (Monday April 27)**: training tools (v0.10.6 generate, v0.10.7 simulate, v0.10.8 auto-confirm, v0.10.10 in_the_room/alerts, v0.10.11 training-tagged alerts) are all live. Roleplay scripts mentioned in the suggestions list have not been written yet.

## Next session quick-start

**First: is v0.11.0 deployed?** `gcloud run revisions list --service=corpmarketer
--region=us-central1 --project=corpmarketer-app --limit=3`. If the live revision is still
`corpmarketer-00065-ssx`, the Active Blockers above are still current and the deploy is the first
task. If it has moved, run the post-deploy checklist above and update this file.

If Dave reports a Settings save 403 → recommend sign-out/in (multi-session edge case, not a bug).
If Dave reports SMTP failures with `535-5.7.8` → App Password regen on `rma.manager`.
If Dave reports SMS fails → Vonage 10DLC campaign approval (out-of-band).
For training-related asks → v0.10.6-v0.10.11 are all in production, work end-to-end.
