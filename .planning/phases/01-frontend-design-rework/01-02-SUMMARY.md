---
phase: 01-frontend-design-rework
plan: 02
subsystem: ui
tags: [layout, navigation, header, status-bar, segmented-tabs, theme-toggle, orange-accent, brand-logo]

# Dependency graph
requires:
  - phase: 01-frontend-design-rework
    provides: dual-theme CSS variable system, useTheme hook, Tailwind v4 bridge (from plan 01)
provides:
  - Restructured app layout (icon-nav | sidebar | header + content + status bar)
  - Restyled NavSidebar with 52px width, orange accent bar on active item
  - Header with brand logo, segmented pill tabs, undo/redo, theme toggle
  - StatusBar with 28px height, dot separators, monospace values
  - Layout where sidebar only appears on configurator route
affects: [01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [segmented pill tab bar, orange accent bar on active nav, brand logo with gradient SVG, layout restructure sidebar-inside-route]

key-files:
  created: []
  modified: [src/routes/__root.tsx, src/routes/configurator.tsx, src/components/NavSidebar.tsx, src/components/Header.tsx, src/components/StatusBar.tsx, src/components/MainContent.tsx]

key-decisions:
  - "StatusBar moved from MainContent to configurator route layout for structural consistency"
  - "NavSidebar uses useMatches for active detection instead of activeProps for precise control"
  - "Header uses native button elements instead of shadcn Button for segmented tabs (simpler, matches mockup)"

patterns-established:
  - "Layout: icon-nav (52px) at root, sidebar within specific routes only"
  - "Segmented tabs: flex gap-px container with p-[3px], seg-bg/seg-active tokens, border + shadow on active"
  - "Nav accent bar: before pseudo-element, 3px wide, accent color, centered vertically"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-02-23
---

# Phase 01 Plan 02: Layout + Navigation + Header + StatusBar Summary

**Restructured app layout to mockup's 3-column structure with 52px icon-nav, segmented pill tabs in header, orange accent bars on active nav, and 28px monospace status bar**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-23T07:41:58Z
- **Completed:** 2026-02-23T07:46:09Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Restructured root layout: icon-nav (52px) at root level with Outlet, sidebar only within configurator route
- NavSidebar restyled with orange accent bar (before pseudo-element), 40x40 icon buttons, 9px labels, mockup colors
- Header rebuilt: brand logo (orange gradient + rack SVG), "RackPro" title, segmented pill tab bar, undo/redo buttons, theme toggle (sun/moon)
- StatusBar restyled: 28px height, dot-separated monospace values, success/danger colors for remaining width

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure root and configurator layouts, restyle NavSidebar** - `553afa7` (feat)
2. **Task 2: Restyle Header with brand logo, segmented tabs, theme toggle; restyle StatusBar** - `5e5def1` (feat)

## Files Created/Modified
- `src/routes/__root.tsx` - Updated to new token classes (bg-bg-root, text-text-primary)
- `src/routes/configurator.tsx` - Restructured: sidebar | main-area (header + content + status bar)
- `src/components/NavSidebar.tsx` - 52px width, orange accent bar, useMatches for active detection, 18px icons with 9px labels
- `src/components/Header.tsx` - Brand logo, segmented pill tabs, undo/redo SVG buttons, theme toggle button
- `src/components/StatusBar.tsx` - 28px height (h-7), dot separators, monospace values, semantic colors
- `src/components/MainContent.tsx` - Removed StatusBar import and rendering (moved to configurator layout)

## Decisions Made
- StatusBar moved from inside MainContent to the configurator route layout, keeping it outside the scrollable content area and ensuring it always renders at the bottom of the main area
- Used useMatches from TanStack Router for active nav detection instead of Link's activeProps, providing more precise control over active state styling with the orange accent bar pseudo-element
- Replaced shadcn Button components in the Header with native button elements for the segmented tab bar, matching the mockup's simpler styling pattern without variant/size abstractions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed StatusBar property name**
- **Found during:** Task 2 (StatusBar restyle)
- **Issue:** Used `rackStandard` which doesn't exist on ConfigState (property is `standard`)
- **Fix:** Changed to `s.standard`, then removed the unused variable entirely
- **Files modified:** src/components/StatusBar.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 5e5def1 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor property name correction. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Layout structure is complete and matches mockup hierarchy
- All CSS tokens from Plan 01 are consumed by the new layout components
- Sidebar component is ready for restyling in Plan 03
- SVG views (FrontView, SideView, SplitView) render correctly in the new layout structure

## Self-Check: PASSED

All created/modified files verified present. All commit hashes (553afa7, 5e5def1) found in git log.

---
*Phase: 01-frontend-design-rework*
*Completed: 2026-02-23*
