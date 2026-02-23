# Phase 5: UI + 3D Polish - Research

**Researched:** 2026-02-22
**Domain:** UI component library migration (shadcn/ui), CSG boolean geometry (three-bvh-csg), PBR materials (Three.js), command palette (cmdk), Zustand selector stability
**Confidence:** HIGH

## Summary

Phase 5 covers five distinct technical domains: (1) migrating ~77 raw HTML form elements across 27 files to shadcn/ui components with a Slate/Neutral + Teal/Cyan dark theme, (2) building a Cmd+K command palette using the shadcn Command component backed by the existing Fuse.js search index, (3) implementing real CSG boolean subtraction for connector/device cutouts in the 3D preview using `three-bvh-csg` (already installed v0.0.17), (4) upgrading materials from `MeshStandardMaterial` to `MeshPhysicalMaterial` with PBR texture maps and HDR environment lighting, and (5) auditing all Zustand selectors for referential stability with tests.

shadcn/ui has full Tailwind CSS v4 and React 19 compatibility. The CLI (`npx shadcn@latest init`) detects Vite projects and generates appropriate configuration. The project's existing `@/*` path alias and Tailwind v4 `@theme` setup align with shadcn/ui requirements -- only the CSS variable format needs updating from the current custom `--color-*` vars to shadcn's OKLCH-based `--background`/`--foreground` convention. The existing `src/components/ui/` directory will conflict with shadcn's default output path and must be handled during migration.

For CSG, the project has two viable paths: (a) use `three-bvh-csg` directly with `Brush`/`Evaluator` classes (imperative, maximum control), or (b) use `@react-three/csg` v4.0.0 (declarative React components wrapping the same library). The CONTEXT.md specifies `three-bvh-csg` directly, and the imperative approach offers better control over batching and caching. Both require two-manifold (watertight) input geometry, which `BoxGeometry` and `CylinderGeometry` satisfy by default.

