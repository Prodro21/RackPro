---
phase: 04-guided-wizard-smart-auto-layout
plan: 02
subsystem: ui
tags: [wizard, step-flow, auto-layout, catalog-search, undo-checkpoint, navigation-guard, tanstack-router]

# Dependency graph
requires:
  - phase: 04-guided-wizard-smart-auto-layout
    provides: "autoLayoutV2 pure function, replaceElements/saveCheckpoint/getUndoDepth store actions"
  - phase: 02-catalog-browser-routing
    provides: "useCatalogSearch hook, CatalogCardGrid/CatalogCard components, FrontView, TanStack Router"
  - phase: 03-export-hardening-web-deployment
    provides: "PreflightReport component, validateExportConfig, export generators (JSON/OpenSCAD/Fusion360/DXF)"
provides:
  - "WizardShell multi-step flow at /wizard with live FrontView preview"
  - "6 wizard steps: StepStandard, StepUHeight, StepDevices, StepConnectors, StepReview, StepExport"
  - "StepNav horizontal navigation indicator with completed/active/locked states"
  - "Undo checkpoint on wizard mount with full revert on cancel"
  - "sessionStorage step persistence for mid-flow navigation recovery"
  - "TanStack Router useBlocker navigation guard with confirmation dialog"
  - "Event-driven auto-layout on element add/remove in device and connector steps"
  - "Connector zone picker (between/left/right/split) in connector step"
affects: [04-03-text-labels]

# Tech tracking
tech-stack:
  added: []
  patterns: ["event-driven auto-layout (not effect-driven) in wizard steps", "undo checkpoint pattern for wizard cancel/revert", "sessionStorage step persistence for wizard resume"]

key-files:
  created:
    - src/components/wizard/WizardShell.tsx
    - src/components/wizard/StepNav.tsx
    - src/components/wizard/StepStandard.tsx
    - src/components/wizard/StepUHeight.tsx
    - src/components/wizard/StepDevices.tsx
    - src/components/wizard/StepConnectors.tsx
    - src/components/wizard/StepReview.tsx
    - src/components/wizard/StepExport.tsx
  modified:
    - src/routes/wizard.tsx

key-decisions:
  - "Event-driven auto-layout on add/remove (not useEffect) per RESEARCH.md Pitfall 1 to avoid infinite loops"
  - "Connector zone state lifted to WizardShell and passed via props to StepDevices and StepConnectors"
  - "useBlocker with withResolver:true for declarative confirmation dialog rendering"
  - "Undo depth saved at mount time; cancel pops stack back to that depth for clean revert"
  - "Placeholder steps in Task 1 enabled type-safe WizardShell compilation before full step implementation"

patterns-established:
  - "Wizard step components receive onNext/onBack props; WizardShell owns step state and navigation"
  - "Undo checkpoint at wizard mount with depth-based revert for cancel"
  - "sessionStorage persistence for wizard step index (non-undoable, survives navigation)"
  - "Event-driven auto-layout calls in wizard (store.addElement then immediate runAutoLayout)"

requirements-completed: [UX-01]

# Metrics
duration: 9min
completed: 2026-02-22
---

# Phase 4 Plan 02: Wizard Shell Summary

**Multi-step guided wizard at /wizard with live FrontView preview, catalog search, auto-layout on element changes, undo checkpoint, connector zone picker, and sessionStorage persistence**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-22T19:28:05Z
- **Completed:** 2026-02-22T19:38:01Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Built complete 6-step wizard flow (standard, U-height, devices, connectors, review, export) at /wizard route
- Integrated catalog search with auto-layout that re-runs on every element add/remove for instant visual feedback
- Added undo checkpoint with depth-based cancel/revert and TanStack Router navigation guard with confirmation dialog
- Reused existing components (FrontView, CatalogCardGrid, PreflightReport, export generators) for zero duplication

## Task Commits

Each task was committed atomically:

1. **Task 1: Build WizardShell layout, StepNav, and basic step infrastructure** - `bd0b611` (feat)
2. **Task 2: Build device, connector, review, and export wizard steps** - `9285140` (feat)

## Files Created/Modified
- `src/routes/wizard.tsx` - Updated to render WizardShell instead of placeholder
- `src/components/wizard/WizardShell.tsx` - Main wizard layout with step state, undo checkpoint, cancel, nav guard, FrontView preview
- `src/components/wizard/StepNav.tsx` - Horizontal step indicator with completed/active/locked states
- `src/components/wizard/StepStandard.tsx` - Step 1: rack standard picker (10" or 19") with card selection
- `src/components/wizard/StepUHeight.tsx` - Step 2: U-height selector (1-6U) with mm display grid
- `src/components/wizard/StepDevices.tsx` - Step 3: device catalog browser with search, category filters, placed list, auto-layout
- `src/components/wizard/StepConnectors.tsx` - Step 4: connector catalog with zone picker (between/left/right/split), auto-layout
- `src/components/wizard/StepReview.tsx` - Step 5: summary stats, PreflightReport, Edit in Configurator / Export Now fork
- `src/components/wizard/StepExport.tsx` - Step 6: JSON/OpenSCAD/Fusion360/DXF/production docs download buttons

## Decisions Made
- Event-driven auto-layout (explicit call after addElement, not useEffect watching elements) prevents infinite re-render loops per RESEARCH.md Pitfall 1
- Connector zone state lifted to WizardShell (not step-local) so both StepDevices and StepConnectors share the same zone preference for consistent layout
- useBlocker with withResolver:true enables declarative rendering of the confirmation dialog directly in JSX rather than imperative window.confirm
- Undo depth reference saved at mount time allows cancel to pop the exact number of undo entries back to pre-wizard state (not just a single undo)
- Task 1 created typed placeholder steps that WizardShell could import, enabling type-safe compilation before Task 2 filled in the full implementations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Wizard is fully functional end-to-end: newcomers can design a panel through guided steps without touching freeform canvas
- WizardShell's step infrastructure is extensible for 04-03 text label additions (label step could be added between review and export)
- Auto-layout V2 integration verified working in wizard context via event-driven calls
- All exports available from wizard flow (JSON, OpenSCAD, Fusion 360, DXF, production docs)

## Self-Check: PASSED

- All 9 source files verified present
- All 2 task commits verified (bd0b611, 9285140)
- tsc --noEmit: PASS
- vite build: PASS (wizard chunk: 24.31 kB / 5.99 kB gzip)

---
*Phase: 04-guided-wizard-smart-auto-layout*
*Plan: 02*
*Completed: 2026-02-22*
