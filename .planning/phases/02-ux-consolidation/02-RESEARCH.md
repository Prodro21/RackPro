# Phase 2: UX Consolidation - Research

**Researched:** 2026-02-23
**Domain:** React UI architecture (routing removal, modal conversion, CSS fixes)
**Confidence:** HIGH

## Summary

Phase 2 is a structural UX refactor that removes the icon-nav + multi-page routing architecture introduced in Phase 1 and consolidates the app into a single-view configurator with modal overlays for Catalog and Wizard. The scope is well-defined with 6 concrete UAT gaps from Phase 1 that must be resolved. No new libraries are needed -- all required components (Dialog/modal, routing, CSS variables) already exist in the codebase.

The work breaks into three distinct areas: (1) routing/navigation teardown (remove NavSidebar, flatten routing to single view, update CommandPalette), (2) modal conversion (wrap CatalogBrowser and WizardShell inside Dialog overlays triggered from sidebar/header), and (3) CSS/visual fixes (grid background visibility, snap grid dot contrast, header mockup fidelity with subtitle).

**Primary recommendation:** Execute in 3 sequential plans: routing teardown first (eliminates NavSidebar, simplifies __root.tsx), then modal conversion (Catalog + Wizard as overlays), then CSS/header fixes (grid-bg, grid dots, header subtitle).

## Standard Stack

### Core (already installed -- no additions needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @radix-ui/react-dialog | ^1.1.15 | Modal overlays for Catalog/Wizard | Already used by shadcn/ui Dialog component, CustomDeviceModal, and WizardShell blocker dialog |
| @tanstack/react-router | ^1.162.1 | Hash-based routing (will be simplified, not removed) | Still needed for URL sharing (`#/?design=...`), but catalog/wizard routes will be deleted |
| React 19 | ^19.0.0 | UI framework | Project standard |
| Zustand 5 | ^5.0.11 | State management (modal open/close state) | Project standard; modal visibility state should live in Zustand for CommandPalette integration |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cmdk | ^1.1.1 | CommandPalette (must update navigation commands to open modals) | Already installed |
| sonner | ^2.0.7 | Toast notifications | Already installed, may add toast for "Added from catalog" |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand for modal state | React useState in root layout | Zustand preferred because CommandPalette needs to open Catalog/Wizard modals without prop drilling; consistent with project pattern |
| Radix Dialog for modals | Custom portal overlay | Dialog already available, accessible, animated; no reason to hand-roll |
| Keeping TanStack Router | No router at all | Router still needed for `#/?design=...` URL sharing; simplify to single route only |

### Installation

No new packages needed. Zero `npm install` commands.

## Architecture Patterns

### Current Architecture (to be changed)

```
RootLayout (__root.tsx)
  NavSidebar (52px icon-nav: Config / Catalog / Wizard)
  Outlet (TanStack Router)
    / -> ConfiguratorRoute (Header + Sidebar + MainContent + StatusBar)
    /catalog -> CatalogRoute (CatalogBrowser, full screen)
    /wizard -> WizardRoute (WizardShell, full screen)
```

### Target Architecture

```
RootLayout (__root.tsx)
  ConfiguratorRoute (always rendered, no Outlet needed)
    Header (with subtitle, "Quick Setup" button)
    Sidebar (with "Browse Catalog..." button)
    MainContent (with visible grid-bg)
    StatusBar
  CatalogModal (Dialog overlay, triggered from sidebar)
  WizardModal (Dialog overlay, triggered from header/sidebar)
  CommandPalette (updated: opens modals instead of navigating)
  Toaster
```

### Pattern 1: Modal State in Zustand Store

**What:** Add `catalogModalOpen` and `wizardModalOpen` boolean fields to the config store (or a separate UI store slice) with `openCatalogModal()` / `closeCatalogModal()` / `openWizardModal()` / `closeWizardModal()` actions.

**When to use:** Whenever multiple unrelated components need to trigger the same modal (Sidebar button, CommandPalette, keyboard shortcut).

