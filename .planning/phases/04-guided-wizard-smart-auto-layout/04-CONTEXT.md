# Phase 4 Context: Guided Wizard + Smart Auto-Layout

**Created:** 2026-02-22
**Phase goal:** A newcomer can complete a panel design end-to-end through a guided wizard, and the auto-layout groups connectors intelligently with weight distribution awareness.
**Requirements:** UX-01, UX-04, LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04

---

## 1. Wizard Step Flow & Transitions

### Decisions

- **Step progression**: Linear with back. Steps unlock sequentially (must complete current to advance), but user can freely navigate back to revise earlier steps without losing later choices.
- **Minimum viable path**: Rack standard and U-height are the only required steps. Devices and connectors are both skippable — supports blank panels and connector-only patch panels.
- **Step sequence**: Pick rack standard → set U-height → add devices (skippable) → add connectors (skippable) → review → export.
- **Auto-layout timing**: Inline as items are added. Auto-layout re-runs every time a device or connector is added/removed during the wizard, updating the live preview incrementally.
- **Live preview**: Split layout throughout the entire wizard — wizard form on the left, live FrontView SVG on the right, updating in real-time as items are added and auto-layout runs.

### Constraints for Implementation

- Wizard route lives at `/wizard/*` with sub-routes per step.
- Each step component writes to `useConfigStore` via existing actions (no new state shape needed for most steps).
- "Back" navigation preserves all subsequent step state — do not clear later steps when revisiting earlier ones.
- The device/connector addition steps should reuse catalog search/filter from Phase 2 (not a separate catalog implementation).

---

## 2. Auto-Layout Grouping Priorities

### Decisions

- **Grouping vs. space**: Grouping wins. Same-type connectors are always placed adjacent, even if it leaves gaps. Clean visual appearance and easier cable management take priority over space efficiency.
- **Weight distribution**: Heaviest near ears, fixed rule. No user toggle. Heavy devices are placed at the ear ends (left/right edges) so weight transfers directly to rack screws with minimal lever arm. This is the mechanically correct answer for all cases.
- **Connector zoning**: User picks zone. The wizard asks "Where should connectors go?" with options: between devices, left side, right side, or split evenly on both sides.
- **Overflow handling**: Suggest panel change. If all items exceed panel width, show an error with actionable suggestions: "Switch to 19\" standard" or "Increase to 2U". Don't silently drop items.

### Constraints for Implementation

- Connector grouping key is the connector `type` field (e.g., all `rj45-keystone` adjacent, all `bnc-bulkhead` adjacent).
- Weight data comes from `CatalogDevice.weight` field (already in schema).
- The algorithm is: sort devices by weight descending → place heaviest at left ear, next heaviest at right ear, alternate inward.
- Connector zone preference is stored as a layout option in the wizard state, passed to the auto-layout function.
- Overflow check runs after every auto-layout attempt. Suggestions are contextual: if 10" panel, suggest 19"; if 1U, suggest 2U; if both maxed, suggest removing items.

---

## 3. Text Label Rendering & Density

### Decisions

- **Position**: User chooses per-element. Default position is below the cutout. User can switch to above or inside per element via the element editor.
- **Collision handling**: Stagger vertically. When adjacent labels would collide horizontally, alternate between above and below placement to avoid overlap.
- **Export scope**: Labels export to all formats — SVG (on-screen), DXF (text entities for laser engraving), and OpenSCAD (embossed/debossed text). Labels are first-class fabrication output, not just visual aids.
- **Content**: Three types of label content:
  1. **Free-form text** — user types anything ("WAN", "Camera 1", "Patch Bay A")
  2. **Auto-numbering toggle** — for grouped connectors, appends sequential numbers ("LAN 1", "LAN 2", "LAN 3")
  3. **Category icons** — small icon alongside text (network, video, audio, power categories)

### Constraints for Implementation

- Label data is stored per `PanelElement` — add `label?: { text: string; position: 'above' | 'below' | 'inside'; autoNumber?: boolean; icon?: 'network' | 'video' | 'audio' | 'power' }` to element type.
- SVG rendering: `<text>` elements positioned relative to cutout bounds. Font size fixed (not auto-scaled) — staggering handles collisions instead.
- DXF export: TEXT or MTEXT entities on a dedicated "LABELS" layer. Fabricators can toggle layer visibility.
- OpenSCAD export: `text()` primitive with `linear_extrude()` for emboss, or `difference()` for deboss. Default deboss depth: 0.3mm.
- Auto-numbering applies to connectors that share the same `type` AND `label.text` — numbered left-to-right by X position.
- Icon set is a small fixed enum (4 categories). Rendered as simple SVG symbols, not a full icon library.

---

## 4. Wizard ↔ Freeform Handoff

### Decisions

- **Wizard exit**: Review page with fork. Final wizard step shows the complete design with two action buttons: "Export Now" (goes to export) and "Edit in Configurator" (navigates to freeform canvas with design loaded).
- **State model**: Same store + undo checkpoint. Wizard writes directly to `useConfigStore` (live). An undo checkpoint is created when the wizard starts. "Cancel Wizard" reverts to pre-wizard state via the undo stack.
- **Re-entry**: Pre-filled. User can re-enter the wizard at any time and it opens pre-filled with the current design state. Earlier choices are editable, and auto-layout re-runs on changes.
- **Mid-flow navigation**: Warn and persist. Navigating away from the wizard mid-flow shows a warning ("Leave wizard? You can resume later."). Wizard progress is preserved and the wizard resumes where the user left off when they return.

### Constraints for Implementation

- Undo checkpoint: call existing undo `saveCheckpoint()` action when wizard mounts. "Cancel Wizard" calls `undo()` to pop back to checkpoint.
- Wizard current step is stored outside the undo-able config state (either React state local to WizardShell, or a separate non-temporal slice). Otherwise "undo" would also revert the step counter.
- Pre-fill on re-entry: wizard reads current `useConfigStore` state to populate each step's form (rack standard from `config.standard`, U-height from `config.uHeight`, placed elements list for device/connector steps).
- Mid-flow persistence: wizard step index stored in `sessionStorage` or a dedicated Zustand slice. Route guard (`beforeLoad` or `useBlocker`) shows confirmation dialog on nav-away.
- The review step reuses `FrontView` + `PreflightReport` components — no new review rendering.

---

## Deferred Ideas

Ideas raised during discussion that belong in future phases:

- *None identified* — all discussion stayed within Phase 4 scope.

---

## Plan Mapping

These decisions inform the three Phase 4 plans:

| Plan | Primary Context Sections |
|------|--------------------------|
| 04-01: Auto-layout V2 | Section 2 (grouping, weight, zoning, overflow) |
| 04-02: Wizard shell | Sections 1 (flow), 4 (handoff), and Section 2 (connector zone picker) |
| 04-03: Text labels | Section 3 (position, collision, export, content) |
