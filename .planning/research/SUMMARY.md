# Project Research Summary

**Project:** RackPro — Parametric Rack Mount Panel Configurator
**Domain:** Web-based fabrication configurator (FDM 3D printing + sheet metal)
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

RackPro is a Milestone 2 extension of an already-functional parametric rack panel configurator. The existing app (React 19 + TypeScript + Vite + Zustand 5 + Tailwind v4 + three.js) already ships panel configuration, drag-and-drop element placement, SVG visualization, split-panel generation, and full fabrication export (OpenSCAD, DXF, Fusion 360 Python). The milestone adds six capability areas: a comprehensive community-extensible equipment database, client-side routing to support new views, a guided wizard for newcomers, smarter auto-layout, cost estimation, and public web deployment. The recommended approach is additive — extend the existing layered architecture (constants → lib → store → hooks → components) without restructuring it. The critical path is: catalog JSON schema + Zod validation → search index + new Zustand store → catalog browser UI → routing → wizard → deployment.

The key library additions are deliberately minimal: TanStack Router for type-safe routing in a plain Vite SPA, Fuse.js for client-side fuzzy search over a 50–150 item JSON catalog, and shadcn/ui component primitives (Radix UI under the hood) for accessible, Tailwind-composable UI polish. Cost estimation and auto-layout are pure TypeScript — no libraries. Deployment is Cloudflare Pages (unlimited bandwidth on free tier, critical because the app downloads STL files). No backend is needed at any point in this milestone.

The dominant risks are data quality and schema stability in the equipment database (wrong device dimensions cause real-money fabrication failures), React 19 + Zustand 5 selector memoization regressions when new store state is added, and WebGL context exhaustion on Safari when the 3D tab is mounted/unmounted via tab navigation. All three are well-understood and have documented prevention strategies. The community contribution system should remain closed until the initial catalog schema has stabilized; opening submissions too early produces a duplicate-and-spam graveyard that is expensive to clean.

---

## Key Findings

### Recommended Stack

The existing stack is correct and requires no changes. Seven new capabilities were evaluated: five are resolved with no new library (cost estimation, auto-layout, equipment database format, community contributions, and the SendCutSend pricing integration — confirmed no public API exists). Two require new dependencies: TanStack Router v1.161.x replaces ad-hoc tab routing, and Fuse.js v7.1.0 handles catalog search. shadcn/ui is a copy-to-source pattern (not an npm dependency) that resolves the known `cmdk` React 19 peer conflict and delivers accessible component primitives that compose natively with Tailwind v4. Optional: `@dnd-kit/core` + `@dnd-kit/sortable` only if the wizard introduces a sortable device list.

**Core technology additions:**
- `@tanstack/react-router` 1.161.x: type-safe routing in plain Vite SPA — replaces ad-hoc tab switching, enables `/catalog` and `/wizard` routes with search-param state
- `fuse.js` 7.1.0: zero-dependency client-side fuzzy search over JSON catalog — instantaneous at 50–150 records
- `shadcn/ui` (copy-to-source): Radix UI primitives styled with Tailwind — Dialog, Command, Badge, Tooltip, Select; resolves cmdk React 19 incompatibility
- `@dnd-kit/core` + `@dnd-kit/sortable` (conditional): sortable list in wizard only — stable React 19 peer; SVG canvas retains existing custom hook
- Cloudflare Pages: static SPA hosting — unlimited bandwidth on free tier, single `_redirects` line for SPA routing, git-push deploys
- Pure TypeScript modules: `costEstimation.ts`, `autoLayoutV2.ts`, `catalogSearch.ts` — no library equivalent for domain-specific logic

**Version constraints:**
- Do NOT use `@dnd-kit/react` v0.3.x — pre-1.0, API unstable
- Do NOT use `cmdk` directly — known React 19 peer conflict; use shadcn's patched `Command` component
- TanStack Router Vite plugin must be listed before `@vitejs/plugin-react` in `vite.config.ts`

### Expected Features

The competitive landscape is fragmented: enterprise tools (XTEN-AV, netTerrain) are too expensive and lack fabrication output; diagram tools (draw.io, Lucidchart) produce no STL/DXF; HomeRacker (the reference OpenSCAD design) handles only single-device layouts with no web UI. RackPro's unique position is the only tool combining accurate physical dimensions, multi-device layout with automated width budgeting, and fabrication output in both FDM and sheet metal formats, accessible via a hosted web UI.

