# Roadmap: RackPro

## Overview

RackPro ships a polished, publicly hosted parametric rack mount configurator built on top of a substantial working foundation. The six phases progress from data layer (catalog schema + seed data) to UI surface (catalog browser + routing), to public readiness (export hardening + deployment), to onboarding quality (wizard + smart auto-layout), to professional finish (cost estimation + UI polish), and finally to visual quality and community pipeline (3D preview + contribution workflow). Each phase delivers a coherent capability that builds on the previous one without dead-end work.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Catalog Schema + Data Infrastructure** - Zod-validated equipment JSON catalog with 50+ seed entries and a versioned schema that everything else builds on
- [x] **Phase 1.1: Device Outline MVP** - INSERTED — AI-assisted SVG outlines for 5-10 priority devices (top and front faces) for fabrication-accurate tray/bracket generation and visual rendering
- [ ] **Phase 2: Catalog Browser + Routing** - Multi-view navigation with a searchable equipment browser and URL-shareable design state
- [ ] **Phase 3: Export Hardening + Web Deployment** - Validated DXF export, Safari WebGL fix, and publicly hosted static site on Cloudflare Pages
- [ ] **Phase 4: Guided Wizard + Smart Auto-Layout** - Multi-step onboarding wizard and connector-grouping auto-layout replacing the greedy left-to-right algorithm
- [ ] **Phase 5: Cost Estimation + UI Polish** - Filament and sheet metal cost range estimates with shadcn/ui component upgrades and stable selector tests
- [ ] **Phase 6: 3D Preview Polish + Community Contributions** - Orbit controls, material shading, accurate geometry in 3D preview, and GitHub PR contribution pipeline for community equipment submissions

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
**Plans**: TBD

Plans:
- [ ] 02-01: Install and configure `@tanstack/react-router` with hash-based routing; define `/`, `/catalog`, and `/wizard` routes in `main.tsx`/`App.tsx`; add navigation component
- [ ] 02-02: Build `src/components/CatalogBrowser.tsx` + `DeviceCard.tsx` with Fuse.js typeahead search, category/brand filters, confidence badge display, and "Add to Panel" dispatch to `useConfigStore`
- [ ] 02-03: Implement URL-shareable design state (base64 JSON hash in URL fragment) and localStorage auto-save/restore

### Phase 3: Export Hardening + Web Deployment
**Goal**: DXF exports pass fabricator preflight, the 3D tab survives tab-switching on Safari, and the app is live at a public URL on Cloudflare Pages
**Depends on**: Phase 2
**Requirements**: EXP-01, EXP-02, EXP-03, EXP-04, PLAT-02, 3D-01
**Success Criteria** (what must be TRUE):
  1. User can download a DXF file and see a preflight validation report before download, showing whether all cutout contours are closed and hole-to-edge distances meet the 2T minimum rule
  2. User sees a visible error before download if any placed element references a missing device or connector definition, rather than silently exporting a broken file
  3. User can switch between tabs multiple times on Safari without the 3D preview losing its WebGL context or becoming blank
  4. Anyone can open the app by navigating to a public URL (no localhost required, no install step)
**Plans**: TBD

Plans:
- [ ] 03-01: Add DXF preflight validation (closed contour check, hole-to-edge 2T check, missing definition check) and expose validation report UI step before download
- [ ] 03-02: Fix 3D preview tab mounting (CSS `display:none` instead of conditional unmount) to prevent Safari WebGL context exhaustion
- [ ] 03-03: Configure Vite `base`, GitHub Actions CI/CD pipeline, Cloudflare Pages `_redirects` for SPA routing, and `Cache-Control: no-cache` on `index.html`; verify public deployment

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
**Plans**: TBD

Plans:
- [ ] 04-01: Build `src/lib/autoLayoutV2.ts` with strip-packing heuristic, connector-type grouping, weight distribution preference, and validation pass on output; wire `suggestLayoutV2()` action into `useConfigStore`
- [ ] 04-02: Build `WizardShell.tsx` at `/wizard/*` with steps: rack standard → U-height → device selection (catalog) → connector placement → auto-layout suggestion → review → export; lazy-loaded via `React.lazy`; writes exclusively to existing `useConfigStore` actions
- [ ] 04-03: Add custom text label field to placed element editor; render labels in SVG front view and pass through to DXF export

