# Phase 1: Catalog Schema + Data Infrastructure - Research

**Researched:** 2026-02-21
**Domain:** Zod schema validation, static JSON catalog architecture, Zustand store for runtime data
**Confidence:** HIGH

## Summary

This phase establishes the data foundation: Zod v4 schemas for devices and connectors, static JSON catalog files in `public/catalog/`, a Zustand-based catalog store with fetch-on-load validation, and migration of the existing 5 hardcoded devices + 10 hardcoded connectors to 50+ devices and 30+ connectors with full metadata.

The project already uses Zod v4.3.6, Zustand v5.0.11, React 19, and Vite 6. No new dependencies are needed. The main technical work is: (1) defining Zod schemas that match the user's decided data model (confidence tiers, port layout, cutout+module architecture), (2) authoring large JSON catalogs with manufacturer-verified dimensions, (3) building an async catalog store that validates on load and exposes data through the same `Record<string, DeviceDef>` / `Record<string, ConnectorDef>` interface the existing 17 consumer files expect, and (4) handling the transition so that `DEVICES[key]` and `CONNECTORS[key]` still work everywhere without a massive refactor of all consumers in this phase.

**Primary recommendation:** Define Zod schemas as the single source of truth for TypeScript types (use `z.infer<>` to derive `CatalogDevice` and `CatalogConnector`). Keep the existing `DeviceDef` and `ConnectorDef` interfaces as narrow view types derived from the catalog schemas, so current consumers (selectors, exporters, components) continue working with zero changes. The catalog store loads JSON, validates with Zod, and exposes `Record<string, DeviceDef>`-shaped getters.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Brand strategy:** Ubiquiti primary (UniFi + EdgeMAX lines) + ~5-10 non-Ubiquiti entries to fill category gaps (Raspberry Pi, Intel NUC, Blackmagic MicroConverter, etc.)
- **Categories:** Network + compute + AV -- schema supports all categories, seed data covers networking fully, compute/AV via gap-filling entries
- **Lines:** UniFi and EdgeMAX (legacy). No UISP or airMAX in seed data.
- **Access points:** Include WiFi APs even though typically ceiling-mounted
- **Discontinued devices:** Include popular legacy products (USG-3P, EdgeRouter X, etc.) marked with `discontinued: true`
- **Variant handling:** Family grouping -- each SKU is a standalone entry with full dimensions, but a `family` string field enables UI grouping in Phase 2
- **Port metadata:** Full port layout -- include port positions and pitch for front-face rendering. Schema fields: port count, port types, positions (x offset array), pitch (mm between ports)
- **Data confidence (4-level):** `manufacturer-datasheet`, `user-calipered`, `cross-referenced`, `estimated`
- **Source field:** Optional `source` URL/reference string, encouraged but not schema-required
- **Connector architecture:** Cutout + module split -- `CatalogConnector` defines physical cutout; `compatibleModules` array lists installable modules
- **Keystone jacks:** Same cutout + module pattern as Neutrik D-type
- **Count targets:** 30+ unique cutout types AND module variants; 50+ device entries
- **Cable clearance:** Two fields: `depthBehind` (body only) and `cableClearance` (bend radius, optional)
- **Malformed entries:** Load but flag as `invalid` -- visible to user but excluded from auto-layout and export
- **Valid entries in same file:** Load normally regardless of invalid siblings
- **Console + UI notification:** Both developer console warning and user-facing toast/banner for validation failures

### Claude's Discretion
- Exact Zod schema field naming and nesting
- localStorage cache key strategy and version comparison logic
- JSON file structure (single file vs split by category)
- Catalog store internal architecture (single store vs separate device/connector stores)
- How port layout data is structured (array of objects vs parallel arrays)

