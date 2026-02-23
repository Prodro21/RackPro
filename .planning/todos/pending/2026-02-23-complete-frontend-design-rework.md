---
created: 2026-02-23T06:36:56.198Z
title: Complete frontend design rework
area: ui
files:
  - src/index.css
  - src/routes/__root.tsx
  - src/routes/configurator.tsx
  - src/routes/catalog.tsx
  - src/routes/wizard.tsx
  - src/components/Header.tsx
  - src/components/NavSidebar.tsx
  - src/components/Sidebar.tsx
  - src/components/MainContent.tsx
  - src/components/StatusBar.tsx
  - src/components/FrontView.tsx
  - src/components/SideView.tsx
  - src/components/SplitView.tsx
  - src/components/Preview3D.tsx
  - src/components/ExportTab.tsx
  - src/components/SpecsTab.tsx
  - src/components/CatalogBrowser.tsx
  - src/components/CatalogSearchSidebar.tsx
  - src/components/CatalogCardGrid.tsx
  - src/components/wizard/WizardShell.tsx
  - mockups/dark-theme.html
  - mockups/light-theme.html
---

## Problem

Current UI has several design issues identified from user screenshot review:

1. **Aggressive accent color** — #FF5500 orange used for everything: active buttons, checkboxes, tabs, links, copy buttons. Reads as "error/danger" rather than "primary action."
2. **Poor toggle/button design** — Segment controls (3D Print/Sheet Metal, Monolithic/Modular, Tray/Box) show one bright red fill + one plain ghost. No sophistication.
3. **Cluttered sidebar** — Section labels stack tightly with controls jammed underneath. No breathing room between PANEL, FABRICATION, ASSEMBLY, ENCLOSURE sections.
4. **Unnecessary icon nav rail** — 52px permanent column for just 3 items (Config/Catalog/Wizard) that aren't equal peers. Config is 80%+ of usage, Catalog is a sub-task, Wizard is one-time onboarding.
5. **Two competing nav layers** — Icon rail + header tabs confuse the eye.
6. **No dark/light mode toggle** — User prefers dark but wants both options available.
7. **Overall prototype feel** — Functional but not polished. No visual hierarchy.

## Solution

User-approved design direction:

### Navigation Restructure
- **Kill the icon nav rail** — reclaim 52px horizontal space
- **Fold Catalog into sidebar** — sidebar gets a Configure/Browse mode toggle. Browse mode shows search + equipment cards. "+Connector/+Device/+Fan" buttons open the browse mode.
- **Wizard becomes a header button** ("Guided Setup") or landing page, not a persistent nav peer

### Theme System
- **Dark theme (default)** — approved mockup at `mockups/dark-theme.html`. Slate/charcoal surfaces (#0c0d11 to #1e2029), layered depth via subtle borders, DM Sans + JetBrains Mono typography.
- **Light theme (toggle)** — approved mockup at `mockups/light-theme.html`. Warm off-white (#f5f4f1) with white cards, soft shadows.
- **Theme toggle** — sun/moon icon in header near undo/redo. Respect prefers-color-scheme as fallback, persist choice to localStorage.

### Component Redesign
- **Segment controls** — recessed track with elevated active state (shadow + fill), NOT colored fills
- **Orange accent** — used ONLY for logo, active nav indicator, and primary CTA. Everything else neutral grays.
- **Checkboxes** — dark/neutral fill when checked, not orange
- **Spacing** — 20px between sections, 8px between controls
- **Typography** — DM Sans body, JetBrains Mono for values. Section labels: 10px uppercase, tertiary color.
- **Tabs** — same segment style as sidebar toggles (recessed track, elevated active)
- **Cost block** — card with subtle border, not inline text
