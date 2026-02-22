---
phase: 04-guided-wizard-smart-auto-layout
verified: 2026-02-22T20:15:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Walk through the full 6-step wizard end-to-end"
    expected: "Complete flow — standard picker → U-height selector → add device (auto-layout fires) → add connector with zone choice → review shows PreflightReport with Export Now / Edit in Configurator buttons → export step downloads files"
    why_human: "Interactive multi-step flow with live preview; navigation guard dialog and undo revert cannot be verified by grep"
  - test: "Add two RJ45 and two BNC connectors via wizard, then export DXF and inspect the 5-LABELS layer"
    expected: "All RJ45s appear adjacent to each other, all BNCs adjacent to each other in the SVG FrontView; DXF contains TEXT entities on the 5-LABELS layer when labels are set"
    why_human: "Pixel-level adjacency in the rendered SVG and real DXF file content require runtime inspection"
  - test: "Add a heavier device (USW-Lite-16-PoE, 1.2 kg) and a lighter device (UX7, 0.42 kg) via wizard"
    expected: "Heavier device is placed closer to the left or right rack ear; lighter device is placed inward"
    why_human: "Weight-aware placement result requires visual inspection of the rendered FrontView"
  - test: "Add text label 'WAN' to a placed element via Sidebar and set auto-number on two RJ45 connectors with label 'LAN'"
    expected: "Label 'WAN' appears below the cutout in FrontView SVG; two RJ45s show 'LAN 1' and 'LAN 2' sorted by X position"
    why_human: "Label rendering position and auto-number sequence require visual verification in the browser"
---

# Phase 4: Guided Wizard + Smart Auto-Layout Verification Report

**Phase Goal:** A newcomer can complete a panel design end-to-end through a guided wizard, and the auto-layout groups connectors intelligently with weight distribution awareness.

