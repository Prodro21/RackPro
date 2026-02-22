#!/usr/bin/env npx tsx
/**
 * batch-generate-outlines.ts -- Generate programmatic SVG outlines for
 * priority devices based on known dimensions and shape descriptions.
 *
 * This is the fallback approach when the Claude Vision API is not available.
 * For rectangular-ish devices, generates rounded-rectangle paths.
 * For non-rectangular devices, generates hand-crafted paths.
 *
 * Usage:
 *   npx tsx scripts/batch-generate-outlines.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ─── Types ─────────────────────────────────────────────────────

type Face = 'top' | 'front';

interface CatalogDevice {
  slug: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  [key: string]: unknown;
}

interface OutlineSpec {
  slug: string;
  face: Face;
  /** Width of the viewBox (mm) */
  bboxW: number;
  /** Height of the viewBox (mm) */
  bboxH: number;
  /** SVG path d attribute */
  pathD: string;
}

// ─── Catalog Reader ────────────────────────────────────────────

function loadCatalog(catalogPath: string): CatalogDevice[] {
  const raw = fs.readFileSync(catalogPath, 'utf-8');
  return JSON.parse(raw) as CatalogDevice[];
}

// ─── Path Generators ──────────────────────────────────────────

/**
 * Generate a rounded rectangle path.
 * M {r} 0 L {W-r} 0 Q {W} 0 {W} {r} L {W} {H-r} Q {W} {H} {W-r} {H}
 * L {r} {H} Q 0 {H} 0 {H-r} L 0 {r} Q 0 0 {r} 0 Z
 */
function roundedRect(W: number, H: number, r: number): string {
  // Clamp radius to half the smallest dimension
  const maxR = Math.min(W, H) / 2;
  const cr = Math.min(r, maxR);
  return [
    `M ${cr} 0`,
    `L ${W - cr} 0`,
    `Q ${W} 0 ${W} ${cr}`,
    `L ${W} ${H - cr}`,
    `Q ${W} ${H} ${W - cr} ${H}`,
    `L ${cr} ${H}`,
    `Q 0 ${H} 0 ${H - cr}`,
    `L 0 ${cr}`,
    `Q 0 0 ${cr} 0`,
    'Z',
  ].join(' ');
}

/**
 * UX7 top view: heavily rounded square (almost a "squircle").
 * The UX7 has very large corner radii (~20mm) on a 117x117mm body.
 */
function ux7Top(W: number, H: number): string {
  const r = 20; // large corner radius
  return roundedRect(W, H, r);
}

/**
 * UX7 front view: rounded rectangle with large corners.
 * 117mm wide x 42.5mm tall, with ~15mm corner radii.
 */
function ux7Front(W: number, H: number): string {
  const r = 12; // front profile corners are slightly less rounded than top
  return roundedRect(W, H, r);
}

/**
 * UDM top view: circular profile viewed from above.
 * The UDM is cylindrical. Top view is a circle inscribed in 110x110mm.
 * Uses cubic Bezier approximation (4 curves, kappa = 0.5522847498).
 * This avoids the validator's conservative arc bounding box inflation.
 */
function udmTop(W: number, H: number): string {
  const cx = W / 2;
  const cy = H / 2;
  const rx = W / 2;
  const ry = H / 2;
  // Kappa for cubic Bezier circle approximation
  const k = 0.5522847498;
  const kx = rx * k;
  const ky = ry * k;
  return [
    // Start at top center
    `M ${cx} 0`,
    // Top-right quadrant
    `C ${cx + kx} 0 ${W} ${cy - ky} ${W} ${cy}`,
    // Bottom-right quadrant
    `C ${W} ${cy + ky} ${cx + kx} ${H} ${cx} ${H}`,
    // Bottom-left quadrant
    `C ${cx - kx} ${H} 0 ${cy + ky} 0 ${cy}`,
    // Top-left quadrant
    `C 0 ${cy - ky} ${cx - kx} 0 ${cx} 0`,
    'Z',
  ].join(' ');
}

/**
 * UDM front view: dome/capsule shape.
 * 110mm wide x 184.2mm tall. Tapered top with dome, cylindrical body.
 * Simplified as a rectangle with a rounded top (dome).
 * Uses cubic Bezier for the dome to avoid arc bounding box inflation.
 */
