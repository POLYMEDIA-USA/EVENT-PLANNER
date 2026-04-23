# Session State

## Current Version
- Version: 0.8.2 (in `package.json`)
- Last released tag: `v0.8.2` (commit `5c975ac`)
- Branch: `main`, in sync with `origin/main`
- Last session: 2026-04-22

## Deployed To
- Cloud Run `corpmarketer` / project `corpmarketer-app` / region `us-central1` — v0.8.2 live at https://corpmarketer-678407058536.us-central1.run.app

## What Was Done Last Session
- Recent tagged releases (most recent first):
  - **v0.8.2** — mobile viewport scaling fix on iPhone
  - **v0.8.1** — in-app camera for photos and document scanning
  - **v0.8.0** — photo/document attachments, name-search check-in, reports "declined" column
  - **v0.7.5** — email scanner false-decline fix (RSVP moved to POST-confirm), prevent duplicate emails within a send batch
- Created `TECHNICAL_MANUAL.md` at project root (developer-facing; complements user-guide HTML in `public/`)

## Uncommitted Work In Progress (Password Reset + Invited Search)
Not yet committed, not yet deployed. Working tree state:
- **New files (untracked):**
  - `src/app/api/auth/forgot-password/route.js` — POST endpoint; generates 16-byte base64url reset token (1-hour expiry), writes `reset_token` and `reset_token_expires` onto user record, emails a reset link using existing SMTP settings. Always returns a generic success message so unknown emails can't be enumerated.
  - `src/app/api/auth/reset-password/route.js` — POST endpoint; validates token, checks expiry, hashes new password via `hashPassword` from `@/lib/auth`, clears `reset_token`/`reset_token_expires`, and clears `session_token` to force re-login. Min password length: 4.
  - `src/app/reset-password/page.js` — public client page at `/reset-password?token=…`, `Suspense`-wrapped form (new + confirm password), redirects to `/` on success after 3s.
- **Modified files:**
  - `src/app/page.js` — login page now has a "Forgot Password?" link (visible only in `mode === 'login'`) that opens an inline panel calling `/api/auth/forgot-password`.
  - `src/app/invited/page.js` — added search box (name/email/company/organization) on Invited tab. `selectAll`, `selectByStatus`, and `selectNotSentType` now operate over the filtered set `filteredInvited` rather than the full `invited` list. Search clears `page` back to 1.

## What's Next (prioritized)
1. **Smoke-test password reset end-to-end on local dev** (`npm run dev`) — confirm: forgot → email arrives → reset link works → new password logs in → session_token from previous device is invalidated.
2. **Decide scope of this release** — is it `v0.8.3` (patch: invited-search) + `v0.9.0` (minor: password reset), or one combined `v0.9.0`? See [PLANS.md](./PLANS.md).
3. **Update user guides** under `public/*-guide.html` to document the Forgot Password flow and the new Invited search box.
4. **Update [TECHNICAL_MANUAL.md](../../TECHNICAL_MANUAL.md)** — add `/api/auth/forgot-password` and `/api/auth/reset-password` to the API Reference (section 8), document `reset_token` / `reset_token_expires` fields in the `users.json` schema (section 17).
5. **Follow the backup/deploy checklist** in [DEPLOYMENT_RULES.md](./DEPLOYMENT_RULES.md) (bump version → guides → commit → tag → push → `gcloud builds submit` → `gcloud run deploy`).

## Active Blockers
- None. Password-reset feature is code-complete but untested.

## Notes for the Next Claude
- **No `docs/claude/` existed before this session.** This directory was created to match the global `~/.claude/CLAUDE.md` handoff protocol. Treat its contents as the starting baseline.
- The `TECHNICAL_MANUAL.md` that appeared as "untracked" in `git status` is the legitimate developer manual — it should be committed alongside the password-reset changes.
- Do NOT run `npm install` unless asked; `node_modules/` is already present.
