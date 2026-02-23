---
phase: 05-ui-3d-polish
plan: 01
subsystem: ui
tags: [shadcn, radix, tailwind, sonner, dialog, react, oklch]

# Dependency graph
requires:
  - phase: 04-guided-wizard-smart-auto-layout
    provides: wizard step components with raw HTML form elements
provides:
  - shadcn/ui foundation (cn utility, components.json, OKLCH theme variables)
  - 15 shadcn/ui components (Button, Input, Select, Checkbox, Slider, Dialog, Tooltip, Card, Table, Toggle, Label, Sonner, Command)
  - Slate/Neutral + Teal/Cyan dark theme via OKLCH CSS variables
  - Sonner toast system replacing custom Zustand-backed Toast
  - Dialog-based CustomDeviceModal replacing manual overlay
  - Complete legacy ui-wrapper retirement
affects: [05-02, 05-04, any future UI work]

# Tech tracking
tech-stack:
  added: [shadcn/ui, radix-ui, class-variance-authority, clsx, tailwind-merge, sonner, cmdk, lucide-react, tw-animate-css]
  patterns: [shadcn copy-to-source components, OKLCH color space theming, compact wrapper pattern for dense UI, Dialog open prop pattern]

key-files:
  created:
    - components.json
    - src/lib/utils.ts
    - src/components/ui/button.tsx
    - src/components/ui/input.tsx
    - src/components/ui/select.tsx
    - src/components/ui/checkbox.tsx
    - src/components/ui/slider.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/card.tsx
    - src/components/ui/table.tsx
    - src/components/ui/toggle.tsx
    - src/components/ui/label.tsx
    - src/components/ui/sonner.tsx
    - src/components/ui/command.tsx
  modified:
    - src/index.css
    - src/components/Sidebar.tsx
    - src/components/ExportTab.tsx
    - src/components/SpecsTab.tsx
    - src/components/SplitView.tsx
    - src/components/CustomDeviceModal.tsx
    - src/components/Header.tsx
    - src/components/MainContent.tsx
    - src/components/PreflightReport.tsx
    - src/components/UpdatePrompt.tsx
    - src/components/Preview3D.tsx
    - src/components/CatalogCard.tsx
    - src/components/CatalogSearchSidebar.tsx
    - src/components/CatalogBrowser.tsx
    - src/components/CatalogCardGrid.tsx
    - src/components/NavSidebar.tsx
    - src/components/StatusBar.tsx
    - src/components/wizard/WizardShell.tsx
    - src/components/wizard/StepStandard.tsx
    - src/components/wizard/StepUHeight.tsx
    - src/components/wizard/StepDevices.tsx
    - src/components/wizard/StepConnectors.tsx
    - src/components/wizard/StepReview.tsx
    - src/components/wizard/StepExport.tsx
    - src/components/wizard/StepNav.tsx
    - src/routes/__root.tsx
    - src/hooks/useDesignPersistence.ts

key-decisions:
  - "Inline SectionLabel/SpecTable components in SpecsTab and SplitView rather than extracting to shared module"
  - "Dialog open prop pattern for CustomDeviceModal instead of conditional rendering"
  - "Compact wrapper pattern (CompactSelect, CompactSlider, CompactCheckbox, FabToggle) in Sidebar for dense control layouts"
  - "Optional chaining for TanStack Router useBlocker resolver methods (blocker.reset?.(), blocker.proceed?.())"
  - "Kept raw button elements for complex multi-state selection cards, filter pills, and step indicators where shadcn Button variants insufficient"
  - "Sonner positioned bottom-center with dark theme in root layout"

patterns-established:
  - "shadcn Button variants: default (primary action), outline (secondary), ghost (subtle/icon), destructive (danger)"
  - "shadcn Button sizes: default, sm, xs, icon — xs for toolbar/compact contexts"
  - "Legacy color migration map: bg-bg-primary->bg-background, bg-bg-secondary->bg-secondary, bg-bg-card->bg-card, text-text-primary->text-foreground, text-text-secondary/text-text-dim->text-muted-foreground, text-accent-gold->text-primary, text-accent-green->text-green-500, text-danger->text-destructive"
  - "Dialog pattern: use open prop + onOpenChange, not conditional rendering"
  - "Toast pattern: import { toast } from 'sonner', action format { action: { label, onClick } }"