### Deferred Ideas (OUT OF SCOPE)
- Catalog browser UI with search/filter -- Phase 2
- "Add to Panel" from catalog -- Phase 2
- Community contribution pipeline for new entries -- Phase 6
- OpenSCAD WASM live preview -- flagged as needing research if it enters scope
- Auto-layout connector-grouping priority order -- Phase 4
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAT-01 | User can browse a catalog of 50+ real network devices with accurate dimensions from manufacturer datasheets | Zod schema with manufacturer dimension fields; JSON catalog populated from techspecs.ui.com; confidence badge field for data quality |
| CAT-02 | User can browse a catalog of 30+ real connectors with precise cutout specs | Cutout+module schema architecture; connector cutout specs from CLAUDE.md reference + manufacturer datasheets |
| CAT-05 | User can see a data confidence badge on each catalog entry | 4-tier `dataSource` enum in schema: `manufacturer-datasheet`, `user-calipered`, `cross-referenced`, `estimated` |
| CAT-06 | Catalog uses a versioned JSON schema validated by Zod on every load, rejecting malformed entries with visible warnings | Zod v4 `safeParse()` per-entry validation; `schemaVersion` field; invalid entries flagged but not blocking |
| COMM-03 | Catalog updates ship independently from app code releases | Static JSON in `public/catalog/` fetched at runtime via `fetch()`; no code rebuild needed to update catalog data |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | 4.3.6 (installed) | Schema definition + runtime validation | Already in project; v4 is 6.5x faster than v3 for object parsing |
| zustand | 5.0.11 (installed) | Catalog store state management | Already in project; separate store pattern appropriate for independent catalog data |
| vite | 6.x (installed) | Static file serving from `public/` | Already in project; `public/` files served as-is without transform |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| immer | 11.1.4 (installed) | Immutable state updates in store | Already used in useConfigStore; use if catalog store needs complex updates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod v4 | io-ts, Valibot, Yup | Zod already installed, v4 is fastest; no reason to switch |
| Static JSON in `public/` | Import JSON at build time | Build-time import bundles data into JS; can't update catalog without rebuild -- violates COMM-03 |
| Separate catalog store | Slice in useConfigStore | Catalog data is independent of panel config; separate store avoids re-renders and keeps concerns separate |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── catalog/
│   ├── schemas.ts           # Zod schemas: CatalogDeviceSchema, CatalogConnectorSchema, CatalogFanSchema
│   ├── types.ts             # z.infer<> derived types + narrow view types for backward compat
│   └── useCatalogStore.ts   # Zustand store: fetch, validate, cache, expose
├── constants/
│   ├── devices.ts           # KEEP: fallback inline data (current 5 devices), re-exported from catalog store
│   ├── connectors.ts        # KEEP: fallback inline data (current 10 connectors), re-exported from catalog store
│   ├── deviceLookup.ts      # MODIFY: check catalog store first, then inline fallback
│   └── ...                  # Other constants unchanged
├── store/
│   ├── useConfigStore.ts    # UNCHANGED in this phase
│   └── selectors.ts         # UNCHANGED in this phase
public/
├── catalog/
│   ├── devices.json         # 50+ devices, validated by CatalogDeviceSchema
│   ├── connectors.json      # 30+ connectors, validated by CatalogConnectorSchema
│   └── fans.json            # Fans catalog (optional, can stay inline for now)
```

### Pattern 1: Zod Schema as Single Source of Truth
**What:** Define Zod schemas first, then derive TypeScript types with `z.infer<>`. The schema IS the type definition.
**When to use:** Always, for all catalog data types.
**Example:**
```typescript
// Source: https://zod.dev/api (Zod v4 docs)
import { z } from 'zod';

const DataSourceSchema = z.enum([
  'manufacturer-datasheet',
  'user-calipered',
  'cross-referenced',
  'estimated',
]);

const PortLayoutSchema = z.object({
  type: z.enum(['rj45', 'sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28', 'usb-a', 'usb-c', 'console']),
  count: z.number().int().min(0),
  pitch: z.number().positive().optional(),       // mm between port centers
  positions: z.array(z.number()).optional(),      // x-offsets from device left edge
});

const CatalogDeviceSchema = z.object({
  // Identity
  slug: z.string(),                              // unique key, e.g. 'usw-lite-16-poe'
  name: z.string(),                              // display name
  brand: z.string(),                             // e.g. 'Ubiquiti'
  family: z.string().optional(),                 // e.g. 'usw-lite' for UI grouping
  category: z.enum(['switch', 'router', 'gateway', 'access-point', 'nas', 'compute', 'converter', 'other']),

  // Dimensions (mm)
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  weight: z.number().positive(),                 // kg

  // Port layout
  ports: z.array(PortLayoutSchema).default([]),

  // Display
  color: z.string().default('#cccccc'),
  portSummary: z.string().optional(),            // e.g. '16xGbE (8 PoE+)'
  poeBudget: z.string().optional(),              // e.g. '45W'

  // Lifecycle
  discontinued: z.boolean().default(false),

  // Data confidence
  dataSource: DataSourceSchema,
  source: z.string().optional(),                 // URL or reference
  notes: z.string().optional(),                  // caveats about dimensions

  // Schema version
  schemaVersion: z.literal(1),
});