**Must have (table stakes for this milestone):**
- Comprehensive equipment database (50+ verified devices + connectors with accurate dimensions from datasheets)
- Search + filter in equipment catalog — typeahead by name/brand/type; nobody scrolls 50+ items
- Web deployment (hosted public URL) — currently localhost-only; zero-friction access is required for community adoption
- Client-side routing — multi-view experience (catalog, configurator, wizard) cannot be tab-switched
- Save/load design state — users do not complete panels in one session; URL-share via base64 JSON hash

**Should have (milestone differentiators):**
- Guided wizard mode — multi-step onboarding (rack standard → U-height → devices → connectors → review → export)
- Smart auto-layout with connector grouping — keep same-type connectors adjacent, respect weight distribution
- Cost estimation — filament weight + reference sheet metal area pricing with explicit "estimate only" disclaimer
- Polished 3D preview — orbit controls, environment lighting, material appearance
- URL-shareable design state — base64 config hash in URL, zero infrastructure

**Defer to later:**
- Community contribution system (PR workflow) — build catalog schema stability first
- Offline catalog sync — bundle catalog with app build for v1; background fetch is a v2 concern
- Keystone local thinning (auto-thin panel at keystone cutout) — validation warning sufficient for v1
- Real-time collaboration, user accounts, mobile UI, Electron/Tauri desktop app

### Architecture Approach

The architecture follows a strict layered dependency hierarchy that must be preserved: constants → lib → store → hooks → components. All new capabilities slot into this hierarchy without restructuring. The equipment catalog lives in `public/catalog/` (not `src/constants/`) to decouple versioning from code releases. A new `useCatalogStore` handles catalog loading, search index, and filter state; the wizard writes directly to the existing `useConfigStore` (not a separate store) to prevent state divergence. Routing uses HashRouter (not BrowserRouter) for compatibility with static hosts. The MCP layer (separate Node.js process) and Fusion 360 bridge (localhost:9100) are unchanged.

**Major components:**
1. `public/catalog/devices.json` + `connectors.json` — versioned JSON, Zod-validated, community-contributable via GitHub PR
2. `src/store/useCatalogStore.ts` — loads catalog, builds Fuse.js index, exposes search/filter API; memoized selectors per MEMORY.md pattern
3. `src/components/CatalogBrowser.tsx` + `DeviceCard.tsx` — full-page catalog view at `/catalog` route; "Add to Panel" dispatches to `useConfigStore`
4. `src/lib/costEstimation.ts` — pure `estimatePrintCost()` + `estimateSheetMetalCost()` functions; consumed by `CostPanel.tsx` and MCP
5. `src/lib/autoLayoutV2.ts` — strip-packing heuristic with connector-type grouping; replaces greedy left-to-right; must call same validation logic as UI
6. `WizardShell.tsx` at `/wizard/*` route — multi-step view over existing `useConfigStore`; lazy-loaded via `React.lazy`
7. GitHub Actions + Vite `base` config + Cloudflare `_redirects` — deployment pipeline

**Critical build order (respects dependency graph):**
`types.ts` extension → catalog JSON seed data → `catalogSearch.ts` → `useCatalogStore` → routing → `CatalogBrowser` → `costEstimation.ts` (parallel) → `autoLayoutV2.ts` (parallel) → `WizardShell` → deployment → MCP catalog resources

### Critical Pitfalls

1. **Wrong device dimensions cause real-money fabrication failures** — Require `dataSource` field (`'manufacturer-datasheet'` | `'community-measured'` | `'estimated'`) on every catalog entry; surface confidence badge in UI; never double-apply the existing TOLERANCE=0.2mm constant. Address before any community submissions open.

2. **React 19 + Zustand 5 selector instability regresses with new state** — Every new store field is a potential re-render loop trigger. Write a selector stability test (call twice, assert `===`) for every selector returning object/array before adding new state. Document cache key composition next to each selector.

3. **Catalog JSON schema is an afterthought, then a crisis** — Add `schemaVersion: 1` at catalog root and a Zod schema on day one. Define required vs optional fields explicitly. Cache version in localStorage; invalidate on mismatch. Migrating after 200+ community entries is expensive.