function udmFront(W: number, H: number): string {
  const domeR = W / 2; // dome radius = half width
  const k = 0.5522847498; // kappa for Bezier circle approximation
  const ky = domeR * k;
  const kx = domeR * k;
  return [
    `M 0 ${H}`,
    `L 0 ${domeR}`,
    // Dome as a half-circle using two cubic Bezier curves
    `C 0 ${domeR - ky} ${W / 2 - kx} 0 ${W / 2} 0`,
    `C ${W / 2 + kx} 0 ${W} ${domeR - ky} ${W} ${domeR}`,
    `L ${W} ${H}`,
    `L 0 ${H}`,
    'Z',
  ].join(' ');
}

/**
 * Raspberry Pi 5 top view: rectangular PCB with notches/cutouts.
 * 86x56mm board with mounting hole indentations at corners and
 * a slight asymmetry from the GPIO header and connectors.
 * Simplified: rectangle with small corner notches (mounting holes).
 */
function rpi5Top(W: number, H: number): string {
  const notch = 2.5; // mounting hole notch size
  const holeInset = 3.5; // distance from edge to hole center
  return [
    // Start at top-left after first notch area
    `M 0 0`,
    `L ${W} 0`,
    `L ${W} ${H}`,
    // Bottom-right notch for SD card slot area
    `L ${W - 5} ${H}`,
    `L ${W - 5} ${H - 2}`,
    `L ${W - 22} ${H - 2}`,
    `L ${W - 22} ${H}`,
    `L 0 ${H}`,
    `L 0 0`,
    'Z',
  ].join(' ');
}

/**
 * Raspberry Pi 5 front view: stepped profile showing board and port heights.
 * 86mm wide x 16mm tall. The bounding box height (16mm) is the overall
 * envelope including the tallest port connector. The PCB is ~1.6mm thick
 * and sits at the bottom. Ports extend upward from the PCB surface.
 *
 * Layout (left to right on this face -- the USB-C/HDMI edge):
 * - USB-C power (left side, ~9mm wide, ~3.2mm tall)
 * - 2x micro-HDMI (~7mm each, ~3.5mm tall)
 * - Gap
 * - Ethernet RJ45 (~16mm wide, ~13.5mm tall) -- tallest
 * - 2x USB-A stacked (~14mm wide, ~16mm tall) -- defines max height
 *
 * Rather than showing individual ports (which causes low area ratio),
 * we draw the overall ENVELOPE of the device as seen from the front:
 * a stepped outline covering the full bounding box.
 */
function rpi5Front(W: number, H: number): string {
  // The front profile is dominated by the tall USB-A/Ethernet ports on the right.
  // Left portion is lower (HDMI/USB-C are shorter connectors).
  // We create a stepped envelope:
  const lowPortH = 4; // shorter connectors (USB-C, HDMI) ~ 3-4mm above PCB
  const midPortH = H * 0.85; // Ethernet port height fraction of total
  const splitX = 48; // transition point where tall ports begin

  return [
    // Start bottom-left
    `M 0 ${H}`,
    // Left edge up (short ports section)
    `L 0 ${H - lowPortH}`,
    // Step up to tall port section
    `L ${splitX} ${H - lowPortH}`,
    `L ${splitX} 0`,
    // Top of tall ports to right edge
    `L ${W} 0`,
    // Right edge down
    `L ${W} ${H}`,
    // Bottom edge back to start
    `L 0 ${H}`,
    'Z',
  ].join(' ');
}

/**
 * ATEM Mini Pro top view: rectangular with slightly angled/beveled edges.
 * 235x104mm. The ATEM has a slightly tapered design and button panel.
 * Simplified: rounded rectangle with small corner radius.
 */
function atemMiniProTop(W: number, H: number): string {
  return roundedRect(W, H, 3);
}

/**
 * ATEM Mini Pro front view: rectangular with small bevel.
 * 235mm wide x 40mm tall.
 */
function atemMiniProFront(W: number, H: number): string {
  return roundedRect(W, H, 1.5);
}

// ─── Outline Generation ──────────────────────────────────────

function resolveViewBox(
  device: CatalogDevice,
  face: Face,
): { bboxW: number; bboxH: number } {
  switch (face) {
    case 'top':
      return { bboxW: device.width, bboxH: device.depth };
    case 'front':
      return { bboxW: device.width, bboxH: device.height };
  }
}