type CatalogDevice = z.infer<typeof CatalogDeviceSchema>;
```

### Pattern 2: Backward-Compatible View Types
**What:** Derive narrow "view" types that match existing `DeviceDef` / `ConnectorDef` interfaces, so the 17 consumer files don't need changes.
**When to use:** During the migration period (this phase and potentially next).
**Example:**
```typescript
// Map CatalogDevice -> DeviceDef for backward compat
function toDeviceDef(cd: CatalogDevice): DeviceDef {
  return {
    name: cd.name,
    w: cd.width,
    d: cd.depth,
    h: cd.height,
    wt: cd.weight,
    color: cd.color,
    ports: cd.portSummary ?? '',
    poe: cd.poeBudget ?? '-',
    portLayout: {
      rj45: cd.ports.filter(p => p.type === 'rj45').reduce((s, p) => s + p.count, 0),
      sfp: cd.ports.filter(p => p.type.startsWith('sfp')).reduce((s, p) => s + p.count, 0),
    },
  };
}
```

### Pattern 3: Fetch-on-Load with Per-Entry Validation
**What:** Fetch JSON from `public/catalog/`, validate each entry individually with `safeParse()`, collect valid and invalid entries separately.
**When to use:** On app initialization (store hydration).
**Example:**
```typescript
// Source: Zod v4 docs (safeParse)
async function loadCatalog<T extends z.ZodType>(
  url: string,
  schema: T,
): Promise<{ valid: z.infer<T>[]; invalid: { index: number; entry: unknown; errors: z.ZodError }[] }> {
  const res = await fetch(url);
  const raw: unknown[] = await res.json();

  const valid: z.infer<T>[] = [];
  const invalid: { index: number; entry: unknown; errors: z.ZodError }[] = [];

  for (let i = 0; i < raw.length; i++) {
    const result = schema.safeParse(raw[i]);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({ index: i, entry: raw[i], errors: result.error });
      console.warn(`Catalog entry ${i} invalid:`, result.error.issues);
    }
  }

  return { valid, invalid };
}
```

### Pattern 4: Module-Level Memoized Selectors (MEMORY.md Pattern)
**What:** All Zustand selectors returning objects/arrays must use module-level caching to prevent infinite re-render loops with React 19 + Zustand 5.
**When to use:** Every selector in the catalog store that returns a non-primitive value.
**Example:**
```typescript
// Source: MEMORY.md - React 19 + Zustand 5 selector memoization
let _devKey: string;
let _devVal: Record<string, DeviceDef>;
export const selectDeviceMap = (s: CatalogState): Record<string, DeviceDef> => {
  const key = s.catalogVersion;  // changes only when catalog is reloaded
  if (key === _devKey) return _devVal;
  _devKey = key;
  _devVal = Object.fromEntries(s.devices.map(d => [d.slug, toDeviceDef(d)]));
  return _devVal;
};
```

### Pattern 5: localStorage Version Cache
**What:** Cache the fetched catalog JSON in localStorage with a version key. On subsequent loads, compare `schemaVersion` + ETag/timestamp and skip fetch if unchanged.
**When to use:** On catalog store initialization.
**Example:**
```typescript
const CACHE_KEY = 'rackpro-catalog-devices';
const CACHE_VERSION_KEY = 'rackpro-catalog-devices-version';