4. **Cost estimator numbers are trusted as precise quotes** — Always display as a range ("$12–$18 FDM"), show explicit assumptions (filament cost/kg, support factor), link to live fabricator quoting page rather than replicating pricing. Add prominent disclaimer.

5. **WebGL context exhaustion on Safari breaks 3D tab** — Keep the R3F Canvas alive with `display: none` instead of conditional unmounting. Verify `forceContextLoss` on unmount. Add Safari to the test matrix before web deployment.

6. **DXF export fails fabricator preflight** — Test representative panels via SendCutSend upload before shipping. Add unit tests asserting closed contours, hole-to-edge distances, and bend annotations. The existing `dxfGen.ts` has no tests (documented in CONCERNS.md).

---

## Implications for Roadmap

Based on research, a 5-phase structure is recommended. The ordering respects the feature dependency graph (catalog must exist before wizard or smart layout), the architectural build order, and the "fix foundation before expanding" principle from PITFALLS.md.

### Phase 1: Foundation — Catalog Schema + Data Infrastructure

**Rationale:** Everything else (wizard, search, cost, smart layout) depends on the equipment catalog existing with a stable schema. Schema instability after community contributions arrive is the highest-cost pitfall. This phase has no UI — it is entirely data architecture.

**Delivers:** Zod-validated `public/catalog/devices.json` + `connectors.json` with 50+ seed entries, `schemaVersion: 1`, `dataSource` field on every entry; `src/types.ts` extensions for `CatalogDevice` and `CatalogConnector`; `src/lib/catalogSearch.ts` (pure, no React); `useCatalogStore` with memoized selectors and localStorage version cache; selector stability tests before any new store state.

**Addresses (from FEATURES.md):** Comprehensive equipment database, accurate connector cutout dimensions, enclosure depth auto-calculation correctness

**Avoids (from PITFALLS.md):** Pitfall 1 (wrong dimensions), Pitfall 3 (schema versioning crisis), Pitfall 4 (selector instability), Pitfall 11 (custom device loss on reload)

**Research flag:** Standard patterns — JSON schema design with Zod is well-documented. No deeper research needed.

---

### Phase 2: Catalog Browser + Routing

**Rationale:** Routing is a prerequisite for the catalog browser and wizard views. The catalog browser is the primary user-facing surface for Phase 1's data. This phase makes the catalog discoverable. URL sharing requires routing to exist.

**Delivers:** HashRouter + TanStack Router integration into `main.tsx`/`App.tsx`; `CatalogBrowser.tsx` at `/catalog` with Fuse.js typeahead search and type/brand filters; `DeviceCard.tsx` with "Add to Panel" action; URL-shareable design state via base64 JSON hash.

**Uses (from STACK.md):** `@tanstack/react-router` 1.161.x, `fuse.js` 7.1.0, `shadcn/ui` (Command, Badge, Input, Dialog)

**Implements (from ARCHITECTURE.md):** Boundary 1 (Equipment Catalog System), Boundary 2 (Client-Side Routing)

**Avoids (from PITFALLS.md):** Pitfall 4 (inline `useConfigStore` hook calls in JSX — use extracted variables), Pitfall 15 (grid dot SVG pattern regression — fix before adding catalog sidebar)

**Research flag:** Standard patterns — routing integration and Fuse.js usage are well-documented.

---

### Phase 3: Export Hardening + Web Deployment

**Rationale:** Going public before fixing DXF preflight failures and the Safari WebGL context bug would immediately damage trust. Deployment unlocks community discovery, which is required before Phase 4's wizard drives adoption. Security review of the Fusion bridge must happen before the URL becomes public. This phase should precede the wizard — a broken export on a publicly hosted tool is worse than a missing feature.

**Delivers:** DXF export tests + validation report step; WebGL context fix (CSS `display:none` instead of conditional unmount); Fusion bridge security hardening (shared secret header + path whitelist); GitHub Actions CI/CD pipeline; Vite `base` config; Cloudflare Pages `_redirects`; `Cache-Control: no-cache` on `index.html`.

**Uses (from STACK.md):** Cloudflare Pages free tier, GitHub Actions

**Implements (from ARCHITECTURE.md):** Boundary 5 (Web Deployment)

