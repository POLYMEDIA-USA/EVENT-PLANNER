# Accumulated Feedback — FunnelFlow

Rules learned from prior sessions. Apply proactively so the user doesn't have to repeat them.

## Working Style (Dave)

- **Action over planning.** If Dave asks for a fix, fix it. Don't present a multi-option plan for a bug that has an obvious cause.
- **"Deploy means the full sequence."** When asked to deploy: commit, push, tag, build, deploy, verify. Do NOT stop between steps to ask permission.
- **"When you just fixed something, deploy it."** Same thread — don't ask "want me to commit?" after doing requested work.
- **Terse responses preferred.** Don't summarize the diff. Don't repeat his words back. Lead with the result.
- **Login for manual testing:** `dave@verifyai.net` (admin).

## Code Quality Rules

- **Review AI-generated (Copilot / assistant) code for broken imports and invented API names before deploying.**
  **Why:** Generated code has shipped referencing imports/functions that don't exist in this repo — Next.js builds on Cloud Run fail and force a rollback.
  **How to apply:** Before committing any AI-drafted route or component, open it, cross-check every `import` against the files it names, and grep for helper functions (`hashPassword`, `getUsers`, `saveUsers`, etc.) to confirm they exist in `src/lib/`.

- **No verbose logging** (global rule): no `print(response.json())`, no DEBUG HTTP dumps. Keep `console.error` for genuine error paths only.

- **No guessing at code structure.** Read the file before editing it. Always. Do not assume a component has a prop, a function has a signature, or a data file has a field without verifying.

## Deployment Rules

- **Version bump + user guides are mandatory for every release.** See [DEPLOYMENT_RULES.md](./DEPLOYMENT_RULES.md).
  **Why:** The only "backup" mechanism for this project is git tags. Un-tagged code cannot be rolled back to cleanly. User guides are end-user-facing — stale docs are treated as bugs.

- **Follow the full backup/deploy checklist when Dave says "backup and document follow the rules."**
  **How to apply:** Hit every step of [DEPLOYMENT_RULES.md](./DEPLOYMENT_RULES.md) without interleaving questions. Only stop if a step errors.

## Project-Specific Gotchas

- **RSVP must be POST-confirmed (not GET).**
  **Why:** Email security scanners pre-fetch every link in outbound mail. If RSVP accept/decline fires on GET, those scanners cause false declines. Fixed in v0.7.5. Don't regress it.
  **How to apply:** `GET /api/rsvp` is read-only (token validation / status lookup). Only `POST /api/rsvp` mutates state.

- **SMTP credentials reference:** `rma.manager@verifyai.net` with a Gmail App Password named `FunnelFlow` (created 2026-04-06 after 535 BadCredentials outage). Stored in `settings.json` in GCS, configured via Settings page, NOT via env vars.
  **Why:** Gmail revoked the prior password; don't assume broken email = code bug without first checking the App Password is still valid.

- **Emails are de-duplicated within a send batch** (case-insensitive). Don't "fix" this — it's intentional (v0.7.5).

- **`node_modules/` is already installed.** Don't run `npm install` unless `package.json` changed.
