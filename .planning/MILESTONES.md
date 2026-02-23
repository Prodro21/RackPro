# Milestones

## v1.0 MVP (Shipped: 2026-02-23)

**Phases completed:** 8 phases, 26 plans
**Stats:** 67 commits, 262 files, ~20,200 LOC TypeScript, 2 days (Feb 21-22, 2026)
**Requirements:** 34/34 satisfied, 34/34 integration paths wired, 6/6 E2E flows verified

**Key accomplishments:**
1. Equipment catalog with 60 devices + 37 connectors, Zod-validated schemas, confidence badges, and runtime validation with visible warnings
2. Catalog browser with fuzzy search (Fuse.js), category/brand filters, drag-and-drop, and one-click add-to-panel
3. Multi-format export pipeline (DXF, OpenSCAD, Fusion 360, JSON) with preflight validation and download gating; deployed to Cloudflare Workers at rackpro.prodro.pro
4. 6-step guided wizard with weight-aware auto-layout (V2 engine), connector family grouping, and 4 zone placement modes
5. shadcn/ui component migration with Slate/Teal dark theme, CSG boolean cutouts in 3D preview, PBR materials (brushed metal / matte plastic / carbon fiber), Cmd+K command palette
6. Cost estimation (filament + sheet metal ranges with assumptions) and community contribution pipeline (CONTRIBUTING.md, GitHub Issue Forms, CI validation workflow)

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `v1.0-REQUIREMENTS.md`, `v1.0-MILESTONE-AUDIT.md`

---


## v1.1 Frontend Redesign (Shipped: 2026-02-23)

**Phases completed:** 3 phases, 12 plans
**Stats:** 44 commits, 165 files changed (+7,044 / -1,397), ~18,500 LOC TypeScript, ~14 hours (Feb 22-23, 2026)

**Key accomplishments:**
1. Dual dark/light theme system with CSS variables, DM Sans + JetBrains Mono typography, and instant theme switching via useTheme hook
2. Restructured layout with branded header (logo + segmented tab navigation), compact sidebar controls, and custom SegmentControl pill components
3. SVG views (FrontView, SideView, SplitView) fully theme-aware via centralized CSS variable palette with semantic color names
4. Catalog and Wizard converted from page routes to modal overlays with Radix Dialog, simplifying router to a single base view
5. Grid background with SVG-internal pattern definitions for cross-theme visibility, calibrated dot contrast values
6. UX polish: orange #FF5500 accent used sparingly (active tab + toolbar icons), widened sidebar with proper padding, wizard modal without preview pane

**Archive:** `.planning/milestones/v1.1-ROADMAP.md`

---

