# RackPro

## What This Is

A parametric rack mount panel configurator for designing custom 3D-printed or sheet metal rack enclosures. Users pick devices and connectors from a comprehensive equipment catalog, arrange them on a panel via a visual canvas or guided wizard, and export fabrication-ready files (STL, OpenSCAD, Fusion 360, DXF). Delivered as a web app with an optional local bridge for Fusion 360 integration.

## Core Value

Anyone can design a custom rack mount panel with real equipment dimensions and export a file they can fabricate — without CAD expertise.

## Requirements

### Validated

- ✓ Panel configuration (rack standard, U-height, materials, wall thickness) — existing
- ✓ Element placement (devices + connectors on panel with drag positioning) — existing
- ✓ SVG front view and side profile rendering — existing
- ✓ Export to JSON configuration — existing
- ✓ Export to OpenSCAD (.scad with BOSL2) — existing
- ✓ Export to Fusion 360 Python script — existing
- ✓ Export to DXF flat pattern (faceplate + per-device trays) — existing
- ✓ Fusion 360 bridge (Python add-in, localhost:9100, live build + screenshot + export) — existing
- ✓ MCP server for AI-assisted panel design — existing
- ✓ Enclosure system (flanges, rear panel, vent slots, auto-reinforcement) — existing
- ✓ Auto-layout suggestion (greedy left-to-right) — existing
- ✓ Validation (overlaps, margins, out-of-bounds, structural) — existing
- ✓ Undo/redo — existing
- ✓ 3D preview (three.js + react-three-fiber, lazy-loaded) — existing
- ✓ Monolithic and modular assembly modes — existing
- ✓ Split system for oversized panels (3-piece with lockpin joints) — existing
- ✓ Custom device creation modal — existing
- ✓ BOM generation — existing

### Active

- [ ] Comprehensive equipment database (50+ real devices and connectors with accurate specs)
- [ ] Community contribution system for new equipment submissions
- [ ] Browse and search catalog by brand, type, dimensions
- [ ] Versioned catalog updates independent from app releases
- [ ] Offline catalog access (bundled with sync)
- [ ] Polished 3D preview (rotation, inspection, accurate geometry)
- [ ] Smart auto-layout with connector grouping and optimal placement
- [ ] Cost estimation (filament usage, SendCutSend pricing, material comparison)
- [ ] Visual drag-drop canvas polish (smooth, reliable, professional)
- [ ] Guided wizard mode for newcomers (pick rack → add devices → configure → export)
- [ ] Professional UI polish (trustworthy enough to fabricate from)
- [ ] Web app deployment (hosted, accessible to all users)
- [ ] Optional local Fusion 360 bridge installer for power users
- [ ] Client-side routing for multi-view experience (catalog, configurator, wizard)

### Out of Scope

- Desktop app (Electron/Tauri) — web app + local bridge architecture instead
- Mobile app — desktop browser primary
- User accounts / authentication — not needed for v1
- Real-time collaboration — single-user design tool
- Custom connector creation UI — use MCP or manual JSON for now

## Context

- Brownfield project with substantial working foundation (~50 source files)
- React 19 + Zustand 5 requires careful selector memoization (module-level caching) to avoid infinite re-render loops
- zundo temporal middleware incompatible with React 19 — manual undo/redo stacks used instead
- Fusion 360 API quirks: no `isComputed` on features (use `healthState`), cut direction matters (+Z), XZ plane coordinate mapping (sketch_Y = -world_Z)
- EIA-310-E rack standards are the foundation — 19" and 10" panels, U-height system, specific bore patterns
- Reference design: HomeRacker OpenSCAD (rackmount.scad, 745 lines, BOSL2) — single-device parametric design adapted for multi-device
- Target audience: homelab hobbyists, AV installers, IT pros, makers
- Existing MCP server enables AI-assisted design via Claude

## Constraints

- **Tech stack**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Zustand 5 (keep + extend)
- **3D rendering**: three.js + @react-three/fiber + three-bvh-csg (existing)
- **Printer primary**: BambuLab P2S — 256mm bed, determines split thresholds
- **Panel width**: 19" panels (482.6mm) exceed P2S bed — split system required
- **Fusion bridge**: Python add-in on localhost:9100 — must remain local
- **Keystone jacks**: Require panel ≤ 2mm at cutout — local thinning needed for 3D prints
- **Equipment DB**: Client-side search over JSON catalog for v1 (server API if scale demands)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app + optional local Fusion bridge | Broadest reach without desktop packaging; Fusion bridge is the only localhost requirement | — Pending |
| Community-driven equipment database | Single maintainer can't cover all equipment; community scales better | — Pending |
| Both visual canvas + guided wizard UX | Experienced users want speed, newcomers need guidance | — Pending |
| Keep React + TypeScript stack, extend | Substantial working codebase, no reason to rewrite; add routing + data layer | ✓ Good |
| Manual undo/redo over zundo | zundo incompatible with React 19 | ✓ Good |
| Module-level selector caching | React 19 + Zustand 5 tear detection requires stable references | ✓ Good |
| JSON catalog with client-side search | 50-100 entries doesn't need a server; GitHub repo for community PRs | — Pending |

---
*Last updated: 2026-02-21 after initialization*
