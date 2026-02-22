# Phase 1: Catalog Schema + Data Infrastructure - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

A stable, versioned equipment catalog with 50+ verified devices and connectors exists as the data foundation that every UI feature can build against. Zod-validated JSON files in `public/catalog/` load at runtime with schema validation, confidence badges, and graceful error handling. No catalog browser UI in this phase — just the data layer and store.

</domain>

<decisions>
## Implementation Decisions

### Device Selection Scope
- **Brand strategy:** Ubiquiti primary (UniFi + EdgeMAX lines) + ~5-10 non-Ubiquiti entries to fill category gaps (Raspberry Pi, Intel NUC, Blackmagic MicroConverter, etc.)
- **Categories:** Network + compute + AV — schema supports all categories, seed data covers networking fully, compute/AV via gap-filling entries
- **Lines:** UniFi and EdgeMAX (legacy). No UISP or airMAX in seed data.
- **Access points:** Include WiFi APs even though typically ceiling-mounted — homelab users do rack-mount them during setup or in network closets
- **Discontinued devices:** Include popular legacy products (USG-3P, EdgeRouter X, etc.) marked with a `discontinued: true` field
- **Variant handling:** Family grouping — each SKU is a standalone entry with full dimensions, but a `family` string field (e.g., `"usw-lite"`) enables UI grouping in Phase 2
- **Port metadata:** Full port layout — include port positions and pitch for front-face rendering in later phases. Schema fields: port count, port types, positions (x offset array), pitch (mm between ports)

### Data Confidence Model
- **Granularity:** Per-entry confidence level + free-text `notes` field for caveats (e.g., "depth includes rubber feet", "measured without antennas")
- **Tiers (4-level):**
  1. `manufacturer-datasheet` — dimensions from official manufacturer spec sheet or techspecs page
  2. `user-calipered` — measured with calipers by a specific person, with measurement date
  3. `cross-referenced` — multiple community sources agree on dimensions
  4. `estimated` — rough dimensions from photos, product images, or similar models
- **Source field:** Optional `source` URL or reference string. Encouraged for all entries, but not schema-required (estimated entries may lack a source)

### Connector Organization
- **Architecture:** Cutout + module split — `CatalogConnector` entries define unique physical cutout shapes; `compatibleModules` array lists what can be installed
- **Rationale:** Fabrication only cares about the hole in the panel. A Neutrik D-type cutout is always 24mm D-shape whether filled with XLR, EtherCon, or fiber. Module selection is metadata for labels/BOM, not geometry.
- **Keystone jacks:** Same cutout + module pattern. One `keystone` cutout entry (14.9x19.2mm), with compatible modules (Cat5e, Cat6, Cat6a, HDMI, USB, fiber LC, coax F-type)
- **Count target:** 30+ unique cutout types AND module variants populated for each. Both breadth (distinct cutout geometries) and depth (module options per cutout)
- **Cable clearance:** Two separate fields — `depthBehind` (connector body only, mm) and `cableClearance` (minimum cable bend radius, mm, optional). Enclosure auto-depth uses `depthBehind`, but can show "recommended depth" including cable clearance.

### Validation & Error Handling
- **Malformed entries:** Load but flag as `invalid` in the UI — visible to user but excluded from auto-layout and export. User can see what's wrong.
- **Valid entries in same file:** Load normally regardless of invalid siblings
- **Console + UI notification:** Both a console warning (for developers) and a UI toast/banner (for users) when entries fail validation

### Device Outline Schema Support
- **Optional `outlines` field** on CatalogDevice schema — array of available face names (e.g., `["top", "front", "side"]`) or empty/absent for rectangle-only entries
- **Outline data lives in separate SVG files** at `public/catalog/outlines/{slug}-{face}.svg` — keeps `devices.json` clean
- **No outline data authored in Phase 1** — schema field only. Actual SVG creation is Phase 1.1.
- **Rectangle fallback** is the default for all rendering and export when outlines are absent

### Claude's Discretion
- Exact Zod schema field naming and nesting
- localStorage cache key strategy and version comparison logic
- JSON file structure (single file vs split by category)
- Catalog store internal architecture (single store vs separate device/connector stores)
- How port layout data is structured (array of objects vs parallel arrays)

</decisions>

<specifics>
## Specific Ideas

- Port layout metadata should be rich enough to render accurate front-face device overlays in later phases — not just port count, but positions and pitch
- The `family` field should be a simple string slug, not a nested hierarchy — UI grouping is a Phase 2 concern
- Neutrik D-type and keystone jacks use the same cutout + module architectural pattern for consistency
- Confidence tiers are ordered by reliability: `manufacturer-datasheet` > `user-calipered` > `cross-referenced` > `estimated`
- Existing `src/constants/devices.ts` and `src/constants/connectors.ts` contain the current inline data — migrate these to the new catalog format

</specifics>

<deferred>
## Deferred Ideas

- Catalog browser UI with search/filter — Phase 2
- "Add to Panel" from catalog — Phase 2
- Community contribution pipeline for new entries — Phase 6
- OpenSCAD WASM live preview — flagged as needing research if it enters scope
- Auto-layout connector-grouping priority order — Phase 4
- Full in-app outline editor with AI-assisted cleanup — post-launch milestone
- Automated outline generation pipeline for all 50+ devices — post-launch milestone

</deferred>

---

*Phase: 01-catalog-schema*
*Context gathered: 2026-02-21*
