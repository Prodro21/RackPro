# Phase 08: Visual Theme Rework — Research

## Current State Audit

### Theme System
- **CSS Variables**: Dual system — 16 shadcn semantic vars + 15 legacy `--color-*` vars in `src/index.css`
- **Tailwind v4**: `@theme inline` block bridges CSS vars to utility classes
- **Dark-only**: No `.dark` class or `prefers-color-scheme` — always dark
- **Accent**: Teal/Cyan `oklch(0.72 0.15 185)` used across `--primary`, `--accent-foreground`, `--ring`, `--color-accent-gold`

### Typography
- **Font**: Monospace everywhere (`JetBrains Mono`, `SF Mono`, `Fira Code`)
- **Tiny text epidemic**: 192 occurrences of `text-[7px]` through `text-[11px]` across 22 files
- **Worst offenders**: Sidebar (41), ExportTab (38), SpecsTab (15), PreflightReport (12)
- **Body font**: Set on `<body>` as `font-family: var(--font-family-mono)`

### Spacing
- **Dense spacing**: 106 occurrences of tight spacing classes (`gap-[5px]`, `gap-1`, `py-1`, `px-1`, `p-1`) across 19 files
- **Worst offenders**: SpecsTab (46), Sidebar (18), select.tsx (6), CatalogSearchSidebar (5)
- **Card padding**: Many cards use `p-2` or `p-3` (8-12px)

### Color Usage
- **Primary/accent refs**: 75 occurrences across 27 files referencing teal/cyan/primary
- **Legacy vars**: Still used in some components (`color-accent-gold`, `color-text-dim`, etc.)
- **Hardcoded colors**: Some components use inline oklch values instead of CSS vars

### Component Inventory (40 files)
| Category | Components | Impact |
|----------|-----------|--------|
| **Layout** | Header, NavSidebar, Sidebar, StatusBar, MainContent | High — set overall feel |
| **Views** | FrontView, SideView, SplitView, Preview3D | High — main content area |
| **Export/Specs** | ExportTab, SpecsTab, PreflightReport | Medium — heavy text |
| **Catalog** | CatalogBrowser, CatalogCard, CatalogCardGrid, CatalogSearchSidebar | Medium |
| **Wizard** | WizardShell, StepStandard, StepUHeight, StepDevices, StepConnectors, StepReview, StepExport, StepNav | Medium |
| **Modals** | CustomDeviceModal, CommandPalette, UpdatePrompt | Low |
| **UI primitives** | button, input, label, select, slider, checkbox, dialog, tooltip, card, table, toggle, sonner, command | Foundation — change once, cascade |

## Technical Approach

### Strategy: Foundation-First Cascade
1. **Change CSS vars** → all components using `bg-primary`, `text-primary`, `border` etc. update automatically
2. **Update UI primitives** (button, card, input) → components using shadcn primitives inherit changes
3. **Fix component-specific** overrides → hardcoded colors, tiny text, dense spacing
4. **Polish views** → SVG fill/stroke colors, 3D viewport styling

### Light Theme Color Palette

```
Background:          oklch(0.985 0 0)       — near-white (#fafafa)
Foreground:          oklch(0.145 0 0)       — near-black (text)
Card:                oklch(1.0 0 0)         — white
Card-foreground:     oklch(0.145 0 0)       — near-black
Muted:               oklch(0.955 0.005 250) — light gray bg
Muted-foreground:    oklch(0.45 0.01 250)   — medium gray text
Border:              oklch(0.90 0.005 250)  — light gray
Input:               oklch(0.90 0.005 250)  — light gray
Secondary:           oklch(0.955 0.005 250) — near-white
Secondary-fg:        oklch(0.20 0 0)        — dark text
Primary:             oklch(0.637 0.259 29.23) — #FF5500
Primary-foreground:  oklch(1.0 0 0)         — white on orange
Accent:              oklch(0.955 0.02 29)   — orange-tinted light bg
Accent-foreground:   oklch(0.637 0.259 29.23) — orange text
Destructive:         oklch(0.55 0.2 27)     — red (unchanged)
Ring:                oklch(0.637 0.259 29.23) — orange focus ring
Popover:             oklch(1.0 0 0)         — white
Popover-foreground:  oklch(0.145 0 0)       — black
```

### Font Loading
- Install `@fontsource-variable/inter`
- Import in `src/index.css`: `@import "@fontsource-variable/inter"`
- Update body: `font-family: "Inter Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Keep `--font-family-mono` for code/values

### Text Size Migration
Replace all sub-12px sizes:
- `text-[7px]` → `text-xs` (12px)
- `text-[8px]` → `text-xs` (12px)
- `text-[9px]` → `text-xs` (12px)
- `text-[10px]` → `text-xs` (12px) or `text-sm` (14px)
- `text-[11px]` → `text-sm` (14px)

### Spacing Migration
Replace dense spacing:
- `gap-[5px]` → `gap-2` (8px) or `gap-3` (12px)
- `gap-1` (4px) → `gap-2` (8px)
- `py-1` → `py-2` or `py-2.5`
- `p-1` → `p-2` or `p-3`
- Card padding → `p-4` (16px) minimum

### Legacy Variable Cleanup
Remove all `--color-*` legacy vars from `:root` and `@theme inline`. Replace usages with semantic vars:
- `color-accent-gold` → `primary`
- `color-text-primary` → `foreground`
- `color-text-secondary` → `muted-foreground`
- `color-text-dim` → `muted-foreground` with lower opacity
- `color-bg-card` → `card`
- `color-border` → `border`

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| SVG colors hardcoded | High | Search all `fill=` and `stroke=` in SVG components |
| 3D viewport too bright | Medium | Keep dark bg, only change toolbar/overlay colors |
| Readability regression | Medium | Test all text on new backgrounds for contrast |
| Legacy var breakage | Low | Search-replace systematically, no legacy var left behind |
| Build breakage | Low | Run `npm run build` after each plan |
