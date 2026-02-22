# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Anyone can design a custom rack mount panel with real equipment dimensions and export a fabrication-ready file — without CAD expertise.
**Current focus:** Phase 1.1 — Device Outline MVP

## Current Position

Phase: 1.1 of 6 (Device Outline MVP)
Plan: 2 of 3 in current phase
Status: In Progress
Last activity: 2026-02-22 — Completed 01.1-02-PLAN.md (Device Outline Assets)

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 3min
- Total execution time: 0.31 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-catalog-schema | 4 | 13min | 3min |
| 01.1-device-outline-mvp | 2 | 6min | 3min |

**Recent Trend:**
- Last 5 plans: 01-02 (7min), 01-04 (2min), 01.1-01 (4min), 01.1-02 (2min)
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

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 3]: DXF preflight exact failure modes not fully specified — test representative DXF exports via SendCutSend before writing validation assertions
- [Pre-Phase 4]: Auto-layout connector-grouping priority order (airflow vs cable-type grouping) undefined — define as explicit constants before implementation
- [Pre-Phase 6]: OpenSCAD WASM scope unclear — if live WASM preview enters scope, Phase 6 needs a research pass before planning

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 01.1-02-PLAN.md (Device Outline Assets)
Resume file: None
