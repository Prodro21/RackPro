# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Anyone can design a custom rack mount panel with real equipment dimensions and export a fabrication-ready file — without CAD expertise.
**Current focus:** Phase 2 — Catalog Browser + Routing

## Current Position

Phase: 2 of 6 (Catalog Browser + Routing)
Plan: 3 of 3 in current phase
Status: Executing
Last activity: 2026-02-22 — Completed 02-03-PLAN.md (URL Sharing + Persistence)

Progress: [█████░░░░░] 48%

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: 3min
- Total execution time: 0.60 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-catalog-schema | 4 | 13min | 3min |
| 01.1-device-outline-mvp | 4 | 11min | 3min |
| 02-catalog-browser-routing | 3 | 12min | 4min |

**Recent Trend:**
- Last 5 plans: 01.1-04 (2min), 02-01 (3min), 02-02 (5min), 02-03 (4min)
- Trend: Stable

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 3]: DXF preflight exact failure modes not fully specified — test representative DXF exports via SendCutSend before writing validation assertions
- [Pre-Phase 4]: Auto-layout connector-grouping priority order (airflow vs cable-type grouping) undefined — define as explicit constants before implementation
- [Pre-Phase 6]: OpenSCAD WASM scope unclear — if live WASM preview enters scope, Phase 6 needs a research pass before planning

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 02-02-PLAN.md (Catalog Browser UI) — all Phase 02 plans complete
Resume file: None
