#!/usr/bin/env npx tsx
/**
 * generate-outline-index.ts -- Generate the outline index.json manifest
 * by scanning existing SVG files and matching against the device catalog.
 *
 * Usage:
 *   npx tsx scripts/generate-outline-index.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Types ─────────────────────────────────────────────────────

type Face = 'top' | 'front' | 'side';

interface CatalogDevice {
  slug: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  [key: string]: unknown;
}

interface OutlineEntry {
  faces: Face[];
  bboxW: number;
  bboxD: number;
  bboxH: number;
}

interface OutlineIndex {
  schemaVersion: 1;
  generated: string;
  outlines: Record<string, OutlineEntry>;
}

// ─── Main ────────────────────────────────────────────────────

const outlinesDir = path.resolve(
  process.cwd(),
  'public/catalog/outlines',
);
const catalogPath = path.resolve(
  process.cwd(),
  'public/catalog/devices.json',
);

// Load catalog
const catalogRaw = fs.readFileSync(catalogPath, 'utf-8');
const devices: CatalogDevice[] = JSON.parse(catalogRaw);
const deviceMap = new Map<string, CatalogDevice>();
for (const d of devices) {
  deviceMap.set(d.slug, d);
}

// Scan SVG files
const files = fs
  .readdirSync(outlinesDir)
  .filter((f) => f.endsWith('.svg'))
  .sort();

// Group by slug
const slugFaces = new Map<string, Face[]>();
const VALID_FACES: Face[] = ['top', 'front', 'side'];

for (const file of files) {
  const match = file.match(/^(.+)-(top|front|side)\.svg$/);
  if (!match) {
    console.warn(`  Warning: Skipping "${file}" -- does not match pattern`);
    continue;
  }

  const slug = match[1];
  const face = match[2] as Face;

  if (!VALID_FACES.includes(face)) continue;

  if (!slugFaces.has(slug)) {
    slugFaces.set(slug, []);
  }
  slugFaces.get(slug)!.push(face);
}

// Build index
const outlines: Record<string, OutlineEntry> = {};
const errors: string[] = [];

for (const [slug, faces] of slugFaces.entries()) {
  const device = deviceMap.get(slug);
  if (!device) {
    errors.push(
      `Slug "${slug}" found in outlines but not in devices.json`,
    );
    continue;
  }

  outlines[slug] = {
    faces: faces.sort() as Face[],
    bboxW: device.width,
    bboxD: device.depth,
    bboxH: device.height,
  };
}

// Verify all SVG files are covered
const indexSlugs = new Set(Object.keys(outlines));
for (const file of files) {
  const match = file.match(/^(.+)-(top|front|side)\.svg$/);
  if (!match) continue;
  const slug = match[1];
  if (!indexSlugs.has(slug)) {
    errors.push(`SVG file "${file}" has no corresponding catalog entry`);
  }
}

// Report errors
if (errors.length > 0) {
  console.error('Validation errors:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

// Write index.json
const index: OutlineIndex = {
  schemaVersion: 1,
  generated: new Date().toISOString(),
  outlines,
};

const indexPath = path.join(outlinesDir, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf-8');

console.log(`Generated ${indexPath}`);
console.log(`  schemaVersion: ${index.schemaVersion}`);
console.log(`  outlines: ${Object.keys(index.outlines).length} devices`);
for (const [slug, entry] of Object.entries(index.outlines)) {
  console.log(
    `    ${slug}: faces=[${entry.faces.join(',')}] bbox=${entry.bboxW}x${entry.bboxD}x${entry.bboxH}mm`,
  );
}
