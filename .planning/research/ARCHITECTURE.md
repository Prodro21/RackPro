# Architecture Patterns

**Project:** RackPro — Parametric Rack Mount Panel Configurator
**Dimension:** Milestone extension — equipment database, routing, cost estimation, enhanced auto-layout, web deployment
**Researched:** 2026-02-21

---

## Recommended Architecture

The existing architecture is a well-layered SPA with a strict dependency hierarchy (constants → lib → store → hooks → components). The new capabilities must slot into this hierarchy without breaking existing boundaries. The core principle: **extend, do not restructure.**

```
Browser (SPA, hash-based routing)
│
├── Routes (React Router v6 HashRouter — 3 top-level routes)
│   ├── /              Configurator (existing FrontView / SideView / 3D / Export tabs)
│   ├── /catalog       Equipment Catalog Browser (new)
│   └── /wizard        Guided Setup Wizard (new)
│
├── UI Layer (React components — reads store, dispatches actions)
│   ├── Existing: Header, Sidebar, FrontView, SideView, Preview3D, SplitView, SpecsTab, ExportTab
│   └── New: CatalogBrowser, CatalogSearch, DeviceCard, WizardShell, CostPanel
│
├── Store Layer (Zustand — two stores, no middleware)
│   ├── useConfigStore (existing — panel config, elements, undo/redo)
│   └── useCatalogStore (new — equipment DB, search index, filters)
│
├── Lib Layer (pure functions — no React, shared with MCP)
│   ├── Existing: layout.ts, margins.ts, enclosure.ts, splitCalc.ts, bom.ts, ...
│   └── New: costEstimation.ts, autoLayoutV2.ts, catalogSearch.ts
│
├── Constants Layer (physical data, zero src/ imports)
│   ├── Existing: eia310.ts, connectors.ts, devices.ts, fans.ts, materials.ts, printers.ts
│   └── New: public/catalog/ (JSON files, versioned, loaded at startup)
│
├── Export Layer (pure format generators — unchanged)
└── MCP Layer (separate Node.js process — unchanged)
```

## Component Boundaries

### Boundary 1: Equipment Catalog System

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `public/catalog/devices.json` + `connectors.json` | Versioned JSON with `catalogVersion` field | Loaded by `useCatalogStore` at startup |
| `src/lib/catalogSearch.ts` (new) | Pure MiniSearch index builder — usable by UI + MCP | `useCatalogStore`, MCP resources |
| `src/store/useCatalogStore.ts` (new) | Loads JSON, builds index, localStorage version cache, search/filter API | `CatalogBrowser`, MCP |
| `src/components/CatalogBrowser.tsx` (new) | Full-page catalog view at `/catalog` route | `useCatalogStore`, React Router |
| `src/components/DeviceCard.tsx` (new) | Single catalog entry card with "Add to Panel" action | `useCatalogStore`, `useConfigStore` |

**Versioning:** `public/catalog/` files are static assets. Version field in JSON checked against localStorage on startup. Community contributions via GitHub PR → merge → bump version → next load auto-updates.

### Boundary 2: Client-Side Routing

**Decision: HashRouter** (not BrowserRouter)

- GitHub Pages / Cloudflare Pages with SPA fallback — `/#/catalog` survives page refresh
- 3 routes only — minimal surgery: wrap `main.tsx` in router, add `<Routes>` in `App.tsx`

```typescript
// src/main.tsx
root.render(<HashRouter><App /></HashRouter>);

// src/App.tsx
<Routes>
  <Route path="/catalog" element={<Suspense><CatalogBrowser /></Suspense>} />
  <Route path="/wizard/*" element={<Suspense><WizardShell /></Suspense>} />
  <Route path="/*" element={<ConfiguratorLayout />} />
</Routes>
```

Each new route is `React.lazy`-wrapped — proven pattern already used for `Preview3D.tsx`.