**Avoids (from PITFALLS.md):** Pitfall 6 (DXF preflight failures), Pitfall 8 (Safari WebGL exhaustion), Pitfall 13 (bridge security), Pitfall 14 (stale app cache)

**Research flag:** Standard patterns for Cloudflare Pages deployment. DXF validation may benefit from a quick research pass on SendCutSend's preflight requirements if the existing CONCERNS.md gaps are not fully specified.

---

### Phase 4: Guided Wizard + Smart Auto-Layout

**Rationale:** The wizard is the primary onboarding path for newcomers and the biggest UX differentiator. It depends on the catalog (Phase 1), routing (Phase 2), and auto-layout v2. The wizard must write to the same `useConfigStore` actions as the configurator — this is the most likely state divergence trap. Auto-layout v2 is a wizard dependency (the "arrange for me" step) and benefits from fixing the width budget inconsistency first.

**Delivers:** `src/lib/autoLayoutV2.ts` with connector-type grouping and strip heuristic; fixed width budget formula aligned with validation; `suggestLayoutV2()` action in `useConfigStore`; `WizardShell.tsx` at `/wizard/*` with steps: rack standard → U-height → device selection (catalog) → connector placement → auto-layout suggestion → review → export.

**Uses (from STACK.md):** `@dnd-kit/core` + `@dnd-kit/sortable` (sortable device list step only); shadcn/ui (Dialog, Select, Button)

**Implements (from ARCHITECTURE.md):** Boundary 4 (Enhanced Auto-Layout), wizard flow from Data Flow section

**Avoids (from PITFALLS.md):** Pitfall 10 (auto-layout produces overlapping layouts), Pitfall 12 (wizard state diverges from configurator), Pitfall 16 (O(n²) overlap checks — add spatial partitioning before catalog expansion enables 30+ elements)

**Research flag:** Wizard UX step design follows established Nielsen Norman Group patterns (well-documented). Auto-layout strip heuristic is domain-specific — no additional research needed.

---

### Phase 5: Cost Estimation + 3D Preview Polish + Community Contribution System

**Rationale:** Cost estimation and 3D preview polish are high-value but have no blocking dependencies — they can be built in parallel after Phase 2. Grouping them in Phase 5 allows earlier phases to deliver the core product loop (catalog → configure → export → deploy) without the added complexity. Community contributions open only after schema stability is proven (post-Phase 1 + real usage).

**Delivers:** `src/lib/costEstimation.ts` with `estimatePrintCost()` (filament volume × density × $/kg × support factor) and `estimateSheetMetalCost()` (flat pattern area × material cost); `CostPanel.tsx` showing range estimates with explicit assumptions; GitHub PR contribution guide + CI Zod schema validation for community device submissions; R3F orbit controls + environment lighting + material appearance improvements; printer bed profile selector exposed in UI.

**Uses (from STACK.md):** Pure TypeScript for cost engine; existing `@react-three/fiber` + `three-bvh-csg` for 3D polish; existing Zod v4.3.6 for CI validation

**Implements (from ARCHITECTURE.md):** Boundary 3 (Cost Estimation Engine); community catalog PR workflow

**Avoids (from PITFALLS.md):** Pitfall 2 (community submission duplicates — enforce slug schema + fuzzy dedup check), Pitfall 5 (cost numbers trusted as quotes — range display + disclaimer), Pitfall 7 (OpenSCAD WASM blocks UI — if added, must use Web Worker with 60s timeout)

**Research flag:** SendCutSend pricing is confirmed to have no public API. Community contribution workflow (GitHub PR + bot) is well-documented. OpenSCAD WASM integration (if pursued in this phase) would need a research-phase pass.

---

### Phase Ordering Rationale

- **Data before UI:** The catalog schema (Phase 1) must exist before the browser UI (Phase 2) or wizard (Phase 4) can be built against it. This prevents rework from schema changes.
- **Deployment before onboarding:** Publishing (Phase 3) before the wizard (Phase 4) means community discovery happens before the onboarding path is polished — but a buggy export on a public URL is a worse outcome than a delayed wizard. The wizard adds to an already-useful tool.
- **Foundation fixes before expansion:** The width budget inconsistency, custom device persistence, and selector stability must be resolved before expanding catalog size or adding wizard flows that rely on them.
- **Community contributions last:** Opening submissions before the schema is stable and proven in production produces cleanup debt that never gets paid.

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (DXF hardening):** If CONCERNS.md does not fully specify the DXF preflight failure modes, a targeted research pass on SendCutSend preflight requirements is warranted before writing test assertions.
- **Phase 5 (OpenSCAD WASM):** If live WASM preview is scoped into this milestone, the Web Worker integration requires a research-phase pass — the openscad-wasm library's worker API is not widely documented.