async function fetchWithCache(url: string): Promise<unknown[]> {
  const cached = localStorage.getItem(CACHE_KEY);
  const cachedVersion = localStorage.getItem(CACHE_VERSION_KEY);

  try {
    const res = await fetch(url);
    const etag = res.headers.get('etag') ?? res.headers.get('last-modified') ?? '';

    if (cached && cachedVersion === etag) {
      return JSON.parse(cached);
    }

    const data = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_VERSION_KEY, etag);
    return data;
  } catch (err) {
    // Offline fallback: use cached data if available
    if (cached) return JSON.parse(cached);
    throw err;
  }
}
```

### Anti-Patterns to Avoid
- **Importing JSON at build time:** `import devices from './devices.json'` bundles data into JS. Violates COMM-03 (independent catalog updates). Always use `fetch()` at runtime.
- **Single Zod parse on entire array:** `z.array(schema).parse(data)` rejects ALL entries if ANY entry is invalid. Must use per-entry `safeParse()`.
- **Inline Zustand hook calls:** Never call `useCatalogStore(selector)` inline in JSX. Extract to variables at component top level (MEMORY.md).
- **Returning new objects from selectors:** Selectors that compute `Record<>` or `Array` must use module-level memoization. Returning `Object.fromEntries(...)` inline creates new references every call, causing infinite re-renders.
- **Mutating catalog data after load:** The catalog store should be read-only after initial hydration. Devices/connectors are reference data, not user state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom validation functions | Zod v4 schemas with `safeParse()` | Type inference, error messages, composability; Zod already installed |
| Type derivation | Manual TypeScript interfaces duplicating schema | `z.infer<typeof Schema>` | Single source of truth; no drift between schema and types |
| Deep equality for memoization | Custom deep-equal in selectors | Module-level cache keyed on version string | Simple, proven pattern from MEMORY.md; deep-equal is expensive |
| JSON schema for community validation | Custom validation scripts | `z.toJSONSchema()` (Zod v4 feature) | Zod v4 can export JSON Schema for CI validation (Phase 6 COMM-02) |

**Key insight:** Zod v4 is both the runtime validator AND the TypeScript type generator. The schema is the contract between the JSON files and the application code. Any hand-rolled alternative will drift from the schema and create bugs.

## Common Pitfalls

### Pitfall 1: Zod v4 API Differences from v3
**What goes wrong:** Code examples from Stack Overflow or training data use v3 patterns that fail or behave differently in v4.
**Why it happens:** Zod v4 was released recently; most online resources still reference v3.
**How to avoid:**
- `z.record(z.string())` is INVALID in v4; must be `z.record(z.string(), z.string())` (two arguments required)
- `z.nativeEnum()` is deprecated; use `z.enum()` which is overloaded to accept enum-like inputs
- `.default()` now short-circuits parsing (returns value directly, doesn't parse it); use `.prefault()` for old behavior
- `z.object()` strips unknown keys by default; use `z.strictObject()` to reject or `z.looseObject()` to passthrough
- `error.format()` / `error.flatten()` replaced by `z.treeifyError(error)`
- `z.string().email()` still works but standalone `z.email()` is preferred
**Warning signs:** `z.record()` calls with single argument; `.nativeEnum()` usage; relying on `.default()` to parse through validators.

### Pitfall 2: Async Store Hydration Race Condition
**What goes wrong:** Components render before catalog data is loaded, causing empty device/connector lookups.
**Why it happens:** `fetch()` is async; Zustand store initializes synchronously with empty state.
**How to avoid:**
- Keep existing inline `DEVICES` and `CONNECTORS` constants as immediate fallback data
- Catalog store exposes a `loading` / `ready` boolean
- `deviceLookup.ts` checks catalog store first, falls back to inline constants
- Components can render immediately with fallback data; catalog store merges fetched data when ready
**Warning signs:** Flash of missing data on initial load; undefined device lookups; components showing "Custom Device" for known devices.

### Pitfall 3: React 19 Selector Stability with Catalog Data
**What goes wrong:** Infinite re-render loops when catalog store selectors return new object references.
**Why it happens:** React 19's strict `useSyncExternalStore` tear-detection triggers re-renders when selector return values are referentially different.
**How to avoid:** All selectors returning objects or arrays use module-level memoization keyed on `catalogVersion` or similar change-tracking value. This is the established pattern in `src/store/selectors.ts`.
**Warning signs:** "Maximum update depth exceeded" errors; browser tab freezing after catalog load.

### Pitfall 4: Overly Strict Schema Blocking Valid Data
**What goes wrong:** A schema that's too strict rejects entries with minor variations (e.g., trailing whitespace in slug, slightly different field casing).
**Why it happens:** Zod is strict by default; JSON authored by different people has inconsistencies.
**How to avoid:**
- Use `.trim()` on string fields where appropriate
- Use `.default()` for fields that have sensible defaults
- Validate per-entry, not per-file, so one bad entry doesn't poison the whole catalog
- Test the schema against real catalog data during development
**Warning signs:** High invalid-entry count after first catalog load; entries failing for trivial reasons.

### Pitfall 5: Breaking the MCP Server
**What goes wrong:** The MCP server (`src/mcp/state.ts`, `src/mcp/resources/catalogs.ts`) imports `DEVICES` and `CONNECTORS` directly from constants. If those are removed or changed to async, the MCP server breaks.
**Why it happens:** MCP server runs as standalone Node process outside React/browser context; can't use browser `fetch()` or Zustand React hooks.
**How to avoid:**
- Keep `src/constants/devices.ts` and `src/constants/connectors.ts` as synchronous inline data (existing behavior)
- The catalog store in the browser app augments/overrides these with fetched JSON data
- MCP server continues importing from constants directly (it doesn't need the expanded catalog in this phase)
- In a future phase, MCP server can import the JSON files via `fs.readFileSync()` instead of browser `fetch()`
**Warning signs:** MCP server crashes on startup; `npx tsx src/mcp/server.ts` fails with module resolution errors.

### Pitfall 6: Large JSON Files Slowing Initial Load
**What goes wrong:** A 50+ device catalog with full port layout data could be 100KB+, causing noticeable load delay.
**Why it happens:** JSON includes verbose field names, per-port position arrays, and metadata.
**How to avoid:**
- Profile actual file sizes after authoring (likely 50-80KB for devices, 20-30KB for connectors)
- Vite dev server and production builds serve static files with gzip; 80KB JSON compresses to ~15KB
- localStorage cache prevents re-fetching on subsequent loads
- Keep port position arrays optional (only populate for devices where front-face rendering is planned)
**Warning signs:** Lighthouse score regression; visible loading spinner before panel palette populates.

## Code Examples

Verified patterns from official sources:

### Defining the Catalog Device Schema (Zod v4)
```typescript
// Source: https://zod.dev/api
import { z } from 'zod';

