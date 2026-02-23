---
phase: 05-ui-3d-polish
plan: 03
subsystem: 3d-preview
tags: [three-bvh-csg, csg, boolean-subtraction, three.js, react-three-fiber, cutouts]

# Dependency graph
requires:
  - phase: 04-guided-wizard-smart-auto-layout
    provides: "Element placement system with connector/device/fan types and lookup functions"
provides:
  - "CSG batch subtraction utility (buildCSGFaceplate) for real faceplate cutout holes"
  - "Simplified 3D connector body meshes behind the faceplate"
  - "csgCacheKey utility for memoized CSG recomputation"
affects: [05-ui-3d-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Union-then-subtract CSG batching via three-bvh-csg Brush/Evaluator", "Module-level material constants for connector body rendering"]

key-files:
  created:
    - "src/lib/csg.ts"
  modified:
    - "src/components/Preview3D.tsx"

key-decisions:
  - "Direct three-bvh-csg Brush/Evaluator API (not @react-three/csg wrapper) for batching control"
  - "Fan cutouts use circular CSG (cutoutDiameter) not square, for realistic rendering"
  - "Device elements excluded from ConnectorBodies (trays already provide spatial footprint)"

patterns-established:
  - "CSG union-then-subtract: union all cutout brushes into compound, single subtraction from faceplate"
  - "CylinderGeometry rotated PI/2 on X axis to align with Z for through-panel holes"
  - "Try/catch fallback to solid BoxGeometry when CSG computation fails"

requirements-completed: [3D-03]

# Metrics
duration: 3min
completed: 2026-02-23
---

# Phase 5 Plan 3: CSG Boolean Subtraction Summary

**Real CSG-subtracted cutout holes in 3D faceplate using three-bvh-csg union-then-subtract batching, with simplified connector body meshes behind panel**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-23T01:50:43Z
- **Completed:** 2026-02-23T01:54:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Connector cutouts and device bay openings are now actual see-through holes in the faceplate mesh via CSG boolean subtraction
- Union-then-subtract batch strategy keeps CSG computation efficient for many cutouts
- Simplified 3D connector/fan body meshes render behind the faceplate for spatial depth/clearance awareness, visible through the CSG holes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CSG batch subtraction utility and integrate into Preview3D** - `8a0bbb2` (feat)
2. **Task 2: Add simplified 3D connector body meshes behind faceplate** - `0784d94` (feat)

## Files Created/Modified
- `src/lib/csg.ts` - CSG batch subtraction utility: buildCSGFaceplate, CutoutDef interface, csgCacheKey
- `src/components/Preview3D.tsx` - Replaced overlay cutout indicators with CSG-subtracted holes; added ConnectorBodies component

## Decisions Made
- Used three-bvh-csg directly (Brush/Evaluator API) rather than @react-three/csg declarative wrapper, for full control over batching and caching
- Fan cutouts rendered as circles (cutoutDiameter/2 radius) for realism rather than square boxes
- Device elements excluded from ConnectorBodies component since trays already provide their spatial footprint
- CSG result cached via csgCacheKey string (type:x:y:w:h:r for each cutout) as useMemo dependency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `src/__tests__/selectors.test.ts` causes `tsc -b` to fail (missing ConfigState properties). This is out-of-scope (not caused by this plan's changes). Vite build and non-test type checking pass cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CSG infrastructure ready for additional cutout types if needed
- ConnectorBodies component extensible for more detailed connector housing shapes
- Ready for PBR material upgrades (plan 05-04) which will apply to the CSG faceplate mesh

## Self-Check: PASSED

- [x] src/lib/csg.ts exists (107 lines, above 50 min)
- [x] src/components/Preview3D.tsx exists
- [x] buildCSGFaceplate exported
- [x] csgCacheKey exported
- [x] CutoutDef interface exported
- [x] ConnectorBodies component renders connector/fan bodies
- [x] Commit 8a0bbb2 exists (Task 1)
- [x] Commit 0784d94 exists (Task 2)
- [x] Vite build succeeds

---
*Phase: 05-ui-3d-polish*
*Completed: 2026-02-23*
