#!/usr/bin/env npx tsx
/**
 * Catalog validation script.
 *
 * Validates public/catalog/devices.json and connectors.json against Zod schemas.
 * Checks for slug collisions and dimension plausibility.
 * Reuses the same Zod schemas used at runtime in the app.
 *
 * Usage:
 *   npx tsx scripts/validate-catalog.ts          # Human-readable output
 *   npx tsx scripts/validate-catalog.ts --json    # Machine-readable JSON output
 *
 * Exit codes:
 *   0 — All entries valid (warnings are OK)
 *   1 — Schema errors or slug collisions found
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CatalogDeviceSchema, CatalogConnectorSchema } from '../src/catalog/schemas.js';

// ─── Types ─────────────────────────────────────────────────────

interface ValidationError {
  slug: string;
  field: string;
  message: string;
}

interface ValidationWarning {
  slug: string;
  field: string;
  value: number | string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  deviceCount: number;
  connectorCount: number;
}

// ─── Plausibility ranges ───────────────────────────────────────

const PLAUSIBILITY = {
  width:  { min: 10, max: 800, unit: 'mm' },
  depth:  { min: 10, max: 800, unit: 'mm' },
  height: { min: 10, max: 200, unit: 'mm' },
  weight: { min: 0.01, max: 50, unit: 'kg' },
} as const;

type PlausibilityField = keyof typeof PLAUSIBILITY;

// ─── Helpers ───────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

function readJsonFile(relativePath: string): unknown {
  const fullPath = resolve(ROOT, relativePath);
  const raw = readFileSync(fullPath, 'utf8');
  return JSON.parse(raw);
}

function checkPlausibility(
  slug: string,
  entry: Record<string, unknown>,
  warnings: ValidationWarning[],
): void {
  for (const [field, range] of Object.entries(PLAUSIBILITY)) {
    const value = entry[field];
    if (typeof value !== 'number') continue;
    if (value < range.min || value > range.max) {
      warnings.push({
        slug,
        field,
        value,
        message: `${value}${range.unit} is outside plausible range (${range.min}-${range.max}${range.unit})`,
      });
    }
  }
}

// ─── Main validation ───────────────────────────────────────────

function validate(): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const allSlugs = new Map<string, string>(); // slug -> source file

  // --- Read catalog files ---
  let devices: unknown[];
  let connectors: unknown[];

  try {
    const raw = readJsonFile('public/catalog/devices.json');
    if (!Array.isArray(raw)) {
      errors.push({ slug: '', field: '', message: 'devices.json is not an array' });
      devices = [];
    } else {
      devices = raw;
    }
  } catch (e) {
    errors.push({ slug: '', field: '', message: `Failed to read devices.json: ${(e as Error).message}` });
    devices = [];
  }

  try {
    const raw = readJsonFile('public/catalog/connectors.json');
    if (!Array.isArray(raw)) {
      errors.push({ slug: '', field: '', message: 'connectors.json is not an array' });
      connectors = [];
    } else {
      connectors = raw;
    }
  } catch (e) {
    errors.push({ slug: '', field: '', message: `Failed to read connectors.json: ${(e as Error).message}` });
    connectors = [];
  }

  // --- Validate devices ---
  for (let i = 0; i < devices.length; i++) {
    const entry = devices[i] as Record<string, unknown>;
    const slug = typeof entry?.slug === 'string' ? entry.slug : `devices[${i}]`;

    const result = CatalogDeviceSchema.safeParse(entry);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          slug,
          field: issue.path.join('.'),
          message: issue.message,
        });
      }
    }

    // Slug collision check
    if (typeof entry?.slug === 'string') {
      if (allSlugs.has(entry.slug)) {
        errors.push({
          slug: entry.slug,
          field: 'slug',
          message: `Duplicate slug "${entry.slug}" (also in ${allSlugs.get(entry.slug)})`,
        });
      } else {
        allSlugs.set(entry.slug, 'devices.json');
      }
    }

    // Plausibility check (only for valid-ish entries)
    if (typeof entry === 'object' && entry !== null) {
      checkPlausibility(slug, entry, warnings);
    }
  }

  // --- Validate connectors ---
  for (let i = 0; i < connectors.length; i++) {
    const entry = connectors[i] as Record<string, unknown>;
    const slug = typeof entry?.slug === 'string' ? entry.slug : `connectors[${i}]`;

    const result = CatalogConnectorSchema.safeParse(entry);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          slug,
          field: issue.path.join('.'),
          message: issue.message,
        });
      }
    }

    // Slug collision check (across both files)
    if (typeof entry?.slug === 'string') {
      if (allSlugs.has(entry.slug)) {
        errors.push({
          slug: entry.slug,
          field: 'slug',
          message: `Duplicate slug "${entry.slug}" (also in ${allSlugs.get(entry.slug)})`,
        });
      } else {
        allSlugs.set(entry.slug, 'connectors.json');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    deviceCount: devices.length,
    connectorCount: connectors.length,
  };
}

// ─── Output ────────────────────────────────────────────────────

function printHumanReadable(result: ValidationResult): void {
  console.log('');
  console.log('=== Catalog Validation ===');
  console.log(`Devices:    ${result.deviceCount}`);
  console.log(`Connectors: ${result.connectorCount}`);
  console.log('');

  if (result.errors.length > 0) {
    console.log(`ERRORS (${result.errors.length}):`);
    for (const e of result.errors) {
      const prefix = e.slug ? `  [${e.slug}]` : '  [root]';
      const field = e.field ? ` ${e.field}:` : '';
      console.log(`${prefix}${field} ${e.message}`);
    }
    console.log('');
  }

  if (result.warnings.length > 0) {
    console.log(`WARNINGS (${result.warnings.length}):`);
    for (const w of result.warnings) {
      console.log(`  [${w.slug}] ${w.field}: ${w.message}`);
    }
    console.log('');
  }

  if (result.valid) {
    console.log('RESULT: PASS');
    if (result.warnings.length > 0) {
      console.log(`  (${result.warnings.length} plausibility warning(s) for maintainer review)`);
    }
  } else {
    console.log('RESULT: FAIL');
    console.log(`  ${result.errors.length} error(s) must be fixed`);
  }
  console.log('');
}

// ─── CLI ───────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

const result = validate();

if (jsonMode) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printHumanReadable(result);
}

process.exit(result.valid ? 0 : 1);
