# Phase 5 Context: UI + 3D Polish

**Phase goal (from ROADMAP.md, modified):** All form controls use accessible shadcn/ui components with a refreshed dark theme, the 3D preview renders accurate CSG cutout geometry with PBR materials, and Zustand selectors are stable and tested.

**Original Phase 5 scope change:** Cost estimation (COST-01 through COST-04) deferred to a future phase. 3D preview polish (3D-02, 3D-03 from original Phase 6) merged into this phase. Community contributions (COMM-01, COMM-02) remain in a future phase.

**Requirements covered:** PLAT-03, PLAT-04, 3D-02, 3D-03

---

## Area 1: shadcn/ui Theme & Migration

### Decisions

**Theme direction:** New Slate/Neutral dark palette replacing the current custom dark grays (#1a1a22, #2a2a35). NOT matching the existing aesthetic — this is a visual refresh.

**Accent color:** Teal/Cyan for interactive elements (buttons, focus rings, active states, selected items). Chosen for its technical/engineering feel and high contrast on dark backgrounds.

**Migration depth:** Full replacement. Every raw HTML form element gets replaced:
- `<select>` → shadcn/ui `Select`
- `<input type="text">` → shadcn/ui `Input`
- `<input type="range">` → shadcn/ui `Slider`
- `<input type="checkbox">` → shadcn/ui `Checkbox`
- `<input type="color">` → shadcn/ui color picker or Popover with swatches
- `<button>` → shadcn/ui `Button` (all ~60 instances)
- Custom modal (`CustomDeviceModal.tsx`) → shadcn/ui `Dialog`
- Custom toast (`Toast.tsx`) → shadcn/ui `Toast` / `Sonner`

**Existing custom wrappers to replace:** All 10 components in `src/components/ui/`:
- `SelectField.tsx` → shadcn `Select`
- `SliderField.tsx` → shadcn `Slider`
- `Checkbox.tsx` → shadcn `Checkbox`
- `ToggleButton.tsx` → shadcn `Toggle`
- `ExportCard.tsx` → shadcn `Card`
- `SectionLabel.tsx` → keep or simplify (just a styled label)
- `PaletteItem.tsx` → shadcn `Button` variant
- `PropertyRow.tsx` → keep (layout component, not a form element)
- `SpecTable.tsx` → shadcn `Table`

### New UI Patterns

**Tooltips:** Add shadcn/ui `Tooltip` to elements needing hover explanations:
- Settings controls (what "support factor" means, what "K-factor" means)
- Validation warning icons
- Toolbar buttons in 3D preview
- Export format options

**Command palette (Cmd+K):** Full power-user surface using shadcn/ui `Command` (cmdk):
- Navigation: switch to configurator, catalog, wizard, export
- Device search: fuzzy search and add devices/connectors by name
- Export triggers: download JSON, DXF, OpenSCAD, copy to clipboard
- Panel config: change rack standard, U-height
- Undo/redo actions
- Uses the existing Fuse.js search index for device/connector fuzzy matching

### Implementation Notes for Researcher/Planner
- shadcn/ui is NOT currently installed — needs initialization via `npx shadcn@latest init`
- The project uses Tailwind CSS v4 — verify shadcn/ui compatibility with v4
- React 19 is in use — verify shadcn/ui + Radix UI compatibility
- The `src/components/ui/` directory exists with custom components — shadcn/ui also writes to `components/ui/` by default. Plan the migration to avoid conflicts (rename existing dir first, or configure shadcn output path)

---

## Area 2: 3D Cutout Rendering

### Decisions

**Cutout method:** CSG boolean subtraction using `three-bvh-csg` (already installed, v0.0.17). Real see-through holes in the faceplate mesh for both connector cutouts AND device bay openings.

**Batch strategy:** Union all cutout shapes into a single compound shape, then perform ONE subtraction from the faceplate. Avoids N sequential subtractions. Cache the result mesh and only recompute when elements change (add/remove/move).

**Device bay openings:** Also CSG-subtracted from the faceplate. Users see through the opening to the tray geometry behind.

**Connector bodies behind panel:** Render simplified 3D connector housings extending behind the faceplate:
- Neutrik D-type: cylinder barrel, ~30mm depth
- BNC bulkhead: narrow cylinder, ~22mm depth
- Keystone jack: rectangular box, ~28mm depth
- Fiber (LC/SC): rectangular box with mount tabs
- SMA: narrow cylinder, ~15mm depth
- D-Sub: trapezoidal box shape
- USB-A, HDMI: rectangular boxes at appropriate depths

These are LOW-DETAIL simplified shapes (no thread detail, no clip geometry). Purpose is spatial awareness and clearance visualization, not manufacturing accuracy.

### Implementation Notes for Researcher/Planner
- `three-bvh-csg` is installed but NOT imported anywhere currently
- Cutouts are currently rendered as dark overlay geometry (cylinders/boxes placed on the faceplate surface)
- The existing cutout indicator code in Preview3D.tsx needs to be replaced, not extended
- Error boundary already exists expecting CSG errors — good, keep it
- Performance target: CSG computation should complete in <500ms for up to 20 cutouts

---

## Area 3: Material Appearance

### Decisions

**Realism level:** Full PBR with texture maps and HDR environment.
- Normal maps for surface detail (brushed grain on metal, subtle layer lines on plastic)
- Roughness maps for reflectivity variation
- HDR environment map for realistic reflections (upgrade from the current drei "studio" preset)

**Material presets:**

| Fab Method | Material | Appearance |
|------------|----------|------------|
| Sheet metal (sm) | `MeshPhysicalMaterial` | Brushed aluminum — clearcoat, normal map with directional grain, high metalness, low roughness. Reflects environment. |
| 3D print (3dp) - Standard | `MeshPhysicalMaterial` | Matte plastic — low metalness, high roughness, subtle layer-line normal map. Covers PLA, PETG, ABS, ASA. |
| 3D print (3dp) - Carbon fiber | `MeshPhysicalMaterial` | Carbon fiber composite — dark with visible woven fiber texture (normal map), slight sheen. Covers PA-CF, PET-CF. |

**Material switching:** Auto-switch based on selected fab method. When user selects `3dp`, show standard plastic (or carbon if material is PA-CF/PET-CF). When user selects `sm`, show brushed metal.

**Manual override:** A material appearance dropdown in the 3D preview toolbar lets the user override the auto-selection. Options: "Auto (match fab method)", "Brushed Aluminum", "Matte Plastic", "Carbon Fiber". This is for visualization only — doesn't change the actual fab method or export.

**Texture assets needed:**
- Brushed metal normal map (tileable, ~200KB)
- Brushed metal roughness map (tileable, ~100KB)
- Carbon fiber normal map (tileable, ~200KB)
- Plastic layer-line normal map (tileable, ~100KB)
- HDR environment map (1-2MB, or use a higher-quality drei preset like "warehouse" or "city")

### Implementation Notes for Researcher/Planner
- Current materials are all `MeshStandardMaterial` — upgrade to `MeshPhysicalMaterial`
- Current environment is `Environment preset="studio"` from drei — may be sufficient if resolution is adequate, or swap to a custom HDR
- Material presets are defined as constants in Preview3D.tsx (MATERIAL_PANEL, MATERIAL_WALL, etc.) — these need to become dynamic based on fab method
- The material override dropdown goes in the 3D preview toolbar (where the wireframe toggle already lives)

---

## Area 4: Selector Stability (Technical — No User Decisions)

**Scope:** Audit all Zustand selectors returning objects/arrays. Add module-level memoization with documented cache keys. Write stability tests (call twice, assert `===`). This is a carry-forward from the original Phase 5 scope (PLAT-04).

Known problematic selectors from project memory:
- `panelDimensions()` — returns new object each call
- `borePositions()` — returns new array each call
- Fix pattern: module-level cache keyed on input values (already established in `src/store/selectors.ts`)

---

## Deferred Items

| Item | Original Phase | Reason Deferred |
|------|---------------|-----------------|
| Cost estimation (COST-01 to COST-04) | Phase 5 | User chose to prioritize visual polish first |
| Community contribution pipeline (COMM-01, COMM-02) | Phase 6 | Remains in a future phase |

---

*Context gathered: 2026-02-22*
*Decisions made by: User during discuss-phase session*
