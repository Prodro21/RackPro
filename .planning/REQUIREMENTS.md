# Requirements: RackPro

**Defined:** 2026-02-21
**Core Value:** Anyone can design a custom rack mount panel with real equipment dimensions and export a fabrication-ready file — without CAD expertise.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Equipment Catalog

- [x] **CAT-01**: User can browse a catalog of 50+ real network devices with accurate dimensions from manufacturer datasheets
- [x] **CAT-02**: User can browse a catalog of 30+ real connectors (Neutrik D, BNC, keystone, SMA, fiber, D-sub, USB, HDMI, IEC) with precise cutout specs
- [x] **CAT-03**: User can search the catalog by name, brand, or type with fuzzy typeahead matching
- [x] **CAT-04**: User can filter the catalog by category (switch, router, patch-panel, connector, fan) and brand
- [x] **CAT-05**: User can see a data confidence badge on each catalog entry (manufacturer-datasheet, community-measured, estimated)
- [x] **CAT-06**: Catalog uses a versioned JSON schema validated by Zod on every load, rejecting malformed entries with visible warnings
- [x] **CAT-07**: User can add any catalog device or connector to their panel design with one click from the catalog browser

### Community

- [ ] **COMM-01**: Community can submit new device/connector specs via GitHub PR with a contribution guide and template
- [ ] **COMM-02**: Submissions are validated by CI (Zod schema check, slug collision check, dimension reasonableness)
- [x] **COMM-03**: Catalog updates ship independently from app code releases (versioned JSON in public/ directory)

### User Experience

- [x] **UX-01**: User can complete a panel design through a guided wizard: pick rack standard → select U-height → add devices from catalog → add connectors → review layout → export
- [x] **UX-02**: User can share a panel design as a URL link that recreates the exact configuration when opened
- [x] **UX-03**: User can save their current design to localStorage and reload it on next visit without losing work
- [x] **UX-04**: User can add custom text labels to any placed element, visible in SVG front view and DXF exports
- [x] **UX-05**: User can switch between configurator (freeform canvas), catalog browser, and wizard via navigation

### Auto-Layout

- [x] **LAYOUT-01**: Smart auto-layout groups connectors by type (all RJ45 together, all BNC together) instead of arbitrary left-to-right
- [x] **LAYOUT-02**: Auto-layout respects weight distribution preference (heavier devices toward rack ears/center)
- [x] **LAYOUT-03**: Auto-layout produces tighter packing than the current greedy algorithm with backtracking for better fit
- [x] **LAYOUT-04**: Auto-layout result passes the same validation checks as manual placement (no overlaps, within bounds, margin compliance)

### Cost Estimation

- [ ] **COST-01**: User can see an estimated filament cost range for 3D printing based on panel volume, material density, and configurable $/kg
- [ ] **COST-02**: User can see an estimated sheet metal cost range based on flat pattern area and material selection
- [ ] **COST-03**: Cost estimates display as ranges (not precise figures) with explicit assumptions shown
- [ ] **COST-04**: Sheet metal estimates include a link to SendCutSend/Protocase for exact quoting with a clear "estimate only" disclaimer

### Export Quality

- [x] **EXP-01**: DXF export validates that all cutout outlines are closed contours before download
- [x] **EXP-02**: DXF export validates hole-to-edge distances meet the 2T minimum rule
- [x] **EXP-03**: DXF export includes a preflight validation report visible to the user before download
- [x] **EXP-04**: Export blocks with a visible error if any placed element references a missing device/connector definition

### 3D Preview

- [x] **3D-01**: 3D preview canvas stays alive across tab switches (CSS visibility toggle, not unmount/remount) to prevent WebGL context exhaustion on Safari
- [ ] **3D-02**: 3D preview shows environment lighting and material-appropriate shading (plastic look for FDM, brushed metal for sheet metal)
- [ ] **3D-03**: 3D preview renders connector cutouts and device bay openings accurately in the panel geometry

