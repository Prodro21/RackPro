# RackPro

## What This Is

A parametric rack mount panel configurator for designing custom 3D-printed or sheet metal rack enclosures. Users pick devices and connectors from a 97-entry equipment catalog, arrange them on a panel via a visual canvas or guided wizard, and export fabrication-ready files (STL, OpenSCAD, Fusion 360, DXF). Live at [rackpro.prodro.pro](https://rackpro.prodro.pro) with an optional local bridge for Fusion 360 integration.

## Core Value

Anyone can design a custom rack mount panel with real equipment dimensions and export a file they can fabricate — without CAD expertise.

## Requirements

### Validated

**v1.0 MVP (34 requirements):**
- ✓ Panel configuration (rack standard, U-height, materials, wall thickness) — pre-existing
- ✓ Element placement (devices + connectors on panel with drag positioning) — pre-existing
- ✓ SVG front view and side profile rendering — pre-existing
- ✓ Export to JSON, OpenSCAD, Fusion 360, DXF — pre-existing + v1.0
- ✓ Fusion 360 bridge (Python add-in, localhost:9100) — pre-existing
- ✓ MCP server for AI-assisted panel design — pre-existing
- ✓ Enclosure system (flanges, rear panel, vent slots, auto-reinforcement) — pre-existing
- ✓ Undo/redo — pre-existing
- ✓ 3D preview (three.js + react-three-fiber, lazy-loaded) — pre-existing
- ✓ Monolithic and modular assembly modes — pre-existing
- ✓ Split system for oversized panels — pre-existing
- ✓ Custom device creation modal — pre-existing
- ✓ BOM generation — pre-existing
- ✓ Equipment catalog: 60 devices + 37 connectors with Zod-validated schemas — v1.0
- ✓ Data confidence badges (datasheet / calipered / cross-referenced / estimated) — v1.0
- ✓ Catalog runtime validation with visible invalid-entry warnings — v1.0
- ✓ Independent catalog updates (versioned JSON in public/) — v1.0
- ✓ Device SVG outlines (10 priority devices, 2 faces each) — v1.0
- ✓ Catalog browser with fuzzy search and category/brand filters — v1.0
- ✓ One-click add from catalog and drag-from-catalog — v1.0
- ✓ URL sharing (base64 design encoding) — v1.0
- ✓ localStorage design persistence — v1.0
- ✓ Hash-based client-side routing (TanStack Router) — v1.0
- ✓ DXF preflight validation (closed contours, hole-to-edge, missing defs) — v1.0
- ✓ Export gating on critical validation issues — v1.0
- ✓ 3D CSS visibility toggle for Safari WebGL persistence — v1.0
- ✓ Cloudflare Workers deployment with SPA routing — v1.0
- ✓ 6-step guided wizard — v1.0
- ✓ Smart auto-layout V2 (weight-aware, connector families, 4 zone modes) — v1.0
- ✓ Custom element labels (SVG + DXF) — v1.0
- ✓ shadcn/ui component system — v1.0 (Slate/Teal), v1.1 (dual dark/light with #FF5500 orange)
- ✓ CSG boolean cutouts in 3D preview — v1.0
- ✓ PBR materials (brushed metal, matte plastic, carbon fiber) — v1.0
- ✓ Cmd+K command palette — v1.0
- ✓ Zustand selector stability tests — v1.0
- ✓ Filament + sheet metal cost estimation with assumptions — v1.0
- ✓ Community contribution pipeline (CONTRIBUTING.md, Issue Forms, CI validation) — v1.0

**v1.1 Frontend Redesign (6 requirements):**
- ✓ Dual dark/light theme with CSS variable system and instant switching — v1.1
- ✓ DM Sans + JetBrains Mono typography via Google Fonts CDN — v1.1
- ✓ Catalog browser as modal overlay (replaces page route) — v1.1
- ✓ Wizard as modal overlay (replaces page route) — v1.1
- ✓ SVG views fully theme-aware with semantic CSS variable palette — v1.1
- ✓ Single-view configurator (removed icon-nav + page routing) — v1.1

### Active

(Empty — define in next milestone via `/gsd:new-milestone`)

### Out of Scope

- Desktop app (Electron/Tauri) — web app + local bridge architecture instead
- Mobile app — desktop browser primary; panel design requires precision mouse interaction
- User accounts / authentication — zero-login access is the value proposition
- Real-time collaboration — single-user design tool; URL sharing covers the use case
- Server-side API backend — static hosting sufficient; client-side search over JSON catalog
- Cable routing / signal flow diagrams — different product category; RackPro is fabrication-focused
- Power budget / circuit breaker sizing — data-center-grade planning out of scope for homelab/AV
- AI "design for me" mode — algorithmic auto-layout achieves 80% of value at 5% of cost
- Thermal simulation / airflow CFD — requires specialized physics engine
- DCIM integration (Device42, netTerrain) — enterprise APIs; homelab users have no DCIM

## Context

Shipped v1.1 with ~18,500 LOC TypeScript. 97 equipment entries (60 devices + 37 connectors) in the catalog. 10 priority devices have dimensioned SVG outlines. Deployed at rackpro.prodro.pro on Cloudflare Workers.

Tech stack: React 19, TypeScript, Vite, Tailwind CSS v4, Zustand 5, TanStack Router, three.js + @react-three/fiber + three-bvh-csg, shadcn/ui (new-york style), Fuse.js, Sonner, Radix Dialog, Google Fonts (DM Sans + JetBrains Mono).

Known patterns:
- React 19 + Zustand 5 requires module-level selector caching for stable references
- zundo temporal middleware incompatible — manual undo/redo stacks
- Fusion 360 API quirks: use `healthState` not `isComputed`, cut direction +Z, XZ plane sketch_Y = -world_Z
- All catalog lookups must use `lookupDevice()`/`lookupConnector()` (3-tier: catalog store → inline constants → custom devices)
- Dark theme is :root default, light via `.light` class — no dark: prefix classes
- Tailwind v4 utility classes may not render for padding in some build scenarios — use inline styles as fallback
- Modal state (catalog/wizard open) in useUIStore, separate from config undo/redo stack in useConfigStore

Target audience: homelab hobbyists, AV installers, IT pros, makers.

## Constraints

- **Tech stack**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand 5 (keep + extend)
- **3D rendering**: three.js + @react-three/fiber + three-bvh-csg
- **Printer primary**: BambuLab P2S — 256mm bed, determines split thresholds
- **Panel width**: 19" panels (482.6mm) exceed P2S bed — split system required
- **Fusion bridge**: Python add-in on localhost:9100 — must remain local
- **Keystone jacks**: Require panel ≤ 2mm at cutout — local thinning needed for 3D prints
- **Equipment DB**: Client-side search over JSON catalog (server API if scale demands)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app + optional local Fusion bridge | Broadest reach without desktop packaging | ✓ Good — deployed to Cloudflare Workers, Fusion bridge works locally |
| Community-driven equipment database | Single maintainer can't cover all equipment | ✓ Good — CONTRIBUTING.md + Issue Forms + CI validation pipeline |
| Both visual canvas + guided wizard UX | Experienced users want speed, newcomers need guidance | ✓ Good — wizard + configurator with shared state |
| Keep React + TypeScript stack, extend | Substantial working codebase, no reason to rewrite | ✓ Good — added TanStack Router, shadcn/ui, Fuse.js |
| Manual undo/redo over zundo | zundo incompatible with React 19 | ✓ Good — works reliably |
| Module-level selector caching | React 19 + Zustand 5 tear detection requires stable references | ✓ Good — 16 stability tests passing |
| JSON catalog with client-side search | 50-100 entries doesn't need a server; GitHub repo for community PRs | ✓ Good — 97 entries, Fuse.js search <50ms |
| shadcn/ui (new-york) + Sonner | Professional appearance; Sonner replaces custom Toast | ✓ Good — consistent dark theme, accessible |
| CSG boolean subtraction (three-bvh-csg) | Real mesh holes vs. visual overlays | ✓ Good — cutouts visible from all angles |
| Auto-layout V2 (alternating ear + family grouping) | Better packing than V1 greedy left-to-right | ✓ Good — accepted over literal backtracking per CONTEXT.md |
| Cost estimation as ranges (±25%) | Exact pricing impossible without fabricator quotes | ✓ Good — explicit assumptions shown |
| Dark-first theme (:root default) | Majority of target audience prefers dark; simpler CSS without dark: prefixes | ✓ Good — clean CSS, instant switching |
| Google Fonts CDN over self-hosted @fontsource | Simpler build, cache-friendly, no bundle size impact | ✓ Good — DM Sans + JetBrains Mono load fast |
| Catalog/Wizard as modal overlays vs routes | Single-view configurator is simpler; modals keep context visible | ✓ Good — removed routing complexity |
| useUIStore for ephemeral modal state | Keep undo/redo stack clean; modal open/close shouldn't be undoable | ✓ Good — clean separation |
| SVG CSS variables for theme colors | Instant theme switching without SVG re-render; semantic naming | ✓ Good — all views theme-aware |
| Inline styles for sidebar padding | Tailwind v4 utility classes inconsistently applied in some scenarios | ⚠️ Revisit — investigate root cause |

---
*Last updated: 2026-02-23 after v1.1 milestone*