**Primary recommendation:** Use shadcn/ui with `npx shadcn@latest init` (Neutral base color, new-york style), migrate components file-by-file starting with the 9 existing `src/components/ui/` wrappers, use `three-bvh-csg` directly (not `@react-three/csg`) for CSG operations with union-then-subtract batching, and use `useTexture` from drei for loading PBR texture maps from `public/textures/`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Theme direction:** New Slate/Neutral dark palette replacing the current custom dark grays (#1a1a22, #2a2a35). NOT matching the existing aesthetic -- this is a visual refresh.

**Accent color:** Teal/Cyan for interactive elements (buttons, focus rings, active states, selected items).

**Migration depth:** Full replacement. Every raw HTML form element gets replaced:
- `<select>` -> shadcn/ui `Select`
- `<input type="text">` -> shadcn/ui `Input`
- `<input type="range">` -> shadcn/ui `Slider`
- `<input type="checkbox">` -> shadcn/ui `Checkbox`
- `<input type="color">` -> shadcn/ui color picker or Popover with swatches
- `<button>` -> shadcn/ui `Button` (all ~60 instances)
- Custom modal (`CustomDeviceModal.tsx`) -> shadcn/ui `Dialog`
- Custom toast (`Toast.tsx`) -> shadcn/ui `Toast` / `Sonner`

**Existing custom wrappers to replace:** All 10 components in `src/components/ui/`:
- `SelectField.tsx` -> shadcn `Select`
- `SliderField.tsx` -> shadcn `Slider`
- `Checkbox.tsx` -> shadcn `Checkbox`
- `ToggleButton.tsx` -> shadcn `Toggle`
- `ExportCard.tsx` -> shadcn `Card`
- `SectionLabel.tsx` -> keep or simplify
- `PaletteItem.tsx` -> shadcn `Button` variant
- `PropertyRow.tsx` -> keep (layout component)
- `SpecTable.tsx` -> shadcn `Table`

**Tooltips:** Add shadcn/ui `Tooltip` to settings controls, validation warning icons, toolbar buttons, export format options.

**Command palette (Cmd+K):** Full power-user surface using shadcn/ui `Command` (cmdk):
- Navigation: switch to configurator, catalog, wizard, export
- Device search: fuzzy search and add devices/connectors by name
- Export triggers: download JSON, DXF, OpenSCAD, copy to clipboard
- Panel config: change rack standard, U-height
- Undo/redo actions
- Uses the existing Fuse.js search index

**Cutout method:** CSG boolean subtraction using `three-bvh-csg` (already installed, v0.0.17). Real see-through holes.

**Batch strategy:** Union all cutout shapes into a single compound shape, then ONE subtraction from the faceplate. Cache the result mesh and only recompute when elements change.

**Device bay openings:** Also CSG-subtracted from the faceplate.

**Connector bodies behind panel:** Render simplified 3D connector housings extending behind the faceplate (LOW-DETAIL shapes for spatial awareness).

**Realism level:** Full PBR with texture maps and HDR environment.

**Material presets:** Brushed aluminum (sheet metal), Matte plastic (standard FDM), Carbon fiber composite (PA-CF/PET-CF).

**Material switching:** Auto-switch based on fab method. Manual override dropdown in 3D preview toolbar.

### Claude's Discretion

- Whether to use `@react-three/csg` (declarative wrapper) or `three-bvh-csg` directly (imperative) -- research recommends direct `three-bvh-csg` for batching control
- HDR environment source: drei preset upgrade or custom HDR file
- Texture generation approach: download free PBR textures vs procedural generation
- `SectionLabel.tsx` keep-or-replace decision
- Specific shadcn/ui component variants and styling details

### Deferred Ideas (OUT OF SCOPE)

- Cost estimation (COST-01 to COST-04) -- deferred to future phase
- Community contribution pipeline (COMM-01, COMM-02) -- remains in future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PLAT-03 | UI uses shadcn/ui components replacing raw HTML form elements (selects, inputs, dialogs) for a professional appearance | shadcn/ui v3.8.5 CLI supports Tailwind v4 + React 19 + Vite. Full component migration path documented with 9 wrapper replacements + 27 files containing raw elements. Sonner replaces custom Toast. |
| PLAT-04 | All new Zustand selectors returning objects/arrays include module-level memoization with documented cache keys and stability tests | Current `selectors.ts` has 7 memoized selectors and 3 unmemoized array-returning selectors (`selectFaceplateElements`, `selectRearElements`, `selectMaxDeviceDepth` loop). Pattern established with module-level `_key`/`_val` caching. Test pattern: call selector twice with same state, assert `===`. |
| 3D-02 | 3D preview shows environment lighting and material-appropriate shading (plastic look for FDM, brushed metal for sheet metal) | `MeshPhysicalMaterial` with `clearcoat`, `metalness`, `roughness` properties. drei `useTexture` hook loads PBR maps (normal, roughness). drei `Environment` presets: "warehouse" or "city" for better reflections than current "studio". |
| 3D-03 | 3D preview renders connector cutouts and device bay openings accurately in the panel geometry | `three-bvh-csg` v0.0.17 (installed, unused). `Brush` + `Evaluator` + `SUBTRACTION` API. Union cutouts first via `ADDITION`, then single `SUBTRACTION` from faceplate brush. Geometry must be two-manifold (BoxGeometry/CylinderGeometry are). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui CLI | 3.8.5 | Component scaffolding + theming | De facto standard for Tailwind-based React UI. Copy-to-source model = full control. Official Tailwind v4 + React 19 support. |
| cmdk | 1.1.1 | Command palette engine | Powers shadcn/ui `Command` component. React 18/19 compatible. <2000 item performance threshold exceeds needs. |
| sonner | 2.0.7 | Toast notifications | shadcn/ui's recommended toast replacement. Imperative `toast()` API matches existing `showToast()` pattern. React 19 compatible. |
| three-bvh-csg | 0.0.17 | CSG boolean operations | Already installed. 100x faster than BSP-based alternatives. Brush/Evaluator API. Requires three-mesh-bvh (installed as transitive dep at 0.9.8). |
| @react-three/drei | 10.7.7 | Three.js helpers (useTexture, Environment) | Already installed. `useTexture` loads PBR maps. `Environment` provides HDR presets. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tw-animate-css | 1.4.0 | CSS animations for shadcn/ui | Replaces deprecated `tailwindcss-animate`. Required by shadcn/ui components. |
| lucide-react | 0.575.0 | Icon library | shadcn/ui default icon library. Used in Command palette items, Tooltips, Buttons. |
| class-variance-authority | 0.7.1 | Variant-based component styling | shadcn/ui dependency for Button variants, etc. |
| clsx + tailwind-merge | 2.1.1 / 3.5.0 | Conditional class merging | shadcn/ui `cn()` utility function. |
| fuse.js | 7.1.0 | Fuzzy search | Already installed. Powers catalog search + Cmd+K device/connector search. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| three-bvh-csg direct | @react-three/csg v4.0.0 | Declarative React components, but less control over batching/caching strategy. Adds a dependency. CONTEXT.md specifies three-bvh-csg. |
| drei Environment preset | Custom .hdr file from Poly Haven | Higher quality reflections, but adds 1-2MB asset. Drei "warehouse" preset may be sufficient. |
| Downloaded PBR textures | Procedural Three.js CanvasTexture | Zero asset weight, but less realistic. Manual coding of brushed-metal grain. |

**Installation:**
```bash
# shadcn/ui initialization (interactive, picks style + base color)
npx shadcn@latest init

# shadcn/ui dependencies (installed automatically by init)
npm install tw-animate-css lucide-react class-variance-authority clsx tailwind-merge

# shadcn/ui components (added one at a time)
npx shadcn@latest add button input select checkbox slider dialog tooltip command card table toggle sonner

# No new CSG/3D dependencies needed -- three-bvh-csg already installed
```

## Architecture Patterns

### Recommended Project Structure Changes
```
src/
├── components/
│   ├── ui/               # shadcn/ui generated components (Button, Input, etc.)
│   │   ├── button.tsx    # shadcn convention: lowercase filenames
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── command.tsx
│   │   ├── dialog.tsx
│   │   ├── tooltip.tsx
│   │   ├── sonner.tsx
│   │   └── ...
│   ├── CommandPalette.tsx   # Cmd+K palette using Command component
│   ├── Preview3D.tsx        # Refactored with CSG + PBR materials
│   ├── Sidebar.tsx          # Migrated to shadcn components
│   └── ...
├── lib/
│   ├── utils.ts           # shadcn cn() utility (created by init)
│   └── ...
├── store/
│   └── selectors.ts       # Audited + stability-tested selectors
├── hooks/
│   └── useKeyboard.ts     # Updated with Cmd+K handler
└── __tests__/
    └── selectors.test.ts  # Selector stability tests
public/
└── textures/              # PBR texture maps
    ├── brushed-metal-normal.jpg
    ├── brushed-metal-roughness.jpg
    ├── carbon-fiber-normal.jpg
    └── plastic-layerline-normal.jpg
```

### Pattern 1: shadcn/ui Component Migration (File-by-File)
**What:** Replace one custom UI wrapper at a time, updating all consumers, then delete the old file.
**When to use:** Every form element replacement.
**Example:**
```typescript
// BEFORE: Custom SelectField wrapper
import { SelectField } from './ui/SelectField';
<SelectField label="Std" value={standard} onChange={v => setStandard(v)} options={[['19', '19"'], ['10', '10"']]} />

// AFTER: shadcn/ui Select with Label
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
<div className="space-y-1">
  <Label className="text-xs text-muted-foreground">Std</Label>
  <Select value={standard} onValueChange={v => setStandard(v as RackStandard)}>
    <SelectTrigger className="h-7 text-xs">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="19">19"</SelectItem>
      <SelectItem value="10">10"</SelectItem>
    </SelectContent>
  </Select>
</div>
```

### Pattern 2: CSG Union-Then-Subtract Batching
**What:** Merge all cutout brushes into one compound brush via ADDITION, then perform a single SUBTRACTION from the faceplate brush. Cache the result keyed on element positions.
**When to use:** Whenever elements change (add/remove/move).
**Example:**
```typescript
// Source: https://github.com/gkjohnson/three-bvh-csg
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import * as THREE from 'three';

function buildCSGFaceplate(
  panelW: number, panelH: number, wallT: number,
  cutouts: Array<{ x: number; y: number; w: number; h: number; type: 'rect' | 'circle'; r?: number }>
): THREE.BufferGeometry {
  const evaluator = new Evaluator();

  // Faceplate brush
  const faceBrush = new Brush(new THREE.BoxGeometry(panelW, panelH, wallT));
  faceBrush.updateMatrixWorld();

  if (cutouts.length === 0) return faceBrush.geometry;

  // Build compound cutout brush
  let compoundCutout: Brush | null = null;
  for (const cut of cutouts) {
    const geo = cut.type === 'circle' && cut.r
      ? new THREE.CylinderGeometry(cut.r, cut.r, wallT + 0.1, 32)
      : new THREE.BoxGeometry(cut.w, cut.h, wallT + 0.1);
    const brush = new Brush(geo);
    brush.position.set(cut.x, cut.y, 0);
    if (cut.type === 'circle') brush.rotation.x = Math.PI / 2;
    brush.updateMatrixWorld();

    if (!compoundCutout) {
      compoundCutout = brush;
    } else {
      compoundCutout = evaluator.evaluate(compoundCutout, brush, ADDITION);
    }
  }

  // Single subtraction
  const result = evaluator.evaluate(faceBrush, compoundCutout!, SUBTRACTION);
  return result.geometry;
}
```

### Pattern 3: PBR Material Presets with Auto-Switch
**What:** Define material presets as factory functions that create `MeshPhysicalMaterial` with loaded textures. Auto-select based on `fabMethod` and `filamentKey`.
**When to use:** When rendering the faceplate, walls, and ears in Preview3D.
**Example:**
```typescript
// Source: drei docs + Three.js MeshPhysicalMaterial docs
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

function usePanelMaterial(fabMethod: string, filamentKey: string, override?: string) {
  const brushedNormal = useTexture('/textures/brushed-metal-normal.jpg');
  const brushedRoughness = useTexture('/textures/brushed-metal-roughness.jpg');
  const carbonNormal = useTexture('/textures/carbon-fiber-normal.jpg');
  const plasticNormal = useTexture('/textures/plastic-layerline-normal.jpg');

  // Set tiling
  [brushedNormal, brushedRoughness, carbonNormal, plasticNormal].forEach(t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(4, 4);
  });

  const preset = override ?? (fabMethod === 'sm' ? 'metal' :
    ['pa-cf', 'pet-cf'].includes(filamentKey) ? 'carbon' : 'plastic');

  return useMemo(() => {
    switch (preset) {
      case 'metal':
        return new THREE.MeshPhysicalMaterial({
          color: '#c0c0c8', metalness: 0.95, roughness: 0.3,
          normalMap: brushedNormal, roughnessMap: brushedRoughness,
          clearcoat: 0.3, clearcoatRoughness: 0.2,
        });
      case 'carbon':
        return new THREE.MeshPhysicalMaterial({
          color: '#1a1a1a', metalness: 0.1, roughness: 0.4,
          normalMap: carbonNormal, sheen: 0.5, sheenColor: new THREE.Color('#333'),
        });
      default: // plastic
        return new THREE.MeshPhysicalMaterial({
          color: '#2a2a35', metalness: 0.0, roughness: 0.85,
          normalMap: plasticNormal,
        });
    }
  }, [preset, brushedNormal, brushedRoughness, carbonNormal, plasticNormal]);
}
```

### Pattern 4: Command Palette with Fuse.js Integration
**What:** Wire shadcn Command dialog to the existing `useCatalogSearch` Fuse.js index for device/connector fuzzy search. Add static command groups for navigation, export, and config.
**When to use:** Cmd+K / Ctrl+K keyboard shortcut.
**Example:**
```typescript
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator } from '@/components/ui/command';
import Fuse from 'fuse.js';

// Hook into existing useKeyboard.ts for Cmd+K
// In the command palette component:
<CommandDialog open={open} onOpenChange={setOpen}>
  <CommandInput placeholder="Type a command or search..." />
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Navigation">
      <CommandItem onSelect={() => navigate('/configurator')}>Configurator</CommandItem>
      <CommandItem onSelect={() => navigate('/catalog')}>Catalog Browser</CommandItem>
      <CommandItem onSelect={() => navigate('/wizard')}>Design Wizard</CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Devices">
      {deviceResults.map(d => (
        <CommandItem key={d.slug} onSelect={() => addElement('device', d.slug)}>
          {d.name}
        </CommandItem>
      ))}
    </CommandGroup>
    <CommandGroup heading="Export">
      <CommandItem onSelect={downloadJSON}>Download JSON</CommandItem>
      <CommandItem onSelect={downloadDXF}>Download DXF</CommandItem>
    </CommandGroup>
    <CommandGroup heading="Actions">
      <CommandItem onSelect={undo}>Undo</CommandItem>
      <CommandItem onSelect={redo}>Redo</CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

### Pattern 5: Selector Stability Test
**What:** Call selector twice with identical state, assert referential equality (`===`).
**When to use:** Every selector returning an object or array.
**Example:**
```typescript
// Source: project MEMORY.md pattern
import { describe, it, expect } from 'vitest';
import { selectFaceplateElements, selectRearElements } from '../store/selectors';
import type { ConfigState } from '../store/useConfigStore';

const mockState = { /* minimal ConfigState */ } as ConfigState;

describe('selector stability', () => {
  it('selectFaceplateElements returns same reference on repeated calls', () => {
    const a = selectFaceplateElements(mockState);
    const b = selectFaceplateElements(mockState);
    expect(a).toBe(b); // === check, not deep equality
  });
});
```

### Anti-Patterns to Avoid
- **Inline `useConfigStore(s => s.elements.filter(...))` in components:** Creates a new array on every render. Always use a named selector with module-level memoization.
- **Creating new `MeshPhysicalMaterial` in render loop:** Materials should be created once (via `useMemo` or module-level) and reused. Dispose old materials when swapping.
- **Running CSG on every frame:** CSG is expensive. Compute once when elements change, cache the `BufferGeometry`, render the cached geometry.
- **Mixing shadcn/ui and raw HTML form elements:** After migration, no raw `<select>`, `<input>`, or `<button>` should remain (except SVG internals and Canvas). Consistency is critical.
- **Forgetting `brush.updateMatrixWorld()` before CSG evaluate:** The brush position/rotation must be applied to the world matrix before the evaluator can use it. Missing this call = cutouts at wrong positions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Select dropdowns | Custom `<select>` with CSS | shadcn/ui `Select` (Radix) | Keyboard navigation, accessibility (ARIA), portal for overflow, focus management |
| Modal dialogs | Custom overlay div (CustomDeviceModal pattern) | shadcn/ui `Dialog` (Radix) | Focus trapping, escape handling, scroll lock, ARIA roles |
| Toast notifications | Custom Zustand-backed Toast (current impl) | Sonner via shadcn/ui | Stacking, swipe-to-dismiss, promise toasts, accessible announcements |
| Command palette | Custom input + fuzzy match dropdown | shadcn/ui `Command` (cmdk) | Keyboard navigation, item scoring, group support, dialog integration |
| Tooltip positioning | CSS `:hover` + absolute positioning | shadcn/ui `Tooltip` (Radix) | Portal rendering, collision detection, delay, accessible aria-describedby |
| CSG boolean ops | Manual vertex manipulation | three-bvh-csg `Evaluator` | BVH-accelerated intersection, handles edge cases, 100x faster than BSP |
| PBR texture loading | Manual THREE.TextureLoader | drei `useTexture` hook | Suspense integration, caching, preloading, R3F lifecycle awareness |

**Key insight:** The existing custom UI wrappers (SelectField, Checkbox, ToggleButton, ExportCard, CustomDeviceModal, Toast) collectively reimplemented ~40% of what shadcn/ui provides out of the box, but without accessibility features (ARIA roles, keyboard navigation, focus management, screen reader support). The migration is not just visual -- it's an accessibility upgrade.

## Common Pitfalls

### Pitfall 1: shadcn/ui `src/components/ui/` Directory Conflict
**What goes wrong:** `npx shadcn@latest init` generates components into `src/components/ui/` by default. The project already has 9 custom components in that directory.
**Why it happens:** shadcn/ui uses a convention-over-configuration approach where the output path matches what most projects use.
**How to avoid:** Before running `shadcn init`, rename the existing `src/components/ui/` to `src/components/ui-legacy/`. Update all imports. Then run `shadcn init` which will create the new `src/components/ui/` with shadcn components. Migrate consumers one-by-one from legacy to shadcn. Delete legacy files when no longer imported.
**Warning signs:** Import errors after init, component name collisions (both old and new `Checkbox.tsx`).

### Pitfall 2: CSS Variable Naming Collision
**What goes wrong:** The project's current `index.css` defines `--color-bg-primary`, `--color-accent-gold`, etc. via `@theme`. shadcn/ui defines `--background`, `--foreground`, `--primary`, etc.
**Why it happens:** Both systems use CSS custom properties for theming but with different naming conventions.
**How to avoid:** During shadcn init, the CSS file gets updated with shadcn's variable format. Keep the old custom vars alongside the new shadcn vars during transition, then remove old vars once all components are migrated. The `@theme inline` directive lets shadcn vars coexist with existing ones.
**Warning signs:** Colors reverting to defaults, dark mode not applying, accent colors wrong.

### Pitfall 3: CSG Brush World Matrix Not Updated
**What goes wrong:** Cutouts appear at the origin (0,0,0) instead of at the element's actual position on the faceplate.
**Why it happens:** `three-bvh-csg` reads position/rotation from the world matrix, not the `.position` property. If `updateMatrixWorld()` is not called after setting position/rotation, the matrix is stale (identity).
**How to avoid:** Always call `brush.updateMatrixWorld()` after setting `brush.position` and `brush.rotation`. Do this for every brush before passing to `evaluator.evaluate()`.
**Warning signs:** All cutouts stacked at center of panel.

### Pitfall 4: CSG Performance with Many Cutouts
**What goes wrong:** Adding 15+ cutouts causes visible frame drops during recomputation.
**Why it happens:** Each sequential CSG operation has O(n*m) complexity where n,m are triangle counts. Sequential subtractions compound.
**How to avoid:** Use the union-then-subtract pattern: ADDITION all cutout brushes into one compound brush, then single SUBTRACTION from faceplate. Cache the result `BufferGeometry` in a `useMemo` keyed on element positions. Only recompute on actual element changes, not on every render.
**Warning signs:** FPS drops below 30 when adding/moving elements in 3D view.

### Pitfall 5: MeshPhysicalMaterial Not Disposed
**What goes wrong:** Memory leak when switching material presets (metal -> plastic -> carbon).
**Why it happens:** Three.js materials and textures are not garbage collected automatically. Creating new materials without disposing old ones leaks GPU memory.
**How to avoid:** Use `useMemo` with stable deps to create materials. When the material changes, call `.dispose()` on the old one. Alternatively, create all three presets once and swap via mesh `.material` property.
**Warning signs:** GPU memory growing steadily on repeated fab method switches.

### Pitfall 6: Selector Stability - `filter()` Creates New Array
**What goes wrong:** `selectFaceplateElements` and `selectRearElements` use `.filter()` which always returns a new array, causing unnecessary re-renders in React 19.
**Why it happens:** React 19's stricter `useSyncExternalStore` tear detection triggers re-renders when selector return values fail `===` check.
**How to avoid:** Add module-level cache with key based on `s.elements` reference:
```typescript
let _feEls: PanelElement[];
let _feVal: PanelElement[];
export const selectFaceplateElements = (s: ConfigState) => {
  if (s.elements === _feEls) return _feVal;
  _feEls = s.elements;
  _feVal = s.elements.filter(e => !e.surface || e.surface === 'faceplate');
  return _feVal;
};
```
**Warning signs:** Components re-rendering on unrelated state changes.

### Pitfall 7: cmdk Search vs Fuse.js Search Interaction
**What goes wrong:** cmdk has its own built-in filtering. Using Fuse.js alongside it causes double-filtering or results not appearing.
**Why it happens:** cmdk's `Command` component filters items by default based on the input text using a simple string match. If you also run Fuse.js, items get filtered twice.
**How to avoid:** Disable cmdk's built-in filtering with `shouldFilter={false}` on the `Command` component, then pipe Fuse.js results directly as `CommandItem` children. This gives Fuse.js full control over fuzzy matching and scoring.
**Warning signs:** Search results disappearing unexpectedly, fuzzy matches not appearing.

### Pitfall 8: CylinderGeometry Orientation for Round Cutouts
**What goes wrong:** Round connector cutouts (Neutrik D, BNC, SMA) appear as horizontal cylinders instead of holes through the panel.
**Why it happens:** Three.js `CylinderGeometry` is oriented along the Y axis by default. The faceplate lies in the XY plane with thickness along Z.
**How to avoid:** Rotate the cylinder brush by `Math.PI / 2` on the X axis so it aligns with the Z axis (through the panel). Apply rotation before `updateMatrixWorld()`.
**Warning signs:** Cylinder-shaped bumps on the panel surface instead of holes.

## Code Examples

### shadcn/ui CSS Theme Setup (Slate/Neutral + Teal/Cyan Accent)
```css
/* Source: https://ui.shadcn.com/docs/tailwind-v4 */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* Neutral/Slate base (dark theme as default) */
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.922 0 0);
  --card: oklch(0.17 0 0);
  --card-foreground: oklch(0.922 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.922 0 0);
  --primary: oklch(0.72 0.15 185);     /* Teal/Cyan accent */
  --primary-foreground: oklch(0.15 0.02 185);
  --secondary: oklch(0.22 0 0);
  --secondary-foreground: oklch(0.922 0 0);
  --muted: oklch(0.22 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.72 0.15 185);      /* Teal/Cyan */
  --accent-foreground: oklch(0.15 0.02 185);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.28 0 0);
  --input: oklch(0.28 0 0);
  --ring: oklch(0.72 0.15 185);        /* Teal/Cyan focus ring */
  --radius: 0.375rem;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius: var(--radius);
}
```

### three-bvh-csg Batch CSG with Caching
```typescript
// Source: https://github.com/gkjohnson/three-bvh-csg README
import { useMemo } from 'react';
import { Brush, Evaluator, ADDITION, SUBTRACTION } from 'three-bvh-csg';
import * as THREE from 'three';