### Platform

- [x] **PLAT-01**: App uses hash-based client-side routing with lazy-loaded route components for catalog, configurator, and wizard views
- [x] **PLAT-02**: App is deployed as a static site on Cloudflare Pages (or equivalent) with SPA fallback routing
- [ ] **PLAT-03**: UI uses shadcn/ui components replacing raw HTML form elements (selects, inputs, dialogs) for a professional appearance
- [ ] **PLAT-04**: All new Zustand selectors returning objects/arrays include module-level memoization with documented cache keys and stability tests

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: Offline catalog access with background sync from CDN-hosted catalog
- **ADV-02**: Animated split assembly diagram showing how pieces fit together
- **ADV-03**: OpenSCAD WASM in-browser preview (Web Worker required)
- **ADV-04**: Keystone jack auto-thinning geometry for 3D prints (currently validation warning only)
- **ADV-05**: Printer bed profile library as user-selectable UI option (currently constants only)

### Community Advanced

- **CADV-01**: Community upvote/verification system for equipment entries
- **CADV-02**: Community design gallery (shared URL collection)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time cloud collaboration | Massive backend complexity for a single-user tool; URL sharing covers the use case |
| User accounts / authentication | Auth adds friction; zero-login access is the value proposition |
| Server-side API backend | Static hosting sufficient; client-side search over JSON catalog |
| Cable routing / signal flow diagrams | Different product category (XTEN-AV, Visio); RackPro is fabrication-focused |
| Power budget / circuit breaker sizing | Data-center-grade planning out of scope for homelab/AV; PoE budget in BOM is sufficient |
| Mobile app or responsive mobile UI | Rack panel design requires precision mouse interaction |
| Electron / Tauri desktop app | Web app + local Fusion bridge is the decided architecture |
| Paid equipment database tier | Paywalling kills community contribution incentives |
| AI "design for me" mode | Algorithmic auto-layout achieves 80% of value at 5% of cost |
| Thermal simulation / airflow CFD | Requires specialized physics engine; exceeds scope |
| DCIM integration (Device42, netTerrain) | Enterprise APIs; homelab users have no DCIM |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAT-01 | Phase 1 | Complete |
| CAT-02 | Phase 1 | Complete |
| CAT-03 | Phase 2 | Complete |
| CAT-04 | Phase 2 | Complete |
| CAT-05 | Phase 1 | Complete |
| CAT-06 | Phase 1 | Complete |
| CAT-07 | Phase 2 | Complete |
| COMM-01 | Phase 6 | Pending |
| COMM-02 | Phase 6 | Pending |
| COMM-03 | Phase 1 | Complete |
| UX-01 | Phase 4 | Complete |
| UX-02 | Phase 2 | Complete |
| UX-03 | Phase 2 | Complete |
| UX-04 | Phase 4 | Complete |
| UX-05 | Phase 2 | Complete |
| LAYOUT-01 | Phase 4 | Complete |
| LAYOUT-02 | Phase 4 | Complete |
| LAYOUT-03 | Phase 4 | Complete |
| LAYOUT-04 | Phase 4 | Complete |
| COST-01 | Phase 5 | Pending |
| COST-02 | Phase 5 | Pending |
| COST-03 | Phase 5 | Pending |
| COST-04 | Phase 5 | Pending |
| EXP-01 | Phase 3 | Complete |
| EXP-02 | Phase 3 | Complete |
| EXP-03 | Phase 3 | Complete |
| EXP-04 | Phase 3 | Complete |
| 3D-01 | Phase 3 | Complete |
| 3D-02 | Phase 6 | Pending |
| 3D-03 | Phase 6 | Pending |
| PLAT-01 | Phase 2 | Complete |
| PLAT-02 | Phase 3 | Complete |
| PLAT-03 | Phase 5 | Pending |
| PLAT-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 — traceability mapped to 6-phase roadmap*
