---
phase: 04-guided-wizard-smart-auto-layout
plan: 03
subsystem: ui
tags: [text-labels, svg-rendering, dxf-export, openscad-export, auto-numbering, fabrication-output]

# Dependency graph
requires:
  - phase: 04-guided-wizard-smart-auto-layout
    provides: "PanelElement interface, useConfigStore actions, designSerializer, FrontView SVG rendering"
  - phase: 03-export-hardening-web-deployment
    provides: "DXF generator with layered output, OpenSCAD generator with cutout modules, ExportConfig pipeline"
provides:
  - "ElementLabel interface with text, position, autoNumber, icon fields"
  - "labelConfig optional field on PanelElement for per-element text labels"
  - "setElementLabel store action with undo support"
  - "SVG label rendering in FrontView with stagger collision handling"
  - "Label editor UI in Sidebar (text, position, auto-number, icon)"
  - "DXF 5-LABELS layer with TEXT entities for laser engraving"
  - "OpenSCAD label_N() debossed text modules via linear_extrude + difference"
  - "labelConfig serialization/deserialization for persistence and URL sharing"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: ["per-element labelConfig with optional auto-numbering for grouped connectors", "label stagger algorithm for collision avoidance", "debossed text via OpenSCAD text() + linear_extrude in difference block"]

key-files:
  created: []
  modified:
    - src/types.ts
    - src/store/useConfigStore.ts
    - src/lib/designSerializer.ts
    - src/components/FrontView.tsx
    - src/components/Sidebar.tsx
    - src/export/configJson.ts
    - src/export/dxfGen.ts
    - src/export/openscadGen.ts

key-decisions:
  - "labelConfig is optional on PanelElement -- v1 designs without labels load correctly (backward compat)"
  - "Auto-numbering groups by element type AND label text, sorted by X position left-to-right"
  - "Label stagger flips adjacent same-position labels (within 20px SVG proximity) to opposite side"
  - "Category icons are inline SVG path data (4 simple icons: network, video, audio, power)"
  - "labelConfig threaded through ExportElement so DXF/OpenSCAD generators access it directly"
  - "DXF labels use TEXT entities on 5-LABELS layer (color 7/white) for fabricator layer toggling"
  - "OpenSCAD deboss depth 0.3mm with 0.4mm extrude height per CONTEXT.md specification"

patterns-established:
  - "Per-element fabrication metadata (labelConfig) on PanelElement flows through ExportElement to all generators"
  - "Label position computation separated from rendering (computeLabelPositions pure function, memoized in component)"
  - "Stagger collision handling as post-processing pass on sorted label positions"

requirements-completed: [UX-04]

# Metrics
duration: 8min
completed: 2026-02-22
---

# Phase 4 Plan 03: Text Labels Summary

**Custom text labels on panel elements with auto-numbering, stagger collision handling, category icons, DXF/OpenSCAD export, and design persistence**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-22T19:45:17Z
- **Completed:** 2026-02-22T19:53:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added ElementLabel type system and labelConfig field threading through entire codebase (types, store, serializer, export config, export generators)
- Built SVG label rendering in FrontView with auto-numbering, position options (above/below/inside), stagger collision avoidance, and category icon display
- Added label editor section in Sidebar with text input, position radio buttons, auto-number checkbox, and icon picker
- Integrated labels into both export formats: DXF TEXT entities on 5-LABELS layer and OpenSCAD debossed text modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Define ElementLabel type, extend PanelElement, add store action, update serializer** - `7d06217` (feat)
2. **Task 2: Render labels in FrontView SVG, add label editor to Sidebar, export to DXF and OpenSCAD** - `b88e1d3` (feat)

## Files Created/Modified
- `src/types.ts` - Added ElementLabel interface, labelConfig on PanelElement and ExportElement
- `src/store/useConfigStore.ts` - Added setElementLabel action with undo support
- `src/lib/designSerializer.ts` - Added labelConfig to SerializedDesign schema and extract/apply functions
- `src/components/FrontView.tsx` - Added label rendering with auto-number, stagger, category icons, memoized positions
- `src/components/Sidebar.tsx` - Added label editor section (text, position, auto-number, icon) in element properties
- `src/export/configJson.ts` - Threads labelConfig through to ExportElement
- `src/export/dxfGen.ts` - Added 5-LABELS layer and TEXT entity generation for labeled elements
- `src/export/openscadGen.ts` - Added label_N() debossed text modules in both monolithic and modular assemblies

## Decisions Made
- labelConfig is optional on PanelElement so existing v1 designs without labels load without errors (backward compatibility per RESEARCH.md Pitfall 4)
- Auto-numbering groups connectors by type AND label text, numbered left-to-right by X position regardless of zone (per RESEARCH.md Open Question 3)
- Stagger collision handling flips adjacent labels within 20px SVG proximity to opposite position (above/below), computed as a post-processing pass on X-sorted positions
- Category icons implemented as simple inline SVG path data constants (4 paths, 3-5 commands each) rather than an icon library
- labelConfig added to ExportElement interface so export generators read it directly from the ExportConfig pipeline
- DXF 5-LABELS layer uses color 7 (white) for visibility on dark backgrounds and contrast on light
- OpenSCAD deboss: 0.3mm into faceplate surface with 0.4mm extrude height, using Liberation Sans font per CONTEXT.md

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added labelConfig to ExportElement type**
- **Found during:** Task 2 (DXF/OpenSCAD export)
- **Issue:** ExportElement interface lacked labelConfig field, so export generators couldn't access label data from config
- **Fix:** Added optional labelConfig field to ExportElement and threaded it through configJson.ts generator
- **Files modified:** src/types.ts, src/export/configJson.ts
- **Verification:** tsc --noEmit passes, DXF and OpenSCAD generators access labelConfig correctly

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for label export to work. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Text labels are fully functional end-to-end: add via Sidebar, render in SVG, export to DXF and OpenSCAD
- Phase 4 is now complete (all 3 plans executed)
- Labels persist across page refresh (localStorage via serializer) and URL sharing (design param)
- Auto-numbering and stagger logic handle dense connector layouts without manual positioning

## Self-Check: PASSED

- All 8 source files verified present
- All 2 task commits verified (7d06217, b88e1d3)
- tsc --noEmit: PASS
- vite build: PASS (FrontView chunk: 24.50 kB / 9.47 kB gzip)

---
*Phase: 04-guided-wizard-smart-auto-layout*
*Plan: 03*
*Completed: 2026-02-22*