**Example:**
```typescript
// In useConfigStore.ts or a new useUIStore.ts
interface UISlice {
  catalogModalOpen: boolean;
  wizardModalOpen: boolean;
  openCatalogModal: () => void;
  closeCatalogModal: () => void;
  openWizardModal: () => void;
  closeWizardModal: () => void;
}

// In Sidebar.tsx — trigger button
<Button onClick={openCatalogModal}>Browse Catalog...</Button>

// In CatalogModal.tsx — Dialog wrapper
<Dialog open={catalogModalOpen} onOpenChange={(open) => { if (!open) closeCatalogModal(); }}>
  <DialogContent className="max-w-5xl h-[80vh]">
    <CatalogBrowser />
  </DialogContent>
</Dialog>
```

**Decision:** Use a separate `useUIStore` (tiny Zustand store) to keep UI-only ephemeral state separate from the persisted config store. This avoids polluting the undo/redo stack with modal open/close events.

### Pattern 2: Large Modal Dialog Sizing

**What:** CatalogBrowser and WizardShell are full-page components that need to be presented inside modals. The Dialog must be sized large enough to be usable.

**When to use:** Catalog modal (wide, ~90vw x 85vh) and Wizard modal (medium, ~600px x 80vh).

**Example:**
```typescript
// CatalogModal -- near-fullscreen overlay
<DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0 overflow-hidden">
  <CatalogBrowser />
</DialogContent>

// WizardModal -- centered, medium width
<DialogContent className="max-w-[640px] w-full h-[80vh] p-0 overflow-hidden">
  <WizardShell />  {/* Modified: remove FrontView preview pane */}
</DialogContent>
```

**Important:** CatalogBrowser currently renders a FrontView preview in a 40% right panel. In modal mode, this may need to be removed or collapsed since the user can see the actual configurator behind the modal overlay.

### Pattern 3: Simplified Routing (Single Route)

**What:** Remove `/catalog` and `/wizard` routes. Keep only the root `/` route. TanStack Router is still needed for hash-based URL sharing (`#/?design=BASE64`).

**When to use:** Always -- this is the target architecture.

**Example:**
```typescript
// router.ts (simplified)
const rootRoute = createRootRoute({
  component: lazyRouteComponent(() => import('./routes/__root'), 'RootLayout'),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: lazyRouteComponent(
    () => import('./routes/configurator'),
    'ConfiguratorRoute',
  ),
});

const routeTree = rootRoute.addChildren([indexRoute]);
```

### Anti-Patterns to Avoid

- **Leaving dead route files:** Delete `src/routes/catalog.tsx` and `src/routes/wizard.tsx` after conversion. Do not leave orphaned files.
- **Prop drilling modal state:** Do not pass `onOpenCatalog` / `onOpenWizard` down through multiple components. Use Zustand store for cross-component modal triggers.
- **Mounting heavy modals eagerly:** The Wizard and Catalog modals should only render their content when `open={true}`. Radix Dialog already handles this -- `DialogContent` is only mounted when open.
- **Breaking undo/redo with modal state:** Modal open/close MUST NOT push to the undo stack. Keep UI state in a separate store or use `{ replace: true }` if adding to config store.
- **Inline hook calls:** Per MEMORY.md, never call `useConfigStore(selector)` inline in JSX. Extract all selectors at component top.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal overlay with backdrop | Custom portal + overlay div | `@radix-ui/react-dialog` via `src/components/ui/dialog.tsx` | Already styled, accessible, animated, theme-aware |
| Focus trap in modals | Manual focus management | Radix Dialog built-in focus trap | Handles escape key, tab cycling, scroll lock |
| URL-based state sharing | Custom URL parser | TanStack Router search params | Already works with `#/?design=...` |

**Key insight:** Every component needed for this phase already exists in the codebase. The work is restructuring, not building new primitives.

## Common Pitfalls

### Pitfall 1: WizardShell Uses TanStack Router Navigation

**What goes wrong:** WizardShell imports `useNavigate` and `useBlocker` from `@tanstack/react-router`. When converted to a modal, there are no routes to navigate to, and `useBlocker` has no meaning.

**Why it happens:** The wizard was built as a page with route-based navigation and exit guards.

**How to avoid:** Replace `useNavigate()` calls with modal close (`closeWizardModal()`). Replace `useBlocker()` with a custom "unsaved changes" confirmation dialog inside the modal. The `handleCancel` and `handleEditInConfigurator` callbacks both currently call `navigate({ to: '/' })` -- these become `closeWizardModal()`.

**Warning signs:** TypeScript errors about missing router context if WizardShell is rendered outside RouterProvider.

### Pitfall 2: CatalogBrowser Renders FrontView Preview

