# Session State

## Current Version
- Version: **0.11.1** (tagged `v0.11.1` at commit `d8cae94`, pushed to `origin/main`)
- Branch: `main`
- Last session: 2026-09-19

## Deployed To
- Cloud Run `corpmarketer` / project `corpmarketer-app` / region `us-central1`
- Revision: **`corpmarketer-00068-467`, 100% traffic** (v0.11.1, deployed 2026-09-19).
  Rollback target: `corpmarketer-00067-bk2` (v0.11.0).
- Build: `f4fc8881-b757-4109-938d-8c766b6ed9fa` (SUCCESS)
- Live URL: https://events.verifyai.net (SSO works here) and
  https://corpmarketer-678407058536.us-central1.run.app (no SSO — the `Domain=verifyai.net`
  cookie never reaches a `*.run.app` origin)

## v0.11.1 — SSO identity link (2026-09-19)

Reported by the Access Portal session: `domp@verifyai.net` could not sign in to FunnelFlow from
Portal. Confirmed against the code and the live `users.json` — his account is
`domp@parametrik.net` (admin, local password, created 2026-03-16, no `verifyai_email`), and the
SSO exchange matched Portal's identity on `email` only.

- `POST /api/auth/portal-session` now matches `email` first, then falls back to `verifyai_email`.
- `verifyai_email` is settable on a **local-password** account. Portal's suggested fix was to set
  it through the existing PUT, but that only worked inside the `auth_source==='verifyai'` branch,
  which deletes `password_hash` — linking an identity would have silently cost an admin his
  local password and made him dependent on VerifyAi being up. It is an identity link, not a
  credential, so it is now independent of `auth_source`; switching back to `local` keeps it.
- New uniqueness guard: 409 if a `verifyai_email` is already another account's `email` or
  `verifyai_email` (two matches would resolve by array order).
- Users page has a **VerifyAi Email** field in both sign-in modes.

