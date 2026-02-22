# Domain Pitfalls

**Domain:** Parametric rack mount panel configurator — community equipment database, enhanced UX, cost estimation, web deployment
**Researched:** 2026-02-21
**Confidence:** HIGH (grounded in existing codebase CONCERNS.md + MEMORY.md + web research verification)

---

## Critical Pitfalls

Mistakes that cause rewrites, fabrication failures, or loss of user trust.

---

### Pitfall 1: Equipment Database Dimensions Are Wrong, and Users Find Out the Hard Way

**What goes wrong:** Community-submitted (or manually entered) device dimensions are off by 1–5mm. The user designs a panel, prints or cuts it, and the device does not fit. Trust in the tool collapses.

**Why it happens:** Manufacturer datasheets frequently report nominal case size, not the actual outer dimension including rubber feet, port protrusions, or antenna stubs. Contributors copy from spec pages without measuring.

**Warning signs:**
- Dimensions copied from marketing pages rather than technical datasheets
- No `dataSource` field on device entries
- No review workflow before entries go live

**Prevention:**
- Require `dataSource` field on every device entry: `'manufacturer-datasheet'`, `'community-measured'`, `'estimated'`
- Surface data source in the UI — show a warning badge when `dataSource === 'estimated'`
- Add a `verifiedBy` or upvote count so crowd-sourced validation accumulates
- Mandate the TOLERANCE constant (0.2mm) is already baked in — document explicitly so contributors do not double-add tolerance

**Phase:** Equipment database build — address before any community submissions open

---

### Pitfall 2: Community Submissions Become a Spam and Duplicate Graveyard

**What goes wrong:** Open "submit a device" form attracts duplicates ("USW-Lite-16-PoE" vs "USW Lite 16 PoE" vs "Ubiquiti USW 16 PoE"), AI-generated submissions with plausible-but-wrong specs, and near-identical regional variants.

**Why it happens:** No deduplication gate, no canonical key schema. The existing codebase uses short slugs as keys — collisions are silent (last writer wins).

**Prevention:**
- Enforce slug naming convention: `{brand-abbrev}-{model-slug}` (e.g., `ubi-usw-lite-16-poe`)
- Run fuzzy-name deduplication on all submissions before merge
- Use GitHub PR-based contribution flow with a bot that checks slug collision + dimension reasonableness
- Require mandatory `dimensions_source` URL in the PR description

**Phase:** Community contribution system design — build the gate before opening contributions

---

### Pitfall 3: JSON Catalog Schema Versioning Is an Afterthought, Then a Crisis

**What goes wrong:** The first catalog ships with `{ key, name, w, d, h, weight }`. Six months later, new features need `rackUnits`, `powerW`, `dataSource`. Old entries have no `rackUnits`. Export generators break on `undefined`.

**Why it happens:** Client-side JSON catalogs feel "just data" — developers skip the versioning discipline applied to APIs.

**Prevention:**
- Add `schemaVersion: 1` at catalog root on day one
- Write a Zod schema for `DeviceDef`, `ConnectorDef` and validate every catalog load
- Define required vs optional fields explicitly; never add a required field without a migration pass
- Store the catalog version in localStorage alongside cached data; invalidate cache on version mismatch

**Phase:** Equipment database architecture — Week 1, before any device entries are written

---

### Pitfall 4: React 19 + Zustand 5 Selector Instability Regresses When New State Is Added

**What goes wrong:** Every new piece of state added to the store is a potential trigger for the known selector memoization issue. A developer adds a new store field referenced inside an existing selector without updating the cache key — infinite re-render loop.

**Why it happens:** The single-slot cache pattern is correct but brittle. The cache key is manually composed.

**Warning signs:**
- Selectors with cache keys that don't list every field they consume (documented: `selectSplitInfo` key omits `wallThickness`)
- New store fields added without a selector audit

**Prevention:**
- Write a selector stability test for every selector returning an object/array: call twice with same state, assert `===`
- Document the cache key formula next to each selector
- Never add a store field without reviewing every selector that might consume it