Phases with standard patterns (skip research-phase):
- **Phase 1:** JSON schema design + Zod validation — established patterns, high-quality official docs.
- **Phase 2:** TanStack Router + Fuse.js — both have excellent official documentation; shadcn/ui init is a single CLI command.
- **Phase 4:** Wizard UX step structure — NN/g patterns apply directly; auto-layout strip heuristic is domain logic with no library equivalent.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library versions npm-verified (2026-02-20). Cloudflare Pages limits verified via official docs. SendCutSend API absence confirmed via their own FAQ. React 19 + Tailwind v4 compatibility confirmed via shadcn official docs. |
| Features | HIGH (core), MEDIUM (community/cost) | Core features grounded in competitive analysis and existing codebase. Community workflow and cost estimation UX are reasonable inferences from analogous tools — not directly benchmarked. |
| Architecture | HIGH | Build order derived from actual dependency graph. Anti-patterns come from MEMORY.md (proven regressions, not speculation). HashRouter requirement confirmed via GitHub Pages SPA routing limitation documentation. |
| Pitfalls | HIGH | Critical pitfalls grounded in CONCERNS.md (documented codebase issues), MEMORY.md (already-encountered bugs), and verified external sources (SendCutSend preflight, WebGL Safari issue in R3F discussions). |

**Overall confidence:** HIGH

### Gaps to Address

- **Exact DXF preflight failure modes:** CONCERNS.md documents `dxfGen.ts` has no tests but does not enumerate which specific entity types or tolerances cause SendCutSend rejections. Resolution: upload 2–3 representative DXF exports to SendCutSend's free instant quote before writing test assertions.
- **Auto-layout grouping heuristic quality:** The strip heuristic is correct in structure, but the connector-type grouping priority order (e.g., does airflow grouping override cable-type grouping?) is not defined. Resolution: define priority rules as explicit constants in `autoLayoutV2.ts` before implementation so they can be tuned without structural changes.
- **Community contribution review capacity:** The PR-based contribution workflow scales indefinitely in theory, but the review burden on a solo maintainer is undefined. Resolution: design the CI validation (Zod schema + slug collision check + dimension plausibility range) to auto-reject obviously bad submissions, minimizing manual review to genuine edge cases.
- **OpenSCAD WASM scope:** It is unclear whether live WASM preview is in scope for this milestone. If yes, Phase 5 needs a research-phase pass before implementation.

---

## Sources

### Primary (HIGH confidence)
- TanStack Router npm (v1.161.3, 2026-02-20) — routing decision
- Fuse.js npm (v7.1.0) — catalog search decision
- shadcn/ui Tailwind v4 + React 19 official docs — UI component decision
- Cloudflare Pages limits (official docs) — deployment decision
- SendCutSend FAQ — no public pricing API confirmation
- 3D print cost formulas (Prusa blog) — costEstimation formula structure
- Codebase CONCERNS.md (2026-02-21) — DXF test gaps, width budget inconsistency
- Codebase MEMORY.md — React 19 + Zustand 5 selector instability, XZ plane mapping, Fusion 360 API quirks

### Secondary (MEDIUM confidence)
- XTEN-AV, draw.io, HomeRacker, RackTables, netTerrain, Lanberg — competitive landscape analysis
- Nielsen Norman Group wizard research — wizard UX step structure
- SendCutSend DXF/STEP preflight guidelines — DXF failure mode categories
- react-three-fiber GitHub discussions — Safari WebGL context issue
- 2D rectangle packing strip rationale (David Colson) — auto-layout algorithm choice

### Tertiary (LOW confidence / needs validation)
- Community contribution review capacity estimate — inferred from solo-maintainer analogues, not measured
- Auto-layout grouping priority rules — designed from first principles, needs empirical tuning post-implementation

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes*
