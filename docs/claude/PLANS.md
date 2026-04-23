# Approved & In-Progress Plans — FunnelFlow

## In Progress: Password Reset Feature (not yet committed)

**Status:** Code complete, untested, unreleased.

### What's built
- `POST /api/auth/forgot-password` — generates a 16-byte base64url `reset_token` with 1-hour TTL, writes it to the user's record in `users.json`, emails a link via existing SMTP settings. Always returns a generic success message (no email enumeration).
- `POST /api/auth/reset-password` — validates token, checks expiry, hashes new password via `hashPassword` from [src/lib/auth.js](../../src/lib/auth.js), clears `reset_token`/`reset_token_expires`, **also clears `session_token`** to force re-login on all devices.
- `/reset-password` page — public client page with `Suspense`-wrapped form. Redirects to `/` after 3s on success.
- Login page (`src/app/page.js`) — "Forgot Password?" inline panel, only visible on login mode.

### Remaining work
1. **Smoke test locally** (`npm run dev`):
   - Valid email → receives email → link works → new password logs in → old session on another device/browser is kicked out.
   - Invalid email → generic success message (no leak).
   - Expired token (>1h) → user-facing "Reset link has expired" error, token cleaned up from `users.json`.
   - Mismatched passwords on reset form → client-side error.
2. **Decide release scope.** Two options:
   - **(A) Combined `v0.9.0`** — password reset + invited search ship together as a minor release. Cleaner tag history.
   - **(B) Two releases** — `v0.8.3` patch (invited search only) followed by `v0.9.0` minor (password reset). More granular rollback.
   - **Recommendation:** (A), one release. The two changes are orthogonal and both are low-risk.
3. **Doc updates (see [DEPLOYMENT_RULES.md](./DEPLOYMENT_RULES.md)):**
   - [TECHNICAL_MANUAL.md](../../TECHNICAL_MANUAL.md) — add the two new endpoints to section 8, add `reset_token` / `reset_token_expires` to the `users.json` schema in section 17.
   - `public/admin-guide.html`, `public/supervisor-guide.html`, `public/sales-rep-guide.html` — "Forgot Password?" link now on login screen, document the email flow.
4. **Ship via the full backup/deploy checklist** — see [DEPLOYMENT_RULES.md](./DEPLOYMENT_RULES.md).

### Security notes (to mention in release)
- Reset tokens are single-use (cleared on successful reset) and time-limited (1 hour).
- Response to `/api/auth/forgot-password` is identical whether the email exists or not — no enumeration.
- Successful reset invalidates all existing sessions by clearing `session_token`.

## Backlog (not started, not promised)

_None captured in this session._
