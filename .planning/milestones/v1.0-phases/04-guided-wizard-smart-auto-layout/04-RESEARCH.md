# Phase 4: Guided Wizard + Smart Auto-Layout - Research

**Researched:** 2026-02-22
**Domain:** Multi-step wizard UX, bin-packing/strip-packing layout algorithms, SVG text rendering, DXF text entities
**Confidence:** HIGH

## Summary

Phase 4 has three distinct technical domains: (1) a smart auto-layout engine replacing the current greedy left-to-right placer, (2) a multi-step guided wizard built as a route within TanStack Router, and (3) a text label system that flows from the PanelElement model through SVG rendering to DXF/OpenSCAD export.

The existing codebase is well-structured for all three. The auto-layout V1 in `src/lib/layout.ts` is a 130-line pure function with no React dependencies -- the V2 replacement follows the same pattern but adds connector-type grouping, weight-aware device ordering, and a post-layout validation pass. The wizard builds on the existing `/wizard` route stub already registered in `router.ts`, the catalog search infrastructure from Phase 2 (`useCatalogSearch`, `CatalogCardGrid`), and the `FrontView` component for live preview. Labels require extending `PanelElement` with a structured label field and threading it through FrontView SVG, DXF `dxfText`, and OpenSCAD `text()` generation.

All three plans operate on existing store actions with no new Zustand middleware. The only type change is extending `PanelElement.label` from `string` to a richer object and adding a `connectorZone` layout option. No new npm dependencies are needed.

**Primary recommendation:** Build autoLayoutV2 first (pure function, fully testable in isolation), then the wizard shell (which consumes autoLayoutV2), then labels (orthogonal to both). Each plan has zero runtime dependency on the others.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Wizard Step Flow (Section 1):**
- Linear with back. Steps unlock sequentially (must complete current to advance), but user can freely navigate back to revise earlier steps without losing later choices.
- Minimum viable path: Rack standard and U-height are the only required steps. Devices and connectors are both skippable -- supports blank panels and connector-only patch panels.
- Step sequence: Pick rack standard -> set U-height -> add devices (skippable) -> add connectors (skippable) -> review -> export.
- Auto-layout timing: Inline as items are added. Auto-layout re-runs every time a device or connector is added/removed during the wizard, updating the live preview incrementally.
- Live preview: Split layout throughout the entire wizard -- wizard form on the left, live FrontView SVG on the right, updating in real-time as items are added and auto-layout runs.

**Auto-Layout Grouping (Section 2):**
- Grouping wins over space efficiency. Same-type connectors always placed adjacent.
- Weight distribution: Heaviest near ears, fixed rule. No user toggle.
- Connector zoning: User picks zone. Wizard asks "Where should connectors go?" with options: between devices, left side, right side, or split evenly on both sides.
- Overflow handling: Suggest panel change. Show error with actionable suggestions.

**Text Labels (Section 3):**
- Position: User chooses per-element. Default below cutout, switchable to above or inside.
- Collision handling: Stagger vertically -- adjacent colliding labels alternate above/below.
- Export scope: Labels export to ALL formats -- SVG, DXF (text entities on LABELS layer), OpenSCAD (embossed/debossed text).
- Content types: Free-form text, auto-numbering toggle (sequential for grouped connectors), category icons (network/video/audio/power).

**Wizard <-> Freeform Handoff (Section 4):**
- Wizard exit: Review page with fork -- "Export Now" or "Edit in Configurator".
- State model: Same store + undo checkpoint. Wizard writes directly to useConfigStore. Undo checkpoint on wizard mount; "Cancel Wizard" reverts via undo.
- Re-entry: Pre-filled from current store state. Auto-layout re-runs on changes.
- Mid-flow navigation: Warn and persist. Wizard progress preserved in sessionStorage or dedicated Zustand slice.

### Claude's Discretion