Verified live on `corpmarketer-00068-467`: `GET /` 200; exchange with no cookie still
`no_cookie`; wrong-password login still 401; `PUT /api/settings/users` unauthenticated still 403.
Match logic unit-checked against fixtures (link-only match resolves, an exact account email beats
someone else's link, primary path unchanged, unknown stays null).

**Open, needs Dave:** set `verifyai_email: domp@verifyai.net` on
`6586f375-0aaf-4b78-b7b7-db900b003abc` — one field on the Users page, or say the word and this
session will PUT it. Deliberately not done from a peer session's request: it is production user
data. Until it is set, domp still signs in with his FunnelFlow password as before; SSO is what is
blocked, not his access.

### v0.11.0 live verification (2026-09-17, against `corpmarketer-00067-bk2`)

```
POST /api/auth/portal-session (no cookie)        -> 401 {"error":"No Portal session","reason":"no_cookie"}
POST /api/auth/portal-session (garbage cookie)   -> 401 same
POST /api/auth/portal-session (forged-signature
     token with the correct claim shape/issuer)  -> 401 same   <- signature verification really runs
POST /api/auth/register (bogus VerifyAi creds)   -> 401 "Those VerifyAi credentials were not
                                                    accepted..."  <- oracle wiring proven end to end
POST /api/auth/login (wrong password)            -> 401 "Invalid email or password"
GET  /                                           -> 200
```

Gotcha for next time: `curl -X POST` with no body gets a **411 Length Required** from Google's
frontend before it ever reaches the app. Pass `-H "Content-Length: 0"`. Browsers set that header
themselves, so the real client path is unaffected.

Still unexercised: the happy path where a verified Portal email matches a local user. It needs a
real Portal cookie, which requires the `events.verifyai.net` mapping below.

## v0.11.0 — VerifyAi sign-in + fleet SSO (live)

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

### What was verified, and by whom

- Portal's live JWKS returns a real Ed25519 document.
- Against a stand-in Portal signing with Portal's documented claim shape: a valid token verifies, an
  expired token is rejected, and a wrong-issuer token is rejected.
- Live on `corpmarketer-00067-bk2`, both origins: `no_cookie` for absent, garbage and
  forged-signature cookies; gated registration refused by VerifyAi's auth-api; password login
  unchanged. Full transcript in the block above.
- **The happy path is closed too.** The Access Portal session POSTed a fresh real `verifyai_session`
  cookie to `https://events.verifyai.net/api/auth/portal-session` and got **200 `sso:true`, matched
  to `dave@verifyai.net`'s real admin account** (confirmed structurally, token not printed). That is
  a peer session's observation, not this one's: a 200 there mints a live admin session token, which
  is why this session deliberately did not make that call from a headless context.
- **So v0.11.0 has no unverified paths.**

## Recent Releases — v0.10.x train

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

1. **Vonage 10DLC campaign** — the only genuinely open item on this project. Blocked on Dave funding
   the Vonage wallet and re-running the submission; all copy answers are saved in
   [VONAGE_10DLC_CAMPAIGN_ANSWERS.md](VONAGE_10DLC_CAMPAIGN_ANSWERS.md). Until the campaign is
   approved, `/api/team/sms` returns Vonage status=0 (success) while US carriers silently drop the
   message. The code is correct; this is purely a carrier-paperwork gate.

**Closed this session:** `events.verifyai.net` (mapped by Dave, CNAME propagated, cert issued ~26
min later, `Ready` / `CertificateProvisioned` / `DomainRoutable` all `True`) and the deploy
credential blocker (see below). Fleet SSO is live, not pending.

## Automation-SA grant probe across the fleet (measured 2026-09-19)

RMA-MANAGER's SESSION_STATE claims **ALL** GCP-deploying repos were granted the automation SA on
2026-08-23. `corpmarketer-app` was on that list and had zero bindings (found 2026-09-17), so the
whole list was worth measuring. Two read-only probes per project, as the SA:

| Project | Cloud Run access | `serviceusage` (proxy for `builds submit`) |
|---|---|---|
| rma-manager-489912 | ok | **missing** |
| verifyai-access-portal | ok | ok |
| anydesk-manager-app | ok | **missing** |
| verifyai-backoffice | ok | **missing** |
| contract-manager-pmd | ok | **missing** |
| corpmarketer-app | ok | ok (granted by this repo 2026-09-17) |
| verifyai-onboarding-tracker | ok | ok |
| parametrik-website | **NOT GRANTED** | n/a |
| verifyai-propose-close | ok | **missing** |
| v2-webapp (TEST2-WEB) | ok | **missing** |
| verifyai-website | ok | ok |

**Limits of this measurement, stated rather than glossed:** `gcloud services list` needs
`serviceusage.services.list`, so a **missing** strongly implies no
`roles/serviceusage.serviceUsageConsumer` (and therefore a failing headless `gcloud builds
submit`), while an **ok** could come from some other role. Cloud Run access says nothing about
build permissions. Nothing here proves a deploy works end to end; only a real build does.

Relayed to RMA-MANAGER in [MESSAGE_TO_RMA-MANAGER.md](MESSAGE_TO_RMA-MANAGER.md). Their own
project is one of the six missing the sixth role.

## Fleet subdomain state (measured 2026-09-17 — all six live, nothing outstanding)

All six internal tools are on `verifyai.net` subdomains. Measured directly with `nslookup` +
`curl -I`, not taken from any repo's notes:

| Subdomain | CNAME -> ghs | HTTPS |
|---|---|---|
| `portal.verifyai.net` | yes | 200 |
| `anydesk.verifyai.net` | yes | 200 |
| `rma.verifyai.net` | yes | 200 |
| `backoffice.verifyai.net` | yes | 200 |
| `events.verifyai.net` | yes | 200 |
| `tracker.verifyai.net` | yes | 200 |

**No DNS work outstanding for anyone.**

### Two corrections this session had to make to its own fleet claims

Both were relayed to Access Portal before being checked, and both were wrong. The lesson is the
same each time: **measure; a repo's committed notes (or another session's summary) are a lead, not a
fact.**

1. **"RMA-MANAGER's `rma` CNAME is still pending"** — false. That came from RMA-MANAGER's own
   SESSION_STATE, which is stale; `rma.verifyai.net` serves 200 today.