**What goes wrong:** CatalogBrowser currently splits 60/40 with a FrontView on the right. Inside a modal overlay, this creates a confusing nested view where the user sees a small preview panel inside the modal while the actual configurator is visible behind the backdrop.

**Why it happens:** The catalog page was designed as a standalone page, not an overlay.

**How to avoid:** Two options: (A) Remove the FrontView from CatalogBrowser when rendered in modal mode (pass a `mode` prop or use context). (B) Keep the preview but acknowledge the redundancy. Recommendation: **Option A** -- remove preview in modal mode, give 100% width to search + card grid.

**Warning signs:** Users confused by two panel views visible simultaneously.

### Pitfall 3: Grid Background CSS Pseudo-Element Z-Ordering

**What goes wrong:** The `.grid-bg::before` pseudo-element creates the grid pattern but `MainContent` has `<div className="relative z-[1]">` which creates a stacking context that may cover it. Additionally, the SVG's full-viewport `<rect fill={SVG_COLORS.canvasBg}>` covers the entire canvas area with an opaque fill, hiding the HTML grid behind it.

**Why it happens:** The SVG canvas background rect paints over any HTML elements behind it. The grid-bg was designed for HTML layout background, but the SVG viewBox covers the same area.

**How to avoid:** Two approaches: (A) Make the SVG background rect use `fill-opacity` < 1 or `fill="none"` so the HTML grid shows through. (B) Render the grid pattern INSIDE the SVG as part of the SVG defs/pattern (the existing `<pattern id="g">` with grid dots already does this for snap dots). **Recommendation:** The SVG already has an internal dot grid pattern. The "grid background" the user wants is likely the 40px CSS grid lines behind the SVG. Either make the SVG bg transparent or recreate the 40px grid pattern inside the SVG (additional SVG pattern alongside the existing snap dots).

**Warning signs:** Grid visible when SVG is not rendered but disappears on Front tab.

### Pitfall 4: Snap Grid Dot Color Contrast

**What goes wrong:** Dark theme `--svg-grid-dot: #1e2029` is too close to `--svg-canvas-bg: var(--bg-main)` which resolves to `#0f1015`. The luminance difference is only ~5% -- invisible on most displays.

**Why it happens:** Phase 1 color theming set grid dot color too dark.

**How to avoid:** Increase dot brightness. Target: dots should be subtle but visible. Good values:
- Dark theme: `--svg-grid-dot: #2a2d3a` (brighter, ~+15 luminance steps)
- Verify light theme `--svg-grid-dot: #d1cfc9` against `--bg-main: #eae9e5` -- this has better contrast (~8% delta, borderline -- consider darkening to `#c0bdb5`)

**Warning signs:** Grid dots invisible when zoomed out or on low-contrast displays.

### Pitfall 5: CommandPalette Navigation Group Becomes Stale

**What goes wrong:** CommandPalette has a "Navigation" group with commands for "Configurator", "Catalog Browser", and "Design Wizard" that call `navigate({ to: '/catalog' })` etc. After route removal, these links break or do nothing.

**Why it happens:** Forgot to update CommandPalette when routes were removed.

**How to avoid:** Replace navigation commands with modal-opening commands. "Catalog Browser" triggers `openCatalogModal()`. "Design Wizard" triggers `openWizardModal()`. "Configurator" becomes a no-op or closes any open modal.

**Warning signs:** Cmd+K -> "Catalog Browser" does nothing or errors.

### Pitfall 6: WizardShell SessionStorage Key Conflict

**What goes wrong:** WizardShell persists step state in `sessionStorage.setItem('rackpro-wizard-step')`. When the wizard is a modal, opening and closing it may leave stale step state.

**Why it happens:** The wizard was designed for page-level lifecycle, not modal open/close cycles.

**How to avoid:** Reset wizard step to 0 when the modal opens (in the `openWizardModal()` action or in a WizardShell `useEffect` on mount). Optionally keep the "resume from where you left off" behavior if the user explicitly wants it.

**Warning signs:** User opens wizard modal, closes it, reopens it and lands on step 4 instead of step 1.

## Code Examples

### Example 1: Separate UI Store for Modal State

