# Phase 3-A — Drive-First Convention for EVENT PLANNER

**Issued:** 2026-06-25 by ANYDESK_MANAGER Claude session
**Pairs with:** `PHASE2_DRIVE_MIGRATION.md` (Phase 2 = no-op for EVENT PLANNER; this is forward-looking prevention)

## Goal

Stop committing bulky non-source artifacts. EVENT PLANNER is currently 100% code-shaped (555 MB = `node_modules` + `.next` + `.git` + tiny source). The convention is prophylactic so it stays that way.

## Canonical spec — read first

`c:\Users\davee\ANYDESK_MANAGER\docs\REFERENCE_PHASE3_DRIVE_FIRST_CONVENTION.md`

## Two cheap edits

**1. Append to `.gitignore`** (canonical block — no EVENT PLANNER specifics since repo is clean):

```gitignore
# === Drive-first hygiene (Phase 3-A) ===
# See c:\Users\davee\ANYDESK_MANAGER\docs\REFERENCE_PHASE3_DRIVE_FIRST_CONVENTION.md

*-Setup*.zip
*-Setup*.exe
*-Installer*.zip
*-Installer*.exe
app_update*.zip
app_update*.tar.gz
*-snapshot-*.zip
*-snapshot-*.7z
/dist/
/installer_output/
# === End ===
```

**2. Add to `CLAUDE.md` (or `README.md` if no CLAUDE.md exists)**:

```markdown
- **Drive-first for non-source content** — release artifacts, demo material, customer-incoming files, marketing assets go to Drive `REPO/EVENT PLANNER/{docs,archive,incoming}/`, NEVER `git add`. See `c:\Users\davee\ANYDESK_MANAGER\docs\REFERENCE_PHASE3_DRIVE_FIRST_CONVENTION.md`.
```

Drive sub-folders for this repo:
- docs: https://drive.google.com/drive/folders/1jjZRu1NT52iv_aEmdJtxLhXQVD2712QH
- archive: https://drive.google.com/drive/folders/14IMtvtQUhMdNsPmdcwicLYfIbBjLipgI
- incoming: https://drive.google.com/drive/folders/1iogKieVTj-BYVx39oFnNqAeUitbWSiqE

## Note for ANYDESK_MANAGER cross-dependency

ANYDESK_MANAGER's `deploy.ps1` reads EVENT PLANNER's `settings.json` from `gs://corpmarketer-bucket/settings.json` to pull SMTP credentials at deploy time. This is a GCS-level dependency, not a local-disk one — no Phase 3-A implications.

## When done

Commit the `.gitignore` + CLAUDE.md / README.md change. Delete this `PHASE3_DRIVE_FIRST.md` file from repo root.