No explicit discretion areas called out in CONTEXT.md -- all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None identified -- all discussion stayed within Phase 4 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UX-01 | User can complete a panel design through a guided wizard: pick rack standard -> select U-height -> add devices from catalog -> add connectors -> review layout -> export | Wizard shell architecture (Section: Architecture Patterns / Wizard Shell), TanStack Router patterns, catalog reuse strategy |
| UX-04 | User can add custom text labels to any placed element, visible in SVG front view and DXF exports | PanelElement label field extension, SVG `<text>` rendering pattern, DXF text entity generation, OpenSCAD `text()` pattern |
| LAYOUT-01 | Smart auto-layout groups connectors by type (all RJ45 together, all BNC together) | Connector grouping key pattern, sort-then-place algorithm design |
| LAYOUT-02 | Auto-layout respects weight distribution preference (heavier devices toward rack ears/center) | Weight-aware alternating ear placement algorithm, DeviceDef.wt / CatalogDevice.weight field access |
| LAYOUT-03 | Auto-layout produces tighter packing than current greedy algorithm | Strip-packing with connector grouping and backtracking, configurable spacing |
| LAYOUT-04 | Auto-layout result passes same validation checks as manual placement | Post-layout validation pass using existing `validateExportConfig()` and `selectOverlaps/selectOutOfBounds` selectors |
</phase_requirements>

## Standard Stack

### Core (already installed -- no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.0.0 | UI rendering | Already in project |
| Zustand | 5.0.11 | State management (useConfigStore) | Already in project; wizard writes to same store |
| TanStack Router | 1.162.1 | Hash-based routing with `/wizard` route | Already in project; useBlocker available for nav guards |
| Fuse.js | 7.1.0 | Fuzzy catalog search | Already in project; wizard reuses useCatalogSearch hook |
| Zod | 4.3.6 | Schema validation | Already in project; catalog schemas already defined |
| Tailwind CSS | 4.x | Styling | Already in project |

### Supporting (no new packages)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| immer | Immutable state updates in store actions | Already used in useConfigStore for element mutations |
| sessionStorage | Wizard step persistence across nav-away | Browser API, no library needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sessionStorage for wizard step | Zustand slice | Zustand slice adds undo complexity; sessionStorage is simpler for transient UI state that should not be undoable |
| Custom strip-packing | @aspect-build/bpack or similar | Overkill; the layout problem is 1D strip-packing (all elements share same Y center in 1U) with simple grouping constraints. ~100 lines of code. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended File Structure

```
src/
├── lib/
│   ├── layout.ts              # Existing V1 auto-layout (keep for MCP backward compat)
│   └── autoLayoutV2.ts        # NEW: Smart layout with grouping, weight, validation
├── routes/
│   └── wizard.tsx             # Wizard route component (replace placeholder)
├── components/
│   ├── wizard/
│   │   ├── WizardShell.tsx    # Layout: step nav + form area + FrontView preview
│   │   ├── StepStandard.tsx   # Step 1: rack standard picker
│   │   ├── StepUHeight.tsx    # Step 2: U-height selector
│   │   ├── StepDevices.tsx    # Step 3: device catalog browser (reuses CatalogCardGrid)
│   │   ├── StepConnectors.tsx # Step 4: connector catalog + zone picker
│   │   ├── StepReview.tsx     # Step 5: FrontView + PreflightReport + action buttons
│   │   └── StepExport.tsx     # Step 6: export options (reuses ExportTab logic)
│   └── FrontView.tsx          # Extended with label rendering
├── store/
│   └── useConfigStore.ts      # Extended with setElementLabel action
└── export/
    ├── dxfGen.ts              # Extended with LABELS layer
    └── openscadGen.ts         # Extended with text() label modules
```

### Pattern 1: Auto-Layout V2 as Pure Function

**What:** The auto-layout engine is a pure function with no React or store dependencies. It takes element definitions, panel dimensions, and layout options as input, and returns positioned `PanelElement[]` as output. The store action `suggestLayoutV2()` calls the pure function then applies the result via `setState`.

**When to use:** Always for layout algorithms. Pure functions are testable, composable, and debuggable. The MCP `suggest_layout` tool and the wizard both call the same function with different option sets.

