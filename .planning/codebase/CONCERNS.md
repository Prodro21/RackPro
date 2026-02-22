# Codebase Concerns

**Analysis Date:** 2026-02-21

## Tech Debt

**Duplicate drag logic in FrontView and useDrag hook:**
- Issue: Drag-and-drop logic is implemented twice: once in `src/components/FrontView.tsx` (lines 88–163) and once in `src/hooks/useDrag.ts`. The hook exists but is not used — `FrontView` has its own inline implementation.
- Files: `src/components/FrontView.tsx`, `src/hooks/useDrag.ts`
- Impact: Bug fixes or feature changes to drag behavior must be applied in two places. `useDrag.ts` is dead code.
- Fix approach: Delete `src/hooks/useDrag.ts` or refactor `FrontView` to use it.

**Duplicate snap-guide logic in FrontView and useDrag:**
- Issue: `computeSnapGuides()` is defined at the top of `src/components/FrontView.tsx` and `findEdgeSnaps()` performs the same calculation in `src/hooks/useDrag.ts`. Neither function is shared.
- Files: `src/components/FrontView.tsx` (lines 14–61), `src/hooks/useDrag.ts` (lines 22–91)
- Impact: Different threshold values (2mm in both, but logic ordering differs) and edge-snap behavior could diverge.
- Fix approach: Move snap logic into a shared pure function in `src/lib/snapGuides.ts`.

**`zundo` listed in dependencies but never used:**
- Issue: `zundo@2.3.0` is in `package.json` dependencies but is not imported anywhere. The MEMORY.md documents it was removed due to React 19 incompatibility.
- Files: `package.json`
- Impact: Adds ~22KB to bundle; signals to future developers the undo system may use it when it does not.
- Fix approach: Remove `"zundo": "^2.3.0"` from `package.json` and run `npm install`.

**`three-bvh-csg` listed in dependencies but never imported:**
- Issue: `three-bvh-csg@0.0.17` is in `package.json` dependencies. No import of this package exists anywhere in `src/`. The 3D preview uses a simplified "CSG-like" overlay approach instead.
- Files: `package.json`, `src/components/Preview3D.tsx` (comment at line 185)
- Impact: Bundle size bloat; confusing indication that real boolean CSG is implemented when it is not.
- Fix approach: Remove `"three-bvh-csg": "^0.0.17"` from `package.json` OR implement actual boolean CSG for accurate cutout representation.

**Module-level mutable undo stacks shared across all store instances:**
- Issue: `past` and `future` arrays in `src/store/useConfigStore.ts` (lines 39–40) are module-level constants, not part of Zustand state. They persist across hot-reloads in development and cannot be inspected by devtools.
- Files: `src/store/useConfigStore.ts`
- Impact: In development, HMR does not reset undo history. Undo/redo state is invisible to React DevTools and Zustand devtools. Cannot serialize for persistence.
- Fix approach: Move `past` and `future` into the Zustand state shape or use a separate store.

**Width budget formula adds a flat 4mm per element regardless of real spacing:**
- Issue: `selectUsedWidth` in `src/store/selectors.ts` (line 187) calculates `sum + e.w + 4` for every element. The `+4` assumes 4mm spacing between all elements including edges, but this is a rough approximation not based on actual element positions.
- Files: `src/store/selectors.ts`, `src/mcp/tools/validate.ts` (line 43)
- Impact: Budget display and MCP `validate` tool report misleading remaining-width numbers when elements are tightly packed or spread out.
- Fix approach: Calculate actual remaining width from element bounding boxes vs. panel width, or document the approximation prominently.

**MCP state is completely disconnected from UI store:**
- Issue: `src/mcp/state.ts` maintains a separate in-memory state that duplicates all fields from `src/store/useConfigStore.ts`. Changes made via MCP tools do not appear in the browser UI, and vice versa.
- Files: `src/mcp/state.ts`, `src/store/useConfigStore.ts`
- Impact: Any MCP-driven workflow (build in Fusion, validate, suggest_layout) operates on a separate state context from what the user sees. Results are not reflected in the UI.
- Fix approach: Long-term — expose the Zustand store state via a shared file or HTTP sync endpoint. Short-term — document the limitation in the MCP README.