// Cache key from element positions
function csgCacheKey(elements: Array<{id: string; x: number; y: number; w: number; h: number}>): string {
  return elements.map(e => `${e.id}:${e.x}:${e.y}:${e.w}:${e.h}`).join('|');
}

// Use inside component with useMemo
const faceplateGeo = useMemo(() => {
  const evaluator = new Evaluator();
  const faceBrush = new Brush(new THREE.BoxGeometry(panW * sc, panH * sc, wallT * sc));
  faceBrush.updateMatrixWorld();

  if (cutouts.length === 0) return faceBrush.geometry;

  // Union all cutouts into compound brush
  let compound: Brush | null = null;
  for (const cut of cutouts) {
    const geo = cut.isRound
      ? new THREE.CylinderGeometry(cut.r * sc, cut.r * sc, (wallT + 0.2) * sc, 32)
      : new THREE.BoxGeometry(cut.w * sc, cut.h * sc, (wallT + 0.2) * sc);
    const b = new Brush(geo);
    b.position.set(cut.x * sc, cut.y * sc, 0);
    if (cut.isRound) b.rotation.x = Math.PI / 2;
    b.updateMatrixWorld();
    compound = compound ? evaluator.evaluate(compound, b, ADDITION) : b;
  }

  const result = evaluator.evaluate(faceBrush, compound!, SUBTRACTION);
  return result.geometry;
}, [csgCacheKey(cutouts), panW, panH, wallT]);
```

### Sonner Toast Migration
```typescript
// Source: https://ui.shadcn.com/docs/components/radix/sonner