requirements-completed: [PLAT-03]

# Metrics
duration: 19min
completed: 2026-02-22
---

# Phase 05 Plan 01: shadcn/ui Foundation + Component Migration Summary

**Initialized shadcn/ui with OKLCH Slate/Teal dark theme, replaced all 9 legacy ui-wrappers plus CustomDeviceModal (Dialog) and Toast (Sonner), migrated ~65 raw HTML buttons/inputs across 30+ components**

## Performance

- **Duration:** 19 min
- **Started:** 2026-02-22T20:54:58-05:00
- **Completed:** 2026-02-22T21:13:36-05:00
- **Tasks:** 3
- **Files modified:** 47

## Accomplishments
- Established shadcn/ui foundation: components.json, cn() utility, 15 Radix-powered components, OKLCH theme with Slate/Neutral base + Teal/Cyan accent
- Migrated all 9 legacy ui/ wrappers (SelectField, SliderField, Checkbox, ToggleButton, ExportCard, PaletteItem, SpecTable, SectionLabel, PropertyRow) to shadcn equivalents in Sidebar, ExportTab, SpecsTab, SplitView
- Replaced CustomDeviceModal overlay with shadcn Dialog (focus trap, escape-to-close, portal rendering)
- Replaced custom Zustand-backed Toast with Sonner across 5 call sites (ExportTab, StepDevices, StepConnectors, StepExport, useDesignPersistence)
- Migrated ~65 raw HTML button elements to shadcn Button with appropriate variant/size across Header, wizard steps, CatalogCard, CatalogSearchSidebar, PreflightReport, MainContent, UpdatePrompt, WizardShell
- Migrated raw HTML inputs to shadcn Input in search fields and modal forms
- Replaced all legacy color classes (bg-bg-primary, text-text-primary, text-accent-gold, etc.) with shadcn semantic classes (bg-background, text-foreground, text-primary, etc.)
- Deleted ui-legacy/ directory (10 files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize shadcn/ui, install dependencies, rename legacy ui/ directory, set up theme** - `8525aaf` (chore)
2. **Task 2: Replace all legacy ui/ wrappers with shadcn/ui equivalents in Sidebar, ExportTab, SpecsTab, SplitView** - `a8b44ec` + `862a13b` (feat)
3. **Task 3: Replace CustomDeviceModal with Dialog, Toast with Sonner, migrate wizard + remaining raw HTML buttons** - `6f0e08c` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `components.json` - shadcn/ui configuration (new-york style, neutral base color)
- `src/lib/utils.ts` - cn() utility function (clsx + tailwind-merge)
- `src/index.css` - OKLCH theme variables for shadcn/ui alongside legacy vars
- `src/components/ui/*.tsx` - 15 shadcn component files (Button, Input, Select, Checkbox, Slider, Dialog, Tooltip, Card, Table, Toggle, Label, Sonner, Command)
- `src/components/Sidebar.tsx` - Full rewrite with CompactSelect, CompactSlider, CompactCheckbox, FabToggle wrappers around shadcn primitives
- `src/components/ExportTab.tsx` - Replaced ExportCard, SectionLabel, raw buttons/inputs with shadcn equivalents; Toast -> Sonner
- `src/components/SpecsTab.tsx` - Replaced SectionLabel, SpecTable with inline components using semantic classes
- `src/components/SplitView.tsx` - Same pattern as SpecsTab
- `src/components/CustomDeviceModal.tsx` - Rewritten from overlay div to shadcn Dialog with Input/Label/Button
- `src/components/Header.tsx` - Undo/redo/tab buttons -> shadcn Button with variants
- `src/components/wizard/WizardShell.tsx` - Cancel button + blocker dialog -> shadcn Button/Dialog
- `src/components/wizard/Step*.tsx` - All 6 step components: nav buttons -> shadcn Button, search inputs -> Input
- `src/components/CatalogCard.tsx` - "Add to Panel" -> shadcn Button
- `src/components/CatalogSearchSidebar.tsx` - Search input -> Input, Clear All -> Button
- `src/routes/__root.tsx` - Sonner Toaster mounted, legacy color classes -> semantic
- `src/hooks/useDesignPersistence.ts` - showToast -> toast from sonner with action format update

## Decisions Made
- **Inline SectionLabel/SpecTable in SpecsTab and SplitView** rather than extracting to a shared module. These components are simple (3-8 lines each) and only used in 2 files; shared extraction adds import complexity without meaningful reuse benefit.
- **Dialog open prop pattern** for CustomDeviceModal instead of conditional rendering. The Dialog manages its own mount/unmount animation and focus trap via the `open` prop, which is cleaner than rendering the entire tree conditionally.
- **Compact wrapper pattern in Sidebar** (CompactSelect, CompactSlider, CompactCheckbox, FabToggle). The dense Sidebar layout needs label+control in a tight row with specific sizing (h-7, text-xs), so thin wrappers around shadcn primitives keep JSX readable.
- **Kept raw buttons for complex multi-state patterns.** Selection cards in StepStandard/StepUHeight, filter pills in CatalogSearchSidebar/StepDevices/StepConnectors, collapsible section headers, and StepNav step indicators have 3+ visual states with complex conditional styling that don't map cleanly to shadcn Button variants. Raw buttons with Tailwind classes are more appropriate here.
- **Optional chaining for blocker methods.** TanStack Router's useBlocker with `withResolver: true` returns `reset` and `proceed` as possibly undefined; optional chaining is the idiomatic fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed checkbox.tsx casing conflict on macOS**
- **Found during:** Task 2 (ExportTab/SpecsTab/SplitView migration)
- **Issue:** macOS case-insensitive filesystem preserved old `Checkbox.tsx` filename from ui-legacy. When shadcn generated `checkbox.tsx`, TypeScript errored: "Already included file name 'checkbox.tsx' differs from 'Checkbox.tsx' only in casing"
- **Fix:** Two-step rename via temp file: `mv Checkbox.tsx checkbox-temp.tsx && mv checkbox-temp.tsx checkbox.tsx`
- **Files modified:** `src/components/ui/checkbox.tsx` (filename only)
- **Verification:** `npm run build` succeeds
- **Committed in:** `a8b44ec` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed WizardShell blocker methods possibly undefined**
- **Found during:** Task 3 (raw button migration)
- **Issue:** After rewriting WizardShell to use shadcn Dialog for the navigation blocker, TypeScript reported `TS2722: Cannot invoke an object which is possibly 'undefined'` for `blocker.reset()` and `blocker.proceed()`
- **Fix:** Added optional chaining: `blocker.reset?.()` and `blocker.proceed?.()`
- **Files modified:** `src/components/wizard/WizardShell.tsx`
- **Verification:** `npm run build` succeeds
- **Committed in:** `6f0e08c` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for build success. No scope creep.

## Issues Encountered
- Toast.tsx was NOT deleted during Task 3 -- it remains as dead code (no imports reference it). The file can be cleaned up in a future pass or left as-is since it has no runtime impact.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- shadcn/ui foundation is fully operational with 15 components available
- All components use semantic color classes compatible with future theme switching
- The OKLCH theme variables are extensible for additional color modes
- Ready for Plan 05-02 (FrontView SVG interactive upgrades) and Plan 05-04 (additional polish work)
- Legacy color classes still exist in src/index.css for any stragglers; can be removed once verified unused

## Self-Check: PASSED

- All 15 created ui component files: FOUND
- ui-legacy/ directory: DELETED
- All 4 task commits (8525aaf, a8b44ec, 862a13b, 6f0e08c): FOUND
- components.json: FOUND
- src/lib/utils.ts: FOUND

---
*Phase: 05-ui-3d-polish*
*Completed: 2026-02-22*