**Phase:** Ongoing — establish selector test coverage before any new store state is added

---

### Pitfall 5: Cost Estimation Numbers Are Trusted as Quotes

**What goes wrong:** The cost estimator shows "$14.73 for FDM" and the user screenshots it. The actual print cost is $22 because filament density varies, support material was not included, and electricity cost was wrong.

**Prevention:**
- Always display as an **estimate range**, never a precise figure: "$12–$18 FDM depending on slicer settings"
- Show the assumptions explicitly: filament cost/kg, estimated support factor (1.2–1.4x), electricity per kWh
- For sheet metal: link to the fabricator's live quoting page rather than replicating their pricing
- Add a prominent disclaimer: "Actual quotes from SendCutSend/Protocase will differ"

**Phase:** Cost estimation feature — address before shipping the estimate UI

---

### Pitfall 6: DXF/STEP Export Produces Files That Fail Fabricator Preflight

**What goes wrong:** The DXF exported by `dxfGen.ts` passes visual inspection but fails SendCutSend's automated preflight. Common failures: open contours, duplicate coincident lines, holes too close to edges/bends, missing bend annotations.

**Why it happens:** DXF is deceptively permissive — a viewer renders it fine while a CNC controller rejects it. The existing `dxfGen.ts` has no tests (documented in CONCERNS.md).

**Prevention:**
- Test every generated DXF by uploading representative panels to a SendCutSend test quote
- Add unit tests: assert each entity forms a closed loop, hole-to-edge distances meet 2T rule, bend lines present
- Add a "DXF validation report" step before download

**Phase:** Export hardening — before web deployment

---

### Pitfall 7: OpenSCAD WASM Blocks the UI Thread Without a Worker

**What goes wrong:** Running `openscad-wasm` on the main thread freezes the browser for 2–60 seconds on complex models.

**Prevention:**
- Always run openscad-wasm inside a Web Worker
- Post progress messages from the worker; show an indeterminate spinner
- Implement a 60-second timeout with "download .scad file instead" fallback
- On mobile: skip live WASM preview — offer download-only

**Phase:** If WASM preview is added — mandatory from day one

---

### Pitfall 8: WebGL Context Exhaustion Breaks the 3D Tab on Safari and iOS

**What goes wrong:** Safari limits WebGL contexts to 4–8 per page. If the 3D canvas is mounted/unmounted during tab navigation, each mount creates a new context without disposing the previous one. After a few tab switches — black screen.

**Why it happens:** The current tab routing (`activeTab === '3d' && <Preview3D />`) mounts and unmounts the canvas on every tab switch.

**Prevention:**
- Keep the Canvas alive using CSS `display: none` instead of conditional rendering
- Verify `@react-three/fiber` v9's Canvas properly calls `forceContextLoss` on unmount
- Set a maximum of one active Canvas in the app
- Add Safari/iOS to the test matrix before web deployment

**Phase:** Web deployment prep — must be fixed before going live

---

## Moderate Pitfalls

---

### Pitfall 9: Saved Configurations Become Unloadable After Schema Changes

**Prevention:**
- Add `configVersion` field to persisted state from day one
- Write a migration function: `migrate(raw, currentVersion) → state`
- Test: save with v1 schema, load with v2 code, assert no crash

**Phase:** State persistence implementation

---

### Pitfall 10: Auto-Layout Produces Overlapping Layouts That Validate as Valid

**What goes wrong:** Width budget selector uses approximate `+4mm` padding, but validation uses real positions. The two checks are inconsistent.

**Prevention:**
- Fix width budget formula to use actual element bounding boxes before improving auto-layout
- Auto-layout must call the same validation logic used by the UI
- After any auto-layout run, immediately run full validation pass

**Phase:** Auto-layout enhancement — fix width budget inconsistency first

---

### Pitfall 11: Custom Devices Are Lost on Page Reload and Silently Break Exports

**Prevention:**
- Persist custom devices to localStorage alongside panel state
- Validate export: if element key resolves to `undefined`, block export with visible error
- Fix all direct `DEVICES[el.key]` lookups to use `lookupDevice()` first