```typescript
// src/store/useUIStore.ts
import { create } from 'zustand';

interface UIState {
  catalogModalOpen: boolean;
  wizardModalOpen: boolean;
  openCatalogModal: () => void;
  closeCatalogModal: () => void;
  openWizardModal: () => void;
  closeWizardModal: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  catalogModalOpen: false,
  wizardModalOpen: false,
  openCatalogModal: () => set({ catalogModalOpen: true }),
  closeCatalogModal: () => set({ catalogModalOpen: false }),
  openWizardModal: () => set({ wizardModalOpen: true }),
  closeWizardModal: () => set({ wizardModalOpen: false }),
}));
```

### Example 2: CatalogModal Component

```typescript
// src/components/CatalogModal.tsx
import { Dialog, DialogContent } from './ui/dialog';
import { useUIStore } from '../store/useUIStore';
import { CatalogBrowser } from './CatalogBrowser';

export function CatalogModal() {
  const open = useUIStore(s => s.catalogModalOpen);
  const close = useUIStore(s => s.closeCatalogModal);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-[90vw] w-[90vw] h-[85vh] p-0 overflow-hidden">
        <CatalogBrowser modal />
      </DialogContent>
    </Dialog>
  );
}
```

### Example 3: Updated Header with Subtitle

```typescript
// In Header.tsx brand section
<div className="flex items-center gap-2.5 min-w-0 shrink-0">
  <div className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center"
    style={{ background: 'linear-gradient(135deg, var(--accent), #ff8c4a)' }}>
    {/* ... logo SVG ... */}
  </div>
  <div>
    <span className="text-sm font-semibold text-text-primary tracking-tight whitespace-nowrap block">
      RackPro
    </span>
    <span className="text-[11px] text-text-tertiary whitespace-nowrap block">
      EIA-310 &bull; 3D Print / Sheet Metal &bull; Full Enclosure
    </span>
  </div>
</div>
```

### Example 4: Fixed Grid Dot Colors

```css
/* Dark theme (in :root) */
--svg-grid-dot: #2a2d3a;  /* Was #1e2029 -- too close to bg-main #0f1015 */

/* Light theme (in .light) */
--svg-grid-dot: #c0bdb5;  /* Was #d1cfc9 -- slightly improve contrast against #eae9e5 */
```

### Example 5: Sidebar Trigger Buttons

```typescript
// In Sidebar.tsx, below "Add Elements" section
<div className="h-px bg-border-subtle" />
<div className="space-y-1.5">
  <Button
    variant="outline"
    onClick={openCatalogModal}
    className="w-full h-8 text-xs font-medium"
  >
    Browse Catalog...
  </Button>
  <Button
    variant="outline"
    onClick={openWizardModal}
    className="w-full h-8 text-xs font-medium border-dashed"
  >
    Quick Setup Wizard
  </Button>
</div>
```

## Detailed File Impact Analysis

### Files to DELETE

| File | Reason |
|------|--------|
| `src/routes/catalog.tsx` | Route replaced by CatalogModal |
| `src/routes/wizard.tsx` | Route replaced by WizardModal |
| `src/components/NavSidebar.tsx` | Icon-nav completely removed |

### Files to CREATE

| File | Purpose |
|------|---------|
| `src/store/useUIStore.ts` | Zustand store for modal open/close state |
| `src/components/CatalogModal.tsx` | Dialog wrapper around CatalogBrowser |
| `src/components/WizardModal.tsx` | Dialog wrapper around WizardShell |

### Files to MODIFY

| File | Changes |
|------|---------|
| `src/router.ts` | Remove catalog + wizard routes; keep only root `/` route |
| `src/routes/__root.tsx` | Remove NavSidebar import + render; add CatalogModal + WizardModal; inline configurator layout (or keep Outlet for single route) |
| `src/routes/configurator.tsx` | May be merged into __root.tsx, or kept as single child route |
| `src/components/Header.tsx` | Add subtitle line per mockup; optionally add "Quick Setup" button |
| `src/components/Sidebar.tsx` | Add "Browse Catalog..." and "Quick Setup Wizard" trigger buttons |
| `src/components/MainContent.tsx` | Fix grid-bg visibility (SVG background transparency or internal grid pattern) |
| `src/components/CommandPalette.tsx` | Replace navigation group: navigate calls -> modal open calls; remove `useNavigate` import |
| `src/components/CatalogBrowser.tsx` | Add `modal?: boolean` prop; when modal, remove FrontView preview column |
| `src/components/wizard/WizardShell.tsx` | Remove `useNavigate` / `useBlocker`; replace with modal close callbacks; add `onClose` prop |
| `src/index.css` | Fix `--svg-grid-dot` values for dark + light themes |
| `src/hooks/useKeyboard.ts` | Check if any keyboard shortcuts navigate to routes (update if so) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multi-page routing (Config/Catalog/Wizard) | Single-view + modal overlays | Phase 2 (this phase) | Simpler mental model; configurator always visible; modals for supplementary tools |
| NavSidebar icon-nav for page switching | No nav; buttons in sidebar/header open modals | Phase 2 (this phase) | Reduces chrome, focuses attention on configurator |
| Catalog as full-page route | Catalog as modal overlay | Phase 2 (this phase) | Header/StatusBar always visible; catalog doesn't "take over" the app |