### Boundary 3: Cost Estimation Engine

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/lib/costEstimation.ts` (new) | Pure: `estimatePrintCost()`, `estimateSheetMetalCost()` | `CostPanel`, export generators, MCP |
| `src/components/CostPanel.tsx` (new) | Renders cost breakdown in SpecsTab or new tab | `useConfigStore`, `lib/costEstimation` |
| `src/constants/materials.ts` (extend) | Add `pricePerKg`, sheet metal cost factors | `lib/costEstimation` |

SendCutSend has no public pricing API (verified). Parameterized formula with explicit "Estimate only — upload DXF for exact quote" disclaimer is correct.

### Boundary 4: Enhanced Auto-Layout (v2)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `src/lib/autoLayoutV2.ts` (new) | Strip placement with connector grouping by cable type | Store action, MCP layout tool |
| `src/lib/layout.ts` (existing) | Kept as fallback fast path | `autoLayoutV2` |

Strip heuristic (not 2D bin packing) is correct: the panel is a 1D strip. Bin packing libraries (potpack, etc.) don't handle domain constraints like cable grouping.

### Boundary 5: Web Deployment

| Layer | Decision | Rationale |
|-------|----------|-----------|
| Hosting | Cloudflare Pages / GitHub Pages | Zero cost, integrated with catalog PR workflow |
| Routing | HashRouter | Required for static hosting without server fallback |
| Build | Vite + GitHub Actions | Existing config + `base` path added |
| Catalog updates | Push to main → auto-deploy | No separate versioning server |
| MCP + Fusion bridge | Local only, not hosted | stdio + localhost:9100 — inherently local |

## Data Flow

**Catalog:** `public/catalog/*.json` → `useCatalogStore.loadCatalog()` → `buildCatalogIndex()` → `CatalogBrowser` (UI) + `MCP resources` → `useConfigStore.addElement()` → `FrontView` re-renders

**Cost:** `useConfigStore` state → `generateConfig()` → `ExportConfig` → `estimatePrintCost()` + `estimateSheetMetalCost()` → `CostPanel.tsx`

**Wizard:** `WizardShell` steps call same `useConfigStore` actions as manual configurator. Step index lives in local `useState`. On finish: `useNavigate('/')` → configurator shows completed panel.

**Routing + Store:** Hash change → React Router renders route component → components read from existing stores. Store state NOT reset on navigation.

## Anti-Patterns to Avoid

1. **Catalog in `src/constants/`** — couples versioning to code releases. Use `public/catalog/` instead.
2. **BrowserRouter without server fallback** — breaks on page refresh with static hosting. Use HashRouter.
3. **Separate wizard store** — state sync is a bug factory. Wizard writes to `useConfigStore` directly.
4. **SendCutSend API calls** — no API exists. Use parameterized formulas with disclaimer.
5. **Inline `useConfigStore(selector)` in JSX** — hooks violation + React 19 re-render loop (MEMORY.md).
6. **`useCatalogStore` selectors returning new arrays without module-level memoization** — same React 19 + Zustand 5 infinite re-render issue documented in MEMORY.md.

## Suggested Build Order

| Order | Item | Depends On | Unlocks |
|-------|------|-----------|---------|
| 1 | Extend `src/types.ts` with `CatalogDevice`, `CatalogConnector`, `SheetPricingParams` | — | Everything |
| 2 | `public/catalog/devices.json` + `connectors.json` seed data | types schema | useCatalogStore |
| 3 | `src/lib/catalogSearch.ts` — search index builder | types | useCatalogStore, MCP |
| 4 | `src/store/useCatalogStore.ts` | lib/catalogSearch | CatalogBrowser |
| 5 | `src/lib/costEstimation.ts` | materials constants | CostPanel |
| 6 | Extend `src/constants/materials.ts` with pricing | — | costEstimation |
| 7 | Add HashRouter + Routes to `main.tsx` / `App.tsx` | react-router-dom | All new routes |
| 8 | `CatalogBrowser.tsx` + `DeviceCard.tsx` | useCatalogStore, routing | Wizard step 2 |
| 9 | `CostPanel.tsx` | lib/costEstimation | Cost in export |
| 10 | `src/lib/autoLayoutV2.ts` | lib/layout | WizardShell |
| 11 | `suggestLayoutV2()` action in useConfigStore | autoLayoutV2 | WizardShell |
| 12 | `WizardShell.tsx` | routing, useCatalogStore, autoLayoutV2 | End-to-end wizard |
| 13 | GitHub Actions deploy + Vite `base` config | All above | Public hosting |
| 14 | Extend MCP `resources/catalogs.ts` | lib/catalogSearch | AI catalog queries |

**Critical path:** types → catalog JSON → catalogSearch → useCatalogStore → CatalogBrowser → routing → WizardShell → deployment

Cost estimation and auto-layout v2 are parallel tracks — build them after catalog works.

## Sources

- [React Router v6 HashRouter](https://reactrouter.com/)
- [GitHub Pages SPA routing limitation](https://github.com/orgs/community/discussions/64096)
- [Vite GitHub Pages deployment](https://paulserban.eu/blog/post/deploy-vite-react-with-react-router-app-to-github-pages/)
- [3D print cost formulas — Prusa](https://blog.prusa3d.com/how-to-calculate-printing-costs_38650/)
- [SendCutSend pricing (no API)](https://sendcutsend.com/pricing/)
- [2D rectangle packing — strip approach rationale](https://www.david-colson.com/2020/03/10/exploring-rect-packing.html)
