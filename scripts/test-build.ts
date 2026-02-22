/**
 * Test build: USW-Lite-16-PoE (left) + 4×RJ45 2×2 grid + UX7 (right)
 * 2U panel — these devices are ~43mm tall, need 2U (88mm) for enclosure walls
 * Run: npx tsx scripts/test-build.ts
 */

import type { ExportConfig, ExportElement, FabConfig3DP } from '../src/types';

const PAN_W = 450.85;  // 19" panel width
const PAN_H = 88.11;   // 2U panel height (2 × 44.45 - 0.79)
const TOT_W = 482.6;   // total width with ears
const VCENTER = PAN_H / 2;  // 44.055mm

// ── Element positions ──────────────────────────────────────────

// Left half: USW-Lite-16-PoE centered in left half
const lite16: ExportElement = {
  type: 'device', key: 'usw-lite-16', label: 'USW-Lite-16-PoE',
  x: 113, y: VCENTER, w: 192, h: 43.7,
  cutout: 'rect', depthBehind: 185,
};

// Right half: 4× RJ45 in a 2×2 grid, then UX7
// RJ45 keystone: 16.5mm wide × 19.2mm tall
// UX7: 117mm wide × 42.5mm tall
//
// 2×2 grid dimensions:
//   2 cols × 16.5mm + 3mm gap = 36mm wide
//   2 rows × 19.2mm + 3mm gap = 41.4mm tall
//
// Right half: 225.4 to 450.85 = 225.4mm available
//   RJ45 grid (36mm) + 15mm gap + UX7 (117mm) = 168mm
//   Padding each side = (225.4 - 168) / 2 ≈ 29mm

const gridCx = 272;       // RJ45 grid center X
const colHalf = (16.5 + 3) / 2;  // 9.75mm — half of column spacing
const rowHalf = (19.2 + 3) / 2;  // 11.1mm — half of row spacing

const rj45_tl: ExportElement = {
  type: 'connector', key: 'rj45-ks', label: 'RJ45 #1',
  x: gridCx - colHalf, y: VCENTER - rowHalf, w: 16.5, h: 19.2,
  cutout: 'rect', depthBehind: 28,
};
const rj45_tr: ExportElement = {
  type: 'connector', key: 'rj45-ks', label: 'RJ45 #2',
  x: gridCx + colHalf, y: VCENTER - rowHalf, w: 16.5, h: 19.2,
  cutout: 'rect', depthBehind: 28,
};
const rj45_bl: ExportElement = {
  type: 'connector', key: 'rj45-ks', label: 'RJ45 #3',
  x: gridCx - colHalf, y: VCENTER + rowHalf, w: 16.5, h: 19.2,
  cutout: 'rect', depthBehind: 28,
};
const rj45_br: ExportElement = {
  type: 'connector', key: 'rj45-ks', label: 'RJ45 #4',
  x: gridCx + colHalf, y: VCENTER + rowHalf, w: 16.5, h: 19.2,
  cutout: 'rect', depthBehind: 28,
};

// UX7 after RJ45 grid + 15mm gap
const ux7X = gridCx + 36 / 2 + 15 + 117 / 2;  // 272 + 18 + 15 + 58.5 = 363.5
const ux7: ExportElement = {
  type: 'device', key: 'ux7', label: 'UniFi Express 7',
  x: ux7X, y: VCENTER, w: 117, h: 42.5,
  cutout: 'rect', depthBehind: 117,
};

const elements = [lite16, rj45_tl, rj45_tr, rj45_bl, rj45_br, ux7];

// ── Print layout summary ───────────────────────────────────────
console.log('=== Test Build Layout ===');
console.log(`Panel: 19" 2U (${PAN_W} × ${PAN_H}mm)`);
console.log('');
for (const el of elements) {
  const left = el.x - el.w / 2;
  const right = el.x + el.w / 2;
  const top = el.y - el.h / 2;
  const bot = el.y + el.h / 2;
  console.log(`  ${el.label.padEnd(20)} x=${el.x.toFixed(1).padStart(6)} y=${el.y.toFixed(1).padStart(5)} [${left.toFixed(1)}–${right.toFixed(1)}] × [${top.toFixed(1)}–${bot.toFixed(1)}]  ${el.w}×${el.h}mm`);
}