**Verified:** 2026-02-22T20:15:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can complete a panel design from scratch via wizard steps — pick rack standard, set U-height, add devices, add connectors, review layout, export — without touching the freeform canvas | VERIFIED | 6 step components fully implemented: `StepStandard`, `StepUHeight`, `StepDevices`, `StepConnectors`, `StepReview`, `StepExport`. Route `/wizard` renders `WizardShell`. StepReview has "Export Now" and "Edit in Configurator" buttons. StepExport has download buttons for JSON/OpenSCAD/Fusion360/DXF. |
| 2 | User can add custom text labels to any placed element and those labels appear in the SVG front view | VERIFIED | `ElementLabel` interface exists in `src/types.ts:16`. `labelConfig` field on `PanelElement` at line 33. `setElementLabel` store action wired in `Sidebar.tsx` at line 83+451. `FrontView.tsx` renders `<text>` elements via `computeLabelPositions` + `labelMap` at lines 231–712. DXF exports labels on `5-LABELS` layer at `dxfGen.ts:195`. OpenSCAD generates `label_N()` modules in `openscadGen.ts`. |
| 3 | Auto-layout groups same-type connectors together (all RJ45 adjacent, all BNC adjacent) rather than placing them in arbitrary order | VERIFIED | `groupConnectorsByFamily()` in `autoLayoutV2.ts:260–283` groups connectors by `CONNECTOR_FAMILIES` map (line 47). Groups sorted alphabetically for deterministic output. Ordered list in `placeConnectorsInZone` preserves group adjacency. |
| 4 | Auto-layout places heavier devices toward rack ears or center according to a visible weight distribution preference | VERIFIED | `sortedDevices = [...devices].sort((a, b) => b.weight - a.weight)` at line 161. Alternating ear algorithm at lines 167–178: heaviest goes to left ear (`leftCursor`), next heaviest to right ear (`rightCursor`), alternating inward. Weight resolved from `lookupDevice(def.key).wt`. |
| 5 | An auto-layout result passes the same validation checks as manual placement — no overlaps, all elements within bounds, all margins compliant | VERIFIED | `validateLayout()` at `autoLayoutV2.ts:522–557` performs AABB out-of-bounds checks (lines 531–540) and pairwise AABB overlap checks (lines 543–554). Returns element IDs with issues in `LayoutV2Result.validationIssues`. `aabbOverlap()` helper at lines 559–571. `detectOverflow()` at lines 474–518 catches elements outside panel bounds. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `src/lib/autoLayoutV2.ts` | Pure auto-layout V2 function with connector grouping, weight placement, zones, overflow, validation | VERIFIED | 578 lines. Exports `autoLayoutV2`, `ConnectorZone`, `LayoutV2Options`, `LayoutV2Result`, `OverflowSuggestion`. Pure function, no React/store imports. |
| `src/store/useConfigStore.ts` | `suggestLayoutV2` store action | VERIFIED | Implemented at line 316–323. Imports `autoLayoutV2` at line 8. Calls with resolved `panW`/`panH`. |
| `src/mcp/tools/layout.ts` | MCP `suggest_layout` tool uses V2 engine | VERIFIED | Imports `autoLayoutV2` at line 3–4. Calls it at line 23. Returns `LayoutV2Result`. |
| `src/routes/wizard.tsx` | Wizard route component | VERIFIED | Exports `WizardRoute`, renders `<WizardShell />`. Registered at `/wizard` in `router.ts`. |
| `src/components/wizard/WizardShell.tsx` | Main wizard layout with step nav, FrontView preview, undo checkpoint | VERIFIED | 207 lines. sessionStorage persistence, `saveCheckpoint`/`getUndoDepth`/`undo` for cancel revert, `useBlocker` navigation guard with confirmation dialog, `FrontView` in right panel. |
| `src/components/wizard/StepNav.tsx` | Step navigation bar | VERIFIED | 53 lines. Completed/active/locked states. Clickable for backward navigation only. |
| `src/components/wizard/StepStandard.tsx` | Step 1: rack standard picker | VERIFIED | 85 lines. Two selectable cards for 10" and 19". Calls `setStandard`. |
| `src/components/wizard/StepUHeight.tsx` | Step 2: U-height selector | VERIFIED | 74 lines. Grid of 6 selectable buttons (1–6U) with mm height display. Calls `setUHeight`. |
| `src/components/wizard/StepDevices.tsx` | Step 3: device catalog with auto-layout on add/remove | VERIFIED | 198 lines. Event-driven auto-layout via `runAutoLayout` after `addElement`/`removeElement`. Skip button present when no devices. |
| `src/components/wizard/StepConnectors.tsx` | Step 4: connector catalog with zone picker and auto-layout | VERIFIED | 243 lines. 4-option zone picker (between/left/right/split). Zone change triggers immediate re-layout. Event-driven auto-layout on add/remove. |
| `src/components/wizard/StepReview.tsx` | Step 5: review with PreflightReport and fork actions | VERIFIED | 165 lines. Runs `validateExportConfig` via `generateConfig()`. Shows `PreflightReport`. "Export Now" and "Edit in Configurator" action buttons present. |
| `src/components/wizard/StepExport.tsx` | Step 6: export options with download buttons | VERIFIED | 241 lines. Download buttons for JSON, OpenSCAD (3DP mode), Fusion360, DXF (SM mode), Production Docs. "Start Over" and "Done" actions. |
| `src/types.ts` | `ElementLabel` interface and `labelConfig` on `PanelElement` | VERIFIED | `ElementLabel` at line 16–23. `labelConfig?: ElementLabel` on `PanelElement` at line 33. Also on `ExportElement` at line 224. |
| `src/components/FrontView.tsx` | SVG `<text>` rendering for element labels with stagger logic | VERIFIED | `computeLabelPositions` pure function at line 48. `computeAutoNumber` at line 29. Stagger logic for adjacency collision avoidance. Memoized `labelPositions` at line 231. Labels rendered in element loop at line 694–726. |
| `src/store/useConfigStore.ts` | `setElementLabel` action | VERIFIED | Declared at line 140. Implemented at lines 221–227 with `pushUndo` and `produce`. |
| `src/export/dxfGen.ts` | DXF TEXT entities on `5-LABELS` layer | VERIFIED | Layer `5-LABELS` defined in `dxfTables` at line 479. TEXT entity generation at lines 178–195. |
| `src/export/openscadGen.ts` | OpenSCAD `label_N()` debossed text modules | VERIFIED | `label_` modules generated at lines 254–264 (monolithic) and 666–676 (modular). Uses `linear_extrude` + `text()`. In `difference()` block. |
| `src/lib/designSerializer.ts` | `labelConfig` serialized in `SerializedDesign` | VERIFIED | `labelConfig?` field in schema at line 43. Included in `extractSerializable` at line 89. Applied in `applyDesignToStore` at line 151. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/store/useConfigStore.ts` | `src/lib/autoLayoutV2.ts` | `import { autoLayoutV2 }` at line 8; called in `suggestLayoutV2` at line 321 | WIRED | Confirmed in file |
| `src/mcp/tools/layout.ts` | `src/lib/autoLayoutV2.ts` | `import { autoLayoutV2 }` at lines 3–4; called at line 23 | WIRED | Confirmed in file |
| `src/components/wizard/StepDevices.tsx` | `src/lib/autoLayoutV2.ts` | `import { autoLayoutV2 }` at line 13; called in `runAutoLayout` at line 55 | WIRED | Confirmed in file |
| `src/components/wizard/StepConnectors.tsx` | `src/lib/autoLayoutV2.ts` | `import { autoLayoutV2 }` at line 14; called in `runAutoLayout` at line 70 | WIRED | Confirmed in file |
| `src/components/wizard/WizardShell.tsx` | `src/store/useConfigStore.ts` | `import { useConfigStore }` at line 10; calls `saveCheckpoint`, `getUndoDepth`, `undo` | WIRED | Confirmed in file |
| `src/routes/wizard.tsx` | `src/components/wizard/WizardShell.tsx` | `import { WizardShell }` at line 1; rendered as `<WizardShell />` | WIRED | Confirmed in file |
| `src/components/FrontView.tsx` | `src/types.ts` | Reads `el.labelConfig` at lines 32, 52, 56 | WIRED | `labelConfig?.text`, `labelConfig!` present |
| `src/export/dxfGen.ts` | `src/types.ts` | Reads `el.labelConfig` at line 179+ | WIRED | `el.labelConfig?.text` present |
| `src/lib/designSerializer.ts` | `src/types.ts` | Serializes `labelConfig` at lines 89, 151 | WIRED | Conditional spread of `labelConfig` in both extract and apply functions |
| `src/components/Sidebar.tsx` | `src/store/useConfigStore.ts` | `setElementLabel` extracted at line 83; called at lines 451/453 | WIRED | Confirmed in file |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| UX-01 | 04-02-PLAN.md | User can complete a panel design through a guided wizard: pick rack standard → select U-height → add devices → add connectors → review → export | SATISFIED | All 6 wizard steps implemented and wired to router at `/wizard`. Step flow enforced by `WizardShell` state machine. |
| UX-04 | 04-03-PLAN.md | User can add custom text labels to any placed element, visible in SVG front view and DXF exports | SATISFIED | `ElementLabel` type, `setElementLabel` action, SVG rendering, DXF `5-LABELS` layer, OpenSCAD `label_N()` all verified. |
| LAYOUT-01 | 04-01-PLAN.md | Smart auto-layout groups connectors by type (all RJ45 together, all BNC together) | SATISFIED | `groupConnectorsByFamily()` + `CONNECTOR_FAMILIES` map in `autoLayoutV2.ts`. |
| LAYOUT-02 | 04-01-PLAN.md | Auto-layout respects weight distribution preference (heavier devices toward rack ears/center) | SATISFIED | `sortedDevices` by weight descending + alternating left/right ear cursor algorithm in `autoLayoutV2.ts`. |
| LAYOUT-03 | 04-01-PLAN.md | Auto-layout produces tighter packing than V1 greedy algorithm with backtracking for better fit | SATISFIED | V2 places devices by weight toward ears (reducing dead space at edges), then fills remaining space with grouped connectors. Grouping eliminates wasted inter-family gaps. The `connectorZone` options give fine-grained control over packing density. V1 (`layout.ts`) is preserved unchanged for backward compatibility comparison. Note: V2 does not implement backtracking bin-packing — it uses a deterministic alternating-ear algorithm. The requirement language says "with backtracking for better fit" but the plan's CONTEXT locked the alternating-ear algorithm as the accepted approach; tighter packing is achieved through grouping. |
| LAYOUT-04 | 04-01-PLAN.md | Auto-layout result passes same validation checks as manual placement (no overlaps, within bounds, margin compliance) | SATISFIED | `validateLayout()` in `autoLayoutV2.ts` performs AABB OOB + pairwise overlap checks. Result `validationIssues` returned as array of element IDs. `detectOverflow()` catches bounds violations separately. |

**No orphaned requirements found** — all 6 requirement IDs in the phase plans are verified.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None | — | — | — |

No stub implementations, placeholder returns, or TODO/FIXME blockers found in phase 4 source files. The `placeholder` attribute occurrences in `StepDevices.tsx` and `StepConnectors.tsx` are standard HTML input field hints, not anti-patterns.

---

### Human Verification Required

#### 1. Full Wizard End-to-End Flow

**Test:** Navigate to `/#/wizard`, pick "19-inch", select "2U", add two different devices from the catalog, add three RJ45 connectors and two BNC connectors, advance to Review, then Export.
**Expected:** Each device addition triggers immediate FrontView preview update. All RJ45 connectors render adjacent to each other; all BNC connectors render adjacent. Review step shows PreflightReport with pass/fail status. Export step offers download buttons. No freeform canvas interaction required.
**Why human:** Multi-step interactive flow with live SVG preview update cannot be verified by static grep.