**`autoReinforcement` defaults to `false` but reinforcement is a core feature:**
- Issue: `autoReinforcement` defaults to `false` in both `useConfigStore.ts` and `mcp/state.ts`. The reinforcement computation in `src/lib/reinforcement.ts` is well-developed but silently skipped.
- Files: `src/store/useConfigStore.ts` (line 171), `src/export/configJson.ts` (lines 41–43)
- Impact: Export configs omit reinforcement geometry unless the user manually enables a non-obvious toggle. Many users will export structurally incomplete designs.
- Fix approach: Default `autoReinforcement` to `true`, or show a prominent warning in the export tab when it is off and there are elements present.

**Chamfer step in Fusion 360 script is a no-op placeholder:**
- Issue: `src/export/fusion360Gen.ts` emits a comment at Step 10 stating "apply manually in Fusion — auto chamfers require body selection" instead of actual chamfer code.
- Files: `src/export/fusion360Gen.ts` (lines 717–719)
- Impact: The `chamfers: true` toggle in the UI has no effect on the Fusion 360 output. Users who enable chamfers get no chamfers in their generated model.
- Fix approach: Implement chamfer feature emission using `comp.features.chamferFeatures`, or disable the chamfers checkbox when Fusion 360 export is selected and document the limitation.

## Known Bugs

**Test uses non-existent connector key `rj45-keystone`:**
- Symptoms: `src/__tests__/exportModular.test.ts` (line 47) references `key: 'rj45-keystone'` but `src/constants/connectors.ts` defines the key as `'rj45-ks'`. Export functions that look up by key will return `undefined` for this element.
- Files: `src/__tests__/exportModular.test.ts`, `src/constants/connectors.ts`
- Trigger: Any export function that resolves `CONNECTORS['rj45-keystone']` returns `undefined`. The test may pass because it checks string contents rather than computed connector geometry.
- Workaround: Change the test fixture key to `'rj45-ks'`.

**Arrow-key move does not clamp to panel bounds:**
- Symptoms: `src/hooks/useKeyboard.ts` (lines 80–85) moves elements with arrow keys but applies no bounds clamping. Elements can be nudged off-panel without triggering a bounds error.
- Files: `src/hooks/useKeyboard.ts`
- Trigger: Select an element near the panel edge and press arrow key repeatedly.
- Workaround: Out-of-bounds elements are highlighted in FrontView, but there is no automatic correction.

**`useConfigStore.getState()` called inline inside JSX render path:**
- Symptoms: `src/components/FrontView.tsx` (line 450) calls `useConfigStore.getState().uHeight` directly inside JSX render. This bypasses React's subscription system and will not re-render if `uHeight` changes while the component is already mounted.
- Files: `src/components/FrontView.tsx` (line 450)
- Trigger: Change U-height while FrontView is rendered — the dimension annotation text at the right edge will show stale data until the next unrelated re-render.
- Workaround: Extract `uHeight` from the selector at the top of the component (it is already available as `useConfigStore(s => s.uHeight)` could be added).

**Custom devices not visible in 3D preview, SideView, or SpecsTab:**
- Symptoms: Multiple components use `DEVICES[el.key]` directly rather than `lookupDevice(el.key)`. Custom devices created via `useCustomDevices` are stored in a separate Zustand store and are invisible to these direct lookups.
- Files: `src/hooks/useEnclosure.ts` (line 46), `src/components/Preview3D.tsx` (lines 191, 284), `src/components/SideView.tsx` (line 83), `src/components/SpecsTab.tsx` (line 113), `src/components/Sidebar.tsx` (lines 380–381)
- Trigger: Create a custom device in `CustomDeviceModal`, place it on the panel, then view the 3D tab, side view, or specs tab.
- Workaround: Use only built-in Ubiquiti devices for accurate previews.

