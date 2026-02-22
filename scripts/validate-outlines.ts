#!/usr/bin/env npx tsx
/**
 * validate-outlines.ts -- CLI tool to validate all existing outline SVGs
 * against catalog dimensions.
 *
 * Usage:
 *   npx tsx scripts/validate-outlines.ts \
 *     [--dir public/catalog/outlines] \
 *     [--tolerance 0.5]
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  parseSvgPathBounds,
  isPathClosed,
  countPathCommands,
  extractPathVertices,
  computePolygonArea,
} from './lib/svg-path-utils.js';

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

interface ValidationEntry {
  file: string;
  slug: string;
  face: Face;
  expectedW: number;
  expectedH: number;
  actualW: number;
  actualH: number;
  deltaW: number;
  deltaH: number;
  viewBoxMatch: boolean;
  pathClosed: boolean;
  commandCount: number;
  areaRatio: number;
  status: 'PASS' | 'FAIL' | 'WARN';
  errors: string[];
}

// ─── Catalog Reader ────────────────────────────────────────────

function loadCatalog(catalogPath: string): CatalogDevice[] {
  if (!fs.existsSync(catalogPath)) {
    console.error(`Error: Catalog file not found at ${catalogPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(catalogPath, 'utf-8');
  return JSON.parse(raw) as CatalogDevice[];
}

// ─── Bounding Box Resolver ─────────────────────────────────────

function resolveBBox(
  device: CatalogDevice,
  face: Face,
): { bboxW: number; bboxH: number } {
  switch (face) {
    case 'top':
      return { bboxW: device.width, bboxH: device.depth };
    case 'front':
      return { bboxW: device.width, bboxH: device.height };
    case 'side':
      return { bboxW: device.depth, bboxH: device.height };
  }
}

// ─── SVG File Parser ──────────────────────────────────────────

function parseSvgFile(filepath: string): {
  pathD: string | null;
  viewBox: string | null;
} {
  const content = fs.readFileSync(filepath, 'utf-8');

  // Extract path d attribute
  const pathMatch = content.match(/<path[^>]*\bd="([^"]+)"/);
  const pathD = pathMatch ? pathMatch[1] : null;

  // Extract viewBox
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  const viewBox = viewBoxMatch ? viewBoxMatch[1] : null;

  return { pathD, viewBox };
}

// ─── Filename Parser ──────────────────────────────────────────

const VALID_FACES: Face[] = ['top', 'front', 'side'];

function parseOutlineFilename(
  filename: string,
): { slug: string; face: Face } | null {
  // Match pattern: {slug}-{face}.svg
  // Face is the last segment before .svg
  const match = filename.match(/^(.+)-(top|front|side)\.svg$/);
  if (!match) return null;

  const slug = match[1];
  const face = match[2] as Face;

  if (!VALID_FACES.includes(face)) return null;

  return { slug, face };
}

// ─── Validation ───────────────────────────────────────────────

function validateOutline(
  filepath: string,
  filename: string,
  slug: string,
  face: Face,
  device: CatalogDevice,
  tolerance: number,
): ValidationEntry {
  const errors: string[] = [];
  const { bboxW: expectedW, bboxH: expectedH } = resolveBBox(device, face);

  const { pathD, viewBox } = parseSvgFile(filepath);

  if (!pathD) {
    return {
      file: filename,
      slug,
      face,
      expectedW,
      expectedH,
      actualW: 0,
      actualH: 0,
      deltaW: expectedW,
      deltaH: expectedH,
      viewBoxMatch: false,
      pathClosed: false,
      commandCount: 0,
      areaRatio: 0,
      status: 'FAIL',
      errors: ['No <path> element found in SVG'],
    };
  }

  // Check path is closed
  const pathClosed = isPathClosed(pathD);
  if (!pathClosed) {
    errors.push('Path is not closed (missing Z command)');
  }

  // Check command count
  const commandCount = countPathCommands(pathD);
  if (commandCount < 4) {
    errors.push(
      `Path has only ${commandCount} commands (minimum 4 for a closed shape)`,
    );
  }

  // Compute path bounding box
  const bounds = parseSvgPathBounds(pathD);
  const actualW = bounds.width;
  const actualH = bounds.height;
  const deltaW = Math.abs(actualW - expectedW);
  const deltaH = Math.abs(actualH - expectedH);

  if (deltaW > tolerance) {
    errors.push(
      `Width mismatch: ${actualW.toFixed(2)} vs ${expectedW} (delta: ${deltaW.toFixed(3)}mm)`,
    );
  }
  if (deltaH > tolerance) {
    errors.push(
      `Height mismatch: ${actualH.toFixed(2)} vs ${expectedH} (delta: ${deltaH.toFixed(3)}mm)`,
    );
  }

  // Check viewBox matches expected dimensions
  let viewBoxMatch = false;
  if (viewBox) {
    const vbParts = viewBox.split(/\s+/).map(Number);
    if (vbParts.length === 4) {
      const vbW = vbParts[2];
      const vbH = vbParts[3];
      viewBoxMatch =
        Math.abs(vbW - expectedW) <= tolerance &&
        Math.abs(vbH - expectedH) <= tolerance;
      if (!viewBoxMatch) {
        errors.push(
          `viewBox dimensions ${vbW}x${vbH} don't match expected ${expectedW}x${expectedH}`,
        );
      }
    } else {
      errors.push(`Invalid viewBox format: "${viewBox}"`);
    }
  } else {
    errors.push('No viewBox attribute found');
  }

  // Area check: path area should be 50-100% of bounding box area
  const bboxArea = expectedW * expectedH;
  const vertices = extractPathVertices(pathD);
  const pathArea = computePolygonArea(vertices);
  const areaRatio = bboxArea > 0 ? pathArea / bboxArea : 0;

  if (areaRatio < 0.5) {
    errors.push(
      `Path area ratio ${(areaRatio * 100).toFixed(1)}% is below 50% of bbox area (suspicious outline)`,
    );
  }
  if (areaRatio > 1.05) {
    errors.push(
      `Path area ratio ${(areaRatio * 100).toFixed(1)}% exceeds 100% of bbox area (path may extend outside bbox)`,
    );
  }

  const status = errors.length > 0 ? 'FAIL' : 'PASS';

  return {
    file: filename,
    slug,
    face,
    expectedW,
    expectedH,
    actualW,
    actualH,
    deltaW,
    deltaH,
    viewBoxMatch,
    pathClosed,
    commandCount,
    areaRatio,
    status,
    errors,
  };
}

// ─── Report Formatter ─────────────────────────────────────────

function printReport(entries: ValidationEntry[]): void {
  if (entries.length === 0) {
    console.log('No outlines found to validate.');
    return;
  }

  // Table header
  const fileColWidth = Math.max(
    30,
    ...entries.map((e) => e.file.length),
  );
  const header = [
    'File'.padEnd(fileColWidth),
    'Expected'.padEnd(12),
    'Actual'.padEnd(12),
    'Delta'.padEnd(12),
    'Cmds',
    'Area%',
    'Status',
  ].join('  ');

  console.log('\n' + header);
  console.log('-'.repeat(header.length));

  for (const entry of entries) {
    const row = [
      entry.file.padEnd(fileColWidth),
      `${entry.expectedW}x${entry.expectedH}`.padEnd(12),
      `${entry.actualW.toFixed(1)}x${entry.actualH.toFixed(1)}`.padEnd(12),
      `${entry.deltaW.toFixed(2)}x${entry.deltaH.toFixed(2)}`.padEnd(12),
      String(entry.commandCount).padStart(4),
      `${(entry.areaRatio * 100).toFixed(0)}%`.padStart(5),
      entry.status === 'PASS' ? ' PASS' : ' FAIL',
    ].join('  ');

    console.log(row);

    // Print errors for failing entries
    if (entry.errors.length > 0) {
      for (const err of entry.errors) {
        console.log(`  -> ${err}`);
      }
    }
  }

  // Summary
  const passCount = entries.filter((e) => e.status === 'PASS').length;
  const failCount = entries.filter((e) => e.status === 'FAIL').length;

  console.log(
    `\nTotal: ${entries.length}  Pass: ${passCount}  Fail: ${failCount}`,
  );
}

// ─── CLI ──────────────────────────────────────────────────────

const program = new Command();

program
  .name('validate-outlines')
  .description(
    'Validate all generated outline SVGs against catalog dimensions',
  )
  .option(
    '--dir <path>',
    'Directory containing outline SVGs',
    'public/catalog/outlines',
  )
  .option(
    '--tolerance <mm>',
    'Max allowed dimensional deviation in mm',
    '0.5',
  )
  .action((opts) => {
    const { dir: dirStr, tolerance: toleranceStr } = opts;

    const tolerance = parseFloat(toleranceStr);
    if (isNaN(tolerance) || tolerance <= 0) {
      console.error(
        `Error: Invalid tolerance "${toleranceStr}". Must be a positive number.`,
      );
      process.exit(1);
    }

    const outlineDir = path.resolve(process.cwd(), dirStr);

    // Load catalog
    const catalogPath = path.resolve(
      process.cwd(),
      'public/catalog/devices.json',
    );
    const devices = loadCatalog(catalogPath);
    const deviceMap = new Map<string, CatalogDevice>();
    for (const d of devices) {
      deviceMap.set(d.slug, d);
    }

    // Scan for SVG files
    if (!fs.existsSync(outlineDir)) {
      console.log(`No outlines directory found at ${outlineDir}`);
      console.log('No outlines found to validate.');
      process.exit(0);
    }

    const files = fs
      .readdirSync(outlineDir)
      .filter((f) => f.endsWith('.svg'))
      .sort();

    if (files.length === 0) {
      console.log('No outlines found to validate.');
      process.exit(0);
    }

    console.log(
      `Validating ${files.length} outline(s) in ${outlineDir} (tolerance: ${tolerance}mm)`,
    );

    const entries: ValidationEntry[] = [];

    for (const file of files) {
      const parsed = parseOutlineFilename(file);

      if (!parsed) {
        console.warn(
          `  Warning: Skipping "${file}" -- does not match {slug}-{face}.svg pattern`,
        );
        continue;
      }

      const { slug, face } = parsed;
      const device = deviceMap.get(slug);

      if (!device) {
        console.warn(
          `  Warning: Skipping "${file}" -- slug "${slug}" not found in catalog`,
        );
        continue;
      }

      const filepath = path.join(outlineDir, file);
      const entry = validateOutline(
        filepath,
        file,
        slug,
        face,
        device,
        tolerance,
      );
      entries.push(entry);
    }

    printReport(entries);

    // Exit code based on results
    const hasFailures = entries.some((e) => e.status === 'FAIL');
    process.exit(hasFailures ? 1 : 0);
  });

program.parse();
