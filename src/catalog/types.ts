/**
 * Catalog types derived from Zod schemas via z.infer<>.
 *
 * These are the canonical TypeScript types for catalog data. They are NOT
 * manually defined -- they are inferred from the schemas in ./schemas.ts,
 * ensuring the Zod schema is the single source of truth.
 *
 * Also provides backward-compatible converter functions (toDeviceDef, toConnectorDef)
 * so the 17 existing consumer files that depend on DeviceDef/ConnectorDef interfaces
 * continue working with zero changes.
 */

import { z } from 'zod';
import type { DeviceDef, ConnectorDef } from '../types';
import {
  DataSourceSchema,
  DeviceCategorySchema,
  PortTypeSchema,
  PortGroupSchema,
  CatalogDeviceSchema,
  CutoutTypeSchema,
  ConnectorModuleSchema,
  CatalogConnectorSchema,
} from './schemas';

// ─── Derived Types ──────────────────────────────────────────────

/** Full catalog device entry, inferred from CatalogDeviceSchema. */
export type CatalogDevice = z.infer<typeof CatalogDeviceSchema>;

/** Full catalog connector entry, inferred from CatalogConnectorSchema. */
export type CatalogConnector = z.infer<typeof CatalogConnectorSchema>;

/** 4-tier data confidence level. */
export type DataSource = z.infer<typeof DataSourceSchema>;

/** Device category identifier. */
export type DeviceCategory = z.infer<typeof DeviceCategorySchema>;

/** Port type identifier. */
export type PortType = z.infer<typeof PortTypeSchema>;

/** A group of identical ports on a device. */
export type PortGroup = z.infer<typeof PortGroupSchema>;

/** A module installable into a connector cutout. */
export type ConnectorModule = z.infer<typeof ConnectorModuleSchema>;

/** Physical cutout shape type. */
export type CutoutType = z.infer<typeof CutoutTypeSchema>;

// ─── Backward-Compatible Converters ─────────────────────────────

/**
 * Convert a CatalogDevice to the existing DeviceDef interface.
 *
 * Maps the rich catalog schema fields to the narrow DeviceDef shape that
 * existing components, selectors, and exporters expect. This allows the
 * 17 consumer files to continue using DeviceDef without any changes.
 *
 * Field mapping:
 * - name -> name
 * - width -> w, depth -> d, height -> h, weight -> wt
 * - color -> color
 * - portSummary -> ports (fallback: empty string)
 * - poeBudget -> poe (fallback: '-')
 * - ports array -> portLayout.rj45 / portLayout.sfp (summed from matching groups)
 */
export function toDeviceDef(cd: CatalogDevice): DeviceDef {
  // Sum RJ45 ports across all port groups of type 'rj45'
  const rj45Count = cd.ports
    .filter((p) => p.type === 'rj45')
    .reduce((sum, p) => sum + p.count, 0);

  // Sum SFP-family ports (sfp, sfp+, sfp28, qsfp+, qsfp28) across all groups
  const sfpCount = cd.ports
    .filter((p) => p.type.startsWith('sfp') || p.type.startsWith('qsfp'))
    .reduce((sum, p) => sum + p.count, 0);

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
      rj45: rj45Count,
      sfp: sfpCount,
    },
    ...(cd.cornerRadius != null ? { cornerRadius: cd.cornerRadius } : {}),
  };
}

/**
 * Convert a CatalogConnector to the existing ConnectorDef interface.
 *
 * Maps the rich catalog schema fields to the narrow ConnectorDef shape that
 * existing components, selectors, and exporters expect. This allows the
 * 17 consumer files to continue using ConnectorDef without any changes.
 *
 * Field mapping:
 * - name -> name
 * - description -> desc (fallback: empty string)
 * - cutoutType -> cut
 * - cutoutWidth -> w, cutoutHeight -> h
 * - cutoutRadius -> r (only if defined)
 * - color -> color, icon -> icon
 * - depthBehind -> depthBehind
 * - mountHoles -> mountHoles (only if > 0)
 */
export function toConnectorDef(cc: CatalogConnector): ConnectorDef {
  const def: ConnectorDef = {
    name: cc.name,
    desc: cc.description ?? '',
    cut: cc.cutoutType,
    w: cc.cutoutWidth,
    h: cc.cutoutHeight,
    color: cc.color,
    icon: cc.icon,
    depthBehind: cc.depthBehind,
  };

  // Only include optional fields when they have meaningful values
  if (cc.cutoutRadius !== undefined) {
    def.r = cc.cutoutRadius;
  }
  if (cc.mountHoles > 0) {
    def.mountHoles = cc.mountHoles;
  }

  return def;
}

// ─── Re-exports ─────────────────────────────────────────────────

// Re-export all schemas for convenience so consumers can import from a single module.
export {
  DataSourceSchema,
  DeviceCategorySchema,
  PortTypeSchema,
  PortGroupSchema,
  CatalogDeviceSchema,
  CutoutTypeSchema,
  ConnectorModuleSchema,
  CatalogConnectorSchema,
} from './schemas';