## Security Considerations

**Fusion 360 bridge accepts unauthenticated requests on localhost:9100:**
- Risk: The bridge HTTP endpoint at `http://localhost:9100` has no authentication. Any process running on the local machine can send arbitrary commands to Fusion 360, including `fusion_build`, `fusion_export_file`, and `fusion_screenshot`.
- Files: `src/mcp/fusion-client.ts`, `src/components/ExportTab.tsx`
- Current mitigation: Localhost-only binding limits exposure to the local machine.
- Recommendations: Add a shared secret header (e.g., `X-RackPro-Token`) generated at bridge startup and stored in a temp file, validated on every request.

**Export file path passed directly to Fusion 360 bridge with no sanitization:**
- Risk: `src/export/fusion360Gen.ts` and `src/mcp/tools/fusion-bridge.ts` pass user-supplied `path` strings to the Fusion 360 bridge `/export` endpoint. The bridge Python script writes to arbitrary filesystem paths.
- Files: `src/mcp/tools/fusion-bridge.ts` (line 145), `src/components/ExportTab.tsx` (line 87)
- Current mitigation: Input limited to the bridge running on localhost under user's account.
- Recommendations: Restrict allowed output directories to `~/Desktop`, `~/Documents`, or a configurable whitelist.

**No input validation on custom device dimensions in CustomDeviceModal:**
- Risk: `src/components/CustomDeviceModal.tsx` allows entering arbitrary numeric values for device W/D/H/weight. Negative or extremely large values can produce degenerate geometry in exports.
- Files: `src/components/CustomDeviceModal.tsx`
- Current mitigation: None beyond browser number input type.
- Recommendations: Add min/max validation — dimensions should be 1–500mm, weight 0–50kg.

## Performance Bottlenecks

**Grid dot rendering generates O(panW × panH) React elements:**
- Problem: `FrontView.tsx` (lines 166–183) generates individual `<circle>` SVG elements for every grid intersection when grid is enabled. For a 450mm × 44mm panel at 5mm grid, this is ~800 circles, each a React node.
- Files: `src/components/FrontView.tsx`
- Cause: The memoized `gridDots` array still creates hundreds of React elements rendered as DOM nodes.
- Improvement path: Use a single SVG `<pattern>` element (there is already a static 5mm pattern defined at lines 196–200) and replace the dynamic `gridDots` with the pattern `fill`. The static pattern already works — `gridDots` is redundant.

**Module-level selector cache uses single-slot memoization:**
- Problem: `src/store/selectors.ts` memoizes each selector with a single cache entry (one key variable). If any input changes, the entire result is recomputed. For `selectMarginWarnings`, the key is a long string built by joining all element positions.
- Files: `src/store/selectors.ts`
- Cause: Simple single-key cache misses whenever any element moves (every drag frame).
- Improvement path: `selectOverlaps` and `selectMarginWarnings` are the most expensive — consider a spatial index (e.g., simple sorted array by X) instead of O(n²) pairwise comparison.

**Hex floor geometry rebuilt on every tray render in Preview3D:**
- Problem: `src/components/Preview3D.tsx` `buildHexFloorGeo()` (lines 13–66) creates `THREE.Path` holes for every hexagon in the tray floor. This runs inside `useMemo` but the geometry object still gets recreated whenever `tray.w`, `tray.d`, `tray.wallT`, or `scale` changes.
- Files: `src/components/Preview3D.tsx`
- Cause: Hex layout involves per-hole path creation in a nested loop — expensive for large devices (e.g., USW-Pro-24-PoE has 285mm depth).
- Improvement path: Cache geometries in a `WeakMap` keyed by `(w, d, t, sc)` tuple outside the component.

## Fragile Areas