### Phase 5: Cost Estimation + UI Polish
**Goal**: Users can see estimated fabrication cost ranges with explicit assumptions, and all form controls use accessible shadcn/ui components with stable, tested Zustand selectors
**Depends on**: Phase 3
**Requirements**: COST-01, COST-02, COST-03, COST-04, PLAT-03, PLAT-04
**Success Criteria** (what must be TRUE):
  1. User can see a filament cost estimate displayed as a range (e.g., "$12-$18 FDM") with explicit assumptions shown (filament cost per kg, infill %, support factor)
  2. User can see a sheet metal cost estimate as a range with material selection context and a direct link to SendCutSend or Protocase for exact quoting, accompanied by a clear "estimate only" disclaimer
  3. All dropdown selects, text inputs, and modal dialogs in the app use shadcn/ui components rather than raw HTML form elements
  4. Every Zustand selector returning an object or array passes a stability test (call twice, assert `===`) and has its cache key composition documented inline
**Plans**: TBD

Plans:
- [ ] 05-01: Build `src/lib/costEstimation.ts` with `estimatePrintCost()` (volume x density x $/kg x support factor) and `estimateSheetMetalCost()` (flat pattern area x material cost); build `CostPanel.tsx` with range display, visible assumptions, disclaimer, and fabricator links
- [ ] 05-02: Replace raw HTML `<select>`, `<input>`, and dialog elements with shadcn/ui components (`Select`, `Input`, `Dialog`, `Badge`, `Tooltip`, `Command`); initialize shadcn/ui via copy-to-source pattern
- [ ] 05-03: Audit all existing and new Zustand selectors returning objects/arrays; add module-level memoization with documented cache keys; add selector stability tests

### Phase 6: 3D Preview Polish + Community Contributions
**Goal**: The 3D preview renders the panel accurately with proper lighting and material appearance, and the community can submit new equipment entries via a validated GitHub PR workflow
**Depends on**: Phase 3
**Requirements**: 3D-02, 3D-03, COMM-01, COMM-02
**Success Criteria** (what must be TRUE):
  1. The 3D preview shows environment lighting with material-appropriate shading — plastic appearance for FDM materials, brushed metal appearance for sheet metal
  2. Connector cutouts and device bay openings are visible as accurate geometry in the 3D panel model (not approximated or omitted)
  3. A community contributor can find a contribution guide explaining how to submit a new device or connector as a GitHub PR, with a template that includes all required fields
  4. A submitted PR triggers CI validation that checks the Zod schema, detects slug collisions, and flags dimension values outside plausible ranges — rejecting obviously malformed entries automatically
**Plans**: TBD

Plans:
- [ ] 06-01: Add R3F orbit controls, environment map lighting, and material-appropriate shading (MeshStandardMaterial for plastic, MeshPhysicalMaterial brushed metal preset for sheet metal); ensure connector cutouts and device openings render as subtracted geometry in the 3D model
- [ ] 06-02: Write `CONTRIBUTING.md` in the repo root with PR submission guide and device/connector JSON template; set up GitHub Actions CI job that runs Zod schema validation, slug collision detection, and dimension plausibility range checks on every PR touching `public/catalog/`

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 1.1 → 2 → 3 → 4 → 5 → 6

Note: Phases 4 and 5/6 can proceed in parallel after Phase 3 completes (Phase 4 depends on Phase 2; Phases 5 and 6 depend on Phase 3). Default sequential execution unless explicitly parallelized.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Catalog Schema + Data Infrastructure | 4/4 | Complete | 2026-02-22 |
| 1.1. Device Outline MVP | 3/4 | Gap closure | - |
| 2. Catalog Browser + Routing | 0/3 | Not started | - |
| 3. Export Hardening + Web Deployment | 0/3 | Not started | - |
| 4. Guided Wizard + Smart Auto-Layout | 0/3 | Not started | - |
| 5. Cost Estimation + UI Polish | 0/3 | Not started | - |
| 6. 3D Preview Polish + Community Contributions | 0/2 | Not started | - |
