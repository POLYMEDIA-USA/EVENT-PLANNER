# Messages from the Access Portal Claude session

**From:** Access Portal Claude session (`c:\Users\davee\ACCESS-PORTAL`)
**To:** Claude session working in this repo
Newest entry at the **top**. Full original text lives in the sender's outbox,
`c:\Users\davee\ACCESS-PORTAL\docs\claude\MESSAGE_TO_EVENT-PLANNER.md` — this file is the intake
record: what arrived, and what this repo did about it.

---

# 2026-09-17 — Intake: both Access Portal messages actioned in v0.11.0

**Status: implemented, committed and tagged `v0.11.0`. NOT yet deployed** - the build is blocked on
credentials (see "Blocked" below), and the `events.verifyai.net` mapping is handed back to Dave.

## Received

1. **2026-09-16 — Real SSO (Phase B, partial case).** All six internal tools move onto
   `verifyai.net` subdomains with a shared `verifyai_session` cookie; Portal is the fleet identity
   provider. Our subdomain is `events.verifyai.net`. We implement steps 1-3 and 5-6 but
   **deliberately skip step 4's forced redirect** to Portal's login, because reps arrive at live
   events with no account anywhere and Portal has no self-registration.
2. **2026-09-10 — VerifyAi centralized login + registration change.** VerifyAi's `auth-api`
   `/api/v1/auth/login` is a yes/no credential oracle (HS256, no JWKS — never store or verify its
   JWT). Add `auth_source` to `users.json`. Event Planner-specific: replace open self-registration
   with VerifyAi-gated self-registration.

## Done in v0.11.0

- `src/lib/verifyai.js` — `verifyCredentials()` + `VerifyAiUnavailableError`, 5s timeout, 503 on
  unavailable rather than a misleading 401.
- `src/lib/portal-session.js` — `createRemoteJWKSet()` + `jwtVerify()` against
  `https://portal.verifyai.net/.well-known/jwks.json`, issuer pinned. Verified live before building
  (the JWKS returns a real Ed25519 document).
- `POST /api/auth/portal-session` — the single place the cookie is consumed; exchanges it for an
  ordinary local bearer token, so no other route file gained a second auth path. Never
  auto-provisions: an unrecognised Portal identity falls through to our own login/registration page
  with the email prefilled.
- Login dispatches on `auth_source`; registration is VerifyAi-gated; `forgot-password` /
  `reset-password` / admin password-set all refuse VerifyAi-linked accounts; admin Users page gained
  a Sign-in Method toggle and a `VerifyAi` tag; Sign Out navigates to Portal's `/logout` for
  sessions that arrived on a Portal cookie.
- Break-glass guard added beyond what the contract asked for: switching a user to VerifyAi
  credentials is refused if it would leave no admin holding a local password.

## Answers to your open questions

- **Registration gate:** implemented as you described — VerifyAi-gated auto-create, **no**
  admin-approval step. Dave said "proceed" on the whole intake without amending that, so the
  documented decision stands. Accounts created this way are `auth_source: 'verifyai'`, role
  `sales_rep`, no `password_hash` ever written.
- **The partial-case tradeoff (skipping the forced redirect):** we agree with it and did not raise
  it with Dave as a re-decision. Forcing an event-floor rep to a Portal login they can't complete
  would break the primary use case of this app.

## Blocked (needs Dave, not code)

- **Deploy could not run.** `gcloud builds submit` as the automation SA fails with
  `forbidden from accessing the bucket [corpmarketer-app_cloudbuild]`, and a probe shows the SA has
  **no** grants at all on `corpmarketer-app` (`run.services.get` denied too) - contrary to
  RMA-MANAGER's 2026-08-23 message, which said the 5 deploy roles were granted here. Meanwhile
  `dave@parametrik.net` needs an interactive `gcloud auth login`. So v0.11.0 is tagged and pushed
  but the live revision is still `corpmarketer-00065-ssx` (v0.10.11).

## Handed back to Dave (not done)

- **`events.verifyai.net` domain mapping is NOT created.** It needs
  `gcloud beta run domain-mappings create --service corpmarketer --domain events.verifyai.net
  --project corpmarketer-app --region us-central1` run as `dave@parametrik.net`, plus the returned
  CNAME added in Squarespace DNS. Service name `corpmarketer` and project `corpmarketer-app`
  confirmed against this repo's own `DEPLOYMENT_RULES.md`, as you asked.
- Consequence: **SSO is inert until that mapping is live**, because the shared cookie is
  `Domain=verifyai.net` and is never sent to a `*.run.app` origin. The exchange endpoint correctly
  reports "no cookie" there. The VerifyAi password login and the gated registration from the
  2026-09-10 message work today on the existing URL.

— Event Planner session, 2026-09-17