**SVG coordinate transform uses non-null assertion on `getScreenCTM()`:**
- Files: `src/components/FrontView.tsx` (lines 102, 116), `src/hooks/useDrag.ts` (lines 118, 133)
- Why fragile: `svg.getScreenCTM()` returns `null` when the element is not rendered to screen (e.g., hidden, detached, or during SSR). The `!.inverse()` pattern throws immediately if null.
- Safe modification: Add a null check: `const ctm = svg.getScreenCTM(); if (!ctm) return;`.
- Test coverage: No tests cover drag behavior at all.

**Selector memoization uses module-level variables (shared across test runs):**
- Files: `src/store/selectors.ts` (lines 16–22, 25–32, etc.)
- Why fragile: All cache variables (`_pdKey`, `_bKey`, `_siKey`, etc.) are module-level. In Vitest, module state persists between test cases unless explicitly reset. A test that calls `selectSplitInfo` with one state will pollute cache for the next test.
- Safe modification: Reset module-level cache between tests, or move cache into closure inside a factory function.
- Test coverage: `exportModular.test.ts` tests generators but not selectors directly.

**MCP server has no per-session state isolation:**
- Files: `src/mcp/state.ts` (line 64 — `let state = createDefaultState()`)
- Why fragile: A single `state` object is shared across all MCP tool calls in the process. If two MCP sessions run concurrently (e.g., Claude opens two conversations), they write to the same state object.
- Safe modification: Wrap state in a session map keyed by connection ID, or document that the server is single-session only.
- Test coverage: No tests for concurrent access.

**`selectSplitInfo` selector key does not include `wallThickness`:**
- Files: `src/store/selectors.ts` (line 37)
- Why fragile: The key is `${s.standard}_${s.uHeight}_${s.fabMethod}_${s.printerKey}`. Wall thickness affects center-piece width calculations indirectly (via `connector_offset` in CLAUDE.md), but a wall thickness change will return a stale cached `SplitInfo`.
- Safe modification: Add `_${s.wallThickness}` to the cache key.
- Test coverage: `exportModular.test.ts` does not test cache invalidation.

**`PlacementSurface` values `'side-top'` and `'side-bottom'` are defined but unhandled:**
- Files: `src/types.ts` (line 11), `src/components/Sidebar.tsx` (line 396)
- Why fragile: Users can assign `side-top` or `side-bottom` to any element via the Sidebar UI. None of the export generators (`openscadGen.ts`, `fusion360Gen.ts`, `dxfGen.ts`) or the 3D preview handle these surface values. Elements placed on side surfaces are silently treated as faceplate elements in exports.
- Safe modification: Either remove `side-top`/`side-bottom` from the UI until implemented, or add a validation warning when these surfaces are selected.
- Test coverage: None.

## Scaling Limits

**19" panel + 3D print tab count:**
- Current capacity: FrontView renders well up to ~20 elements.
- Limit: Each element creates multiple SVG nodes (selection, overlap, margin, label). At 50+ elements, the margin-warning O(n²) check in `computeMarginWarnings` (`src/lib/margins.ts`) and overlap check in `selectOverlaps` (`src/store/selectors.ts`) will produce noticeable lag on every drag frame.
- Scaling path: Spatial partitioning (sort by X, skip non-adjacent pairs) for both checks.

**Fusion 360 script grows linearly with element count:**
- Current capacity: Scripts with 5–10 elements (~200–500 lines) run successfully.
- Limit: Each device generates ~30 lines of Python per tray (floor, walls, tabs, holes, ribs). At 20+ devices, scripts exceed 1000 lines and Fusion's undo timeline becomes very deep, slowing feature computation.
- Scaling path: Use Fusion components/occurrences to instantiate repeated geometry instead of emitting per-element code blocks.

## Dependencies at Risk

