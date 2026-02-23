---
phase: 04-guided-wizard-smart-auto-layout
plan: 01
subsystem: layout
tags: [auto-layout, algorithm, connector-grouping, weight-distribution, zustand, mcp]

# Dependency graph
requires:
  - phase: 01-catalog-schema
    provides: "Device/connector catalog lookups (lookupDevice, lookupConnector)"
  - phase: 02-catalog-browser-routing
    provides: "MCP tools infrastructure (suggest_layout), store shape"
provides:
  - "autoLayoutV2 pure function with connector grouping, weight-aware placement, zone modes"
  - "suggestLayoutV2 store action for wizard integration"
  - "replaceElements, saveCheckpoint, getUndoDepth store actions for wizard lifecycle"
  - "MCP suggest_layout tool upgraded to V2 with connectorZone and overflow reporting"
affects: [04-02-wizard-shell, 04-03-text-labels]

# Tech tracking
tech-stack:
  added: []
  patterns: ["connector family grouping via slug-to-family map", "alternating ear placement for weight distribution", "overflow suggestion generation"]

key-files:
  created:
    - src/lib/autoLayoutV2.ts
  modified:
    - src/store/useConfigStore.ts
    - src/mcp/tools/layout.ts

key-decisions:
  - "CONNECTOR_FAMILIES map with slug-prefix fallback for unknown connector types"
  - "Weight-aware placement alternates left/right from ears inward (heaviest first)"
  - "Overflow detection uses panel-width heuristic to distinguish 10-inch vs 19-inch suggestions"
  - "Post-layout validation is lightweight inline AABB (not the full validateExportConfig)"
  - "V1 layout.ts preserved unchanged for backward compatibility"

patterns-established:
  - "Pure layout functions in src/lib/ with no React/store dependencies"
  - "Connector family grouping via CONNECTOR_FAMILIES constant with prefix-based fallback"
  - "Store actions for wizard lifecycle: saveCheckpoint, getUndoDepth, replaceElements"

requirements-completed: [LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04]

# Metrics
duration: 9min
completed: 2026-02-22
---

# Phase 4 Plan 01: Auto-Layout V2 Summary

**Smart auto-layout engine with connector-type grouping, weight-aware ear placement, 4 connector zone modes, overflow suggestions, and AABB validation**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-22T19:13:16Z
- **Completed:** 2026-02-22T19:22:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Built autoLayoutV2 pure function that groups same-type connectors adjacently and places heavy devices at rack ears
- Added 4 configurable connector zone modes (between, left, right, split) for flexible panel layouts
- Wired V2 engine into Zustand store (suggestLayoutV2) and MCP tool with overflow/validation reporting
- Added wizard-supporting store actions: replaceElements, saveCheckpoint, getUndoDepth

## Task Commits

Each task was committed atomically:

1. **Task 1: Build autoLayoutV2 pure function** - `9cf22dc` (feat)
2. **Task 2: Wire suggestLayoutV2 store action and update MCP tool** - `3e68425` (feat)

## Files Created/Modified
- `src/lib/autoLayoutV2.ts` - Pure auto-layout V2 engine with connector grouping, weight placement, zone modes, overflow, validation
- `src/store/useConfigStore.ts` - Added suggestLayoutV2, replaceElements, saveCheckpoint, getUndoDepth actions
- `src/mcp/tools/layout.ts` - Updated to use autoLayoutV2 with connectorZone option and return overflow/validation info

## Decisions Made
- CONNECTOR_FAMILIES map covers all inline CONNECTORS slugs plus catalog variants; unknown slugs fall back to first-segment prefix matching against known families
- Weight-aware placement uses simple alternating left/right cursor from ears; no complex bin-packing needed since devices rarely exceed 3-4 per panel
- Overflow detection distinguishes 10-inch panels (suggests upgrade to 19") from 19-inch (suggests removing items) using panel width threshold
- Post-layout validation uses lightweight inline AABB checks rather than importing the full validateExportConfig which operates on ExportConfig, not PanelElement[]
- V1 layout.ts preserved untouched for backward compatibility with existing MCP tests

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- autoLayoutV2 ready for wizard shell (04-02) to call via suggestLayoutV2 store action
- replaceElements and saveCheckpoint/getUndoDepth ready for wizard lifecycle management
- MCP tool ready for AI-assisted layout with connector zone support

## Self-Check: PASSED

- All 3 source files verified present
- All 2 task commits verified (9cf22dc, 3e68425)
- tsc --noEmit: PASS
- vite build: PASS
- V1 layout.ts: unchanged

---
*Phase: 04-guided-wizard-smart-auto-layout*
*Plan: 01*
*Completed: 2026-02-22*
