# Known Bugs & Open Items — FunnelFlow

## Open Items

_None currently tracked as bugs._

## Untested Features (code complete, verification pending)

- **Password Reset (uncommitted, as of 2026-04-22).**
  - Files: `src/app/api/auth/forgot-password/route.js`, `src/app/api/auth/reset-password/route.js`, `src/app/reset-password/page.js`.
  - Needs smoke test: forgot link → email arrives → reset token accepted → new password works → old session invalidated.
  - See [PLANS.md](./PLANS.md) for the full rollout plan.

- **Invited tab search (uncommitted).**
  - `src/app/invited/page.js` — search by name/email/company/organization; "Select All" / status filters now operate over filtered set.
  - Needs smoke test: search while having selections, confirm filter + bulk-action behavior is intuitive.

## Recently Closed (for context, not action)

- **v0.7.5** — RSVP false declines from email scanners. Fixed by moving RSVP mutation from GET to POST-with-confirm-button.
- **v0.7.5** — Duplicate emails within a single batch. Fixed with case-insensitive dedup.
- **2026-04-06 SMTP outage** — Gmail rejected the old password with 535 BadCredentials. Fixed by generating a new Google App Password ("FunnelFlow") on `rma.manager@verifyai.net` with 2-Step Verification enabled. Stored in `settings.json` via the Settings page.

## Pending Backend / External

_None._
