# Roadmap: RackPro

## Overview

RackPro ships a polished, publicly hosted parametric rack mount configurator built on top of a substantial working foundation. The six phases progress from data layer (catalog schema + seed data) to UI surface (catalog browser + routing), to public readiness (export hardening + deployment), to onboarding quality (wizard + smart auto-layout), to visual polish (shadcn/ui + PBR 3D preview), and finally to cost estimation and community pipeline. Each phase delivers a coherent capability that builds on the previous one without dead-end work.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Catalog Schema + Data Infrastructure** - Zod-validated equipment JSON catalog with 50+ seed entries and a versioned schema that everything else builds on
- [x] **Phase 1.1: Device Outline MVP** - INSERTED — AI-assisted SVG outlines for 5-10 priority devices (top and front faces) for fabrication-accurate tray/bracket generation and visual rendering
- [x] **Phase 2: Catalog Browser + Routing** - Multi-view navigation with a searchable equipment browser and URL-shareable design state (completed 2026-02-22)
- [x] **Phase 3: Export Hardening + Web Deployment** - Validated DXF export, Safari WebGL fix, and publicly hosted static site on Cloudflare Workers (completed 2026-02-22)
- [ ] **Phase 4: Guided Wizard + Smart Auto-Layout** - Multi-step onboarding wizard and connector-grouping auto-layout replacing the greedy left-to-right algorithm
- [ ] **Phase 5: UI + 3D Polish** - shadcn/ui component migration with Slate/Teal theme, PBR materials and CSG cutout geometry in 3D preview, Cmd+K command palette, and stable selector tests
- [ ] **Phase 6: Cost Estimation + Community Contributions** - Filament and sheet metal cost range estimates, and GitHub PR contribution pipeline for community equipment submissions
- [x] **Phase 7: Tech Debt Cleanup** - Fix CAT-05 Sidebar reactive selector, delete dead Toast.tsx, set Cloudflare analytics token (completed 2026-02-23)

## Phase Details

### Phase 1: Catalog Schema + Data Infrastructure
**Goal**: A stable, versioned equipment catalog with 50+ verified devices and connectors exists as the data foundation that every UI feature can build against
**Depends on**: Nothing (first phase)
**Requirements**: CAT-01, CAT-02, CAT-05, CAT-06, COMM-03
**Success Criteria** (what must be TRUE):
  1. User can open the app and 50+ real network devices with manufacturer-accurate dimensions are available in the data layer (even without catalog browser UI)
  2. User can see a data confidence badge on each catalog entry indicating whether dimensions came from a manufacturer datasheet, community measurement, or estimation
  3. Any malformed or schema-invalid catalog entry is rejected at load time with a visible warning rather than silently corrupting the panel dimensions
  4. A new catalog JSON file (updated independently from app code) can be dropped into `public/catalog/` and the app picks it up on next load without a code release
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Define Zod v4 schemas for CatalogDevice and CatalogConnector with derived types and backward-compat converters
- [x] 01-02-PLAN.md — Author devices.json (50+ entries) and connectors.json (30+ entries) with manufacturer-verified dimensions
- [x] 01-03-PLAN.md — Build useCatalogStore with fetch-on-load, Zod validation, localStorage cache, and backward-compatible lookup wiring
- [x] 01-04-PLAN.md — Gap closure: Wire loadCatalog() bootstrap, invalid entry warning UI, and data confidence badge display

### Phase 1.1: Device Outline MVP
**INSERTED** — Added to enable fabrication-accurate device profiles before public launch
**Goal**: 5-10 priority devices have dimensioned SVG outlines (top and front faces) that the configurator can use for snug-fit tray generation and realistic visual rendering, with rectangle fallback for all other devices
**Depends on**: Phase 1 (needs catalog schema with optional outlines field)
**Requirements**: None (new capability, not in original requirements)
**Success Criteria** (what must be TRUE):
  1. A script/tool exists that takes a product photo + bounding box dimensions and outputs a dimensioned SVG outline for a specified face (top, front, or side)
  2. 5-10 user-selected priority devices have SVG outlines in `public/catalog/outlines/{slug}-{face}.svg` for top and front faces (side face deferred to batch 2 per RESEARCH.md recommendation -- the SideView renders enclosure cross-sections, not device face silhouettes)
  3. The SVG outlines are fabrication-accurate — scaled to match the manufacturer bounding box dimensions within 0.5mm tolerance
  4. The app loads outline data on-demand and falls back to rectangular bounding box when outlines are absent
