---
status: resolved
trigger: "Investigate why the 3D rendering only shows the first device and is missing the second device, all keystones/connectors, and the tray."
created: 2026-02-22T22:00:00Z
updated: 2026-02-22T22:30:00Z
---

## Current Focus

hypothesis: CONFIRMED -- Preview3D.tsx uses only the legacy inline `DEVICES` and `CONNECTORS` constants for lookups, not the catalog-aware `lookupDevice()`/`lookupConnector()` functions. Any device or connector added from the catalog (slug not in inline constants) silently returns `null`/`undefined`, causing elements to be skipped.
test: Code trace -- compare lookup methods across components
expecting: Preview3D uses inline-only; FrontView uses catalog-aware lookups
next_action: Return diagnosis

## Symptoms

expected: 3D preview shows all placed elements (multiple devices, connectors/keystones, and device trays)
actual: Only the first device is visible; second device, all connectors, and trays are missing
errors: No runtime errors (failures are silent -- null checks just skip rendering)
reproduction: Place 2+ devices from catalog and connectors on panel, switch to 3D tab
started: Pre-existing issue from before Phase 4 -- the Preview3D.tsx was written using inline constants and was never updated when the catalog system was introduced in Phase 1

## Eliminated

(none -- first hypothesis was confirmed)

## Evidence

- timestamp: 2026-02-22T22:05:00Z
  checked: Preview3D.tsx line 191 -- cutout generation for faceplate
  found: |
    `const lib = el.type === 'connector' ? CONNECTORS[el.key] : DEVICES[el.key];`
    Uses only inline `CONNECTORS` and `DEVICES` constants. Does NOT use `lookupDevice()` or `lookupConnector()`.
    If `el.key` is a catalog-only slug (not in inline constants), `lib` is `undefined` and the element is filtered out by `.filter(Boolean)` on line 215.
  implication: All catalog-sourced devices AND connectors are invisible in the 3D cutout rendering.

- timestamp: 2026-02-22T22:07:00Z
  checked: Preview3D.tsx line 283-284 -- retention lip generation
  found: |
    `elements.filter(e => e.type === 'device').map(el => { if (!DEVICES[el.key]) return null; ... })`
    Same problem: retention lips only render for devices whose `el.key` exists in the inline `DEVICES` constant.
  implication: Catalog-sourced devices get no retention lips in 3D view.

- timestamp: 2026-02-22T22:09:00Z
  checked: useEnclosure.ts line 46-47 -- tray generation
  found: |
    `.map(e => { const dev = DEVICES[e.key]; if (!dev) return null; ... })`
    The `useEnclosure` hook also uses only inline `DEVICES[e.key]` instead of `lookupDevice(e.key)`.
    If the device came from catalog, `dev` is `undefined`, tray is `null`, and it gets filtered out.
  implication: Trays are missing for ALL catalog-sourced devices.

- timestamp: 2026-02-22T22:11:00Z
  checked: Preview3D.tsx line 191 -- fan handling
  found: |
    The ternary `el.type === 'connector' ? CONNECTORS[el.key] : DEVICES[el.key]` has NO branch for `el.type === 'fan'`.
    Fans fall into the `DEVICES[el.key]` branch, which will always be `undefined` for fan keys (they live in `FANS` constant).
  implication: Fan elements are also completely invisible in the 3D preview.

- timestamp: 2026-02-22T22:13:00Z
  checked: FrontView.tsx lines 176-191 for comparison
  found: |
    FrontView uses `useCatalogStore(selectDeviceMap)` and `useCatalogStore(selectConnectorMap)` to build a `knownSlugs` set.
    FrontView renders elements based on `el.w` and `el.h` from the `PanelElement` itself (which were set at add-time from the resolved device/connector), not from a re-lookup.
    This is why FrontView works: it uses the pre-resolved dimensions stored on the element.
  implication: FrontView does NOT re-lookup device defs for rendering dimensions. Preview3D does re-lookup and fails for catalog entries.