// Check for overlaps
let clean = true;
for (let i = 0; i < elements.length; i++) {
  for (let j = i + 1; j < elements.length; j++) {
    const a = elements[i], b = elements[j];
    const overlapX = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
    const overlapY = Math.abs(a.y - b.y) < (a.h + b.h) / 2;
    if (overlapX && overlapY) {
      console.log(`  ⚠ OVERLAP: ${a.label} ↔ ${b.label}`);
      clean = false;
    }
  }
}

// Check bounds
for (const el of elements) {
  if (el.x - el.w / 2 < 0) { console.log(`  ⚠ OUT OF BOUNDS (left): ${el.label}`); clean = false; }
  if (el.x + el.w / 2 > PAN_W) { console.log(`  ⚠ OUT OF BOUNDS (right): ${el.label}`); clean = false; }
  if (el.y - el.h / 2 < 0) { console.log(`  ⚠ OUT OF BOUNDS (top): ${el.label}`); clean = false; }
  if (el.y + el.h / 2 > PAN_H) { console.log(`  ⚠ OUT OF BOUNDS (bottom): ${el.label}`); clean = false; }
}
if (clean) console.log('  ✓ No overlaps or bounds violations');

// ── Build ExportConfig ─────────────────────────────────────────

const maxDepth = Math.max(...elements.map(e => e.depthBehind));
const depth = Math.max(50, maxDepth + 3 * 2 + 10);

const config: ExportConfig = {
  panel: {
    standard: '19',
    uHeight: 2,
    panelWidth: PAN_W,
    panelHeight: PAN_H,
    totalWidth: TOT_W,
  },
  enclosure: {
    depth,
    maxDeviceDepth: maxDepth,
    rearPanel: false,
    ventSlots: false,
    flangeDepth: 15,
    style: 'tray',
  },
  fabrication: {
    method: '3D Print',
    printer: 'BambuLab P2S',
    bed: [256, 256, 256],
    filament: 'PETG',
    wallThickness: 3,
    split: { type: 'none', parts: [{ name: 'Full Panel', w: TOT_W, fitsX: true, fitsY: true, color: '#4ade80' }] },
  } as FabConfig3DP,
  elements,
};

console.log(`\nEnclosure depth: ${depth}mm (max device: ${maxDepth}mm)`);
console.log('');

// ── Send to Fusion 360 bridge ──────────────────────────────────

async function sendBuild() {
  console.log('Connecting to Fusion 360 bridge (localhost:9100)...');

  try {
    const pingRes = await fetch('http://localhost:9100/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    const ping = await pingRes.json();
    console.log(`Connected: Fusion ${ping.fusion_version}, doc=${ping.document}`);
  } catch (err) {
    console.error('Cannot connect to Fusion 360 bridge. Is it running?');
    process.exit(1);
  }

  try {
    console.log('Building model...');
    const res = await fetch('http://localhost:9100/build', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, newDocument: true }),
      signal: AbortSignal.timeout(120000),
    });
    const result = await res.json();

    if (result.success) {
      console.log(`\n✅ Build successful!`);
      const features = result.features ?? [];
      const computed = features.filter((f: any) => f.computed).length;
      const failed = features.filter((f: any) => !f.computed);
      console.log(`  Features: ${computed}/${features.length} computed`);
      if (result.bodies) {
        console.log(`  Bodies: ${result.bodies.length}`);
        for (const b of result.bodies) {
          console.log(`    - ${b.name}: ${b.volume_cm3?.toFixed(2) ?? '?'} cm³, ${b.mass_g?.toFixed(1) ?? '?'} g`);
        }
      }
      if (failed.length > 0) {
        console.log(`  ⚠ ${failed.length} failed features:`);
        for (const f of failed) console.log(`    - ${f.name}: ${f.error ?? 'unknown error'}`);
      }
      if (result.warnings?.length) {
        for (const w of result.warnings) console.log(`  ⚠ ${w}`);
      }
    } else {
      console.error(`\n❌ Build failed: ${result.error}`);
      if (result.errors) for (const e of result.errors) console.error(`  ${e}`);
    }
  } catch (err) {
    console.error(`\n❌ Build error: ${err}`);
  }
}

sendBuild();