// BEFORE (current custom Toast):
import { showToast } from './Toast';
showToast('Design saved', { label: 'Undo', onClick: handleUndo });

// AFTER (Sonner):
import { toast } from 'sonner';
toast('Design saved', {
  action: { label: 'Undo', onClick: handleUndo },
  duration: 8000,
});

// Root layout: replace <Toast /> with <Toaster />
import { Toaster } from '@/components/ui/sonner';
// In RootLayout:
<Toaster position="bottom-center" theme="dark" />
```

### drei Environment Preset Upgrade
```tsx
// Source: https://drei.docs.pmnd.rs/staging/environment
// Current: <Environment preset="studio" />
// Upgrade: "warehouse" provides better metallic reflections

<Environment preset="warehouse" />
// or for background visibility:
<Environment preset="warehouse" background backgroundBlurriness={0.8} />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| tailwindcss-animate | tw-animate-css | shadcn/ui 2025 update | Must use `@import "tw-animate-css"` instead of `@plugin` |
| HSL color vars in shadcn | OKLCH color vars | shadcn/ui Tailwind v4 update | Better perceptual uniformity, wider gamut |
| shadcn `default` style | shadcn `new-york` style (default deprecated) | shadcn/ui 2024 | Use `new-york` when initializing |
| `forwardRef` in shadcn components | `data-slot` attributes | React 19 update | No more ref forwarding boilerplate |
| MeshStandardMaterial | MeshPhysicalMaterial | Three.js r150+ | Adds clearcoat, sheen, transmission for PBR |
| Custom Toast component | Sonner library | shadcn/ui deprecation | Official shadcn Toast deprecated in favor of Sonner |

