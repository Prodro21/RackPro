# Contributing to RackPro

Welcome! RackPro's equipment catalog is community-driven. By adding new devices and connectors, you help everyone design better custom rack mount panels.

The catalog lives in `public/catalog/` as JSON files validated by Zod schemas. Every entry you contribute becomes instantly available in the configurator's device browser, wizard, and export pipelines.

---

## Choose Your Path

### Path A: Submit via Issue Form (Recommended)

Best for most contributors. No coding required.

1. Go to **Issues** > **New Issue**
2. Select **"New Device Submission"** or **"New Connector Submission"**
3. Fill in the structured form fields (dimensions, ports, category, etc.)
4. Submit the issue
5. A GitHub Action automatically validates your data, generates the catalog JSON, and opens a draft PR
6. A maintainer reviews and merges

### Path B: Direct PR (Technical Contributors)

Best if you are comfortable editing JSON and using Git.

1. **Fork** this repository
2. Edit `public/catalog/devices.json` or `public/catalog/connectors.json`
3. Add a new entry following the schema (see examples below)
4. Ensure the `slug` is unique, lowercase, hyphens only (regex: `^[a-z0-9-]+$`)
5. Submit a Pull Request
6. CI automatically validates your entry against the Zod schema, checks for slug collisions, and flags implausible dimensions
7. A maintainer reviews and merges

---

## Required Fields: Devices

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `slug` | string | Unique ID. Lowercase alphanumeric + hyphens. | `usw-lite-16-poe` |
| `name` | string | Human-readable display name. | `USW-Lite-16-PoE` |
| `brand` | string | Manufacturer name. | `Ubiquiti` |
| `category` | enum | One of: `switch`, `router`, `gateway`, `access-point`, `nas`, `compute`, `converter`, `patch-panel`, `ups`, `pdu`, `other` | `switch` |
| `width` | number | Width in mm. | `191.7` |
| `depth` | number | Depth in mm. | `185` |
| `height` | number | Height in mm. | `43.7` |
| `weight` | number | Weight in kg. | `1.2` |
| `dataSource` | enum | One of: `manufacturer-datasheet`, `user-calipered`, `cross-referenced`, `estimated` | `manufacturer-datasheet` |
| `schemaVersion` | literal | Must be `1`. | `1` |

## Optional Fields: Devices

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `family` | string | Family grouping slug for UI filtering. | `usw-lite` |
| `ports` | array | Port groups (see schema). | `[{"type":"rj45","count":16,"speed":"1G","poe":true}]` |
| `color` | string | Hex color for display. Default: `#cccccc`. | `#d0d0d0` |
| `portSummary` | string | Human-readable port description. | `16xGbE (8 PoE+)` |
| `poeBudget` | string | PoE power budget. | `45W` |
| `power` | string | Power consumption description. | `Internal 60W AC/DC PSU` |
| `discontinued` | boolean | Whether the device is end-of-life. Default: `false`. | `true` |
| `source` | string | URL or reference for dimension data. | `https://techspecs.ui.com/...` |
| `notes` | string | Additional notes or caveats. | `Depth includes rubber feet` |
| `productUrl` | string | Manufacturer product page URL. | `https://...` |

## Required Fields: Connectors

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `slug` | string | Unique ID. Lowercase alphanumeric + hyphens. | `bnc` |
| `name` | string | Human-readable display name. | `BNC Bulkhead (Jam-Nut)` |
| `cutoutType` | enum | One of: `round`, `d-shape`, `rect`, `d-sub` | `round` |
| `cutoutWidth` | number | Cutout width in mm. | `14` |
| `cutoutHeight` | number | Cutout height in mm. | `14` |
| `depthBehind` | number | Depth behind panel face in mm. | `22` |
| `dataSource` | enum | Same as devices. | `manufacturer-datasheet` |
| `schemaVersion` | literal | Must be `1`. | `1` |

