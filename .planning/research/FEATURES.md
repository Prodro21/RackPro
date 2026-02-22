# Feature Landscape

**Domain:** Parametric rack mount panel configurator (web app, FDM 3D print + sheet metal fabrication)
**Researched:** 2026-02-21
**Overall confidence:** HIGH (core features), MEDIUM (community/cost features)

---

## Scope: What Already Exists

The following are already implemented and are NOT research targets for this milestone:

- Panel configuration (rack standard, U-height, material, wall thickness)
- Element placement with drag-and-drop on SVG canvas
- SVG front view + side profile rendering
- Export: JSON, OpenSCAD (.scad + BOSL2), Fusion 360 Python script, DXF flat pattern
- Fusion 360 bridge (localhost:9100 Python add-in)
- MCP server for AI-assisted design
- Enclosure system (flanges, rear panel, vent slots, auto-reinforcement)
- Greedy auto-layout suggestion (left-to-right)
- Validation (overlaps, margins, out-of-bounds, structural)
- Undo/redo
- 3D preview (three.js + react-three-fiber, lazy-loaded)
- Monolithic and modular assembly modes
- Split system for oversized panels (3-piece with lockpin joints)
- Custom device creation modal
- BOM generation

Research below focuses on the ACTIVE milestone features and what the competitive landscape reveals.

---

## Table Stakes

Features users expect from any credible fabrication-oriented configurator. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Comprehensive equipment database (50+ devices + connectors with accurate specs) | Users need real dimensions to design real panels — placeholder data is useless for fabrication | High | Core differentiator vs. generic rack diagram tools. netTerrain ships 9K+ devices; XTEN-AV ships 1.5M AV items. 50–200 entries covers the homelab + AV sweet spot |
| Search + filter in equipment catalog | Nobody scrolls through 50+ items; search by name/brand/type is baseline | Medium | Typeahead search, filter by type (switch, connector, fan), filter by brand. Client-side fuse.js or similar |
| Accurate connector cutout dimensions in library | Without precise cutout specs (Neutrik D-type 24mm, BNC 9.5mm, Keystone 14.9x19.2mm), the panel cannot be fabricated | Medium | Already partially exists; needs to be comprehensive and verified against datasheets |
| Panel element labels / annotation | Users need to identify what each slot is when reading the SVG or exporting DXF | Low | Custom label per element, font size, position. Required for documentation and BOM |
| Enclosure depth auto-calculation | Deepest connector or device behind panel determines enclosure depth — if wrong, nothing fits | Low | Already exists; must stay correct when catalog expands |
| Real-time validation feedback | If elements overlap or exceed panel bounds, user must know immediately — fabricating with errors is expensive | Low | Already exists; must remain visible and actionable |
| Visual representation of elements on canvas | A text list of elements is insufficient; users need to see spatial layout before fabricating | Medium | Already exists; quality/fidelity matters — must be accurate to scale |
| Export in at least one fabrication-ready format | The entire value prop collapses without a usable output file | High | Already exists (OpenSCAD, DXF, Fusion 360) |
| Save and load design state | Users do not complete a design in one session; losing work kills trust | Medium | JSON export covers this partially; true save/load (URL share or localStorage) is expected |

---

## Differentiators

Features that set RackPro apart from generic rack diagram software and simple parametric template generators.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Community-driven equipment database with PR workflow | Single maintainer cannot cover all gear; GitHub PR submissions scale indefinitely. No competitor in homelab space does this | Medium | JSON catalog in repo + contribution guide. Review process (CI validation of JSON schema) matters for quality |
| Versioned catalog independent from app releases | Equipment specs must update without requiring app redeploys | Low | Separate catalog.json fetched at runtime (or bundled with version tag). Offline fallback to bundled version |
| Guided wizard mode for newcomers | Homelab audience skews technical but not CAD-experienced; wizard lowers the barrier dramatically | High | Multi-step flow: pick rack standard → select U-height → add devices (catalog) → add connectors → review → export |
| Smart auto-layout with grouping intelligence | "Put all RJ45s together, put power at bottom" is what experienced rack builders do manually — automating it is valuable | High | Group by type (connectors, devices), respect weight distribution, minimize cable crossing, optimize for airflow |
| Cost estimation (filament weight + sheet metal pricing) | Users need to decide: print it or cut it? A real cost comparison with material selection seals the decision | High | Filament: volume x density x $/kg. Sheet metal: area x material cost/m². SendCutSend has no public API — use reference pricing table |
| Print-bed-aware split strategy with visual diagram | No other homelab configurator shows you exactly how the panel splits for your specific printer bed | High | Already exists; polish the split diagram view to be the "wow moment" — animated assembly view |
| Polished 3D preview (orbit, zoom, material shading) | Confidence before fabrication. Users who cannot visualize will not commit to printing | High | Already exists (R3F + three-bvh-csg); needs orbit controls, environment lighting, material appearance |
| Printer bed profile library | Users swap printers; P2S is the primary but A1, X1C, Prusa MK4S are common | Low | Already partially exists (constants/printers.ts); expose as user-selectable UI option |
| URL-shareable design state | Share a panel design with a single link — huge for community sharing (Reddit, Discord, forums) | Medium | Encode config as base64 JSON in URL hash. No backend needed |
| Offline catalog access with background sync | Users in workshop environments may have spotty internet; catalog must work offline | Low | Bundle catalog with app; fetch updates on load and cache |
| Keystone jack local panel thinning flag | Keystones require ≤2mm panel at cutout — FDM prints need special annotation or auto-thinning | Medium | Flag in validation when keystone is placed on thick panel |
| Professional UI polish (trustworthy enough to fabricate from) | "This looks like a demo" kills confidence before users even try to export | Medium | Color consistency, scale accuracy, clear hierarchy |
| Web deployment (hosted, public URL) | Currently localhost-only; zero friction access is table stakes for community adoption | Medium | Vite build → static hosting (Cloudflare Pages). No backend required for v1 |
| Client-side routing (catalog → configurator → wizard) | Multi-view experience requires routing; tab switching is too limiting for catalog + wizard flows | Medium | TanStack Router or React Router. Hash-based routing works for static hosting |