export const DataSourceSchema = z.enum([
  'manufacturer-datasheet',
  'user-calipered',
  'cross-referenced',
  'estimated',
]);

export const DeviceCategorySchema = z.enum([
  'switch', 'router', 'gateway', 'access-point',
  'nas', 'compute', 'converter', 'other',
]);

export const PortTypeSchema = z.enum([
  'rj45', 'sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28',
  'usb-a', 'usb-c', 'console', 'poe-in',
]);

export const PortGroupSchema = z.object({
  type: PortTypeSchema,
  count: z.number().int().min(0),
  speed: z.string().optional(),         // e.g. '1G', '2.5G', '10G'
  poe: z.boolean().default(false),
  pitch: z.number().positive().optional(),
  positions: z.array(z.number()).optional(),
});

export const CatalogDeviceSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  brand: z.string().min(1),
  family: z.string().optional(),
  category: DeviceCategorySchema,
  width: z.number().positive(),
  depth: z.number().positive(),
  height: z.number().positive(),
  weight: z.number().positive(),
  ports: z.array(PortGroupSchema).default([]),
  color: z.string().default('#cccccc'),
  portSummary: z.string().optional(),
  poeBudget: z.string().optional(),
  power: z.string().optional(),
  discontinued: z.boolean().default(false),
  dataSource: DataSourceSchema,
  source: z.string().optional(),
  notes: z.string().optional(),
  schemaVersion: z.literal(1),
});

export type CatalogDevice = z.infer<typeof CatalogDeviceSchema>;
```

### Defining the Catalog Connector Schema (Cutout + Module Pattern)
```typescript
export const CutoutTypeSchema = z.enum(['round', 'd-shape', 'rect', 'd-sub']);

export const ConnectorModuleSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  partNumbers: z.array(z.string()).optional(),
});

export const CatalogConnectorSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().optional(),
  cutoutType: CutoutTypeSchema,
  cutoutWidth: z.number().positive(),
  cutoutHeight: z.number().positive(),
  cutoutRadius: z.number().positive().optional(),  // for round/d-shape
  mountHoles: z.number().int().min(0).default(0),
  mountHoleDiameter: z.number().positive().optional(),
  mountHoleSpacing: z.number().positive().optional(),
  depthBehind: z.number().positive(),
  cableClearance: z.number().positive().optional(),
  color: z.string().default('#4a90d9'),
  icon: z.string().default('*'),
  compatibleModules: z.array(ConnectorModuleSchema).default([]),
  panelThicknessMax: z.number().positive().optional(),  // e.g. 2mm for keystone snap-in
  dataSource: DataSourceSchema,
  source: z.string().optional(),
  notes: z.string().optional(),
  schemaVersion: z.literal(1),
});

export type CatalogConnector = z.infer<typeof CatalogConnectorSchema>;
```

### Catalog Store with Fetch-on-Load
```typescript
// Source: Zustand docs + project MEMORY.md patterns
import { create } from 'zustand';