**Deprecated/outdated:**
- `tailwindcss-animate`: Replaced by `tw-animate-css` in shadcn/ui
- shadcn `default` style: Deprecated in favor of `new-york`
- shadcn `Toast` component: Deprecated in favor of `Sonner`

## Open Questions

1. **Texture Asset Strategy**
   - What we know: PBR texture maps (normal, roughness) are needed for brushed metal, carbon fiber, and plastic. Free CC0 sources exist (3dtextures.me, freepbr.com) at 1024x1024 resolution.
   - What's unclear: Whether to download pre-made textures (~100-200KB each) or generate procedural textures at runtime with `CanvasTexture` (zero asset weight but less realistic).
   - Recommendation: Download pre-made textures from CC0 sources. 4 files at ~150KB each = 600KB total, well within acceptable bounds. Store in `public/textures/`. Procedural would require significant development time for inferior results.

2. **shadcn/ui `components.json` Configuration**
   - What we know: The init command asks for style ("new-york"), base color ("neutral"), CSS file path, aliases.
   - What's unclear: Whether to use `rsc: false` (this is a Vite SPA, not Next.js RSC) and exact alias configuration.
   - Recommendation: Run `npx shadcn@latest init` interactively. Choose `new-york` style, `neutral` base color, set CSS path to `src/index.css`, set aliases to match existing `@/*` pattern. Set `rsc: false`.