---

## Anti-Features

Features to explicitly NOT build in this milestone (and rationale).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time cloud collaboration | Massive backend complexity for a single-user design tool | URL sharing covers 95% of the "share my design" use case |
| User accounts / authentication | Auth adds friction; the tool's value is immediate, zero-login access | Persist state in localStorage; share via URL |
| Server-side rendering or API backend | Static hosting is sufficient for a client-side tool | Client-side search over JSON catalog |
| Full cable routing diagram | Cable routing is a different product category (XTEN-AV, Visio) | BOM output includes connector types for cable planning |
| Power budget calculation with circuit breaker sizing | Data-center-grade power planning is out of scope for homelab/AV | Show PoE budget from device specs in BOM |
| Mobile app or responsive mobile UI | Designing rack panels requires precision mouse interaction | Desktop browser primary; tablet minimum |
| Electron / Tauri desktop app | Web app + local Fusion bridge architecture is established | Keep web app + optional local bridge pattern |
| Paid equipment database tier | Paywalling the catalog kills community contribution incentives | Keep catalog free and open |
| AI "design for me" mode | Without significant ML investment, AI suggestions are random permutations | Smart algorithmic auto-layout achieves 80% of value at 5% of cost |
| Thermal simulation / airflow CFD | Requires specialized physics engine; far exceeds scope | Surface note in wizard: "Ensure 1U spacing above heat-dissipating devices" |
| DCIM integration (Device42, netTerrain) | Enterprise DCIM systems have closed APIs; homelab users have no DCIM | JSON export covers data portability |

---

## Feature Dependencies

```
Comprehensive equipment database
    └── Community contribution system (cannot crowdsource what does not exist first)
    └── Offline catalog access (cannot cache what is not stable)
    └── Search + filter (catalog too large to browse without search)

Guided wizard mode
    └── Equipment database (wizard needs real devices to populate)
    └── Client-side routing (wizard is a separate route/view)
    └── Smart auto-layout (wizard's "arrange for me" step calls auto-layout)

Smart auto-layout with grouping
    └── Equipment database (needs type metadata per device)
    └── Validation (auto-layout must not violate panel constraints)

Cost estimation
    └── Equipment database (volume calc needs accurate panel element dimensions)
    └── Material selection (already exists in store)

URL-shareable design
    └── JSON config export (already exists — encode as URL param)

Polished 3D preview
    └── 3D preview (already exists — extend, do not replace)

Web deployment
    └── Client-side routing (routing must work on static host)
```

---

## MVP Recommendation for This Milestone

Prioritize (in order):

1. **Comprehensive equipment database** — 50+ verified devices and connectors with accurate dimensions
2. **Search + filter in catalog** — Typeahead by name, filter by type and brand
3. **Web deployment** — Hosted URL unlocks community discovery
4. **Client-side routing** — Required for wizard + catalog views
5. **Guided wizard mode** — Onboarding path that converts newcomers
6. **Smart auto-layout** — Grouping heuristic (connectors together, heavy devices at bottom)
7. **Cost estimation** — Filament weight + reference sheet metal pricing
8. **URL-shareable design** — Base64 config hash in URL. Zero infrastructure
9. **Polished 3D preview** — Orbit controls, environment lighting, material appearance

Defer to later:
- Community contribution system — build the catalog first, open contributions after schema stability
- Offline catalog sync — bundle catalog with app build for v1
- Keystone local thinning — validation warning sufficient for v1

---

## Competitive Landscape Summary

| Tool | Audience | Strengths | Gap RackPro Fills |
|------|----------|-----------|-------------------|
| XTEN-AV | Professional AV integrators | 1.5M AV products, AI layout, cloud collaboration | Too pro/expensive for homelab; no fabrication output (STL/DXF) |
| draw.io / Lucidchart | IT documentation | Good diagram tools, vendor shapes | Diagram-only, no fabrication output, generic shapes |
| RackTables | Data center ops | Asset management, DCIM-light | No design/configurator, no fabrication output |
| netTerrain | Enterprise DCIM | 9K+ devices, power tracking | Enterprise pricing, no 3D/fabrication output |
| HomeRacker | 3D print hobbyists | Same OpenSCAD base, free | Single device only, no web UI, no multi-device layout |
| Lanberg Configurator | Rack cabinet vendors | Drag-and-drop cabinet config | Product-locked (Lanberg gear only), no custom fabrication |

RackPro's unique position: The only tool combining (a) accurate physical device dimensions, (b) multi-device layout with automated width budgeting, (c) fabrication output in both FDM and sheet metal formats, and (d) a web-accessible interface.

---

## Sources

- [XTEN-AV](https://xtenav.com/)
- [draw.io rack diagrams](https://www.drawio.com/blog/rack-diagrams)
- [HomeRacker](https://homeracker.org/)
- [kellerlabs/homeracker GitHub](https://github.com/kellerlabs/homeracker)
- [Nielsen Norman Group on Wizards](https://www.nngroup.com/articles/wizards/)
- [BeeGraphy 2025 configurator review](https://beegraphy.com/blog/top-product-configurators-2025/)
- [SendCutSend pricing](https://sendcutsend.com/pricing/)
- [Prusa 3D printing price calculator](https://blog.prusa3d.com/3d-printing-price-calculator_38905/)