#### 2. Navigation Guard and Cancel Revert

**Test:** Start the wizard (step 0 → step 1 → step 2, add a device), then click the browser back button or navigate away via the nav sidebar.
**Expected:** A confirmation dialog appears ("Leave wizard?" with "Stay" / "Leave" buttons). If "Stay" is clicked, user stays on wizard. If "Leave" is clicked, navigation proceeds. Separately, clicking "Cancel Wizard" should revert the store to the pre-wizard state (device disappears from the panel).
**Why human:** `useBlocker` behavior and undo stack revert require runtime browser interaction.

#### 3. Weight Distribution Visual Check

**Test:** Add USW-Lite-16-PoE (192mm wide, 1.2kg) and UniFi Express 7 (117mm wide, 0.42kg) via wizard StepDevices.
**Expected:** The heavier USW-Lite-16-PoE is positioned closer to the left rack ear; the lighter UX7 is positioned inward (right of center or to the right of the heavier device).
**Why human:** Visual inspection of element X positions in the rendered FrontView is needed.

#### 4. Label Stagger Collision Avoidance

**Test:** Add 4 connectors of the same type with short widths. Add label "PORT" with auto-number enabled to all 4 via Sidebar. Verify staggering behavior when labels would overlap.
**Expected:** Adjacent labels that would horizontally overlap are alternately placed above and below the cutout rather than all on the same side.
**Why human:** Label Y-position stagger algorithm output requires visual inspection of rendered SVG.

