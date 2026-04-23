# Known Bugs & Open Items — FunnelFlow

## Open Items

_None currently tracked as bugs._

## Untested Features

_None — v0.9.0 features were smoke-tested locally and in production (forgot-password endpoint verified returning generic success message against corpmarketer-bucket data)._

## Recently Closed (for context, not action)

- **v0.9.0** — full release. Password reset, role-wide dashboard/reports/check-in, walk-in check-ins, inert email preview in Invited tab, two-column Interactions, sales-rep self-claim of unassigned leads. See [SESSION_STATE.md](./SESSION_STATE.md) for the full rundown.
- **v0.7.5** — RSVP false declines from email scanners. Fixed by moving RSVP mutation from GET to POST-with-confirm-button.
- **v0.7.5** — Duplicate emails within a single batch. Fixed with case-insensitive dedup.
- **2026-04-06 SMTP outage** — Gmail rejected the old password with 535 BadCredentials. Fixed by generating a new Google App Password ("FunnelFlow") on `rma.manager@verifyai.net` with 2-Step Verification enabled. Stored in `settings.json` via the Settings page.

## Pending Backend / External

_None._