**Example:**
```typescript
// src/lib/autoLayoutV2.ts

export type ConnectorZone = 'between' | 'left' | 'right' | 'split';

export interface LayoutV2Options {
  spacing?: number;           // min gap between elements (mm), default 4
  connectorZone?: ConnectorZone; // where connectors go relative to devices
}

export interface LayoutV2Result {
  elements: PanelElement[];
  overflow: OverflowSuggestion | null;
  validationIssues: string[];  // ids of elements with issues
}

export function autoLayoutV2(
  elementDefs: ElementDef[],
  panW: number,
  panH: number,
  options?: LayoutV2Options,
): LayoutV2Result {
  // 1. Resolve dimensions
  // 2. Separate devices and connectors
  // 3. Sort devices by weight descending
  // 4. Place devices: heaviest at left ear, next at right ear, alternate inward
  // 5. Group connectors by type (key), sort groups
  // 6. Place connector groups in the chosen zone
  // 7. Validate result (overlaps, OOB, margins)
  // 8. Return result with overflow suggestions if any elements don't fit
}
```

### Pattern 2: Wizard as Single Route with Local Step State

**What:** The wizard is a single TanStack Router route (`/wizard`) that internally manages step progression via React state in `WizardShell`. Steps are rendered conditionally based on `currentStep` index. No sub-routes per step -- this avoids URL bookmarking of intermediate wizard states which would be confusing (a step 3 URL with no devices would be meaningless).

**When to use:** For linear multi-step flows where each step's validity depends on previous steps. Sub-routes add complexity without value.

**Example:**
```typescript
// src/components/wizard/WizardShell.tsx

const STEPS = ['standard', 'u-height', 'devices', 'connectors', 'review', 'export'] as const;

export function WizardShell() {
  const [currentStep, setCurrentStep] = useState(() => {
    // Restore from sessionStorage if mid-flow
    const saved = sessionStorage.getItem('rackpro-wizard-step');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Save step to sessionStorage on change
  useEffect(() => {
    sessionStorage.setItem('rackpro-wizard-step', String(currentStep));
  }, [currentStep]);

  // Undo checkpoint on mount
  useEffect(() => {
    // Save current state as undo checkpoint
    // The existing pushUndo mechanism handles this -- call a dummy action
    // or expose a saveCheckpoint() action
  }, []);

  // Navigation guard
  useBlocker({
    shouldBlockFn: () => currentStep > 0 && currentStep < STEPS.length - 1,
    // ... show confirmation dialog
  });

  return (
    <div className="flex-1 flex">
      {/* Left: step nav + form */}
      <div className="w-[400px] flex flex-col">
        <StepNav steps={STEPS} current={currentStep} onChange={setCurrentStep} />
        <StepContent step={STEPS[currentStep]} onNext={() => setCurrentStep(s => s + 1)} />
      </div>
      {/* Right: live FrontView preview */}
      <div className="flex-1">
        <FrontView />
      </div>
    </div>
  );
}
```

### Pattern 3: Label Data on PanelElement

**What:** Extend `PanelElement` with a structured `labelConfig` field (keeping the existing `label: string` as the element name for backward compatibility). The new field stores user-configured label text, position, auto-numbering, and icon category.

**When to use:** When adding per-element metadata that flows through rendering and export pipelines.

**Example:**
```typescript
// In types.ts

export interface ElementLabel {
  text: string;                                    // user's custom label text
  position: 'above' | 'below' | 'inside';         // placement relative to cutout
  autoNumber?: boolean;                            // append sequential number
  icon?: 'network' | 'video' | 'audio' | 'power'; // category icon
}

export interface PanelElement {
  // ... existing fields ...
  label: string;        // element name (from catalog), kept for backward compat
  labelConfig?: ElementLabel;  // user's custom label (optional)
}
```

### Pattern 4: Undo Checkpoint via Exposed Action

**What:** Add a `saveCheckpoint()` action to `useConfigStore` that pushes the current state to the undo stack without performing any state change. The wizard calls this on mount. "Cancel Wizard" calls `undo()` repeatedly (or a new `revertToCheckpoint()`) to pop back.

