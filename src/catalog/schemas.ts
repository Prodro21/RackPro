/**
 * Catalog Zod v4 schemas — single source of truth for equipment catalog data.
 *
 * All TypeScript types are derived from these schemas via z.infer<>.
 * JSON catalog files in public/catalog/ are validated against these schemas at runtime.
 *
 * Zod v4 notes:
 * - z.record() requires TWO arguments: z.record(keySchema, valueSchema)
 * - z.enum() is used (not z.nativeEnum())
 * - .default() short-circuits parsing (returns value without validating)
 * - z.object() strips unknown keys by default (fine for catalog parsing)
 */

import { z } from 'zod';

// ─── Data Confidence ────────────────────────────────────────────

/**
 * 4-tier data confidence model.
 * Ordered by reliability: manufacturer-datasheet > user-calipered > cross-referenced > estimated
 */
export const DataSourceSchema = z.enum([
  'manufacturer-datasheet',
  'user-calipered',
  'cross-referenced',
  'estimated',
]);

// ─── Device Enums ───────────────────────────────────────────────

/** Device category for filtering and UI grouping. */
export const DeviceCategorySchema = z.enum([
  'switch',
  'router',
  'gateway',
  'access-point',
  'nas',
  'compute',
  'converter',
  'patch-panel',
  'ups',
  'pdu',
  'other',
]);

/** Physical port type identifier. */
export const PortTypeSchema = z.enum([
  'rj45',
  'sfp',
  'sfp+',
  'sfp28',
  'qsfp+',
  'qsfp28',
  'usb-a',
  'usb-c',
  'console',
  'poe-in',
]);

// ─── Device Sub-schemas ─────────────────────────────────────────

/**
 * A group of identical ports on a device.
 * Port groups define count, speed, PoE capability, and optional physical layout
 * (pitch between ports, x-offset positions from device left edge).
 */
export const PortGroupSchema = z.object({
  /** Port type identifier. */
  type: PortTypeSchema,
  /** Number of ports in this group. */
  count: z.number().int().min(0),
  /** Speed designation, e.g. '1G', '2.5G', '10G'. */
  speed: z.string().optional(),
  /** Whether these ports provide PoE output. */
  poe: z.boolean().default(false),
  /** Distance between port centers (mm). For front-face rendering. */
  pitch: z.number().positive().optional(),
  /** X-offsets from device left edge (mm) for each port. For precise front-face rendering. */
  positions: z.array(z.number()).optional(),
});

// ─── CatalogDevice Schema ───────────────────────────────────────

/**
 * Full catalog entry for a physical device.
 *
 * Contains identity, physical dimensions, port layout, display metadata,
 * lifecycle status, data confidence, and schema version.
 *
 * Fields with .default() are optional in JSON input but always present after parsing.
 */
export const CatalogDeviceSchema = z.object({
  /** Unique identifier slug, e.g. 'usw-lite-16-poe'. Lowercase alphanumeric + hyphens only. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  /** Human-readable display name, e.g. 'USW-Lite-16-PoE'. */
  name: z.string().min(1),
  /** Manufacturer/brand name, e.g. 'Ubiquiti'. */
  brand: z.string().min(1),
  /** Family grouping slug for Phase 2 UI grouping, e.g. 'usw-lite'. */
  family: z.string().optional(),
  /** Device category for filtering. */
  category: DeviceCategorySchema,

  /** Device width in mm. */
  width: z.number().positive(),
  /** Device depth in mm. */
  depth: z.number().positive(),
  /** Device height in mm. */
  height: z.number().positive(),
  /** Device weight in kg. */
  weight: z.number().positive(),

  /** Port groups defining all device ports. Defaults to empty array. */
  ports: z.array(PortGroupSchema).default([]),

  /** Display color hex code. Defaults to '#cccccc'. */
  color: z.string().default('#cccccc'),
  /** Human-readable port summary, e.g. '16xGbE (8 PoE+)'. */
  portSummary: z.string().optional(),
  /** PoE budget string, e.g. '45W'. */
  poeBudget: z.string().optional(),
  /** Power consumption description, e.g. 'USB-C 5V/5A (22W max)'. */
  power: z.string().optional(),

  /** Whether this device is discontinued / end-of-life. */
  discontinued: z.boolean().default(false),

  /** Data confidence tier. */
  dataSource: DataSourceSchema,
  /** Source URL or reference string for dimension data. */
  source: z.string().optional(),
  /** Dimension caveats, e.g. 'depth includes rubber feet'. */
  notes: z.string().optional(),

  /** Corner radius in mm for devices with rounded body corners. */
  cornerRadius: z.number().positive().optional(),

  /** Schema version for forward compatibility. Must be 1 for current schema. */
  schemaVersion: z.literal(1),
});

