/**
 * RackPro — Fusion 360 Bridge MCP Tools
 *
 * Six tools that communicate with the RackProBridge add-in running
 * inside Fusion 360 via HTTP on localhost:9100.
 */

import { z } from 'zod';
import {
  fusionPing,
  fusionBuild,
  fusionQueryProperties,
  fusionQueryFeatures,
  fusionQueryInterference,
  fusionExport,
  fusionScreenshot,
} from '../fusion-client';
import { buildExportConfig } from './export';

// ─── Schemas ─────────────────────────────────────────────────

export const fusionConnectSchema = z.object({});

export const fusionBuildSchema = z.object({
  newDocument: z.boolean().optional()
    .describe('Create a new Fusion document before building (default: false)'),
});

export const fusionPropertiesSchema = z.object({});

export const fusionFeaturesSchema = z.object({});

export const fusionExportFileSchema = z.object({
  format: z.enum(['stl', 'step', 'dxf']).describe('Export file format'),
  path: z.string().describe('Output file path (e.g. ~/Desktop/panel.stl)'),
  bodyName: z.string().optional().describe('Specific body name to export (STL only)'),
});

export const fusionScreenshotSchema = z.object({
  path: z.string().describe('Output image path (.png or .jpg)'),
  width: z.number().optional().describe('Image width in pixels (default: 1920)'),
  height: z.number().optional().describe('Image height in pixels (default: 1080)'),
});

// ─── Handlers ────────────────────────────────────────────────

export async function handleFusionConnect() {
  try {
    const result = await fusionPing();
    return {
      success: true,
      connected: result.ok,
      fusionVersion: result.fusion_version,
      activeDocument: result.document,
    };
  } catch (err: unknown) {
    return {
      success: false,
      connected: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleFusionBuild(args: z.infer<typeof fusionBuildSchema>) {
  try {
    const config = buildExportConfig();
    const result = await fusionBuild(config, args.newDocument ?? false);

    // Build a human-readable summary
    const featureCount = result.features?.length ?? 0;
    const computedCount = result.features?.filter(f => f.computed).length ?? 0;
    const failedFeatures = result.features?.filter(f => !f.computed) ?? [];
    const bodyCount = result.bodies?.length ?? 0;

    return {
      success: result.success,
      summary: `${computedCount}/${featureCount} features computed, ${bodyCount} bodies created`,
      features: result.features,
      bodies: result.bodies,
      errors: result.errors,
      warnings: result.warnings,
      failedFeatures: failedFeatures.length > 0 ? failedFeatures : undefined,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleFusionProperties() {
  try {
    const result = await fusionQueryProperties();
    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Add summary
    const totalMass = result.bodies?.reduce((sum, b) => sum + (b.mass_g ?? 0), 0) ?? 0;
    const totalVolume = result.bodies?.reduce((sum, b) => sum + (b.volume_cm3 ?? 0), 0) ?? 0;

    return {
      success: true,
      bodyCount: result.count,
      totalMass_g: Math.round(totalMass * 100) / 100,
      totalVolume_cm3: Math.round(totalVolume * 10000) / 10000,
      bodies: result.bodies,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleFusionFeatures() {
  try {
    const result = await fusionQueryFeatures();
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const failed = result.features?.filter(f => !f.computed && !f.suppressed && !f.rolled_back) ?? [];

    return {
      success: true,
      featureCount: result.count,
      failedCount: failed.length,
      features: result.features,
      failedFeatures: failed.length > 0 ? failed : undefined,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleFusionExportFile(args: z.infer<typeof fusionExportFileSchema>) {
  try {
    const result = await fusionExport(args.format, args.path, args.bodyName);
    return result;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function handleFusionScreenshot(args: z.infer<typeof fusionScreenshotSchema>) {
  try {
    const result = await fusionScreenshot(args.path, args.width, args.height);
    return result;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