**When to use:** When a multi-step flow needs atomic revert capability.

**Example:**
```typescript
// In useConfigStore.ts

saveCheckpoint: () => {
  pushUndo(get());
  // No state change -- just saves the snapshot
},

// In WizardShell mount:
useEffect(() => {
  useConfigStore.getState().saveCheckpoint();
}, []);
```

### Anti-Patterns to Avoid

- **Sub-routes per wizard step:** Creates bookmarkable intermediate URLs that produce broken states when visited directly. Use a single route with local step state.
- **Wizard-specific state store:** Creates dual-write complexity. The wizard should write directly to `useConfigStore` via existing actions. Only the step index and connector zone preference are wizard-local.
- **Auto-layout modifying store directly:** The layout function should be pure. The caller (store action or wizard) applies the result. This makes the function testable and the MCP tool reusable.
- **Inline hook calls in wizard step components:** Per MEMORY.md, all `useConfigStore` selectors must be extracted at component top level, never inline in JSX or callbacks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Navigation guards | Custom `beforeunload` listeners + route interception | TanStack Router `useBlocker` | Already available in v1.162.1; handles both browser back and in-app navigation |
| Fuzzy catalog search in wizard | Separate search implementation | Existing `useCatalogSearch` hook + `CatalogCardGrid` component | Phase 2 already built this; wizard device/connector steps reuse it directly |
| Overlap/OOB validation | New validation in autoLayoutV2 | Existing `selectOverlaps`, `selectOutOfBounds`, and `validateExportConfig` | Phase 3 already built comprehensive validation; auto-layout calls the same checks |
| DXF text rendering | Custom DXF text parser | Existing `dxfText()` primitive in `dxfGen.ts` | Already generates valid TEXT entities with position, height, rotation, and layer |

**Key insight:** Phase 4 is primarily about composition -- wiring together existing infrastructure (catalog search, FrontView preview, validation engine, DXF/OpenSCAD generators) with a new user flow (wizard) and a better placement algorithm (autoLayoutV2). The amount of genuinely new code is small relative to the amount of integration.

## Common Pitfalls

### Pitfall 1: Infinite Re-render from Auto-Layout in Wizard

**What goes wrong:** If the wizard calls `autoLayoutV2()` inside a `useEffect` that depends on `elements`, and `autoLayoutV2` writes new elements to the store, the effect triggers again, causing an infinite loop.

**Why it happens:** `autoLayoutV2` returns new element objects with new IDs, which changes the `elements` array reference, which re-triggers the effect.

**How to avoid:** Use a debounced callback or a `useRef` flag to prevent re-entry. Only re-run auto-layout when the user explicitly adds/removes an element (event-driven), not when elements change (state-driven). The wizard step's "Add" button handler calls auto-layout, not an effect watching elements.

**Warning signs:** Console showing rapid state updates, browser becoming unresponsive after adding an element in the wizard.

### Pitfall 2: Label Collision Detection Running on Every Render

**What goes wrong:** Checking every label against every other label for collision on each render causes O(n^2) work per frame during drag operations.

**Why it happens:** Labels need stagger logic (adjacent colliders alternate above/below), which requires pairwise distance checks.

**How to avoid:** Only compute stagger positions when elements change position (debounced), not on every render frame. Use a memoized selector with the elements array as cache key. During drag, show the label at its configured position; stagger recalculates on drag end.

**Warning signs:** FrontView SVG becoming sluggish when 8+ labeled elements are on the panel.

### Pitfall 3: Wizard Undo Checkpoint Contamination

**What goes wrong:** If the user makes changes in the wizard (adding devices via `addElement`), each call pushes to the undo stack. Calling `undo()` once only reverts the last element addition, not the entire wizard session.

**Why it happens:** The wizard uses existing store actions which each push their own undo snapshots. There's no "grouped undo" concept.

