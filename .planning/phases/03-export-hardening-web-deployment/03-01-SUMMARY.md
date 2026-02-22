---
phase: 03-export-hardening-web-deployment
plan: 01
subsystem: export
tags: [validation, dxf, preflight, lwpolyline, sheet-metal, export-gating]

# Dependency graph
requires:
  - phase: 01-catalog-schema
    provides: "Zod-validated catalog with device/connector lookup functions"
  - phase: 02-catalog-browser-routing
    provides: "ExportTab, FrontView, store selectors, catalog store"
provides:
  - "validateExportConfig() pure validation engine with 5 check types"
  - "PreflightReport component with expandable per-element issue details"
  - "Export download gating (critical blocks, warnings allow)"
  - "Red validation highlight overlay on FrontView elements"
  - "DXF LWPOLYLINE closed contours for rect/d-sub/trapezoid shapes"
affects: [export-tab, front-view, dxf-generator]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Validation engine as pure function on ExportConfig", "Store-mediated cross-component issue IDs (ExportTab writes, FrontView reads)"]

key-files:
  created:
    - "src/lib/validation.ts"
    - "src/components/PreflightReport.tsx"
  modified:
    - "src/export/dxfGen.ts"
    - "src/components/ExportTab.tsx"
    - "src/components/FrontView.tsx"
    - "src/store/useConfigStore.ts"
    - "src/store/selectors.ts"
    - "src/store/index.ts"
    - "src/lib/index.ts"

key-decisions:
  - "Validation elementId uses key-index format (key-0, key-1) since ExportElement has no persistent ID; mapped to PanelElement.id in ExportTab for FrontView consumption"
  - "HOLE_TO_EDGE checks run only for sheet metal (SM) fabrication; 3D print hole-to-edge is less critical per CLAUDE.md"
  - "Validation result stored as React state in ExportTab; only issue IDs propagated to Zustand store (minimal cross-component surface)"
  - "validationIssueIds is UI-only state (not undoable, not in snapshots) since it is derived from element positions"

patterns-established:
  - "Pure validation: validateExportConfig(config) -> ValidationResult with severity-coded issues and actionable fix strings"
  - "Export gating: checkBeforeExport() runs validation, returns false + toast on critical, all download/copy handlers gate on it"
  - "Cross-component highlighting: ExportTab dispatches issue IDs to store, FrontView reads via selector, red dashed overlay"

requirements-completed: [EXP-01, EXP-02, EXP-03, EXP-04]

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 3, Plan 1: Export Preflight Validation Summary

**Pure validation engine with 5 check types (MISSING_DEF, OPEN_CONTOUR, HOLE_TO_EDGE, OVERLAP, OUT_OF_BOUNDS), PreflightReport UI gating all exports, DXF LWPOLYLINE upgrade, and FrontView red highlighting**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T17:00:46Z
- **Completed:** 2026-02-22T17:06:22Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created pure validation engine (`validateExportConfig`) that checks ExportConfig for missing definitions, closed contours, hole-to-edge violations, overlaps, and out-of-bounds elements
- Upgraded DXF generator `dxfRect()` and `dxfTrapezoid()` from 4 individual LINE entities to single closed LWPOLYLINE entities, ensuring CAM tools recognize closed boundaries
- Built PreflightReport component with pass/fail summary bar, expandable per-element issue groups, severity icons, and actionable fix suggestions with exact mm values
- Integrated validation gating into all ExportTab download/copy handlers -- critical issues block export with toast error
- Added red dashed validation highlight overlay on FrontView for elements with issues, communicating via store-mediated `validationIssueIds`

## Task Commits

Each task was committed atomically:

1. **Task 1: Build pure validation engine + DXF LWPOLYLINE upgrade** - `823eb42` (feat)
2. **Task 2: PreflightReport UI + ExportTab integration + FrontView highlights** - `b703d30` (feat)

## Files Created/Modified
- `src/lib/validation.ts` - Pure validation engine: validateExportConfig() with 5 check types, ValidationResult/ValidationIssue types
- `src/components/PreflightReport.tsx` - Collapsible preflight report UI with severity summary, per-element groups, fix suggestions
- `src/export/dxfGen.ts` - Upgraded dxfRect() and dxfTrapezoid() to use closed LWPOLYLINE instead of 4 separate LINEs
- `src/components/ExportTab.tsx` - Integrated PreflightReport, added runPreflight/checkBeforeExport, gated all download/copy handlers
- `src/components/FrontView.tsx` - Added red dashed validation highlight overlay for elements with issues
- `src/store/useConfigStore.ts` - Added validationIssueIds state + setValidationIssueIds action
- `src/store/selectors.ts` - Added selectValidationIssueIds selector
- `src/store/index.ts` - Re-exported selectValidationIssueIds
- `src/lib/index.ts` - Re-exported validateExportConfig and types

## Decisions Made
- Validation elementId uses `key-index` format since ExportElement lacks a persistent ID; mapped back to PanelElement.id for FrontView
- HOLE_TO_EDGE is warning severity (not critical) and only applies to sheet metal -- 3D print hole-to-edge is structurally less critical
- DXF LWPOLYLINE upgrade was a prerequisite in the plan for meaningful contour validation; now all rectangular and trapezoidal shapes are guaranteed closed single entities
- validationIssueIds lives in Zustand store as UI-only state (not undoable) to enable cross-component communication without prop drilling

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Validation engine is complete and gates all export formats
- Plan 03-02 (Safari 3D fix + Cloudflare deployment) can proceed independently
- All EXP requirements (EXP-01 through EXP-04) satisfied by this plan

## Self-Check: PASSED

All 9 files verified present. Both task commits (823eb42, b703d30) verified in git log.

---
*Phase: 03-export-hardening-web-deployment*
*Completed: 2026-02-22*