**Plans:** 4 plans

Plans:
- [x] 01.1-01-PLAN.md — Build outline generation CLI toolchain (generate-outline.ts + validate-outlines.ts) using Claude Vision API
- [x] 01.1-02-PLAN.md — Generate and validate SVG outlines for 5-10 priority devices, create index.json manifest
- [x] 01.1-03-PLAN.md — Wire outline loading into the app with on-demand fetch, memory cache, rectangle fallback, and export config integration
- [ ] 01.1-04-PLAN.md — Gap closure: Fix slug mismatch between DEVICES keys and outline index slugs, fix export top-face cache timing

### Phase 2: Catalog Browser + Routing
**Goal**: Users can navigate to a dedicated catalog view, search and filter it, add items to their panel with one click, share a design via URL, and save progress across sessions
**Depends on**: Phase 1
**Requirements**: CAT-03, CAT-04, CAT-07, UX-02, UX-03, UX-05, PLAT-01
**Success Criteria** (what must be TRUE):
  1. User can type a partial device name or brand and see matching results appear immediately with fuzzy typeahead matching
  2. User can filter the catalog by category (switch, router, patch-panel, connector, fan) and brand using visible filter controls
  3. User can click "Add to Panel" on any catalog item and it appears as a placed element in the configurator without leaving the catalog view
  4. User can switch between Catalog, Configurator, and Wizard views via navigation without losing their current design state
  5. User can copy a URL that, when opened in a new tab, recreates the exact same panel design
  6. User can close and reopen the browser tab and find their design still present (localStorage persistence)
**Plans:** 3/3 plans complete

Plans:
- [ ] 02-01-PLAN.md — Install TanStack Router + Fuse.js, create hash-based routing with three lazy-loaded routes, add NavSidebar, restructure App.tsx
- [ ] 02-02-PLAN.md — Build catalog browser with Fuse.js search, category/brand filters, adaptive accordion cards, grouped sections, and 60/40 split with live FrontView
- [ ] 02-03-PLAN.md — Implement URL-shareable design state (base64 in hash fragment) and debounced localStorage auto-save/restore with conflict toast

### Phase 3: Export Hardening + Web Deployment
**Goal**: DXF exports pass fabricator preflight, the 3D tab survives tab-switching on Safari, and the app is live at a public URL on Cloudflare Workers
**Depends on**: Phase 2
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, PLAT-02, 3D-01
**Success Criteria** (what must be TRUE):
  1. User can download a DXF file and see a preflight validation report before download, showing whether all cutout contours are closed and hole-to-edge distances meet the 2T minimum rule
  2. User sees a visible error before download if any placed element references a missing device or connector definition, rather than silently exporting a broken file
  3. User can switch between tabs multiple times on Safari without the 3D preview losing its WebGL context or becoming blank
  4. Anyone can open the app by navigating to a public URL (no localhost required, no install step)
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Build export preflight validation engine (closed contour, hole-to-edge, missing def, overlap, OOB checks) with PreflightReport UI inline in ExportTab and red highlighting on FrontView
- [x] 03-02-PLAN.md — Fix Safari 3D preview (persistent Canvas mount with CSS visibility toggle), deploy to Cloudflare Workers with GitHub Actions CI/CD, PWA offline support, update prompting, and analytics