**How to avoid:** Two approaches: (A) Record the undo stack length on wizard mount. "Cancel Wizard" calls `undo()` repeatedly until the stack is at that length. (B) Add a `revertToCheckpoint()` action that pops the undo stack down to a saved snapshot depth marker. Approach B is cleaner. Store the `past.length` at checkpoint time as a module-level variable.

**Warning signs:** "Cancel Wizard" only reverting the last device addition instead of the entire wizard session.

### Pitfall 4: SerializedDesign Schema Not Updated for Labels

**What goes wrong:** Users save a design with labels, refresh, and labels are lost because `extractSerializable` and `applyDesignToStore` don't include the `labelConfig` field.

**Why it happens:** The serializer has an explicit field list, not a spread. New fields must be added manually.

**How to avoid:** Add `labelConfig` to `SerializedDesign.elements` interface, `extractSerializable()`, and `applyDesignToStore()`. Ensure the field is optional so v=1 designs without labels still load correctly.

**Warning signs:** Labels disappearing after page refresh or URL share.

### Pitfall 5: Connector Key Mismatch Between Constants and Catalog

**What goes wrong:** Auto-layout groups connectors by `key` (slug), but the same connector type (e.g., RJ45 keystone) might have different keys in constants (`rj45-keystone`) vs catalog (`rj45-ks`).

**Why it happens:** Legacy slug aliases exist (documented in STATE.md: `rj45-ks` -> `rj45-keystone`). The grouping key should be the connector type concept, not the raw slug.

**How to avoid:** Group connectors by a derived type key, not the raw element key. Extract the connector "family" from the slug (e.g., `rj45-keystone` and `rj45-ks` both start with `rj45`). Or define a `connectorFamily` mapping in constants. The CONTEXT.md says "grouping key is the connector `type` field" -- for catalog connectors, use the slug prefix (everything before the last hyphen-segment), and for constants connectors, use the `cut` type + `icon` combination as a grouping proxy.

**Warning signs:** Two RJ45 keystone connectors placed non-adjacent because they have different keys.

## Code Examples

### Auto-Layout V2: Weight-Aware Device Placement

```typescript
// Weight-descending alternating ear placement
function placeDevices(
  devices: ResolvedElement[],
  panW: number,
  panH: number,
  spacing: number,
): PanelElement[] {
  // Sort heaviest first
  const sorted = [...devices].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
  const placed: PanelElement[] = [];

  let leftCursor = spacing;
  let rightCursor = panW - spacing;
  let placeLeft = true;

  for (const dev of sorted) {
    if (placeLeft) {
      const cx = leftCursor + dev.w / 2;
      if (cx + dev.w / 2 > panW) continue; // overflow
      placed.push(makeElement(dev, cx, panH / 2));
      leftCursor = cx + dev.w / 2 + spacing;
    } else {
      const cx = rightCursor - dev.w / 2;
      if (cx - dev.w / 2 < 0) continue; // overflow
      placed.push(makeElement(dev, cx, panH / 2));
      rightCursor = cx - dev.w / 2 - spacing;
    }
    placeLeft = !placeLeft;
  }

  return placed;
}
```

### Auto-Layout V2: Connector-Type Grouping

```typescript
// Group connectors by type, place each group contiguously
function placeConnectors(
  connectors: ResolvedElement[],
  zone: ConnectorZone,
  leftBound: number,
  rightBound: number,
  panH: number,
  spacing: number,
): PanelElement[] {
  // Group by connector key prefix (e.g., 'rj45-keystone' -> 'rj45')
  const groups = new Map<string, ResolvedElement[]>();
  for (const con of connectors) {
    const family = connectorFamily(con.key);
    const group = groups.get(family) ?? [];
    group.push(con);
    groups.set(family, group);
  }

  // Flatten groups back to array (grouped order preserved)
  const ordered = Array.from(groups.values()).flat();

  // Place based on zone
  let cursor: number;
  if (zone === 'left') cursor = leftBound + spacing;
  else if (zone === 'right') cursor = rightBound; // right-to-left
  else cursor = leftBound + spacing; // 'between' or 'split'

  // ... placement logic per zone type
}

function connectorFamily(key: string): string {
  // Extract family from slug: 'rj45-keystone' -> 'rj45'
  // 'neutrik-d' -> 'neutrik-d' (already a family)
  // 'bnc-bulkhead' -> 'bnc'
  const parts = key.split('-');
  if (parts.length <= 1) return key;
  // Known single-segment families
  if (['rj45', 'bnc', 'sma', 'fiber', 'usb', 'hdmi'].includes(parts[0])) return parts[0];
  return key; // e.g., 'neutrik-d' stays as-is
}
```