**`@react-three/fiber@^9.5.0` requires React 19 compatibility:**
- Risk: `@react-three/fiber` v9 is the React 19 compatible release but is relatively new. The `Suspense fallback={null}` pattern in `Preview3D.tsx` (line 353) can cause the canvas to flash blank on re-renders.
- Impact: 3D preview visual glitches during state changes.
- Migration plan: Monitor `@react-three/fiber` releases; pin to a known-good patch version.

**`immer@^11.1.4` + Zustand 5 — Immer recipe mutability:**
- Risk: `produce()` from Immer wraps Zustand state mutations. If a future Zustand update changes how it calls Immer recipes, mutations like `s.elements.push(el)` may silently fail.
- Impact: `addElement`, `removeElement`, `moveElement`, `setElementSurface` actions could silently no-op.
- Migration plan: Add integration tests that verify state changes are applied correctly.

## Missing Critical Features

**No state persistence across page reloads:**
- Problem: The entire panel configuration is lost when the browser tab is closed or refreshed. There is no `localStorage` persistence, IndexedDB, or file save/load.
- Blocks: Cannot return to a partially configured panel; cannot share configurations between sessions.
- Note: `App.tsx` has a "Clear Storage & Reload" error recovery button that calls `localStorage.clear()`, implying persistence was planned but not implemented.

**No multi-U-height element support:**
- Problem: All elements are placed as flat 2D rectangles. There is no concept of an element spanning multiple U spaces in the Y axis independently. The panel is treated as a single canvas regardless of U-height.
- Blocks: Accurate modeling of tall rack gear (2U switches, KVM drawers) that need both a front-panel cutout and a specific U-space reservation.

**3D preview does not perform boolean CSG cutouts:**
- Problem: `src/components/Preview3D.tsx` renders cutouts as dark overlay meshes (additive), not as actual holes in the faceplate. The faceplate is a solid box and the "cutouts" float on top of it.
- Blocks: Accurate visualization; users cannot verify that cutouts will not overlap structural panel material.
- Note: `three-bvh-csg` is in `package.json` but not used; `src/components/MainContent.tsx` mentions "degenerate CSG geometry" in the error boundary, suggesting CSG was attempted.

## Test Coverage Gaps

**No tests for drag and drop behavior:**
- What's not tested: Element dragging, grid snapping, edge snapping, bounds clamping, snap guide generation.
- Files: `src/components/FrontView.tsx`, `src/hooks/useDrag.ts`
- Risk: Snap logic regressions, off-by-one bounds clamping, or coordinate transform errors could go undetected.
- Priority: High — drag is the primary user interaction.

**No tests for Zustand store actions:**
- What's not tested: `addElement`, `removeElement`, `duplicateElement`, `moveElement`, `undo`, `redo`, selector memoization invalidation.
- Files: `src/store/useConfigStore.ts`, `src/store/selectors.ts`
- Risk: Undo/redo stack corruption, selector cache staleness.
- Priority: High.

**No tests for MCP tool handlers:**
- What's not tested: `handleAddElement`, `handleRemoveElement`, `handleMoveElement`, `handleSuggestLayout`, `handleValidate`, `configurePanel`.
- Files: `src/mcp/tools/` (all files)
- Risk: MCP state mutation bugs, validation logic errors.
- Priority: Medium.

**No tests for OpenSCAD generator:**
- What's not tested: `generateOpenSCAD()` in `src/export/openscadGen.ts` (760 lines) — no test file exists for it.
- Files: `src/export/openscadGen.ts`
- Risk: Generated `.scad` files may have syntax errors or incorrect geometry for edge cases (round connectors, d-sub cutouts, multi-device panels, fan elements).
- Priority: Medium.

**No tests for DXF flat-pattern geometry:**
- What's not tested: Bend allowance calculations, bore slot placement, element cutout positioning in flat-pattern coordinates.
- Files: `src/export/dxfGen.ts` (563 lines)
- Risk: Fabricated panels with incorrect hole positions or missing relief cuts.
- Priority: High (incorrect DXF = wasted sheet metal).

---

*Concerns audit: 2026-02-21*