// ─── Connector Enums ────────────────────────────────────────────

/** Physical cutout shape type for panel fabrication. */
export const CutoutTypeSchema = z.enum(['round', 'd-shape', 'rect', 'd-sub']);

// ─── Connector Sub-schemas ──────────────────────────────────────

/**
 * A module that can be installed into a connector cutout.
 * The cutout defines the hole geometry; modules define what fills it.
 * E.g. a Neutrik D-type cutout accepts XLR, EtherCon, HDMI, BNC modules.
 */
export const ConnectorModuleSchema = z.object({
  /** Module name, e.g. 'EtherCon RJ45'. */
  name: z.string(),
  /** Module description. */
  description: z.string().optional(),
  /** Manufacturer part numbers for sourcing. */
  partNumbers: z.array(z.string()).optional(),
});

// ─── CatalogConnector Schema ────────────────────────────────────

/**
 * Full catalog entry for a connector cutout.
 *
 * Uses the cutout + module architecture: the connector defines the physical
 * hole geometry for fabrication, while compatibleModules lists what can be
 * installed in that cutout. Fabrication only cares about the hole.
 *
 * Fields with .default() are optional in JSON input but always present after parsing.
 */
export const CatalogConnectorSchema = z.object({
  /** Unique identifier slug, e.g. 'neutrik-d'. Lowercase alphanumeric + hyphens only. */
  slug: z.string().regex(/^[a-z0-9-]+$/),
  /** Human-readable display name, e.g. 'Neutrik D-Type'. */
  name: z.string().min(1),
  /** Connector description. */
  description: z.string().optional(),

  /** Cutout shape type for panel fabrication. */
  cutoutType: CutoutTypeSchema,
  /** Cutout width in mm. */
  cutoutWidth: z.number().positive(),
  /** Cutout height in mm. */
  cutoutHeight: z.number().positive(),
  /** Cutout radius in mm. For round and d-shape cutouts. */
  cutoutRadius: z.number().positive().optional(),

  /** Number of mounting screw holes. Defaults to 0 (jam-nut mount). */
  mountHoles: z.number().int().min(0).default(0),
  /** Mounting hole diameter in mm. */
  mountHoleDiameter: z.number().positive().optional(),
  /** Mounting hole center-to-center spacing in mm. */
  mountHoleSpacing: z.number().positive().optional(),

  /** Connector body depth behind panel face in mm. Drives enclosure auto-depth. */
  depthBehind: z.number().positive(),
  /** Minimum cable bend radius clearance in mm. Optional; for recommended depth calculation. */
  cableClearance: z.number().positive().optional(),

  /** Display color hex code. Defaults to '#4a90d9'. */
  color: z.string().default('#4a90d9'),
  /** Display icon character. Defaults to '*'. */
  icon: z.string().default('*'),

  /** Modules that can be installed in this cutout. Defaults to empty array. */
  compatibleModules: z.array(ConnectorModuleSchema).default([]),
  /** Maximum panel thickness for snap-in retention, e.g. 2mm for keystone jacks. */
  panelThicknessMax: z.number().positive().optional(),

  /** Data confidence tier. */
  dataSource: DataSourceSchema,
  /** Source URL or reference string for cutout specs. */
  source: z.string().optional(),
  /** Notes about cutout or mounting requirements. */
  notes: z.string().optional(),

  /** Schema version for forward compatibility. Must be 1 for current schema. */
  schemaVersion: z.literal(1),
});