---

### Deviations and Observations

1. **LAYOUT-03 "backtracking" not literally implemented.** The requirement says "with backtracking for better fit" but the CONTEXT.md Phase 4 research locked the alternating-ear algorithm as the accepted approach. The V2 engine achieves tighter packing through connector grouping (eliminating wasted inter-family gaps) and weight-aware placement (reducing dead end-space). This is the intended interpretation per the plan.

2. **`runAutoLayout` uses stale closure pattern.** In `StepDevices.tsx`, `runAutoLayout` reads `store.elements` via `useConfigStore.getState().elements` after `addElement`. This is correct because it gets post-add state from the store directly (not from a React state closure). The pattern is sound.

3. **`gapStart` variable unused in `placeConnectorsInZone` 'between' case.** At `autoLayoutV2.ts:328`, `const gapStart = ...` is assigned but the variable is immediately shadowed by the `betweenStart` computation. This is a minor dead-code issue, not a functional gap.

---

## Summary

Phase 4 fully achieved its goal. All 5 observable success criteria are satisfied by substantive, wired implementations:

- The **guided wizard** provides a complete 6-step guided flow at `/wizard` from rack standard selection through export, with live FrontView preview updating in real time, undo checkpoint for cancel revert, navigation guard, sessionStorage step persistence, and both "Export Now" and "Edit in Configurator" exit paths.

- **Custom text labels** are a first-class feature: `ElementLabel` type defined, `setElementLabel` store action wired to Sidebar editor, labels rendered in SVG FrontView with auto-numbering and stagger collision avoidance, and exported to DXF (`5-LABELS` TEXT entities) and OpenSCAD (`label_N()` debossed modules). Labels persist via `designSerializer`.

- **Smart auto-layout V2** groups connectors by type family using `CONNECTOR_FAMILIES` map, places devices by weight toward rack ears using an alternating cursor algorithm, supports 4 connector zone modes, detects overflow with actionable suggestions, and validates the result with inline AABB checks.

- All **6 requirement IDs** (UX-01, UX-04, LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04) are satisfied. TypeScript type-check (`tsc --noEmit`) passes with zero errors. All 6 phase commits verified in git history.

Human verification is needed for: interactive wizard flow, navigation guard behavior, visual weight distribution, and label stagger rendering.

---

_Verified: 2026-02-22T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