### Phase 4: Guided Wizard + Smart Auto-Layout
**Goal**: A newcomer can complete a panel design end-to-end through a guided wizard, and the auto-layout groups connectors intelligently with weight distribution awareness
**Depends on**: Phase 2
**Requirements**: UX-01, UX-04, LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04
**Success Criteria** (what must be TRUE):
  1. User can complete a panel design from scratch via wizard steps — pick rack standard, set U-height, add devices from catalog, add connectors, review layout, export — without touching the freeform canvas
  2. User can add custom text labels to any placed element and those labels appear in the SVG front view
  3. Auto-layout groups same-type connectors together (all RJ45 adjacent, all BNC adjacent) rather than placing them in arbitrary order
  4. Auto-layout places heavier devices toward rack ears or center according to a visible weight distribution preference
  5. An auto-layout result passes the same validation checks as manual placement — no overlaps, all elements within bounds, all margins compliant
**Plans:** 5 plans

Plans:
- [x] 04-01-PLAN.md — Build autoLayoutV2 pure function with connector-type grouping, weight-aware ear placement, connector zone modes, overflow suggestions, and validation; wire suggestLayoutV2 store action and update MCP tool
- [x] 04-02-PLAN.md — Build guided wizard at /wizard with 6 steps (standard, U-height, devices, connectors, review, export), live FrontView preview, auto-layout on element changes, undo checkpoint, and sessionStorage persistence
- [x] 04-03-PLAN.md — Add ElementLabel type with position/autoNumber/icon, render labels in FrontView SVG with stagger collision handling, label editor in Sidebar, export to DXF (LABELS layer) and OpenSCAD (debossed text), persist via design serializer
- [ ] 04-04-PLAN.md — Gap closure: Fix between-zone overflow, zone shift bounds clamping, overlap-aware overflow detection, validation surfacing in store and wizard steps, moveElement re-validation
- [ ] 04-05-PLAN.md — Gap closure: Replace inline DEVICES[]/CONNECTORS[] lookups with catalog-aware lookupDevice()/lookupConnector() in Preview3D and useEnclosure for full 3D rendering of all elements

### Phase 5: UI + 3D Polish
**Goal**: All form controls use accessible shadcn/ui components with a refreshed Slate/Teal dark theme, the 3D preview renders accurate CSG cutout geometry with PBR materials, a Cmd+K command palette provides power-user access, and Zustand selectors are stable and tested
**Depends on**: Phase 3
**Requirements**: PLAT-03, PLAT-04, 3D-02, 3D-03
**Success Criteria** (what must be TRUE):
  1. All dropdown selects, text inputs, buttons, and modal dialogs use shadcn/ui components with a Slate/Neutral dark theme and Teal/Cyan accent color
  2. The 3D preview shows connector cutouts and device bay openings as actual CSG-subtracted geometry (real holes), not visual overlays
  3. The 3D preview uses PBR materials: brushed aluminum for sheet metal, matte plastic for standard FDM, carbon fiber texture for PA-CF/PET-CF, auto-switching on fab method with manual override
  4. A Cmd+K command palette supports navigation, device/connector search-and-add, export triggers, panel config changes, and undo/redo
  5. Tooltips appear on settings controls, validation warnings, toolbar buttons, and export options to explain meaning
  6. Every Zustand selector returning an object or array passes a stability test (call twice, assert `===`) and has its cache key composition documented inline
**Plans:** 4/5 plans executed

Plans:
- [x] 05-01-PLAN.md — Initialize shadcn/ui with Slate/Neutral + Teal/Cyan dark theme; replace all 9 legacy ui/ wrappers with shadcn equivalents in Sidebar, ExportTab, SpecsTab, SplitView; replace CustomDeviceModal with Dialog; replace Toast with Sonner; migrate all raw HTML buttons/inputs
- [x] 05-02-PLAN.md — Build Cmd+K command palette using shadcn Command (cmdk) with Fuse.js device/connector search, navigation, export triggers, panel config, undo/redo; add Tooltips to settings controls, toolbar buttons, export options
- [ ] 05-03-PLAN.md — Implement CSG boolean subtraction for connector cutouts and device bay openings using three-bvh-csg with union-then-subtract batching and mesh caching; add simplified 3D connector body meshes behind the faceplate
- [ ] 05-04-PLAN.md — Create PBR texture assets and usePanelMaterial hook; upgrade to MeshPhysicalMaterial with brushed metal, matte plastic, carbon fiber presets; auto-switch on fab method; material override dropdown; Environment upgrade to warehouse preset
- [ ] 05-05-PLAN.md — Audit all Zustand selectors returning objects/arrays; add module-level memoization to selectFaceplateElements, selectRearElements, selectMaxDeviceDepth; document all cache keys inline; write selector stability tests

