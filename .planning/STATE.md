# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Anyone can design a custom rack mount panel with real equipment dimensions and export a fabrication-ready file — without CAD expertise.
**Current focus:** Phase 6 COMPLETE — Cost Estimation + Community Contributions

## Current Position

Phase: 6 of 6 (Cost Estimation + Community Contributions) -- COMPLETE
Plan: 2 of 2 in current phase -- ALL COMPLETE
Status: Phase 6 complete — all plans executed
Last activity: 2026-02-23 — Completed 06-01-PLAN.md (Cost Estimation Pure Functions + UI)

Progress: [████████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 25
- Average duration: 6min
- Total execution time: 2.65 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-catalog-schema | 4 | 13min | 3min |
| 01.1-device-outline-mvp | 4 | 11min | 3min |
| 02-catalog-browser-routing | 3 | 12min | 4min |
| 03-export-hardening-web-deployment | 2 | 37min | 19min |
| 04-guided-wizard-smart-auto-layout | 5 | 31min | 6min |
| 05-ui-3d-polish | 5 | 48min | 10min |
| 06-cost-estimation-community-contributions | 2 | 8min | 4min |

**Recent Trend:**
- Last 5 plans: 06-01 (4min), 06-02 (4min), 05-04 (17min), 05-05 (3min), 05-03 (3min)
- Trend: Phase 6 complete — all 2 plans executed

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 6-phase structure at comprehensive depth — catalog schema first, deployment before wizard, community contributions last after schema stability proven
- [Roadmap]: Phases 4 and 5/6 can execute in parallel after Phase 3 (Phase 4 from Phase 2, Phases 5+6 from Phase 3)
- [Stack]: TanStack Router (hash-based), Fuse.js, shadcn/ui (copy-to-source) — confirmed additions for this milestone
- [Data]: Equipment catalog lives in `public/catalog/` (not `src/constants/`) to decouple versioning from code releases
- [01-01]: z.literal(1) for schemaVersion enforcing exact match, enabling future schema migration via z.union
- [01-01]: PortGroup uses array-of-objects pattern for ergonomic JSON authoring
- [01-01]: Converter functions (toDeviceDef/toConnectorDef) create new objects for React safety
- [01-01]: All schemas re-exported from types.ts for single-module convenience
- [Phase 01]: [01-03]: fetchWithCache uses ETag/Last-Modified for localStorage cache invalidation
- [Phase 01]: [01-03]: catalogVersion string as memoization key for all selectors
- [Phase 01]: [01-03]: loadCatalog does not set ready:true on fetch failure (distinguishes loaded-empty from failed-to-load)
- [Phase 01]: [01-02]: Legacy slug aliases added for backward compat (usw-pm16, usw-pro-24, rj45-ks, fiber-lc, fiber-sc, db9, powercon)
- [Phase 01]: [01-02]: USW-Lite-8-PoE dimensions corrected to manufacturer datasheet (99.6x163.7x31.7mm)
- [Phase 01]: [01-02]: Cutout+module architecture for connectors: Neutrik D-type 14 modules, keystone 10 modules
- [Phase 01]: [01-04]: getState() over hook selector for catalog reads in Sidebar/SpecsTab — catalog data is static after boot
- [Phase 01]: [01-04]: Duplicated confidenceBadge() in Sidebar and SpecsTab — extraction to shared util deferred to Phase 2
- [Phase 01.1]: [01.1-01]: Shared SVG path utils extracted to scripts/lib/svg-path-utils.ts to avoid circular dependency between generate-outline and validate-outlines
- [Phase 01.1]: [01.1-01]: Scripts tsconfig.json does NOT extend root tsconfig -- uses NodeNext module resolution vs bundler
- [Phase 01.1]: [01.1-01]: Arc bounding box uses conservative endpoint +/- radius approach rather than exact arc math
- [Phase 01.1]: [01.1-02]: Generated outlines for all 10 priority devices (stretch goal) rather than minimum 5
- [Phase 01.1]: [01.1-02]: Separate generate-outline-index.ts script for manifest generation from filesystem scan
- [Phase 01.1]: [01.1-02]: public/catalog/outlines/{slug}-{face}.svg naming convention for outline assets
- [Phase 01.1]: [01.1-03]: Module-level cache for outline data (not Zustand) per MEMORY.md convention for static assets
- [Phase 01.1]: [01.1-03]: Async fetch with sync read-back pattern for outline loading: loadOutlinePath triggers fetch, getCachedOutlinePath reads cache synchronously for render
- [Phase 01.1]: [01.1-03]: null cached intentionally for missing outlines to prevent re-fetch attempts
- [Phase 01.1]: [01.1-03]: Top face for export outlinePath (tray generation), front face for FrontView rendering
- [Phase 01.1]: [01.1-04]: SLUG_ALIASES constant for hardcoded known mismatches (usw-lite-16 -> usw-lite-16-poe) rather than fuzzy matching
- [Phase 01.1]: [01.1-04]: Slug resolution inside all public API functions so callers never need to know about the mapping
- [Phase 01.1]: [01.1-04]: Cache keys use resolved slugs so both short and full form keys hit same cache entry
- [Phase 02]: [02-01]: Code-based routing (createRootRoute/createRoute) not file-based — no Vite plugin needed
- [Phase 02]: [02-01]: Named exports for route components with lazyRouteComponent second argument for explicit resolution
- [Phase 02]: [02-01]: Root layout (__root.tsx) owns catalog bootstrap and keyboard hooks — runs regardless of active route
- [Phase 02]: [02-01]: AppErrorBoundary standalone export in App.tsx wraps RouterProvider in main.tsx
- [Phase 02]: [02-02]: IFuseOptions imported as named type from fuse.js (not Fuse.IFuseOptions namespace) for correct TS resolution
- [Phase 02]: [02-02]: lookupConnector() replaces direct CONNECTORS[key] in addElement for catalog-loaded connector support
- [Phase 02]: [02-02]: application/rackpro-item MIME type for HTML5 drag data from catalog cards to FrontView canvas
- [Phase 02]: [02-02]: Connectors excluded when brand filter active (AND logic: connectors have no brand field)
- [Phase 02]: [02-03]: SerializedDesign v1 schema version tag for forward-compatible URL decoding
- [Phase 02]: [02-03]: Unknown device slugs preserved with saved dimensions on URL load — not filtered out
- [Phase 02]: [02-03]: URL design param stripped via replaceState after load — no bidirectional sync with TanStack Router
- [Phase 02]: [02-03]: Toast uses dedicated Zustand mini-store for imperative showToast() API without React context
- [Phase 03]: [03-01]: Validation elementId uses key-index format mapped to PanelElement.id for FrontView cross-component highlighting
- [Phase 03]: [03-01]: HOLE_TO_EDGE is warning severity (SM only); 3D print hole-to-edge is structurally less critical
- [Phase 03]: [03-01]: validationIssueIds is UI-only Zustand state (not undoable) for cross-component issue communication
- [Phase 03]: [03-01]: DXF dxfRect/dxfTrapezoid upgraded to LWPOLYLINE for guaranteed closed contours
- [Phase 03]: [03-02]: CSS display:none toggle instead of conditional render for 3D Canvas — prevents Safari WebGL context creation/destruction
- [Phase 03]: [03-02]: frameloop='never' when 3D tab hidden — pauses render loop to save GPU while Canvas stays mounted
- [Phase 03]: [03-02]: PWA registerType='prompt' — user sees toast on update, chooses when to refresh (no forced reload)
- [Phase 03]: [03-02]: PWA icons deferred — manifest works without icons, install prompt deferred until branding ready
- [Phase 03]: [03-02]: Cloudflare Web Analytics with PLACEHOLDER token — user replaces after enabling in dashboard
- [Phase 04]: CONNECTOR_FAMILIES map with slug-prefix fallback for unknown connector types
- [Phase 04]: Weight-aware placement alternates left/right from ears inward (heaviest first)
- [Phase 04]: Post-layout validation uses lightweight inline AABB checks (not full validateExportConfig)
- [Phase 04]: V1 layout.ts preserved unchanged for backward compatibility with MCP tests
- [Phase 04]: [04-02]: Event-driven auto-layout on add/remove (not useEffect) per RESEARCH.md Pitfall 1
- [Phase 04]: [04-02]: Connector zone state lifted to WizardShell and passed via props to step components
- [Phase 04]: [04-02]: useBlocker with withResolver:true for declarative confirmation dialog rendering
- [Phase 04]: [04-02]: Undo depth saved at mount time; cancel pops stack back to that depth for clean revert
- [Phase 04]: [04-02]: Placeholder steps in Task 1 enabled type-safe WizardShell compilation before full step implementation
- [Phase 04]: [04-03]: labelConfig is optional on PanelElement for backward compat with v1 designs
- [Phase 04]: [04-03]: Auto-numbering groups by element type AND label text, sorted L-to-R by X position
- [Phase 04]: [04-03]: Label stagger flips adjacent same-position labels to opposite side (above/below)
- [Phase 04]: [04-03]: labelConfig threaded through ExportElement for DXF/OpenSCAD generator access
- [Phase 04]: [04-03]: DXF 5-LABELS layer (color 7/white) with TEXT entities for laser engraving
- [Phase 04]: [04-03]: OpenSCAD deboss 0.3mm into faceplate with 0.4mm extrude, Liberation Sans font
- [Phase 04]: [04-05]: 3-branch lookup in Preview3D cutout mesh: connector via lookupConnector, fan via FANS[], device via lookupDevice
- [Phase 04]: [04-04]: Between-zone overflow connectors spill rightward past devRightEdge rather than wrapping
- [Phase 04]: [04-04]: clampDeviceBounds called at end of every zone shift case for uniform safety
- [Phase 04]: [04-04]: revalidatePositions is a thin export alias so validateLayout stays internal
- [Phase 04]: [04-04]: positionKey joins id:x:y for all elements as stable change-detection key
- [Phase 05]: [05-05]: selectMaxDeviceDepth memoized for performance even though it returns a primitive (avoids redundant iteration)
- [Phase 05]: [05-05]: as unknown as ConfigState double cast for partial mock objects in tests (tsc strict mode)
- [Phase 05]: [05-03]: Direct three-bvh-csg Brush/Evaluator API (not @react-three/csg wrapper) for batching control
- [Phase 05]: [05-03]: Fan cutouts use circular CSG (cutoutDiameter) not square, for realistic rendering
- [Phase 05]: [05-03]: Device elements excluded from ConnectorBodies (trays already provide spatial footprint)
- [Phase 05]: [05-01]: Inline SectionLabel/SpecTable in SpecsTab/SplitView rather than shared module extraction
- [Phase 05]: [05-01]: Dialog open prop pattern for CustomDeviceModal instead of conditional rendering
- [Phase 05]: [05-01]: Compact wrapper pattern (CompactSelect/Slider/Checkbox, FabToggle) in Sidebar for dense layouts
- [Phase 05]: [05-01]: Kept raw buttons for complex multi-state patterns (selection cards, filter pills, step indicators)
- [Phase 05]: [05-01]: Sonner toast positioned bottom-center with dark theme in root layout
- [Phase 05]: [05-02]: Fuse.js index rebuilt on palette open (not once) to pick up runtime catalog changes
- [Phase 05]: [05-02]: shouldFilter={false} on CommandDialog to use Fuse.js results instead of cmdk built-in filtering
- [Phase 05]: [05-02]: useCommandPalette hook returns {open, setOpen} state lifted to root layout
- [Phase 05]: [05-02]: TooltipProvider at root layout level with delayDuration=300 for consistent behavior
- [Phase 05]: [05-02]: Tooltip on SectionLabel headers rather than individual toggle buttons for cleaner UX
- [Phase 05]: [05-02]: ExportCard tooltip prop wraps title text with cursor-help for discoverability
- [Phase 05]: [05-04]: Procedural texture generation via sharp (scripts/generate-textures.ts) rather than external CC0 downloads
- [Phase 05]: [05-04]: Carbon filament detection uses actual keys (pacf, petcf, petgcf) not hyphenated variants
- [Phase 05]: [05-04]: Native HTML select for material dropdown overlay on Canvas (not shadcn Select)
- [Phase 05]: [05-04]: Environment preset changed from studio to warehouse for metallic reflections
- [Phase 05]: [05-04]: Tray/connector body materials kept as static MeshStandardMaterial (less prominent)
- [Phase 06]: [06-02]: validate-catalog.ts imports Zod schemas from src/catalog/schemas.ts via relative path for single source of truth
- [Phase 06]: [06-02]: Plausibility warnings exit 0 (soft flag); schema errors and slug collisions exit 1 (hard fail)
- [Phase 06]: [06-02]: Issue Form uses onmax/issue-form-parser for structured field extraction, peter-evans/create-pull-request for draft PR creation
- [Phase 06]: [06-02]: Connector Issue Form uses mountHoles dropdown (0/2/4) instead of text input to constrain valid values

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 3]: DXF preflight exact failure modes not fully specified — test representative DXF exports via SendCutSend before writing validation assertions
- [Pre-Phase 4]: RESOLVED in 04-01 — CONNECTOR_FAMILIES constant map defines grouping priority (cable-type grouping, alphabetical family sort)
- [Pre-Phase 6]: OpenSCAD WASM scope unclear — if live WASM preview enters scope, Phase 6 needs a research pass before planning

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 06-02-PLAN.md (Community Contribution Infrastructure)
Resume file: None