interface CatalogState {
  devices: CatalogDevice[];
  connectors: CatalogConnector[];
  invalidDevices: { index: number; raw: unknown; error: string }[];
  invalidConnectors: { index: number; raw: unknown; error: string }[];
  loading: boolean;
  ready: boolean;
  catalogVersion: string;  // changes on each successful load, for selector memoization
  loadCatalog: () => Promise<void>;
}

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  devices: [],
  connectors: [],
  invalidDevices: [],
  invalidConnectors: [],
  loading: false,
  ready: false,
  catalogVersion: '',

  loadCatalog: async () => {
    set({ loading: true });
    try {
      const [devRes, conRes] = await Promise.all([
        fetch('/catalog/devices.json'),
        fetch('/catalog/connectors.json'),
      ]);
      const devRaw: unknown[] = await devRes.json();
      const conRaw: unknown[] = await conRes.json();

      const devices: CatalogDevice[] = [];
      const invalidDevices: { index: number; raw: unknown; error: string }[] = [];
      for (let i = 0; i < devRaw.length; i++) {
        const result = CatalogDeviceSchema.safeParse(devRaw[i]);
        if (result.success) devices.push(result.data);
        else invalidDevices.push({ index: i, raw: devRaw[i], error: result.error.message });
      }

      const connectors: CatalogConnector[] = [];
      const invalidConnectors: { index: number; raw: unknown; error: string }[] = [];
      for (let i = 0; i < conRaw.length; i++) {
        const result = CatalogConnectorSchema.safeParse(conRaw[i]);
        if (result.success) connectors.push(result.data);
        else invalidConnectors.push({ index: i, raw: conRaw[i], error: result.error.message });
      }

      set({
        devices,
        connectors,
        invalidDevices,
        invalidConnectors,
        loading: false,
        ready: true,
        catalogVersion: `${devices.length}-${connectors.length}-${Date.now()}`,
      });
    } catch (err) {
      console.error('Failed to load catalog:', err);
      set({ loading: false });
      // Fallback: app still works with inline constants
    }
  },
}));
```

### Backward-Compatible Device Lookup
```typescript
// Modified src/constants/deviceLookup.ts
import type { DeviceDef } from '../types';
import { DEVICES } from './devices';
import { useCustomDevices } from '../store/useCustomDevices';
import { useCatalogStore } from '../catalog/useCatalogStore';

// Module-level cache for catalog device map
let _catVer = '';
let _catDevMap: Record<string, DeviceDef> = {};

function getCatalogDeviceMap(): Record<string, DeviceDef> {
  const store = useCatalogStore.getState();
  if (store.catalogVersion === _catVer) return _catDevMap;
  _catVer = store.catalogVersion;
  _catDevMap = {};
  for (const d of store.devices) {
    _catDevMap[d.slug] = {
      name: d.name,
      w: d.width,
      d: d.depth,
      h: d.height,
      wt: d.weight,
      color: d.color,
      ports: d.portSummary ?? '',
      poe: d.poeBudget ?? '-',
      portLayout: {
        rj45: d.ports.filter(p => p.type === 'rj45').reduce((s, p) => s + p.count, 0),
        sfp: d.ports.filter(p => p.type.startsWith('sfp')).reduce((s, p) => s + p.count, 0),
      },
    };
  }
  return _catDevMap;
}

export function lookupDevice(key: string): DeviceDef | undefined {
  // 1. Check catalog store (fetched JSON)
  const catMap = getCatalogDeviceMap();
  if (catMap[key]) return catMap[key];
  // 2. Check inline constants (fallback)
  if (DEVICES[key]) return DEVICES[key];
  // 3. Check custom devices
  const customs = useCustomDevices.getState().customDevices;
  return customs[key];
}
```

### JSON Catalog File Structure (devices.json excerpt)
```json
[
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
    "discontinued": false,
    "dataSource": "manufacturer-datasheet",
    "source": "https://techspecs.ui.com/unifi/switching/usw-lite-16-poe",
    "schemaVersion": 1
  }
]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `z.record(val)` | Zod v4 `z.record(key, val)` (two args required) | Zod 4.0 (2025) | All record schemas must be updated |
| Zod v3 `.nativeEnum()` | Zod v4 `z.enum()` (overloaded) | Zod 4.0 | `z.enum()` now accepts TS enums directly |
| Zod v3 `.default()` parses value | Zod v4 `.default()` short-circuits | Zod 4.0 | Defaults skip validation; use `.prefault()` for old behavior |
| Zod v3 `error.format()` | Zod v4 `z.treeifyError(error)` | Zod 4.0 | Error formatting API changed |
| Zod v3 `ZodType<O, D, I>` | Zod v4 `ZodType<O, I>` | Zod 4.0 | Generic structure simplified; `z.ZodTypeAny` eliminated |