**Phase:** State persistence implementation

---

### Pitfall 12: Wizard Mode Collects State That Diverges from the Configurator State

**Prevention:**
- Wizard is a **view over the same Zustand store** — not a separate store
- Wizard steps use the same `addElement()` actions the configurator uses
- Test: complete wizard → switch to configurator → verify panel matches

**Phase:** Wizard mode implementation — establish state model before building steps

---

### Pitfall 13: Fusion 360 Bridge Path Injection and Unauthenticated Access

**Prevention:**
- Audit the bridge's CORS config before web deployment
- Add a shared secret header (`X-RackPro-Token`) validated on every bridge request
- Restrict export paths to a configurable whitelist
- Add input validation on custom device dimensions

**Phase:** Web deployment prep — security review before public hosting

---

## Minor Pitfalls

---

### Pitfall 14: HTML index.html Cached by Browser — Users Run Stale App

**Prevention:** Set `Cache-Control: no-cache` on `index.html` at the CDN layer. Optionally add a `version.json` poll for "new version available" banner.

**Phase:** Web deployment — hosting configuration

---

### Pitfall 15: Grid Dot SVG Pattern Regresses Under New Components

**Prevention:** Replace `gridDots` array with the static SVG `<pattern>` element (already defined in `FrontView.tsx` lines 196–200) before adding new UI panels.

**Phase:** UI polish — fix before adding catalog browser or wizard sidebar

---

### Pitfall 16: O(n²) Overlap and Margin Checks With Large Element Counts

**Prevention:** Add spatial partitioning: sort elements by X, skip pairs whose bounding boxes cannot possibly overlap. 15-line optimization: O(n²) → O(n log n).

**Phase:** Performance optimization — do before catalog expansion enables 30+ elements

---

### Pitfall 17: Module-Level Undo Stack Shared Across Test Runs

**Prevention:** Move `past`/`future` into Zustand state, or add `resetUndoHistory()` called in `beforeEach`.

**Phase:** Test coverage — fix before writing new store action tests

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Equipment database build | Wrong dimensions (Pitfall 1) | Require `dataSource` field; surface confidence in UI |
| Community submissions | Duplicates/spam (Pitfall 2) | Enforce slug schema; dedup check before merge |
| State persistence | Old configs break (Pitfall 9) | Version from first persist call; migration function |
| Custom device persistence | Exports break silently (Pitfall 11) | Fix `lookupDevice()` usage everywhere first |
| Cost estimation | Numbers mistaken for quotes (Pitfall 5) | Range display + explicit assumptions + vendor link |
| DXF export hardening | Preflight failures (Pitfall 6) | Upload test files to SendCutSend before shipping |
| Auto-layout improvement | Inconsistent validation (Pitfall 10) | Fix width budget formula first |
| Wizard mode | State divergence (Pitfall 12) | Use same Zustand actions, not parallel state |
| Web deployment | Safari, cache, bridge security (8, 13, 14) | Security review + Safari test + CDN config |
| New store fields | Selector instability (Pitfall 4) | Selector stability tests before new state |
| Catalog grows 50+ | O(n²) drag lag (Pitfall 16) | Spatial partitioning before expansion |

---

## Sources

- Codebase CONCERNS.md (2026-02-21) — documented bugs, tech debt, performance bottlenecks
- Codebase MEMORY.md — React 19 + Zustand 5 selector instability, Fusion 360 API quirks
- CLAUDE.md — TOLERANCE=0.2mm, split system constraints, keystone panel thickness
- [SendCutSend DXF/STEP preflight guidelines](https://sendcutsend.com/faq/what-are-common-problems-to-look-for-in-my-files/)
- [openscad-wasm GitHub](https://github.com/openscad/openscad-wasm) — Web Worker support
- [react-three-fiber Safari WebGL discussion](https://github.com/pmndrs/react-three-fiber/discussions/2457)
- [NN/g wizard research](https://www.nngroup.com/articles/wizards/)
