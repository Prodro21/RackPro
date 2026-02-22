---
phase: 02-catalog-browser-routing
plan: 02
subsystem: ui
tags: [fuse.js, fuzzy-search, catalog-browser, drag-drop, accordion-cards, faceted-search]

# Dependency graph
requires:
  - phase: 01-catalog-schema
    provides: "CatalogDevice/CatalogConnector types and useCatalogStore with validated entries"
  - phase: 02-catalog-browser-routing plan 01
    provides: "TanStack Router with hash history, catalog route shell, Fuse.js installed"
provides:
  - "Fuse.js fuzzy search hook with category/brand AND-composed filters"
  - "Full catalog browser UI with 60/40 split layout and live FrontView preview"
  - "Adaptive accordion cards with compact/expanded states and Add to Panel"
  - "Drag-from-catalog to FrontView canvas for precise element placement"
  - "Grouped collapsible category sections for unified device+connector view"
affects: [03-export-pipeline, 04-guided-wizard]

# Tech tracking
tech-stack:
  added: []
  patterns: ["faceted-search sidebar with pill filters", "HTML5 drag-and-drop with application/rackpro-item MIME type", "accordion card expand/collapse with single-expanded-at-a-time", "parseCatalogDragData helper for cross-component drag data"]

key-files:
  created:
    - src/hooks/useCatalogSearch.ts
    - src/hooks/useCatalogDrag.ts
    - src/components/CatalogBrowser.tsx
    - src/components/CatalogCard.tsx
    - src/components/CatalogCardGrid.tsx
    - src/components/CatalogSearchSidebar.tsx
  modified:
    - src/routes/catalog.tsx
    - src/components/FrontView.tsx
    - src/store/useConfigStore.ts

key-decisions:
  - "IFuseOptions imported as named type from fuse.js (not Fuse.IFuseOptions namespace) for correct TypeScript resolution"
  - "lookupConnector() replaces direct CONNECTORS[key] in addElement for catalog-loaded connector support"
  - "SVG viewBox coordinate math for drop-to-panel conversion accounts for ear width offset and SC scale factor"
  - "Connectors excluded when brand filter active (AND logic: connectors have no brand field)"

patterns-established:
  - "CatalogItem union type with itemType discriminator for unified device+connector handling"
  - "application/rackpro-item drag data format for cross-component catalog drag operations"
  - "parseCatalogDragData() helper for safe parsing of drag event data"

requirements-completed: [CAT-03, CAT-04, CAT-07]

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 2 Plan 02: Catalog Browser UI Summary

**Fuse.js fuzzy search with category/brand faceted filters, adaptive accordion cards, 60/40 split layout with live FrontView preview, and drag-to-canvas placement**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T07:19:37Z
- **Completed:** 2026-02-22T07:24:55Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Built complete catalog browser with Fuse.js fuzzy search over 80+ device and connector entries with weighted field scoring
- Created faceted-search sidebar with category pill filters, brand filters, and AND-composed result narrowing
- Implemented adaptive accordion cards (compact/expanded) grouped into collapsible category sections with one-click Add to Panel
- Added drag-from-catalog to FrontView canvas with SVG coordinate conversion for precise element placement
- Fixed addElement to use lookupConnector() so catalog-loaded connectors work properly (was using inline constants only)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useCatalogSearch hook with Fuse.js and filter composition** - `5a58fc5` (feat)
2. **Task 2: Build catalog browser components and wire into catalog route** - `a05c5c7` (feat)
3. **Task 3: Implement drag-from-catalog to FrontView canvas drop** - `5317fb6` (feat)

## Files Created/Modified
- `src/hooks/useCatalogSearch.ts` - Fuse.js search + category/brand filter composition hook with CatalogItem union type
- `src/hooks/useCatalogDrag.ts` - parseCatalogDragData helper for HTML5 drag event parsing
- `src/components/CatalogBrowser.tsx` - Main catalog view with 60/40 split layout, search sidebar + card grid + live FrontView
- `src/components/CatalogCard.tsx` - Adaptive card with compact/expanded states, confidence dot, SVG outline thumbnail, draggable
- `src/components/CatalogCardGrid.tsx` - Grouped collapsible sections by category with accordion card behavior
- `src/components/CatalogSearchSidebar.tsx` - Search input, category pill filters, brand pill filters, clear-all button
- `src/routes/catalog.tsx` - Catalog route now renders CatalogBrowser (replaced placeholder shell)
- `src/components/FrontView.tsx` - Added onDragOver/onDrop handlers for catalog item drop placement with visual feedback
- `src/store/useConfigStore.ts` - Switched addElement connector lookup from CONNECTORS[key] to lookupConnector(key)

## Decisions Made
- Used `IFuseOptions` as named import from fuse.js rather than `Fuse.IFuseOptions` namespace access -- the namespace form causes TS2702 with the fuse.js 7.x type declarations
- Replaced direct `CONNECTORS[key]` lookup in addElement with `lookupConnector(key)` to support catalog-loaded connectors that may not exist in inline constants (Pitfall 6 from RESEARCH.md)
- Drop coordinate conversion uses SVG viewBox ratio calculation rather than CTM inverse -- simpler and accounts for the ear width offset correctly
- Connectors are excluded from results when brand filter is active since they have no brand field (AND logic means all active filters must match)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Fuse.IFuseOptions TypeScript error**
- **Found during:** Task 1 (useCatalogSearch hook)
- **Issue:** `Fuse.IFuseOptions<CatalogItem>` causes TS2702 "only refers to a type, but is being used as a namespace" with fuse.js 7.x
- **Fix:** Changed to named import: `import Fuse, { type IFuseOptions } from 'fuse.js'`
- **Files modified:** src/hooks/useCatalogSearch.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 5a58fc5 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed addElement using inline CONNECTORS instead of lookupConnector**
- **Found during:** Task 2 (CatalogBrowser wiring)
- **Issue:** `addElement` used `CONNECTORS[key]` directly, which only checks inline constants -- catalog-loaded connectors with slugs not in inline map would silently fail
- **Fix:** Switched to `lookupConnector(key)` which checks catalog store first, then falls back to inline constants
- **Files modified:** src/store/useConfigStore.ts
- **Verification:** `npm run build` succeeds, connector lookup chain verified
- **Committed in:** a05c5c7 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Catalog browser is fully functional with search, filters, add-to-panel, and drag-to-canvas
- Plan 03 (URL sharing + localStorage persistence) can build on this foundation
- The 60/40 split layout renders FrontView as a fully interactive panel preview
- All catalog items (devices + connectors) can be added via both button click and drag

## Self-Check: PASSED

All 9 created/modified files verified on disk. All 3 task commits (5a58fc5, a05c5c7, 5317fb6) found in git log. SUMMARY.md exists.

---
*Phase: 02-catalog-browser-routing*
*Completed: 2026-02-22*
