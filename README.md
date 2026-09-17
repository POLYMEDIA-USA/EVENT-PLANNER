# FunnelFlow

Corporate event lead-tracking, invitation management and sales-funnel platform (internal VerifyAi
tool, formerly "CorpMarketer"). Next.js 14 App Router on Cloud Run; all data lives in JSON files in
Google Cloud Storage — there is no database.

- **Live:** https://corpmarketer-678407058536.us-central1.run.app (subdomain
  `events.verifyai.net` pending DNS)
- **Developer manual:** [TECHNICAL_MANUAL.md](TECHNICAL_MANUAL.md)
- **Deploy commands:** [DEPLOY.md](DEPLOY.md) · release checklist:
  [docs/claude/DEPLOYMENT_RULES.md](docs/claude/DEPLOYMENT_RULES.md)
- **End-user guides:** `public/admin-guide.html`, `public/supervisor-guide.html`,
  `public/sales-rep-guide.html`, `public/corpmarketer-workflow-guide.html`
- **Session handoff / current state:** [docs/claude/SESSION_STATE.md](docs/claude/SESSION_STATE.md)

## What it does

Reps capture leads before and during an event; admins send invitations, track RSVPs, print QR
codes, and check attendees in at the door with a phone camera. Supervisors and admins get
per-event and per-org reporting, an email log with previews, team-attendance tracking for the staff
working the event, and a training mode that replays the whole flow with dummy leads and no real
email sends.

## Local development

```bash
npm install
GCS_BUCKET=corpmarketer-bucket npm run dev
```

`GCS_BUCKET` is required locally — without it the app falls back to `event-planner-bucket`, which
has billing disabled and 403s on every read. Copy [.env.example](.env.example) to `.env.local` for
the optional settings. Application-level secrets (SMTP, Vonage) are **not** env vars: they live in
`settings.json` in GCS and are edited from the in-app Settings page.

---

# Release Notes

Newest first. Every release is tagged `vX.Y.Z` — tags are the rollback mechanism.

### v0.11.0 (2026-09-17) — VerifyAi sign-in and fleet single sign-on

_Live on revision `corpmarketer-00067-bk2`._

- SECURITY: **self-registration can no longer invent an identity.** `POST /api/auth/register`
  previously created an account from nothing but a name, email, phone, password and a free-text
  organization name, with no approval gate of any kind. It now verifies the submitted email and
  password against VerifyAi's `auth-api` *before* any write, and only then auto-creates the local
  account (`auth_source: 'verifyai'`, no `password_hash`, password never stored or logged). The
  twenty-second signup a rep does standing at a live event is unchanged in shape — it just has to be
  a real VerifyAi identity now.
- IMPROVEMENT: **accounts can sign in with their VerifyAi dashboard password.** Each user record
  carries an `auth_source` of `local` (default; a missing field means local, so no migration was
  needed) or `verifyai`. Admins pick per user with a new **Sign-in Method** control on the Users
  page, and VerifyAi-linked accounts show a `VerifyAi` tag in the list. VerifyAi's auth-api is used
  strictly as a yes/no credential oracle — its HS256 JWT is never stored, forwarded or verified, and
  FunnelFlow keeps minting its own session tokens, so per-request auth is unchanged.
- IMPROVEMENT: **single sign-on with the VerifyAi Access Portal.** Anyone carrying a valid
  `verifyai_session` cookie from `portal.verifyai.net` whose email matches a FunnelFlow account is
  signed in automatically, verified locally against Portal's published Ed25519 JWKS with no callback
  to Portal per request. "Sign Out" for those sessions is a real navigation to Portal's `/logout`,
  ending the session across every internal tool rather than just this one.
- NOTE: **FunnelFlow is a deliberate partial case of the fleet SSO contract.** The other five
  internal tools forcibly redirect an unauthenticated visitor to Portal's login. FunnelFlow does
  not, and must not: reps arrive at live events with no account anywhere, and Portal is
  admin-provisioned with no self-registration, so that redirect would be a dead end. The Portal
  cookie is an accelerator only; our own login and registration screen stays the primary path, and a
  valid Portal cookie never auto-provisions an account here.
- SECURITY: **break-glass admin preserved.** Switching a user to VerifyAi credentials is refused
  when it would leave no admin holding a local password, so a VerifyAi outage cannot lock every
  admin out of every internal tool at once. Password-reset paths (`forgot-password`,
  `reset-password`, and an admin setting a password) now refuse VerifyAi-linked accounts instead of
  silently hashing a password that would never be checked.
- NOTE: one item from this work is **not** done and needs Dave: mapping `events.verifyai.net` to the
  Cloud Run service, which needs a `gcloud beta run domain-mappings create` run as
  `dave@parametrik.net` plus a CNAME in Squarespace DNS. Portal's cookie is `Domain=verifyai.net`,
  so **SSO only starts working once the app is served from that subdomain** — the VerifyAi password
  login and the gated registration in this release work on the current `*.run.app` URL today.

### v0.10.0 – v0.10.11 (2026-04-23 → 2026-04-25) — team attendance and training mode

Release-by-release detail for the 0.10.x train is in
[docs/claude/SESSION_STATE.md](docs/claude/SESSION_STATE.md). Headlines: Team Attendance
(invite/confirm/check-in the staff working an event, email or Vonage SMS RSVP, Reports → Team), the
`in_the_room` check-in status with auto-migration after an event closes, lead-arrival email alerts
to the assigned rep and supervisors, a full training mode (dummy-lead generator, reset-for-replay,
simulated email sends with no SMTP, `[TRAINING]`-tagged alerts), reusable email templates,
multi-session auth, and sender signatures.

### v0.9.x and earlier

See `git tag` and the per-version notes in
[docs/claude/SESSION_STATE.md](docs/claude/SESSION_STATE.md). Milestones: password reset and
role-wide dashboards/reports (v0.9.0), QR auto-generation for manually accepted leads (v0.9.3),
mobile viewport fix (v0.8.2), and the POST-only RSVP confirmation model that stopped email scanners
from pre-fetching decline links and producing false declines (v0.7.5 — **do not regress this**).