- timestamp: 2026-02-22T22:15:00Z
  checked: configJson.ts lines 68-87 for comparison
  found: |
    The export generator uses `lookupDevice(e.key)` (catalog-aware, 3-tier resolution) for device depth.
    It also uses `CONNECTORS[e.key]` directly for connectors (partially affected -- but connector dimensions come from the element's `w`/`h`).
  implication: Export is partially affected but less visibly broken because most output fields come from the element itself.

- timestamp: 2026-02-22T22:17:00Z
  checked: useConfigStore.ts addElement() lines 235-277
  found: |
    When adding elements, `addElement` calls `lookupDevice(key)` / `lookupConnector(key)` to resolve dimensions.
    The resolved `w`, `h`, `label` are stored directly on the `PanelElement`.
    This means every placed element has correct `w` and `h` regardless of source.
  implication: The PanelElement already carries correct dimensions. Preview3D does NOT need to re-lookup device/connector definitions for geometry -- it only needs them for metadata like `color` and `depthBehind`.

- timestamp: 2026-02-22T22:20:00Z
  checked: Preview3D.tsx cutoutMeshes useMemo -- what data actually comes from `lib`
  found: |
    From `lib`, Preview3D uses:
    1. `lib.cut` (cutout type -- round vs rect) -- only for connectors
    2. `lib.r` (cutout radius) -- only for round/d-shape connectors
    3. `lib.color` -- for cutout indicator color
    For device cutouts, it only uses `el.w * scale` and `el.h * scale` (from the element itself).
    But the null check `if (!lib) return null` on line 192 discards the ENTIRE element when lookup fails, even though `el.w` and `el.h` are available.
  implication: The null guard is too aggressive. Even for catalog-only devices, the element has all the geometry data needed for the 3D cutout. The lookup failure shouldn't skip the element entirely.

## Resolution

root_cause: |
  **THREE LOOKUP FAILURES in Preview3D.tsx and useEnclosure.ts:**

  1. **Preview3D.tsx line 191**: Uses `CONNECTORS[el.key]` / `DEVICES[el.key]` (inline constants only) instead of `lookupConnector(el.key)` / `lookupDevice(el.key)` (catalog-aware 3-tier resolution). Any element whose key is a catalog-only slug returns `undefined`, and the `if (!lib) return null` guard on line 192 silently discards it.

  2. **Preview3D.tsx line 284**: Same pattern for retention lips: `if (!DEVICES[el.key]) return null` -- catalog devices get no retention lips.

  3. **useEnclosure.ts line 46-47**: `const dev = DEVICES[e.key]; if (!dev) return null;` -- trays are not generated for catalog-sourced devices.

  Additionally, Preview3D has no handling for `el.type === 'fan'` -- fan elements fall through to `DEVICES[el.key]` which always returns `undefined`.

  **This is a pre-existing issue from before Phase 4.** The catalog system was introduced in Phase 1, but Preview3D.tsx and useEnclosure.ts were never updated to use the catalog-aware lookup functions.

fix: (not applied -- diagnosis only)
verification: (not verified -- diagnosis only)
files_changed: []

## Suggested Fix Direction

**Files to change:**
- `src/components/Preview3D.tsx` -- Replace `CONNECTORS[el.key]`/`DEVICES[el.key]` with `lookupConnector(el.key)`/`lookupDevice(el.key)`, add `FANS[el.key]` branch for fans
- `src/hooks/useEnclosure.ts` -- Replace `DEVICES[e.key]` with `lookupDevice(e.key)`

**Specific changes:**

1. **Preview3D.tsx cutoutMeshes (line 189-216)**: Replace inline lookups with catalog-aware ones. Add a fan branch. Consider using `el.w`/`el.h` from the PanelElement directly (already resolved at add-time) so the cutout rendering never depends on a re-lookup succeeding.

2. **Preview3D.tsx retention lips (line 283-284)**: Replace `DEVICES[el.key]` guard with `lookupDevice(el.key)`, OR better yet remove the guard entirely since device elements already have `el.w` and `el.h` on the PanelElement.

3. **useEnclosure.ts tray generation (line 46-47)**: Replace `DEVICES[e.key]` with `lookupDevice(e.key)`. Note: this needs `dev.d` (device depth) which is NOT stored on PanelElement, so the lookup is genuinely required here.

**Architecture note:** Since `useEnclosure.ts` is a React hook, using `lookupDevice()` (which calls `useCatalogStore.getState()`) is fine -- it does synchronous reads. However, for reactivity to catalog loading, it may need to subscribe to `useCatalogStore` or accept the device map as a parameter.