2. **"`onboarding.verifyai.net` is the only DNS gap, worth clearing in the same sitting"** — false,
   and **acting on it would have caused real damage.** Onboarding Tracker's subdomain is
   `tracker.verifyai.net` (live, 200); `onboarding.verifyai.net` was abandoned for web use because it
   carries a live `MX 10 inbound-smtp.us-east-1.amazonaws.com` that `production.verifyai.net`'s
   dashboard depends on for inbound email. A CNAME cannot coexist with any other record at the same
   name, so adding one there would have been invalid at best and would have broken inbound email at
   worst. Verified here: the MX is live, and `tracker.verifyai.net` resolves to `ghs.googlehosted.com`
   and returns 200.

   **Never propose a DNS record on a name without first checking what already exists there**
   (`nslookup -type=ANY <name>`). A missing A/CNAME does not mean an unused name.

## Resolved 2026-09-17 — the deploy credential blocker

Recorded because any repo on this machine can hit the same thing. The automation SA
(`claude-automation@rma-manager-489912.iam.gserviceaccount.com`) genuinely had **no** bindings on
`corpmarketer-app`, despite RMA-MANAGER's 2026-08-23 intake message stating the 5 deploy roles were
granted here. Dave re-authed `dave@parametrik.net`, then this session bound six roles:

```
roles/run.admin  roles/cloudbuild.builds.editor  roles/storage.admin
roles/artifactregistry.writer  roles/iam.serviceAccountUser
roles/serviceusage.serviceUsageConsumer      <- NOT in the documented 5-role loop
```

**`roles/serviceusage.serviceUsageConsumer` is the one the global `~/.claude/CLAUDE.md` §8 loop
omits**, and it is what the misleading `forbidden from accessing the bucket
[corpmarketer-app_cloudbuild]` error is actually about (the message blames the bucket; the missing
permission is `serviceusage.services.use`). Bindings also need ~a minute to propagate — the first
build retry after granting still failed, the second succeeded unchanged.

Expect one harmless error at the end of a successful `gcloud builds submit` as the SA: it cannot
stream build logs without project Viewer. The build is running regardless — poll
`gcloud builds describe <id> --format="value(status)"` instead of trusting the exit code.

## Active work / not yet done

- **Vonage 10DLC campaign**: blocked on Dave funding + resubmitting. All copy answers are saved in [VONAGE_10DLC_CAMPAIGN_ANSWERS.md](VONAGE_10DLC_CAMPAIGN_ANSWERS.md).
- **HSPA 2026 training** (was Monday 2026-04-27, now past): the training tools (v0.10.6 generate,
  v0.10.7 simulate, v0.10.8 auto-confirm, v0.10.10 in_the_room/alerts, v0.10.11 training-tagged
  alerts) are all live and were used. The roleplay scripts from the old suggestions list were never
  written — only worth picking up if Dave asks for another training run.

## Next session quick-start

**Nothing is blocked or half-finished.** v0.11.0 is live and fully verified on revision
`corpmarketer-00067-bk2`; fleet SSO is active on `https://events.verifyai.net` (all six fleet
subdomains are live — see the table above). The only open item on this project is the Vonage 10DLC
campaign, which needs Dave, not code.

Triage shortcuts:
- Settings save 403 —> recommend sign-out/in (multi-session edge case, not a bug).
- SMTP failures with `535-5.7.8` —> App Password regen on `rma.manager`.
- SMS fails —> Vonage 10DLC campaign approval (out-of-band).
- Training asks —> v0.10.6-v0.10.11 are in production and work end to end.
- "I'm logged into Portal but FunnelFlow shows the login form" —> that is correct behaviour when
  the Portal email has no FunnelFlow account; the Register tab will be pre-filled. Check
  `POST /api/auth/portal-session` (`reason: no_local_account` vs `no_cookie`), never
  `/api/auth/me` — that endpoint is bearer-only by design and never reads the cookie.
- Anything touching a shared contract (Portal's `iss`, VerifyAi's auth-api path, shared DNS)
  —> read `MESSAGE_FROM_*`/`MESSAGE_TO_*` in this folder first, and **measure before relaying**
  (this session relayed two wrong fleet claims taken from sibling notes; see the corrections above).
