# Phase 08: Visual Theme Rework — Context

## Phase Goal

Transform the RackPro UI from a dark "engineer debug panel" aesthetic (Slate/Teal, monospace, dense spacing) to a **light professional tool** with a warm orange accent. The 3D viewport remains dark.

## Locked Design Decisions

### 1. Theme Mode: Light Only
- **Light background** for all chrome (sidebar, header, panels, cards)
- **No dark mode toggle** — single light theme
- **Dark 3D viewport** — the Preview3D canvas keeps a dark/studio background for contrast with metallic materials

### 2. Accent Color: #FF5500 Orange
- Primary: `oklch(0.637 0.259 29.23)` / `#FF5500`
- Replaces all teal/cyan (`oklch(0.72 0.15 185)`)
- Used for: primary buttons, active states, focus rings, selected nav items, links, badges
- Orange-50 through Orange-950 scale for hover/active/muted variants

### 3. Font: Inter (Variable)
- Body/UI: `Inter Variable`, fallback `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Code/values/technical: Keep `JetBrains Mono` / `SF Mono` / monospace
- Load via `@fontsource-variable/inter` npm package
- Minimum body text: 14px (`text-sm`); labels: 12px (`text-xs`)

### 4. Spacing: Comfortable Professional
- Card padding: 16-24px (from ~8px)
- Section gaps: 16px (`gap-4`) from 5px
- Sidebar width: flexible, min 280px
- Button padding: `px-4 py-2` minimum

### 5. Radius: Softer
- Base radius: `0.5rem` (8px) from 6px
- Cards: `rounded-lg` (8px)
- Buttons: `rounded-md` (6px)
- Inputs: `rounded-md` (6px)

### 6. Borders: Clean and Visible
- Light gray borders (`oklch(0.90 0 0)`) on cards and sections
- Subtle shadows for elevation instead of heavy borders

## Deferred / Out of Scope

- Dark mode toggle (future consideration)
- Custom color picker for accent (future)
- Animation/transition overhaul (keep minimal)
- Component library extraction
- Logo / branding changes

## Dependencies

- `@fontsource-variable/inter` npm package
- No other new dependencies expected

## Key Files

- `src/index.css` — All CSS variables and theme definition
- `src/components/ui/*.tsx` — shadcn/ui primitives (Button, Card, Dialog, etc.)
- `src/components/Header.tsx` — App header
- `src/components/NavSidebar.tsx` — Navigation sidebar
- `src/components/Sidebar.tsx` — Configuration sidebar
- `src/components/StatusBar.tsx` — Bottom status bar
- `src/components/FrontView.tsx` — SVG front panel
- `src/components/SideView.tsx` — SVG side profile
- `src/components/SplitView.tsx` — SVG split diagram
- `src/components/Preview3D.tsx` — Three.js 3D viewport
- `src/components/ExportTab.tsx` — Export interface
- `src/components/SpecsTab.tsx` — Specs/calculations
- `src/components/CatalogBrowser.tsx` — Catalog grid
- `src/components/CatalogCard.tsx` — Catalog cards
- `src/components/wizard/*.tsx` — Guided wizard steps