## Optional Fields: Connectors

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `description` | string | Connector description. | `Standard BNC bulkhead feedthrough` |
| `cutoutRadius` | number | Radius in mm (for round/d-shape). | `4.75` |
| `mountHoles` | number | Number of mounting holes. Default: `0`. | `2` |
| `mountHoleDiameter` | number | Mounting hole diameter in mm. | `3.0` |
| `mountHoleSpacing` | number | Mounting hole center-to-center spacing in mm. | `19.0` |
| `cableClearance` | number | Minimum cable bend radius clearance in mm. | `30` |
| `color` | string | Hex color for display. Default: `#4a90d9`. | `#d4a017` |
| `icon` | string | Display icon character. Default: `*`. | `B` |
| `compatibleModules` | array | Modules installable in this cutout. | See example below |
| `panelThicknessMax` | number | Max panel thickness for snap-in (mm). | `2` |
| `source` | string | URL or reference for cutout specs. | `https://...` |
| `notes` | string | Notes about cutout or mounting. | `9.5mm hole diameter` |

---

## Dimension Guidelines

These plausibility ranges are used by CI validation. Values outside these ranges are **flagged for maintainer review** but not auto-rejected.

| Dimension | Min | Max | Unit |
|-----------|-----|-----|------|
| Width | 10 | 800 | mm |
| Depth | 10 | 800 | mm |
| Height | 10 | 200 | mm |
| Weight | 0.01 | 50 | kg |

If your device genuinely falls outside these ranges (e.g., a very lightweight PCB or a deep rack server), add a note in the `notes` field explaining why.

---

## Data Source / Confidence

Every entry must declare where its dimension data comes from:

| Tier | Meaning | When to use |
|------|---------|-------------|
| `manufacturer-datasheet` | Dimensions from official spec sheet or tech specs page | You found exact dimensions on the manufacturer's website |
| `user-calipered` | Measured with calipers by a contributor | You physically measured the device |
| `cross-referenced` | Multiple unofficial sources agree | You checked 2+ reviews/listings that agree on dimensions |
| `estimated` | Rough estimate from photos or similar products | No reliable source; approximate from product images |

---

## What CI Checks

When you submit a PR touching `public/catalog/`, CI automatically runs validation:

1. **Zod schema validation** -- Every entry is parsed against the TypeScript Zod schema. Missing required fields, wrong types, or invalid enum values cause a **hard failure** (CI exits 1).
2. **Slug collision detection** -- Duplicate slugs within or across `devices.json` and `connectors.json` cause a **hard failure**.
3. **Dimension plausibility** -- Dimensions outside the plausibility ranges trigger **warnings** (CI exits 0). A maintainer will review flagged values.

CI posts a formatted comment on your PR with detailed results.

---

## Example Device Entry

```json
{
  "slug": "usw-lite-16-poe",
  "name": "USW-Lite-16-PoE",
  "brand": "Ubiquiti",
  "family": "usw-lite",
  "category": "switch",
  "width": 191.7,
  "depth": 185,
  "height": 43.7,
  "weight": 1.2,
  "ports": [
    { "type": "rj45", "count": 16, "speed": "1G", "poe": true, "pitch": 10.4 }
  ],
  "color": "#d0d0d0",
  "portSummary": "16xGbE (8 PoE+)",
  "poeBudget": "45W",
  "power": "Internal 60W AC/DC PSU, 100-240VAC",
  "dataSource": "manufacturer-datasheet",
  "source": "https://techspecs.ui.com/unifi/switching/usw-lite-16-poe",
  "schemaVersion": 1
}
```

---

## Example Connector Entry

```json
{
  "slug": "bnc",
  "name": "BNC Bulkhead (Jam-Nut)",
  "description": "Standard BNC bulkhead feedthrough with jam-nut mounting. 75-ohm for SDI video, 50-ohm for RF.",
  "cutoutType": "round",
  "cutoutWidth": 14,
  "cutoutHeight": 14,
  "cutoutRadius": 4.75,
  "mountHoles": 0,
  "depthBehind": 22,
  "cableClearance": 30,
  "color": "#d4a017",
  "icon": "B",
  "compatibleModules": [
    { "name": "75-Ohm SDI", "description": "75-ohm BNC for SDI video (3G/6G/12G)" },
    { "name": "50-Ohm RF", "description": "50-ohm BNC for RF test and measurement" }
  ],
  "dataSource": "manufacturer-datasheet",
  "notes": "9.5mm hole diameter. Jam-nut retention, no screw holes needed.",
  "schemaVersion": 1
}
```

---

## Questions?

Open a blank issue or start a discussion. We are happy to help with dimension sourcing, category selection, or any other questions about contributing to the catalog.
