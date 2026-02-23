---
status: diagnosed
phase: 01-frontend-design-rework
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md, 01-05-SUMMARY.md]
started: 2026-02-23T08:10:00Z
updated: 2026-02-23T08:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Dark theme default appearance
expected: Open the app in the browser. The page should render with a dark background by default. Page title should be "RackPro". Body text should be in DM Sans font (not Inter).
result: issue
reported: "Left nav tab with config, catalog, wizard was supposed to go away. No grid background visible."
severity: major

### 2. Light theme toggle and persistence
expected: Click the sun/moon icon in the header toolbar (right side). The entire app should switch to a light color scheme. Reload the page — it should stay in light mode (no flash of dark then light). Toggle back to dark.
result: pass

### 3. Icon navigation with orange accent bar
expected: Left side shows a narrow (~52px) icon-nav column. The active icon has an orange accent bar on its left edge. Clicking different nav icons (Config, Catalog, Wizard) navigates between pages. Labels appear under each icon.
result: skipped
reason: User wants icon-nav removed — covered by test 1 gap

### 4. Header with brand logo, segmented tabs, and toolbar
expected: Inside the main content area, the header shows: (1) an orange gradient square logo + "RackPro" text on the left, (2) segmented pill tabs in the center (Front, Side, Split, 3D, Specs, Export, Cost), (3) undo/redo buttons and theme toggle on the right. Active tab is visually highlighted with a raised/bordered style.
result: issue
reported: "The mockup looks better on the top bar. Missing subtitle under RackPro, spacing/proportions don't match mockup as closely."
severity: cosmetic

### 5. Segmented tabs switch views
expected: Clicking each segmented tab (Front, Side, Split, 3D, Specs, Export, Cost) switches the main content view. The active tab pill gets a distinct background/border treatment. No page reload — instant switching.
result: pass

### 6. Status bar with monospace values
expected: At the bottom of the configurator view, a thin status bar (~28px) shows panel specs with dot separators between values (e.g. "19\" · 2U · 482.6 x 88.1 mm · 0 elements"). Values are in monospace font.
result: pass

### 7. Sidebar compact controls and segment toggles
expected: The sidebar (~272px) has compact controls. Fabrication method (3D Print / Sheet Metal), assembly mode (Monolithic / Modular), and enclosure type use pill-style segment toggles (not regular toggles). Section headers are small uppercase labels. Selects, sliders, and checkboxes are styled with the theme colors.
result: pass

### 8. SVG panel rendering in both themes
expected: In the Front view, the SVG panel renders with appropriate contrast — panel face, ears, bores, and any placed elements are visible. Toggle to light theme — all SVG colors change to lighter values with appropriate contrast. No elements become invisible or hard to see.
result: issue
reported: "Snap grid dots that were there for device placement seem messed up / not visible"
severity: major

### 9. Grid background on content area
expected: Behind the SVG panel view, a subtle grid pattern is visible on the main content background. The grid lines don't interfere with clicking/dragging elements. Grid adapts when switching between dark and light themes.
result: issue
reported: "Grid background not visible — SVG canvas background covers it"
severity: major

### 10. Catalog page styling
expected: Navigate to the Catalog page. Cards display with correct theme colors (dark cards on dark bg, light cards on light bg). Search sidebar has proper styling. Toggle theme — catalog page adapts correctly.
result: issue
reported: "Catalog goes full screen and blocks top bar. No header/navigation visible on catalog page."
severity: major

### 11. Wizard page styling
expected: Navigate to the Wizard page. Step navigation shows progress indicators. Each wizard step (Standard, U-Height, Devices, Connectors, Review, Export) renders with correct theme colors. Navigation between steps works.
result: issue
reported: "Wizard buttons look bad. A modal would be better than the clunky buttons and confusing sidebars."
severity: major

### 12. 3D preview background
expected: Switch to the 3D tab. The Three.js canvas background should match the current theme (dark bg in dark mode, lighter bg in light mode). Toggle theme — canvas background updates.
result: pass

## Summary

total: 12
passed: 5
issues: 6
pending: 0
skipped: 1
skipped: 0

## Gaps

- truth: "Left nav with Config/Catalog/Wizard icons should be removed — user expected it gone"
  status: failed
  reason: "User reported: left tab with config, catalog, wizard was supposed to go away"
  severity: major
  test: 1
  artifacts: [src/components/NavSidebar.tsx, src/routes/__root.tsx]
  missing: []
- truth: "Header should closely match mockup: subtitle, spacing, proportions"
  status: failed
  reason: "User reported: mockup looks better on the top bar — missing subtitle, spacing off"
  severity: cosmetic
  test: 4
  artifacts: [src/components/Header.tsx]
  missing: [subtitle line under RackPro]
- truth: "Catalog page should not block the top bar / header"
  status: failed
  reason: "User reported: Catalog goes full screen and blocks top bar. No header visible."
  severity: major
  test: 10
  artifacts: [src/routes/catalog.tsx, src/routes/__root.tsx, src/components/CatalogBrowser.tsx]
  missing: [header/navigation on catalog page]
- truth: "Wizard should use a modal instead of clunky buttons and confusing sidebars"
  status: failed
  reason: "User reported: wizard buttons look bad, modal would be better than clunky buttons and confusing sidebars"
  severity: major
  test: 11
  artifacts: [src/components/wizard/WizardShell.tsx, src/components/wizard/StepNav.tsx, src/routes/wizard.tsx]
  missing: [modal-based wizard UX]
- truth: "Snap grid dots should be visible for device placement on front panel"
  status: failed
  reason: "User reported: snap grid dots messed up / not visible. Root cause: --svg-grid-dot (#1e2029) too close to --svg-canvas-bg (#0f1015)"
  severity: major
  test: 8
  artifacts: [src/index.css, src/lib/svgTheme.ts, src/components/FrontView.tsx]
  missing: []
- truth: "Grid background should be visible behind the SVG panel view"
  status: failed
  reason: "User reported: no grid background visible"
  severity: major
  test: 1
  artifacts: [src/components/MainContent.tsx, src/index.css]
  missing: []