**Deprecated/outdated:**
- `z.nativeEnum()`: Still works in v4 but deprecated; use `z.enum()` instead
- `z.string().email()`: Still works but `z.email()` preferred
- `error.format()` / `error.flatten()`: Replaced by `z.treeifyError()`

## Data Sourcing Strategy

### Ubiquiti Device Dimensions (Verified from Search Results)

The following dimensions have been verified through web searches of datasheets and product pages. All dimensions are in mm (Width x Depth x Height):

| Device | Dimensions (WxDxH mm) | Weight | Confidence |
|--------|----------------------|--------|------------|
| USW-Lite-16-PoE | 191.7 x 185 x 43.7 | 1.2 kg | HIGH (datasheet) |
| USW-Lite-8-PoE | 99.6 x 163.7 x 31.7 | 0.295 kg | HIGH (datasheet) |
| USW-Pro-8-PoE | 200 x 248 x 44 | 2.1 kg | HIGH (datasheet) |
| USW-Pro-48-PoE | 442.4 x 399.6 x 43.7 | 6.2 kg | HIGH (datasheet) |
| USW-Flex | 122.5 x 107.1 x 28 | 0.23 kg | HIGH (datasheet) |
| USW-Enterprise-8-PoE | 200 x 248 x 44 | 2.4 kg | HIGH (datasheet) |
| UniFi Express 7 (UX7) | 117 x 117 x 42.5 | 0.422 kg | HIGH (CLAUDE.md) |
| EdgeRouter X (ER-X) | 110 x 75 x 22 | 0.175 kg | HIGH (datasheet) |
| UDM-SE | 442.4 x 285.6 x 43.7 | ~5 kg | MEDIUM (search result) |
| Raspberry Pi 5 | 86 x 56 x 16 | 0.046 kg | HIGH (official brief) |

**NOTE (Lite-8 dimensions):** The existing code has USW-Lite-8-PoE at 200 x 119 x 30.3 mm (from CLAUDE.md), but manufacturer datasheets indicate 99.6 x 163.7 x 31.7 mm. The datasheet dimensions should be used and the existing data corrected. This highlights why the `dataSource` confidence field is important.

### Device Count Strategy for 50+ Entries

| Category | Target Count | Sources |
|----------|-------------|---------|
| UniFi Switches (current gen) | 15-20 | techspecs.ui.com/unifi/switching |
| UniFi Gateways/Routers | 8-10 | techspecs.ui.com/unifi/cloud-gateways |
| UniFi Access Points | 8-10 | techspecs.ui.com/unifi/wifi |
| UniFi Other (NAS, Protect) | 3-5 | techspecs.ui.com |
| EdgeMAX Legacy | 3-5 | dl.ubnt.com datasheets |
| Compute (Pi, NUC) | 3-4 | Manufacturer datasheets |
| AV (Blackmagic, etc.) | 2-3 | blackmagicdesign.com/techspecs |
| **Total** | **42-57** | |

### Connector Count Strategy for 30+ Cutout Types

| Category | Count | Types |
|----------|-------|-------|
| Neutrik D-type cutout | 1 cutout, 10+ modules | XLR-M, XLR-F, EtherCon, opticalCON, BNC, HDMI, USB-A, USB-B, USB-C, SpeakON, PowerCON |
| Keystone | 1 cutout, 8+ modules | Cat5e, Cat6, Cat6a, HDMI, USB-A, USB-C, fiber LC, coax F |
| BNC bulkhead | 2 (jam-nut, flange) | 75-ohm SDI, 50-ohm RF |
| SMA bulkhead | 1 | RF to 18 GHz |
| N-type bulkhead | 1 | RF to 11 GHz |
| TNC bulkhead | 1 | RF |
| Fiber (non-Neutrik) | 3 | LC duplex, SC simplex, LGX panel |
| D-Sub | 3 | DE-9, DA-15, DB-25 |
| USB panel mount | 3 | USB-A, USB-B, USB-C |
| HDMI panel mount | 1 | Standard HDMI |
| DisplayPort | 1 | DP panel mount |
| IEC power | 2 | C14 inlet, C13 outlet |
| PowerCON | 2 | PowerCON 20A, PowerCON TRUE1 |
| XLR (non-Neutrik D) | 2 | Chassis mount XLR3, XLR5 |
| Speakon (non-Neutrik D) | 1 | Chassis mount |
| Banana binding post | 1 | Speaker/test |
| **Total cutout types** | **~26** | |
| **Total with modules** | **50+** | |