### Phase 6: Cost Estimation + Community Contributions
**Goal**: Users can see estimated fabrication cost ranges with explicit assumptions, and the community can submit new equipment entries via a validated GitHub PR workflow
**Depends on**: Phase 5
**Requirements**: COST-01, COST-02, COST-03, COST-04, COMM-01, COMM-02
**Success Criteria** (what must be TRUE):
  1. User can see a filament cost estimate displayed as a range (e.g., "$12-$18 FDM") with explicit assumptions shown (filament cost per kg, infill %, support factor)
  2. User can see a sheet metal cost estimate as a range with material selection context and a direct link to SendCutSend or Protocase for exact quoting, accompanied by a clear "estimate only" disclaimer
  3. A community contributor can find a contribution guide explaining how to submit a new device or connector as a GitHub PR, with a template that includes all required fields
  4. A submitted PR triggers CI validation that checks the Zod schema, detects slug collisions, and flags dimension values outside plausible ranges — rejecting obviously malformed entries automatically
**Gap Closure:** Closes 6 orphaned requirements from v1.0 audit + 1 integration fix
**Plans**: 2 plans

Plans:
- [ ] 06-01-PLAN.md — Build `src/lib/costEstimation.ts` with `estimatePrintCost()` and `estimateSheetMetalCost()` pure functions; add CostSummaryCard to Sidebar, CostBreakdown to ExportTab with assumptions/disclaimer/fabricator links; add editable $/kg in sidebar config; fix ExportTab preflight effect position dependency
- [ ] 06-02-PLAN.md — Write `CONTRIBUTING.md` with dual submission paths (Issue Form + direct PR); create GitHub Issue Form templates for device/connector; build CI validation workflow + issue-to-PR automation workflow; create `scripts/validate-catalog.ts` reusing Zod schemas

### Phase 7: Tech Debt Cleanup
**Goal**: Close the last integration gap (CAT-05 Sidebar reactive selector) and clean up accumulated tech debt items before milestone completion
**Depends on**: Phase 6
**Requirements**: None (all 34/34 requirements already satisfied)
**Gap Closure:** Closes 1 integration gap from v1.0 audit + 2 tech debt items
**Success Criteria** (what must be TRUE):
  1. Sidebar confidence badge uses a reactive `useCatalogStore()` selector (not `getState()` snapshot) so the badge renders correctly even if element is selected before async catalog load completes
  2. Dead `src/components/Toast.tsx` file is deleted (replaced by Sonner in Phase 5)
  3. Cloudflare Web Analytics beacon in `index.html` has the real token (or a clear instruction for the user to set it)
**Plans**: 1 plan

Plans:
- [x] 07-01-PLAN.md — Fix CAT-05-SIDEBAR reactive selector in Sidebar.tsx, delete dead Toast.tsx (Cloudflare token pre-completed)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 2 → 3 → 4 → 5 → 6 → 7

Note: Phases 4 and 5/6 can proceed in parallel after Phase 3 completes (Phase 4 depends on Phase 2; Phases 5 and 6 depend on Phase 3). Default sequential execution unless explicitly parallelized.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Catalog Schema + Data Infrastructure | 4/4 | Complete | 2026-02-22 |
| 1.1. Device Outline MVP | 3/4 | Gap closure | - |
| 2. Catalog Browser + Routing | 3/3 | Complete    | 2026-02-22 |
| 3. Export Hardening + Web Deployment | 2/2 | Complete | 2026-02-22 |
| 4. Guided Wizard + Smart Auto-Layout | 3/5 | Gap closure | - |
| 5. UI + 3D Polish | 4/5 | In Progress|  |
| 6. Cost Estimation + Community Contributions | 0/2 | Not started | - |
| 7. Tech Debt Cleanup | 1/1 | Complete | 2026-02-23 |
