---
phase: 05-ui-3d-polish
plan: 04
subsystem: 3d-preview
tags: [pbr, meshphysicalmaterial, three.js, normal-maps, textures, react-three-fiber, sharp]

# Dependency graph
requires:
  - phase: 05-ui-3d-polish
    plan: 01
    provides: "shadcn/ui foundation with Tooltip component for toolbar"
  - phase: 05-ui-3d-polish
    plan: 03
    provides: "CSG faceplate with boolean-subtracted cutout holes in Preview3D"
provides:
  - "PBR material system with auto-switch on fab method and filament selection"
  - "4 procedural PBR texture maps (brushed metal normal/roughness, carbon fiber normal, plastic layer-line normal)"
  - "usePanelMaterial hook returning MeshPhysicalMaterial presets for faceplate/wall/ear"
  - "Material override dropdown in 3D toolbar (Auto/Aluminum/Plastic/Carbon)"
  - "Warehouse Environment preset for metallic reflections"
affects: [05-ui-3d-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Procedural texture generation via sharp for PBR normal/roughness maps", "MeshPhysicalMaterial with clearcoat (metal), sheen (carbon), layer-line normal (plastic)", "Material preset auto-resolution from fabMethod + filamentKey"]

key-files:
  created:
    - "src/hooks/usePanelMaterial.ts"
    - "public/textures/brushed-metal-normal.jpg"
    - "public/textures/brushed-metal-roughness.jpg"
    - "public/textures/carbon-fiber-normal.jpg"
    - "public/textures/plastic-layerline-normal.jpg"
    - "scripts/generate-textures.ts"
  modified:
    - "src/components/Preview3D.tsx"

key-decisions:
  - "Procedural texture generation via sharp rather than downloading CC0 assets — ensures reproducibility and avoids external dependency"
  - "Filament keys petcf, pacf, petgcf trigger carbon fiber preset (matching actual FILAMENTS constant keys, not hyphenated variants)"
  - "Tray floor and connector body materials kept as static MeshStandardMaterial — less visually prominent and simpler"
  - "Material override dropdown uses native HTML select (not shadcn Select) — positioned as overlay on Canvas, simpler than bridging React DOM into R3F"
  - "Environment preset changed from studio to warehouse for wider light sources that produce visible reflections on clearcoat/metallic surfaces"

patterns-established:
  - "PBR material hook pattern: useTexture for loading, useMemo keyed on preset for creation, useEffect/ref for disposal"
  - "Material prop threading: EnclosureMesh receives materialOverride from outside Canvas, TrayMesh receives wallMaterial prop"

requirements-completed: [3D-02]

# Metrics
duration: 17min
completed: 2026-02-23
---

# Phase 5 Plan 4: PBR Materials + Environment Lighting Summary

**MeshPhysicalMaterial PBR with procedural normal/roughness maps, fab-method auto-switching, manual material override dropdown, and warehouse Environment for metallic reflections**

## Performance

- **Duration:** 17 min
- **Started:** 2026-02-23T02:21:10Z
- **Completed:** 2026-02-23T02:38:02Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Procedural PBR texture generation (1024x1024) via sharp: brushed metal grain normal + roughness, carbon fiber 2x2 twill weave normal, FDM layer-line normal
- usePanelMaterial hook provides MeshPhysicalMaterial presets (metal with clearcoat, plastic with layer lines, carbon with sheen) that auto-switch based on fabMethod and filamentKey
- Preview3D upgraded from MeshStandardMaterial to MeshPhysicalMaterial with PBR textures on faceplate, walls, ears, retention lips, and rear panel
- Material override dropdown in 3D toolbar allows manual selection (Auto, Aluminum, Plastic, Carbon)
- Environment upgraded from "studio" to "warehouse" for better metallic reflections and clearcoat visibility
- Material disposal on preset change prevents GPU memory leaks

## Task Commits

Each task was committed atomically:

1. **Task 1: PBR texture assets and usePanelMaterial hook with auto-switch** - `935e16e` (feat)
2. **Task 2: Integrate PBR materials into Preview3D, upgrade Environment, add material override dropdown** - `93511d3` (feat)

## Files Created/Modified
- `public/textures/brushed-metal-normal.jpg` - Tileable 1024x1024 brushed metal normal map (horizontal grain lines)
- `public/textures/brushed-metal-roughness.jpg` - Tileable 1024x1024 roughness map with directional streak variation
- `public/textures/carbon-fiber-normal.jpg` - Tileable 1024x1024 carbon fiber 2x2 twill weave normal map
- `public/textures/plastic-layerline-normal.jpg` - Tileable 1024x1024 FDM layer-line normal map (0.2mm period)
- `scripts/generate-textures.ts` - Procedural texture generator using sharp (run once, output committed)
- `src/hooks/usePanelMaterial.ts` - PBR material hook: resolvePreset, usePanelMaterial returning PanelMaterials {faceplate, wall, ear}
- `src/components/Preview3D.tsx` - Replaced static MeshStandardMaterial with PBR hook, added material dropdown, upgraded Environment

## Decisions Made
- **Procedural texture generation via sharp** rather than downloading external CC0 assets. The generate-textures.ts script creates all 4 maps deterministically, avoiding network dependencies and licensing concerns. Results are committed as static assets.
- **Native HTML select for material dropdown** rather than shadcn Select. The dropdown overlays the Canvas and is simpler as a plain `<select>` than bridging Radix portal rendering over a WebGL context.
- **Tray/connector body materials kept as MeshStandardMaterial** — these are semi-transparent or small elements where PBR visual difference is negligible. Avoids unnecessary material object creation.
- **Carbon filament detection** uses actual FILAMENTS keys (`pacf`, `petcf`, `petgcf`) rather than hyphenated variants assumed in the plan.
- **Environment warehouse preset** provides wider light sources than "studio", producing more visible reflections on high-metalness surfaces with clearcoat.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed carbon filament key matching**
- **Found during:** Task 1 (usePanelMaterial hook implementation)
- **Issue:** Plan assumed filament keys `pa-cf` and `pet-cf` for carbon fiber detection, but actual FILAMENTS constant uses `pacf`, `petcf`, and `petgcf`
- **Fix:** Used `new Set(['pacf', 'petcf', 'petgcf'])` for carbon filament detection
- **Files modified:** `src/hooks/usePanelMaterial.ts`
- **Verification:** `npm run build` succeeds, preset resolves correctly for all filament keys
- **Committed in:** `935e16e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Key matching fix essential for correct carbon fiber preset activation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PBR material system fully operational with 3 presets
- Environment lighting produces visible reflections for metallic materials
- Materials auto-switch cleanly when user changes fab method or filament in Sidebar
- Manual override allows visualization in any material regardless of config
- Textures are committed static assets (no runtime generation needed)
- Ready for any remaining Phase 5 plans

## Self-Check: PASSED