### Wizard Step Navigation

```typescript
// Step nav component with linear progression
function StepNav({ steps, current, onChange }: {
  steps: readonly string[];
  current: number;
  onChange: (step: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-3">
      {steps.map((step, i) => {
        const completed = i < current;
        const active = i === current;
        const locked = i > current;
        return (
          <button
            key={step}
            onClick={() => !locked && onChange(i)}
            disabled={locked}
            className={`px-2 py-1 text-[9px] rounded-[3px] font-mono ${
              active ? 'bg-accent-gold text-[#111] font-bold' :
              completed ? 'text-accent-green cursor-pointer' :
              'text-text-dim cursor-not-allowed'
            }`}
          >
            {i + 1}. {step}
          </button>
        );
      })}
    </div>
  );
}
```

### SVG Label Rendering in FrontView

```typescript
// Inside FrontView's element rendering loop
{el.labelConfig?.text && (() => {
  const fontSize = 5; // fixed, not auto-scaled per CONTEXT.md
  const labelY = el.labelConfig.position === 'above'
    ? ey - 6
    : el.labelConfig.position === 'inside'
    ? cy + 1
    : ey + eh + 8; // 'below' (default)

  const displayText = el.labelConfig.autoNumber
    ? `${el.labelConfig.text} ${computeAutoNumber(el, elements)}`
    : el.labelConfig.text;

  return (
    <text
      x={cx}
      y={labelY}
      textAnchor="middle"
      dominantBaseline={el.labelConfig.position === 'inside' ? 'central' : 'auto'}
      fill="#ccc"
      fontSize={fontSize}
      fontFamily="inherit"
    >
      {displayText}
    </text>
  );
})()}
```

### DXF Label Export

```typescript
// In dxfGen.ts, after element cutout generation
if (el.label && el.labelConfig?.text) {
  const labelText = el.labelConfig.autoNumber
    ? `${el.labelConfig.text} ${autoNumberForElement(el, config.elements)}`
    : el.labelConfig.text;
  const labelY = el.labelConfig.position === 'above'
    ? cy + el.h / 2 + 2  // above cutout in DXF Y-up coords
    : cy - el.h / 2 - 3; // below cutout
  entities.push(dxfText(cx, labelY, labelText, '5-LABELS', 2, 0));
}
```

### OpenSCAD Label Export

```typescript
// In openscadGen.ts, label module generation
function labelModule(el: ExportElement, idx: number, panW: number, panH: number): string {
  if (!el.labelConfig?.text) return '';
  const cx = fmt(sxN(el.x, panW));
  const cy = fmt(syN(el.y, panH));
  const depth = 0.3; // deboss depth
  const yOff = el.labelConfig.position === 'above'
    ? fmt(el.h / 2 + 3)
    : el.labelConfig.position === 'inside' ? '0' : fmt(-(el.h / 2 + 3));

  return [
    `module label_${idx}() {`,
    `  // Label: "${el.labelConfig.text}"`,
    `  translate([${cx}, ${cy} + ${yOff}, wall_t - ${depth}])`,
    `    linear_extrude(height = ${depth + 0.1})`,
    `      text("${el.labelConfig.text}", size = 3, halign = "center", valign = "center", font = "Liberation Sans");`,
    `}`,
  ].join('\n');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1 greedy left-to-right layout | V2 with grouping + weight-aware placement | This phase | Better packing, professional connector grouping |
| PanelElement.label as plain string | Structured ElementLabel with position/numbering/icons | This phase | Labels become fabrication output, not just UI |
| No wizard (direct freeform canvas) | Guided wizard as entry point for newcomers | This phase | Dramatically lower learning curve |