function generateOutline(
  device: CatalogDevice,
  face: Face,
): OutlineSpec {
  const { bboxW, bboxH } = resolveViewBox(device, face);
  const slug = device.slug;

  let pathD: string;

  // Dispatch to specialized generators for non-rectangular devices
  if (slug === 'ux7' && face === 'top') {
    pathD = ux7Top(bboxW, bboxH);
  } else if (slug === 'ux7' && face === 'front') {
    pathD = ux7Front(bboxW, bboxH);
  } else if (slug === 'udm' && face === 'top') {
    pathD = udmTop(bboxW, bboxH);
  } else if (slug === 'udm' && face === 'front') {
    pathD = udmFront(bboxW, bboxH);
  } else if (slug === 'rpi5' && face === 'top') {
    pathD = rpi5Top(bboxW, bboxH);
  } else if (slug === 'rpi5' && face === 'front') {
    pathD = rpi5Front(bboxW, bboxH);
  } else if (slug === 'bmd-atem-mini-pro' && face === 'top') {
    pathD = atemMiniProTop(bboxW, bboxH);
  } else if (slug === 'bmd-atem-mini-pro' && face === 'front') {
    pathD = atemMiniProFront(bboxW, bboxH);
  } else if (slug === 'ucg-ultra' && face === 'top') {
    // UCG-Ultra: square with moderately rounded corners (~8mm radius)
    pathD = roundedRect(bboxW, bboxH, 8);
  } else if (slug === 'ucg-ultra' && face === 'front') {
    pathD = roundedRect(bboxW, bboxH, 5);
  } else {
    // Default: rounded rectangle with 2mm corner radius (typical for network equipment)
    pathD = roundedRect(bboxW, bboxH, 2);
  }

  return { slug, face, bboxW, bboxH, pathD };
}

// ─── SVG Writer ───────────────────────────────────────────────

function writeSvg(spec: OutlineSpec, outputDir: string): string {
  const now = new Date().toISOString().split('T')[0];
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${spec.bboxW} ${spec.bboxH}"
     width="${spec.bboxW}mm" height="${spec.bboxH}mm">
  <!-- Generated by RackPro batch outline generator -->
  <!-- Device: ${spec.slug}, Face: ${spec.face} -->
  <!-- BBox: ${spec.bboxW} x ${spec.bboxH} mm -->
  <!-- Date: ${now} -->
  <path d="${spec.pathD}" fill="none" stroke="black" stroke-width="0.5" />
</svg>
`;

  const filename = `${spec.slug}-${spec.face}.svg`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, svg, 'utf-8');
  return filepath;
}

// ─── Main ────────────────────────────────────────────────────

const PRIORITY_SLUGS = [
  'usw-lite-16-poe',
  'ux7',
  'usw-lite-8-poe',
  'usw-flex',
  'usw-flex-mini',
  'ucg-ultra',
  'udm',
  'unvr',
  'rpi5',
  'bmd-atem-mini-pro',
];

const FACES: Face[] = ['top', 'front'];

const catalogPath = path.resolve(
  process.cwd(),
  'public/catalog/devices.json',
);
const outputDir = path.resolve(
  process.cwd(),
  'public/catalog/outlines',
);

// Load catalog
const devices = loadCatalog(catalogPath);
const deviceMap = new Map<string, CatalogDevice>();
for (const d of devices) {
  deviceMap.set(d.slug, d);
}

// Ensure output directory
fs.mkdirSync(outputDir, { recursive: true });

console.log('Generating outlines for priority devices...\n');

let generated = 0;
let failed = 0;

for (const slug of PRIORITY_SLUGS) {
  const device = deviceMap.get(slug);
  if (!device) {
    console.error(`  SKIP: ${slug} -- not found in catalog`);
    failed++;
    continue;
  }

  for (const face of FACES) {
    const spec = generateOutline(device, face);
    const filepath = writeSvg(spec, outputDir);
    console.log(
      `  OK: ${spec.slug}-${spec.face}.svg (${spec.bboxW}x${spec.bboxH}mm)`,
    );
    generated++;
  }
}

console.log(`\nGenerated: ${generated} outlines (${failed} slugs skipped)`);
console.log(`Output: ${outputDir}`);
