---
phase: 06-cost-estimation-community-contributions
plan: 02
subsystem: community
tags: [github-actions, ci, zod, issue-templates, contributing, automation]

# Dependency graph
requires:
  - phase: 01-catalog-schema
    provides: CatalogDeviceSchema and CatalogConnectorSchema Zod schemas
provides:
  - CONTRIBUTING.md with dual-path community contribution guide
  - GitHub Issue Form templates for device and connector submissions
  - CI validation workflow for catalog PRs (Zod schema + slug collision + plausibility)
  - Issue-to-PR automation workflow parsing form submissions
  - Standalone validate-catalog.ts script reusing existing Zod schemas
affects: []

# Tech tracking
tech-stack:
  added: [onmax/issue-form-parser@v1.6, peter-evans/create-pull-request@v7, actions/github-script@v7]
  patterns: [reusable-zod-validation-cli, issue-form-to-pr-automation, dual-submission-path-contribution]

key-files:
  created:
    - CONTRIBUTING.md
    - .github/ISSUE_TEMPLATE/new-device.yml
    - .github/ISSUE_TEMPLATE/new-connector.yml
    - .github/ISSUE_TEMPLATE/config.yml
    - .github/workflows/validate-catalog.yml
    - .github/workflows/auto-generate-entry.yml
    - scripts/validate-catalog.ts
  modified: []

key-decisions:
  - "validate-catalog.ts imports Zod schemas from src/catalog/schemas.ts via relative path for single source of truth"
  - "Plausibility warnings exit 0 (soft flag); schema errors and slug collisions exit 1 (hard fail)"
  - "Issue Form uses onmax/issue-form-parser for structured field extraction, peter-evans/create-pull-request for draft PR creation"
  - "Connector Issue Form uses mountHoles dropdown (0/2/4) instead of text input to constrain valid values"

patterns-established:
  - "CLI validation script reusing app Zod schemas: import from src/, run via npx tsx, output JSON or human-readable"
  - "Dual submission path: casual (Issue Form + automation) and technical (direct PR + CI)"

requirements-completed: [COMM-01, COMM-02]

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 6 Plan 2: Community Contribution Infrastructure Summary

**CONTRIBUTING.md with dual-path guide, GitHub Issue Form templates, CI validation reusing Zod schemas, and issue-to-PR automation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T03:46:18Z
- **Completed:** 2026-02-23T03:50:33Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- CONTRIBUTING.md (196 lines) with dual submission paths, required/optional field tables, JSON examples, dimension guidelines, and data source confidence tiers
- GitHub Issue Form templates for new device and connector submissions with structured form fields matching Zod schema requirements
- validate-catalog.ts CLI script that validates 60 devices + 37 connectors against Zod schemas, detects slug collisions, and flags dimension plausibility warnings
- CI workflow (validate-catalog.yml) that runs on PRs touching catalog files and posts formatted validation results as PR comments
- Issue-to-PR automation (auto-generate-entry.yml) that parses form submissions and creates draft PRs with validated catalog entries

## Task Commits

Each task was committed atomically:

1. **Task 1: CONTRIBUTING.md + Issue Form templates** - `75a19da` (feat)
2. **Task 2: validate-catalog.ts + CI workflows** - `a2c8096` (feat)

## Files Created/Modified
- `CONTRIBUTING.md` - Community contribution guide with dual submission paths
- `.github/ISSUE_TEMPLATE/new-device.yml` - Device submission Issue Form template (142 lines)
- `.github/ISSUE_TEMPLATE/new-connector.yml` - Connector submission Issue Form template (135 lines)
- `.github/ISSUE_TEMPLATE/config.yml` - Issue template chooser enabling blank issues
- `.github/workflows/validate-catalog.yml` - PR validation workflow for catalog changes
- `.github/workflows/auto-generate-entry.yml` - Issue-to-PR automation workflow
- `scripts/validate-catalog.ts` - CLI validation script reusing Zod schemas

## Decisions Made
- validate-catalog.ts uses relative import from `../src/catalog/schemas.js` so it shares the exact same Zod schemas as the app runtime
- Plausibility warnings (e.g., Raspberry Pi Zero 2 W's 5mm height) produce exit code 0 so CI passes; only schema errors and slug collisions produce exit code 1
- Connector Issue Form uses dropdown for mountHoles (0/2/4) rather than free text to constrain to valid values
- Issue Form dataSource enum uses `community-measured` label (user-facing) which maps to `user-calipered` in the schema if needed by the generation script

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Community contribution infrastructure is complete
- Phase 6 Plan 1 (cost estimation) is the remaining plan in the phase
- All COMM-01 and COMM-02 requirements are satisfied

## Self-Check: PASSED

All 7 created files verified on disk. Both commit hashes (75a19da, a2c8096) confirmed in git log.

---
*Phase: 06-cost-estimation-community-contributions*
*Completed: 2026-02-23*