3. **Cmd+K vs Existing Keyboard Shortcuts**
   - What we know: `useKeyboard.ts` handles Ctrl+Z (undo), Ctrl+Shift+Z (redo), Ctrl+E (export), Delete, Ctrl+D (duplicate), Escape, G (grid toggle), Tab (cycle elements), Arrow keys. There is no existing Cmd+K binding.
   - What's unclear: Whether Cmd+K should suppress existing shortcuts while the palette is open.
   - Recommendation: Add Cmd+K / Ctrl+K handler in `useKeyboard.ts` that sets a `commandPaletteOpen` state. When the palette is open, cmdk handles its own keyboard events (up/down/enter/escape). The existing keyboard handler should early-return when the palette is open.

4. **drei `Environment` Preset Quality for PBR Reflections**
   - What we know: Current "studio" preset is adequate for the current `MeshStandardMaterial`. PBR with `MeshPhysicalMaterial` (high metalness, low roughness) will show more reflection detail.
   - What's unclear: Whether "warehouse" preset at its default resolution (1K) provides sufficient reflection quality for brushed metal appearance.
   - Recommendation: Start with "warehouse" preset. If reflection quality is insufficient, upgrade to a custom 2K HDR from Poly Haven (~1MB). This can be decided during implementation.

## Sources

