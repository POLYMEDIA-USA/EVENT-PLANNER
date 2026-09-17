# Phase 2 Drive Migration — EVENT PLANNER

**Issued:** 2026-06-25 by ANYDESK_MANAGER Claude session
**Status:** NO-OP. Repo is 100% code-shaped (Next.js project).

## Scope summary

| Path | Size | Disposition |
|---|---|---|
| `node_modules/` | 310 MB | Active build dep — stays |
| `.next/` | 242 MB | Active build artifact — stays |
| `.git/` | 2 MB | Stays |
| Source + config | ~1 MB | Stays |
| **Total** | **555 MB** | **0 MB movable** |

## Canonical spec (for reference)

`c:\Users\davee\ANYDESK_MANAGER\docs\REFERENCE_PHASE2_DRIVE_MIGRATION_SPEC.md`

## Drive folder IDs (for future bulky reference content)

- docs: https://drive.google.com/drive/folders/1jjZRu1NT52iv_aEmdJtxLhXQVD2712QH
- archive: https://drive.google.com/drive/folders/14IMtvtQUhMdNsPmdcwicLYfIbBjLipgI
- incoming: https://drive.google.com/drive/folders/1iogKieVTj-BYVx39oFnNqAeUitbWSiqE

## Note for ANYDESK_MANAGER cross-dependency

ANYDESK_MANAGER's `deploy.ps1` reads EVENT PLANNER's `settings.json` from `gs://corpmarketer-bucket/settings.json` to pull SMTP credentials at deploy time. This is a **GCS-level** dependency, not a local-disk one — no phase 2 implications.

## When done

Delete this file. No further action needed.