## Open Questions

1. **Connector family extraction heuristic**
   - What we know: Connectors should be grouped by "type" per CONTEXT.md. The `key` field is a slug like `rj45-keystone`, `bnc-bulkhead`, `neutrik-d`.
   - What's unclear: The best heuristic for extracting the "family" from the slug. Prefix-based (`rj45`) works for most cases but `neutrik-d` is a family name, not a prefix.
   - Recommendation: Maintain a small constant map `CONNECTOR_FAMILIES: Record<string, string>` that maps each known connector slug to its family. Falls back to slug-prefix extraction for unknown slugs. This is explicit, testable, and handles edge cases.

2. **Undo checkpoint depth tracking**
   - What we know: The `past` array in useConfigStore is module-level. We need to pop back to a specific depth on wizard cancel.
   - What's unclear: Whether `past.length` at checkpoint time is sufficient, or whether intervening non-wizard undo operations could corrupt the depth count.
   - Recommendation: Store both the depth AND the snapshot. On "Cancel Wizard," compare current state to checkpoint snapshot; if different, revert. If the user manually triggered undo/redo within the wizard, the checkpoint is still the correct revert target because it represents the pre-wizard state.

3. **Auto-numbering scope for split connectors**
   - What we know: Auto-numbering applies to connectors that share the same `type` AND `label.text`, numbered left-to-right by X position.
   - What's unclear: If the connector zone is "split" (some on left, some on right), should numbering be continuous (1-4 left, 5-8 right) or restart per side (1-4 left, 1-4 right)?
   - Recommendation: Continuous numbering sorted by X position regardless of zone. This matches physical labeling conventions (patch panel ports numbered sequentially across the panel).

## Sources

### Primary (HIGH confidence)

- **Codebase analysis** -- Direct inspection of all relevant source files:
  - `src/lib/layout.ts` (existing V1 auto-layout, 130 lines)
  - `src/store/useConfigStore.ts` (state shape, undo system, actions)
  - `src/store/selectors.ts` (memoization patterns, validation selectors)
  - `src/components/FrontView.tsx` (SVG rendering, drag handling, label rendering)
  - `src/export/dxfGen.ts` (DXF text entity pattern with `dxfText()` primitive)
  - `src/export/openscadGen.ts` (OpenSCAD cutout modules, `linear_extrude` pattern)
  - `src/router.ts` (TanStack Router setup, existing `/wizard` route stub)
  - `src/routes/wizard.tsx` (placeholder component ready for replacement)
  - `src/hooks/useCatalogSearch.ts` (Fuse.js search, reusable for wizard)
  - `src/components/CatalogBrowser.tsx` (split layout pattern: catalog left, FrontView right)
  - `src/lib/validation.ts` (validateExportConfig, overlap/OOB checks)
  - `src/lib/designSerializer.ts` (SerializedDesign schema, field-level extraction)
  - `src/types.ts` (PanelElement interface, all type definitions)

- **TanStack Router `useBlocker`** -- Confirmed available in installed v1.162.1 via exports check

- **CONTEXT.md** -- All user decisions locked per Section 1-4

### Secondary (MEDIUM confidence)

- **Project MEMORY.md** -- React 19 + Zustand 5 selector memoization requirements, inline hook rules, Fusion 360 API notes

### Tertiary (LOW confidence)

- None -- all findings are from direct codebase inspection and confirmed API availability.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all libraries already in use and verified
- Architecture: HIGH -- patterns derived from existing codebase conventions (pure lib functions, module-level memoization, TanStack Router code-based routing)
- Pitfalls: HIGH -- identified from direct MEMORY.md entries and codebase analysis of re-render risks, undo stack behavior, and serialization gaps
- Auto-layout algorithm: HIGH -- strip-packing with grouping is a well-understood 1D problem; weight-aware placement is a simple alternating cursor

**Research date:** 2026-02-22
**Valid until:** 2026-03-22 (stable domain, no external dependency changes expected)