**Deprecated/outdated:**
- `NavSidebar.tsx`: Will be deleted -- entire component is the icon-nav that the user wants removed
- `/catalog` and `/wizard` routes: Replaced by modal overlays
- CommandPalette "Navigation" group with route-based commands: Replaced by modal-opening commands

## Open Questions

1. **WizardShell FrontView preview in modal?**
   - What we know: WizardShell currently renders a FrontView preview in a right panel (flex-1 width)
   - What's unclear: Should the wizard modal include the FrontView preview, or rely on the configurator visible behind the overlay?
   - Recommendation: Remove FrontView from wizard in modal mode. The modal is narrower and the user can see the configurator behind the semi-transparent backdrop. Add a "Preview" tab or toggle if needed later.

2. **Should TanStack Router be removed entirely?**
   - What we know: After removing /catalog and /wizard, only the root route `/` remains. Router is still used for `#/?design=BASE64` URL sharing.
   - What's unclear: Is a full router library justified for a single route with search params?
   - Recommendation: **Keep TanStack Router for now.** URL sharing with `?design=` search params works well with the router. Removing it would require reimplementing URL parsing in `useDesignPersistence`. Not worth the risk/effort for this phase.

3. **Grid background: HTML grid lines or SVG-internal grid?**
   - What we know: `.grid-bg::before` creates 40px CSS grid lines but the SVG fills over them. The SVG has its own internal dot pattern for snap grid.
   - What's unclear: Does the user want the 40px CSS grid behind the SVG (visible around the panel) or grid lines inside the SVG canvas area?
   - Recommendation: Make the SVG background rect semi-transparent (`fill-opacity="0.85"` or similar) so the CSS grid shows through as subtle lines around and behind the panel. Alternatively, add a second SVG pattern for 40px grid lines inside the SVG viewBox. Try the simpler fill-opacity approach first.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct reading of all affected source files:
  - `src/routes/__root.tsx`, `src/routes/configurator.tsx`, `src/routes/catalog.tsx`, `src/routes/wizard.tsx`
  - `src/router.ts` (TanStack Router configuration)
  - `src/components/NavSidebar.tsx`, `src/components/Header.tsx`, `src/components/MainContent.tsx`
  - `src/components/CatalogBrowser.tsx`, `src/components/wizard/WizardShell.tsx`
  - `src/components/CommandPalette.tsx`
  - `src/components/ui/dialog.tsx` (Radix Dialog wrapper)
  - `src/components/CustomDeviceModal.tsx` (existing modal pattern reference)
  - `src/index.css` (CSS variable system, grid-bg class)
  - `src/lib/svgTheme.ts` (SVG color tokens)
  - `src/components/FrontView.tsx` (grid dot rendering, SVG background)
  - `mockups/dark-theme.html` (header mockup with subtitle)

### Secondary (HIGH confidence)
- **Phase 1 UAT** -- `.planning/phases/01-frontend-design-rework/01-UAT.md` -- 6 specific gaps that define this phase's scope
- **ROADMAP.md** -- Phase 2 goal statement defining the target architecture
- **MEMORY.md** -- Known pitfalls (React 19 + Zustand 5 selector stability, inline hook violations)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; all components already exist in codebase
- Architecture: HIGH - Target architecture is clearly defined by UAT gaps and Phase 2 goal
- Pitfalls: HIGH - All pitfalls identified from direct code reading (router dependencies in WizardShell, CommandPalette navigation commands, CSS z-ordering, color contrast values)

**Research date:** 2026-02-23
**Valid until:** 2026-03-23 (stable -- no external dependency changes needed)