### Primary (HIGH confidence)
- shadcn/ui official docs - Tailwind v4 migration: https://ui.shadcn.com/docs/tailwind-v4
- shadcn/ui Vite installation: https://ui.shadcn.com/docs/installation/vite
- shadcn/ui Command component: https://ui.shadcn.com/docs/components/radix/command
- shadcn/ui Sonner (toast): https://ui.shadcn.com/docs/components/radix/sonner
- three-bvh-csg GitHub README (Brush/Evaluator API): https://github.com/gkjohnson/three-bvh-csg
- @react-three/csg GitHub (declarative wrapper): https://github.com/pmndrs/react-three-csg
- drei Environment docs: https://drei.docs.pmnd.rs/staging/environment
- R3F loading textures tutorial: https://r3f.docs.pmnd.rs/tutorials/loading-textures
- cmdk npm (command palette engine): https://www.npmjs.com/package/cmdk
- sonner npm (toast library): https://www.npmjs.com/package/sonner

### Secondary (MEDIUM confidence)
- shadcn/ui components.json config: https://ui.shadcn.com/docs/components-json
- Three.js MeshPhysicalMaterial: https://sbcode.net/threejs/meshphysicalmaterial/
- PBR texture loading with drei useTexture: https://r3f.docs.pmnd.rs/tutorials/loading-textures
- Free PBR textures: https://3dtextures.me/, https://freepbr.com/

### Tertiary (LOW confidence)
- Procedural brushed metal generation approach - based on general Three.js knowledge, not verified with specific library

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm registry (versions, peer deps), official docs confirmed Tailwind v4 + React 19 compatibility
- Architecture: HIGH - Patterns verified against official docs and existing codebase. CSG API confirmed from GitHub README. shadcn init process confirmed from official installation guide.
- Pitfalls: HIGH - Directory conflict, CSS variable collision, and CSG orientation issues identified from direct codebase inspection. Selector stability issues documented in project MEMORY.md.

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (30 days - all libraries are mature/stable)

**Current versions verified via npm registry:**
- `shadcn` CLI: 3.8.5
- `cmdk`: 1.1.1 (peer: react ^18 || ^19)
- `sonner`: 2.0.7 (peer: react ^18 || ^19)
- `three-bvh-csg`: 0.0.17 installed, 0.0.18 latest (peer: three >=0.179.0)
- `@react-three/csg`: 4.0.0 (deps: three-bvh-csg ^0.0.16)
- `tw-animate-css`: 1.4.0
- `lucide-react`: 0.575.0
- `class-variance-authority`: 0.7.1
- `clsx`: 2.1.1
- `tailwind-merge`: 3.5.0