To reach 30+ unique cutout types, add:
- RCA bulkhead (2: single, dual)
- 3.5mm TRS panel jack
- 6.35mm TRS panel jack
- DIN connector (5-pin MIDI)
- Toslink optical panel mount

## Open Questions

1. **USW-Lite-8-PoE dimensions discrepancy**
   - What we know: CLAUDE.md says 200 x 119 x 30.3mm; manufacturer datasheet says 99.6 x 163.7 x 31.7mm
   - What's unclear: Which is correct (likely the datasheet is correct and CLAUDE.md has an error)
   - Recommendation: Use datasheet dimensions in catalog, add `notes` field explaining the correction, mark as `manufacturer-datasheet` confidence

2. **Port position data depth**
   - What we know: User wants port positions and pitch for front-face rendering
   - What's unclear: For 50+ devices, authoring precise per-port X-offset arrays is labor-intensive and error-prone
   - Recommendation: Populate `pitch` (mm between port centers) for all entries. Populate `positions` array only for devices where front-face rendering is actively planned (the 5-10 most popular devices). Leave positions optional in schema.

3. **Fans catalog: migrate or leave inline?**
   - What we know: `src/constants/fans.ts` has 5 fan entries with precise mechanical specs
   - What's unclear: Whether fans should also move to `public/catalog/fans.json`
   - Recommendation: Leave fans inline for this phase. Fan specs are mechanical standards (40mm, 60mm, 80mm, 92mm, 120mm) that don't change. Moving them provides no user value and adds complexity. Can move later if catalog grows.

4. **MCP server catalog access**
   - What we know: MCP server runs standalone (Node, no browser), imports from `src/constants/`
   - What's unclear: Whether MCP server should read the JSON catalog files too
   - Recommendation: Defer. MCP server continues using inline constants in this phase. Phase 2 or later can add `fs.readFileSync()` catalog loading for MCP. The MCP resource endpoints (`rackpro://devices`, etc.) already return the inline data.

5. **Vite `public/` directory creation**
   - What we know: The project currently has no `public/` directory
   - What's unclear: Nothing -- Vite creates it automatically or we create it manually
   - Recommendation: Create `public/catalog/` directory manually. Vite automatically serves everything in `public/` at the root path. No config change needed.

## Sources

### Primary (HIGH confidence)
- Zod v4 API docs: https://zod.dev/api -- schema definition patterns, safeParse, z.infer, z.enum, z.object
- Zod v4 release notes: https://zod.dev/v4 -- performance improvements, new features, breaking changes
- Zod v4 migration guide: https://zod.dev/v4/changelog -- v3-to-v4 API differences, z.record changes, .default() behavior
- Project codebase: `src/types.ts`, `src/constants/devices.ts`, `src/constants/connectors.ts`, `src/store/selectors.ts` -- existing data model and memoization patterns
- Project MEMORY.md -- React 19 + Zustand 5 selector memoization requirement

### Secondary (MEDIUM confidence)
- Ubiquiti USW-Lite-16-PoE datasheet: https://dl.ubnt.com/ds/usw-lite-16-poe.pdf -- verified dimensions 191.7 x 185 x 43.7mm
- Ubiquiti EdgeRouter X datasheet: https://dl.ubnt.com/datasheets/edgemax/EdgeRouter_X_DS.pdf -- verified dimensions 110 x 75 x 22mm
- Raspberry Pi 5 product brief: https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-product-brief.pdf -- verified 86 x 56 x 16mm
- Vite static asset docs: https://vite.dev/guide/assets -- public directory behavior
- Zustand discussions on multiple stores: https://github.com/pmndrs/zustand/discussions/2486

### Tertiary (LOW confidence)
- USW-Lite-8-PoE dimensions (99.6 x 163.7 x 31.7mm) -- from broadbandbuyer.com listing, needs verification against official datasheet
- UDM-SE dimensions (442.4 x 285.6 x 43.7mm) -- from search results, needs verification
- Blackmagic MicroConverter dimensions -- not found in search results; needs manual lookup from blackmagicdesign.com/techspecs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already installed and used in project; no new dependencies
- Architecture: HIGH - Patterns proven in existing codebase (selector memoization, Zustand stores, Zod schemas for MCP tools)
- Pitfalls: HIGH - Directly from project MEMORY.md (React 19 + Zustand 5 issues) and verified Zod v4 migration docs
- Data sourcing: MEDIUM - Device dimensions partially verified; full catalog requires manual data entry from manufacturer sources

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable domain; Zod v4 API unlikely to change)
