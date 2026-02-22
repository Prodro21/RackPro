import type { ExportConfig, ExportElement, FabConfig3DP, RibGeometry } from '../types';
import { FANS } from '../constants/fans';
import { BORE_HOLES } from '../constants/eia310';
import { MOUNTING } from '../constants/mounting';
import { computeTrayDimensions, computeMountPositions, computeAlignPositions } from '../lib/trayGeometry';
import { computeTrayReinforcement } from '../lib/trayReinforcement';
import { lookupDevice } from '../constants/deviceLookup';

function L(s: string) { return s + '\n'; }
function comment(s: string) { return `// ${s}\n`; }
function section(s: string) { return `\n// ═══ ${s} ${'═'.repeat(Math.max(0, 60 - s.length))}\n`; }

/** Panel-relative X (from left) → OpenSCAD center-origin */
function sxN(elX: number, panW: number): number { return elX - panW / 2; }
/** Panel-relative Y (from top) → OpenSCAD center-origin (Y-up) */
function syN(elY: number, panH: number): number { return panH / 2 - elY; }
function fmt(n: number, d = 2): string { return n.toFixed(d); }

/** Compute auto-number index for an export element in its label group */
function computeScadAutoNumber(el: ExportElement, allElements: ExportElement[]): number {
  const sameGroup = allElements
    .filter(e => e.type === el.type &&
                 e.labelConfig?.text === el.labelConfig?.text &&
                 e.labelConfig?.autoNumber)
    .sort((a, b) => a.x - b.x);
  return sameGroup.findIndex(e => e === el) + 1;
}

/** Generate a debossed label module for OpenSCAD */
function labelModule(el: ExportElement, idx: number, panW: number, panH: number, wallT: number, allElements: ExportElement[]): string {
  const lc = el.labelConfig!;
  const displayText = lc.autoNumber
    ? `${lc.text} ${computeScadAutoNumber(el, allElements)}`
    : lc.text;

  const cx = fmt(sxN(el.x, panW));
  // Compute Y offset based on position
  let yOffset: number;
  switch (lc.position) {
    case 'above': yOffset = el.h / 2 + 4; break;  // above cutout (OpenSCAD Y-up)
    case 'inside': yOffset = 0; break;
    case 'below': default: yOffset = -(el.h / 2 + 5); break;  // below cutout
  }
  const cy = fmt(syN(el.y, panH) + yOffset);

  return [
    `module label_${idx}() {`,
    `  // Label: "${displayText}"`,
    `  translate([${cx}, ${cy}, ${fmt(wallT - 0.3)}])`,
    `    linear_extrude(height = 0.4)`,
    `      text("${displayText}", size = 3, halign = "center", valign = "center",`,
    `           font = "Liberation Sans");`,
    `}`,
  ].join('\n');
}

function cutoutModule(el: ExportElement, idx: number, panW: number, panH: number): string {
  const tol = 0.2;
  const id = `cutout_${idx}`;
  const cx = fmt(sxN(el.x, panW));
  const cy = fmt(syN(el.y, panH));

  switch (el.cutout) {
    case 'round': {
      const r = (el.radius ?? el.w / 2) + tol / 2;
      return [
        `module ${id}() {`,
        `  // ${el.label} — round ⌀${fmt(r * 2)}mm`,
        `  translate([${cx}, ${cy}, -eps])`,
        `    cylinder(h = wall_t + eps*2, r = ${fmt(r, 3)}, $fn = 64);`,
        `}`,
      ].join('\n');
    }

    case 'd-shape': {
      const r = (el.radius ?? el.w / 2) + tol / 2;
      // Neutrik D-type: circle with flat bottom, flat removes ~25% (max 3mm)
      const flatCut = Math.min(r * 0.25, 3);
      return [
        `module ${id}() {`,
        `  // ${el.label} — D-shape r=${fmt(r)}mm`,
        `  translate([${cx}, ${cy}, -eps])`,
        `    intersection() {`,
        `      cylinder(h = wall_t + eps*2, r = ${fmt(r, 3)}, $fn = 64);`,
        `      translate([0, ${fmt(flatCut / 2, 3)}, 0])`,
        `        cube([${fmt(r * 2 + 1, 1)}, ${fmt(r * 2 - flatCut, 3)}, wall_t + eps*2 + 1], center = true);`,
        `    }`,
        `}`,
      ].join('\n');
    }

    case 'rect':
      return [
        `module ${id}() {`,
        `  // ${el.label} — rect ${el.w}×${el.h}mm`,
        `  translate([${cx}, ${cy}, -eps])`,
        `    cube([${fmt(el.w + tol)}, ${fmt(el.h + tol)}, wall_t + eps*2], center = true);`,
        `}`,
      ].join('\n');

    case 'd-sub': {
      const w = el.w + tol;
      const h = el.h + tol;
      const taper = 2.5;
      return [
        `module ${id}() {`,
        `  // ${el.label} — D-sub ${el.w}×${el.h}mm`,
        `  translate([${cx}, ${cy}, -eps])`,
        `    linear_extrude(height = wall_t + eps*2)`,
        `      hull() {`,
        `        translate([${fmt(-w / 2 + 1)}, ${fmt(-h / 2)}]) circle(r = 1, $fn = 16);`,
        `        translate([${fmt(w / 2 - 1)}, ${fmt(-h / 2)}]) circle(r = 1, $fn = 16);`,
        `        translate([${fmt(-w / 2 + taper + 1)}, ${fmt(h / 2)}]) circle(r = 1, $fn = 16);`,
        `        translate([${fmt(w / 2 - taper - 1)}, ${fmt(h / 2)}]) circle(r = 1, $fn = 16);`,
        `      }`,
        `}`,
      ].join('\n');
    }

    default:
      return [
        `module ${id}() {`,
        `  // ${el.label} — fallback rect`,
        `  translate([${cx}, ${cy}, -eps])`,
        `    cube([${fmt(el.w + tol)}, ${fmt(el.h + tol)}, wall_t + eps*2], center = true);`,
        `}`,
      ].join('\n');
  }
}

export function generateOpenSCAD(config: ExportConfig): string {
  if (config.assembly?.mode === 'modular') {
    return emitModularSCAD(config);
  }
  return emitMonolithicSCAD(config);
}

function emitMonolithicSCAD(config: ExportConfig): string {
  const fab = config.fabrication as FabConfig3DP;
  const { panelWidth: panW, panelHeight: panH, totalWidth: totW, uHeight, mountHoleType } = config.panel;
  const boreR = (BORE_HOLES[mountHoleType ?? '#10-32']?.diameter ?? 4.83) / 2;
  const wallT = fab.wallThickness;
  const flangeD = config.enclosure.flangeDepth;
  const depth = config.enclosure.depth;
  const split = fab.split;
  const earW = 15.875;
  const rackH = uHeight * 44.45; // full rack height (for bore positioning)

  const out: string[] = [];

  // ─── Preamble ───
  out.push(
    comment('RackPro — Generated OpenSCAD File'),
    comment(`Standard: ${config.panel.standard}" rack, ${uHeight}U`),
    comment(`Generated: ${new Date().toISOString()}`),
    comment('Requires BOSL2 library: https://github.com/BelfrySCAD/BOSL2'),
    L('include <BOSL2/std.scad>'),
    L(''),
  );

  // ─── Constants ───
  out.push(
    section('Constants'),
    L(`total_width   = ${totW};`),
    L(`panel_width   = ${panW};`),
    L(`panel_height  = ${fmt(panH)};`),
    L(`ear_width     = ${earW};  // 0.625"`),
    L(`bore_center_x = panel_width/2 + ear_width/2;  // X center of each ear`),
    L(`bore_r        = ${fmt(boreR)};  // ${mountHoleType ?? '#10-32'} mounting hole radius`),
    L(''),
    L(`wall_t        = ${wallT};`),
    L(`flange_depth  = ${flangeD};`),
    L(`enclosure_d   = ${fmt(depth, 1)};`),
    L(''),
    L('BASE_UNIT     = 15;'),
    L('BASE_STRENGTH = 2;'),
    L('BASE_CHAMFER  = 1;'),
    L('TOLERANCE     = 0.2;'),
    L('LOCKPIN_HOLE  = 4;'),
    L('LOCKPIN_CHAMF = 0.8;'),
    L('LOCKPIN_OUTER = BASE_UNIT + BASE_STRENGTH*2 + TOLERANCE*2;'),
    L('eps = 0.02;'),
    L(`has_rear_panel = ${config.enclosure.rearPanel ? 'true' : 'false'};`),
    L(`has_vent_slots = ${config.enclosure.ventSlots ? 'true' : 'false'};`),
    L(''),
  );

  // ─── Bore pattern ───
  // EIA-310: 6.35, 22.225, 38.1mm from top of each U (equal 15.875mm spacing)
  const boreYs: number[] = [];
  for (let u = 0; u < uHeight; u++) {
    const base = u * 44.45;
    boreYs.push(base + 6.35, base + 22.225, base + 38.1);
  }
  // Convert to center-origin Y using rack height
  const boreScadYs = boreYs.map(by => rackH / 2 - by);

  out.push(
    section('Mounting Bore Pattern'),
    L('module rack_bore(x_pos, y_pos) {'),
    L('  translate([x_pos, y_pos, -eps])'),
    L('    hull() {'),
    L('      translate([0, -2.25, 0]) cylinder(h = wall_t + eps*2, r = bore_r, $fn = 32);'),
    L('      translate([0,  2.25, 0]) cylinder(h = wall_t + eps*2, r = bore_r, $fn = 32);'),
    L('    }'),
    L('}'),
    L(''),
    L('module all_bores() {'),
  );
  for (const by of boreScadYs) {
    out.push(
      L(`  rack_bore(-bore_center_x, ${fmt(by, 4)});`),
      L(`  rack_bore( bore_center_x, ${fmt(by, 4)});`),
    );
  }
  out.push(L('}'), L(''));

  // ─── Lockpin joint ───
  out.push(
    section('Lockpin Joint'),
    L('module lock_pin_hole(s, chamfer) {'),
    L('  translate([0, 0, -eps])'),
    L('    cube([s, s, wall_t + eps*2], center = true);'),
    L('  cs = s + chamfer*2;'),
    L('  translate([0, 0, wall_t - chamfer/2])'),
    L('    cube([cs, cs, chamfer + eps], center = true);'),
    L('}'),
    L(''),
    L('module mountbar(w, h, d) {'),
    L('  difference() {'),
    L('    cube([w, h, d], center = true);'),
    L('    translate([0, -BASE_UNIT/2, 0]) lock_pin_hole(LOCKPIN_HOLE, LOCKPIN_CHAMF);'),
    L('    translate([0,  BASE_UNIT/2, 0]) lock_pin_hole(LOCKPIN_HOLE, LOCKPIN_CHAMF);'),
    L('  }'),
    L('}'),
    L(''),
  );

  // ─── Cutout modules ───
  const connectors = config.elements.filter(e => e.type === 'connector');
  const devices = config.elements.filter(e => e.type === 'device');

  out.push(section('Cutout Modules'));
  connectors.forEach((el, i) => {
    out.push(L(cutoutModule(el, i, panW, panH)), L(''));
  });
  out.push(
    L('module all_cutouts() {'),
    ...connectors.map((_, i) => L(`  cutout_${i}();`)),
    L('}'), L(''),
  );

  // ─── Label modules (debossed text) ───
  const labeledElements = config.elements.filter(e => e.labelConfig?.text);
  if (labeledElements.length > 0) {
    out.push(section('Label Modules'));
    labeledElements.forEach((el, i) => {
      out.push(L(labelModule(el, i, panW, panH, wallT, config.elements)), L(''));
    });
    out.push(
      L('module all_labels() {'),
      ...labeledElements.map((_, i) => L(`  label_${i}();`)),
      L('}'), L(''),
    );
  }

  // ─── Device bay openings ───
  out.push(section('Device Bay Openings'), L('module device_bays() {'));
  devices.forEach((el) => {
    const cx = fmt(sxN(el.x, panW));
    const cy = fmt(syN(el.y, panH));
    out.push(
      L(`  // ${el.label} — ${el.w}×${el.h}mm`),
      L(`  translate([${cx}, ${cy}, -eps])`),
      L(`    cube([${fmt(el.w + 0.2)}, ${fmt(el.h + 0.2)}, wall_t + eps*2], center = true);`),
    );
  });
  out.push(L('}'), L(''));

  // ─── Device trays ───
  out.push(section('Device Trays'), L('module device_trays() {'));
  devices.forEach((el) => {
    const cx = sxN(el.x, panW);
    const cy = syN(el.y, panH);
    const td = el.depthBehind;
    const tw = 2 + Math.max(0, (td - 100) * 0.02);
    const zc = -(wallT / 2 + td / 2);
    const totalW = el.w + tw * 2;
    const useHex = el.floorStyle === 'hex';
    const hexFrame = Math.min(totalW, td) >= 45 ? 15 : 2;
    out.push(
      L(`  // Tray: ${el.label} — ${el.w}×${td}mm deep${useHex ? ' (hex lightweighted)' : ''}`),
      L(`  // Floor`),
      L(`  translate([${fmt(cx)}, ${fmt(cy - el.h / 2 - tw / 2)}, ${fmt(zc, 1)}])`),
    );
    if (useHex) {
      out.push(L(`    hex_panel([${fmt(totalW)}, ${fmt(td, 1)}, ${fmt(tw)}], strut=BASE_STRENGTH, spacing=BASE_UNIT/2, frame=${hexFrame});`));
    } else {
      out.push(L(`    cube([${fmt(totalW)}, ${fmt(tw)}, ${fmt(td, 1)}], center = true);`));
    }
    out.push(
      L(`  // Left wall`),
      L(`  translate([${fmt(cx - el.w / 2 - tw / 2)}, ${fmt(cy)}, ${fmt(zc, 1)}])`),
      L(`    cube([${fmt(tw)}, ${fmt(el.h)}, ${fmt(td, 1)}], center = true);`),
      L(`  // Right wall`),
      L(`  translate([${fmt(cx + el.w / 2 + tw / 2)}, ${fmt(cy)}, ${fmt(zc, 1)}])`),
      L(`    cube([${fmt(tw)}, ${fmt(el.h)}, ${fmt(td, 1)}], center = true);`),
    );
  });
  out.push(L('}'), L(''));

  // ─── Enclosure walls ───
  out.push(
    section('Enclosure'),
    L('module enclosure_walls() {'),
    L('  // Top wall — overlaps faceplate by eps for clean union'),
    L('  translate([0, panel_height/2 + wall_t/2 - eps, -(enclosure_d/2)])'),
    L('    cube([panel_width, wall_t + eps, enclosure_d + wall_t], center = true);'),
    L('  // Bottom wall'),
    L('  translate([0, -(panel_height/2 + wall_t/2 - eps), -(enclosure_d/2)])'),
    L('    cube([panel_width, wall_t + eps, enclosure_d + wall_t], center = true);'),
    L('}'),
    L(''),
    L('module flanges() {'),
    L('  // Top flange — retention lip inside panel area'),
    L('  translate([0, panel_height/2 - wall_t/2, -(flange_depth/2)])'),
    L('    cube([panel_width, wall_t + eps, flange_depth + wall_t], center = true);'),
    L('  // Bottom flange'),
    L('  translate([0, -(panel_height/2 - wall_t/2), -(flange_depth/2)])'),
    L('    cube([panel_width, wall_t + eps, flange_depth + wall_t], center = true);'),
    L('}'),
    L(''),
  );

  // ─── Rear panel ───
  const rearFanEls = config.elements.filter(e => e.type === 'fan' && e.surface === 'rear');

  if (config.enclosure.rearPanel) {
    out.push(L('module rear_panel() {'), L('  if (has_rear_panel) {'));
    out.push(L('    translate([0, 0, -(wall_t/2 + enclosure_d)])'));
    if (config.enclosure.ventSlots || rearFanEls.length > 0) {
      out.push(
        L('    difference() {'),
        L('      cube([panel_width, panel_height, wall_t], center = true);'),
      );
      if (config.enclosure.ventSlots) {
        out.push(
          L('      for (i = [-4:4])'),
          L('        translate([i * 15, 0, 0])'),
          L('          cube([8, panel_height * 0.6, wall_t + eps*2], center = true);'),
        );
      }
      // Rear fan cutouts in rear panel
      rearFanEls.forEach((el, i) => {
        const fan = FANS[el.key];
        if (!fan) return;
        const cx = fmt(sxN(el.x, panW));
        const cy = fmt(syN(el.y, panH));
        out.push(
          L(`      // Rear fan ${i}: ${fan.name}`),
          L(`      translate([${cx}, ${cy}, 0]) {`),
          L(`        cylinder(h = wall_t + eps*2, r = ${fmt(fan.cutoutDiameter / 2)}, $fn = 64, center = true);`),
        );
        const hs = fan.holeSpacing / 2;
        for (const [dx, dy] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
          out.push(L(`        translate([${fmt(dx * hs)}, ${fmt(dy * hs)}, 0]) cylinder(h = wall_t + eps*2, r = ${fmt(fan.holeDiameter / 2)}, $fn = 24, center = true);`));
        }
        out.push(L(`      }`));
      });
      out.push(L('    }'));
    } else {
      out.push(L('    cube([panel_width, panel_height, wall_t], center = true);'));
    }
    out.push(L('  }'), L('}'), L(''));
  }

  // ─── Fan cutouts ───
  const fans = config.elements.filter(e => e.type === 'fan');
  if (fans.length > 0) {
    out.push(section('Fan Cutout Modules'));
    fans.forEach((el, i) => {
      const fan = FANS[el.key];
      if (!fan) return;
      const cx = fmt(sxN(el.x, panW));
      const cy = fmt(syN(el.y, panH));
      out.push(
        L(`module fan_cutout_${i}() {`),
        L(`  // ${el.label} — ${fan.size}mm fan`),
        L(`  translate([${cx}, ${cy}, -eps]) {`),
        L(`    // Center bore`),
        L(`    cylinder(h = wall_t + eps*2, r = ${fmt(fan.cutoutDiameter / 2, 3)}, $fn = 64);`),
        L(`    // 4 bolt holes (${fan.holeSpacing}mm spacing)`),
      );
      const hs = fan.holeSpacing / 2;
      for (const [dx, dy] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        out.push(L(`    translate([${fmt(dx * hs)}, ${fmt(dy * hs)}, 0]) cylinder(h = wall_t + eps*2, r = ${fmt(fan.holeDiameter / 2, 3)}, $fn = 24);`));
      }
      out.push(L(`  }`), L(`}`), L(''));
    });
    out.push(
      L('module all_fan_cutouts() {'),
      ...fans.map((_, i) => L(`  fan_cutout_${i}();`)),
      L('}'), L(''),
    );
  }

  // ─── Reinforcement ribs ───
  const ribs = config.reinforcement ?? [];
  if (ribs.length > 0) {
    out.push(section('Reinforcement Ribs'));
    out.push(L('module reinforcement_ribs() {'));
    ribs.forEach((rib, i) => {
      const rx = fmt(sxN(rib.x, panW));
      const ry = fmt(syN(rib.y, panH));
      const zc = fmt(-(wallT / 2 + rib.depth / 2));
      if (rib.type === 'stiffener-wedge') {
        out.push(
          L(`  // ${rib.reason}`),
          L(`  translate([${rx}, ${ry}, ${zc}])`),
          L(`    polyhedron(`),
          L(`      points = [[0,0,0], [${fmt(rib.w)},0,0], [0,${fmt(rib.h)},0], [0,0,${fmt(rib.depth)}]],`),
          L(`      faces = [[0,2,1],[0,1,3],[1,2,3],[0,3,2]]`),
          L(`    );`),
        );
      } else {
        out.push(
          L(`  // ${rib.reason}`),
          L(`  translate([${rx}, ${ry}, ${zc}])`),
          L(`    cube([${fmt(rib.w)}, ${fmt(rib.h)}, ${fmt(rib.depth)}], center = true);`),
        );
      }
    });
    out.push(L('}'), L(''));
  }

  // ─── Ears ───
  out.push(
    section('Mounting Ears'),
    L('module ears() {'),
    L('  // eps overlap with faceplate for clean union'),
    L('  translate([-(panel_width/2 + ear_width/2), 0, 0])'),
    L('    cube([ear_width + eps, panel_height, wall_t], center = true);'),
    L('  translate([(panel_width/2 + ear_width/2), 0, 0])'),
    L('    cube([ear_width + eps, panel_height, wall_t], center = true);'),
    L('}'),
    L(''),
  );

  // ─── Main Assembly ───
  out.push(section('Main Assembly'));

  if (split.type === 'none' || split.type === '2-piece') {
    out.push(
      L('module rackmount_full() {'),
      L('  difference() {'),
      L('    union() {'),
      L('      cube([panel_width, panel_height, wall_t], center = true);'),
      L('      ears();'),
      L('      enclosure_walls();'),
      L('      flanges();'),
    );
    if (devices.length > 0) out.push(L('      device_trays();'));
    if (config.enclosure.rearPanel) out.push(L('      rear_panel();'));
    if (ribs.length > 0) out.push(L('      reinforcement_ribs();'));
    out.push(L('    }'));
    if (connectors.length > 0) out.push(L('    all_cutouts();'));
    if (devices.length > 0) out.push(L('    device_bays();'));
    if (fans.length > 0) out.push(L('    all_fan_cutouts();'));
    out.push(L('    all_bores();'));
    if (labeledElements.length > 0) out.push(L('    all_labels();'));
    out.push(L('  }'), L('}'), L(''));

    if (split.type === '2-piece') {
      out.push(
        comment('2-piece center split — dovetail + M3 bolts'),
        L('module rackmount_left() {'),
        L('  intersection() {'),
        L('    rackmount_full();'),
        L('    translate([-total_width/4, 0, -(enclosure_d/2)])'),
        L('      cube([total_width/2 + 1, panel_height + 50, enclosure_d + wall_t + 20], center = true);'),
        L('  }'),
        L('}'),
        L(''),
        L('module rackmount_right() {'),
        L('  intersection() {'),
        L('    rackmount_full();'),
        L('    translate([total_width/4, 0, -(enclosure_d/2)])'),
        L('      cube([total_width/2 + 1, panel_height + 50, enclosure_d + wall_t + 20], center = true);'),
        L('  }'),
        L('}'),
        L(''),
        L('// Render: choose one'),
        L('// rackmount_left();'),
        L('// rackmount_right();'),
        L('rackmount_full();'),
      );
    } else {
      out.push(L('rackmount_full();'));
    }
  } else {
    // 3-piece split
    const connOvl = split.connectorOverlap ?? 17.2;
    const earTotalW = earW + connOvl + 5;
    const centerW = totW - earTotalW * 2;
    const mbW = split.mountbarW ?? 15;

    out.push(
      comment('3-piece split: Center + 2 Side Ears (HomeRacker style)'),
      L(`center_width  = ${fmt(centerW)};`),
      L(`ear_total_w   = ${fmt(earTotalW)};`),
      L(`mountbar_w    = ${mbW};`),
      L(`connector_ovl = ${fmt(connOvl)};`),
      L(''),
      L('module rackmount_center() {'),
      L('  difference() {'),
      L('    union() {'),
      L('      cube([center_width, panel_height, wall_t], center = true);'),
      L('      translate([-center_width/2 + mountbar_w/2, 0, -(wall_t/2 + mountbar_w/2)])'),
      L('        mountbar(mountbar_w, panel_height, mountbar_w);'),
      L('      translate([ center_width/2 - mountbar_w/2, 0, -(wall_t/2 + mountbar_w/2)])'),
      L('        mountbar(mountbar_w, panel_height, mountbar_w);'),
      L('      enclosure_walls();'),
      L('      flanges();'),
    );
    if (devices.length > 0) out.push(L('      device_trays();'));
    if (config.enclosure.rearPanel) out.push(L('      rear_panel();'));
    if (ribs.length > 0) out.push(L('      reinforcement_ribs();'));
    out.push(L('    }'));
    if (connectors.length > 0) out.push(L('    all_cutouts();'));
    if (devices.length > 0) out.push(L('    device_bays();'));
    if (fans.length > 0) out.push(L('    all_fan_cutouts();'));
    if (labeledElements.length > 0) out.push(L('    all_labels();'));
    out.push(
      L('  }'),
      L('}'),
      L(''),
      L('module rackmount_side(mirror_x = false) {'),
      L('  m = mirror_x ? -1 : 1;'),
      L('  translate([m * (center_width/2 + ear_total_w/2 + TOLERANCE/2), 0, 0])'),
      L('    difference() {'),
      L('      union() {'),
      L('        cube([ear_total_w, panel_height, wall_t], center = true);'),
      L('        translate([-m * (ear_total_w/2 - connector_ovl/2), 0, -(wall_t/2 + (BASE_UNIT + BASE_STRENGTH)/2)])'),
      L('          difference() {'),
      L('            cube([connector_ovl, panel_height, BASE_UNIT + BASE_STRENGTH*2], center = true);'),
      L('            cube([mountbar_w + TOLERANCE, panel_height + eps, BASE_UNIT + TOLERANCE], center = true);'),
      L('          }'),
      L('      }'),
    );
    for (const by of boreScadYs) {
      out.push(
        L(`      translate([0, ${fmt(by, 4)}, -eps]) hull() { translate([0, -2.25, 0]) cylinder(h = wall_t + eps*2, r = bore_r, $fn = 32); translate([0, 2.25, 0]) cylinder(h = wall_t + eps*2, r = bore_r, $fn = 32); }`),
      );
    }
    out.push(
      L('    }'),
      L('}'),
      L(''),
      L('// Render: choose one or all'),
      L('rackmount_center();'),
      L('// translate([0, -60, 0]) rackmount_side(false);'),
      L('// translate([0,  60, 0]) rackmount_side(true);'),
    );
  }

  return out.join('');
}

// ═══ Modular OpenSCAD Build ═══

function emitModularSCAD(config: ExportConfig): string {
  const fab = config.fabrication as FabConfig3DP;
  const { panelWidth: panW, panelHeight: panH, totalWidth: totW, uHeight, mountHoleType } = config.panel;
  const boreR = (BORE_HOLES[mountHoleType ?? '#10-32']?.diameter ?? 4.83) / 2;
  const wallT = fab.wallThickness;
  const flangeD = config.enclosure.flangeDepth;
  const depth = config.enclosure.depth;
  const earW = 15.875;
  const rackH = uHeight * 44.45;
  const assembly = config.assembly!;
  const connectors = config.elements.filter(e => e.type === 'connector');
  const devices = config.elements.filter(e => e.type === 'device');

  const out: string[] = [];

  out.push(
    comment('RackPro — Generated OpenSCAD File (Modular Assembly)'),
    comment(`Standard: ${config.panel.standard}" rack, ${uHeight}U`),
    comment(`Assembly: faceplate=${assembly.faceFab}, trays=${assembly.trayFab}`),
    comment(`Generated: ${new Date().toISOString()}`),
    comment('Requires BOSL2 library: https://github.com/BelfrySCAD/BOSL2'),
    L('include <BOSL2/std.scad>'),
    L(''),
  );

  // Constants
  out.push(
    section('Constants'),
    L(`total_width   = ${totW};`),
    L(`panel_width   = ${panW};`),
    L(`panel_height  = ${fmt(panH)};`),
    L(`ear_width     = ${earW};`),
    L(`bore_center_x = panel_width/2 + ear_width/2;`),
    L(`bore_r        = ${fmt(boreR)};  // ${mountHoleType ?? '#10-32'} mounting hole radius`),
    L(''),
    L(`wall_t        = ${wallT};`),
    L(`flange_depth  = ${flangeD};`),
    L(`enclosure_d   = ${fmt(depth, 1)};`),
    L('eps = 0.02;'),
    L(''),
    L('BASE_UNIT     = 15;'),
    L('BASE_STRENGTH = 2;'),
    L(''),
    L(`// Mounting interface`),
    L(`boss_dia      = ${MOUNTING.BOSS_DIA};`),
    L(`boss_height   = ${MOUNTING.BOSS_HEIGHT};`),
    L(`tab_width     = ${MOUNTING.TAB_WIDTH};`),
    L(`tab_depth     = ${MOUNTING.TAB_DEPTH};`),
    L(`clearance_hole = ${MOUNTING.CLEARANCE_HOLE};`),
    L(`pilot_hole    = ${MOUNTING.PILOT_HOLE};`),
    L(`align_pin_dia = ${MOUNTING.ALIGN_PIN_DIA};`),
    L(`align_pin_depth = ${MOUNTING.ALIGN_PIN_DEPTH};`),
    L(''),
  );

  // Bore pattern
  const boreYs: number[] = [];
  for (let u = 0; u < uHeight; u++) {
    const base = u * 44.45;
    boreYs.push(base + 6.35, base + 22.225, base + 38.1);
  }
  const boreScadYs = boreYs.map(by => rackH / 2 - by);

  out.push(
    section('Mounting Bore Pattern'),
    L('module rack_bore(x_pos, y_pos) {'),
    L('  translate([x_pos, y_pos, -eps])'),
    L('    hull() {'),
    L('      translate([0, -2.25, 0]) cylinder(h = wall_t + eps*2, r = bore_r, $fn = 32);'),
    L('      translate([0,  2.25, 0]) cylinder(h = wall_t + eps*2, r = bore_r, $fn = 32);'),
    L('    }'),
    L('}'),
    L(''),
    L('module all_bores() {'),
  );
  for (const by of boreScadYs) {
    out.push(
      L(`  rack_bore(-bore_center_x, ${fmt(by, 4)});`),
      L(`  rack_bore( bore_center_x, ${fmt(by, 4)});`),
    );
  }
  out.push(L('}'), L(''));

  // Cutout modules (reuse from monolithic)
  out.push(section('Cutout Modules'));
  connectors.forEach((el, i) => {
    out.push(L(cutoutModule(el, i, panW, panH)), L(''));
  });
  out.push(
    L('module all_cutouts() {'),
    ...connectors.map((_, i) => L(`  cutout_${i}();`)),
    L('}'), L(''),
  );

  // Label modules (debossed text)
  const labeledElements = config.elements.filter(e => e.labelConfig?.text);
  if (labeledElements.length > 0) {
    out.push(section('Label Modules'));
    labeledElements.forEach((el, i) => {
      out.push(L(labelModule(el, i, panW, panH, wallT, config.elements)), L(''));
    });
    out.push(
      L('module all_labels() {'),
      ...labeledElements.map((_, i) => L(`  label_${i}();`)),
      L('}'), L(''),
    );
  }

  // Device bay openings
  out.push(section('Device Bay Openings'), L('module device_bays() {'));
  devices.forEach((el) => {
    const cx = fmt(sxN(el.x, panW));
    const cy = fmt(syN(el.y, panH));
    out.push(
      L(`  translate([${cx}, ${cy}, -eps])`),
      L(`    cube([${fmt(el.w + 0.2)}, ${fmt(el.h + 0.2)}, wall_t + eps*2], center = true);`),
    );
  });
  out.push(L('}'), L(''));

  // Faceplate assembly module
  out.push(
    section('Faceplate Assembly'),
    L('module faceplate_assembly() {'),
    L('  difference() {'),
    L('    union() {'),
    L('      // Faceplate + ears'),
    L('      cube([panel_width, panel_height, wall_t], center = true);'),
    L('      translate([-(panel_width/2 + ear_width/2), 0, 0]) cube([ear_width + eps, panel_height, wall_t], center = true);'),
    L('      translate([ (panel_width/2 + ear_width/2), 0, 0]) cube([ear_width + eps, panel_height, wall_t], center = true);'),
    L('      // Enclosure walls'),
    L('      translate([0, panel_height/2 + wall_t/2 - eps, -(enclosure_d/2)]) cube([panel_width, wall_t + eps, enclosure_d + wall_t], center = true);'),
    L('      translate([0, -(panel_height/2 + wall_t/2 - eps), -(enclosure_d/2)]) cube([panel_width, wall_t + eps, enclosure_d + wall_t], center = true);'),
    L('      // Flanges'),
    L('      translate([0, panel_height/2 - wall_t/2, -(flange_depth/2)]) cube([panel_width, wall_t + eps, flange_depth + wall_t], center = true);'),
    L('      translate([0, -(panel_height/2 - wall_t/2), -(flange_depth/2)]) cube([panel_width, wall_t + eps, flange_depth + wall_t], center = true);'),
  );

  // Mounting bosses
  for (const el of devices) {
    const mounts = computeMountPositions(el, wallT);
    for (const mp of mounts) {
      const cx = fmt(sxN(mp.x, panW));
      const cy = fmt(syN(mp.y, panH));
      out.push(L(`      translate([${cx}, ${cy}, -(wall_t/2 + boss_height/2)]) cylinder(h = boss_height, r = boss_dia/2, $fn = 32, center = true);`));
    }
  }

  // Alignment pins
  for (const el of devices) {
    const aligns = computeAlignPositions(el, wallT);
    for (const ap of aligns) {
      const cx = fmt(sxN(ap.x, panW));
      const cy = fmt(syN(ap.y, panH));
      out.push(L(`      translate([${cx}, ${cy}, -(wall_t/2 + align_pin_depth/2)]) cylinder(h = align_pin_depth, r = align_pin_dia/2, $fn = 32, center = true);`));
    }
  }

  out.push(L('    }'));
  // Cuts
  if (connectors.length > 0) out.push(L('    all_cutouts();'));
  if (devices.length > 0) out.push(L('    device_bays();'));
  out.push(L('    all_bores();'));
  if (labeledElements.length > 0) out.push(L('    all_labels();'));

  // Boss pilot holes
  for (const el of devices) {
    const mounts = computeMountPositions(el, wallT);
    for (const mp of mounts) {
      const cx = fmt(sxN(mp.x, panW));
      const cy = fmt(syN(mp.y, panH));
      out.push(L(`    translate([${cx}, ${cy}, -boss_height - wall_t]) cylinder(h = boss_height + wall_t + eps*2, r = pilot_hole/2, $fn = 24);`));
    }
  }

  out.push(L('  }'), L('}'), L(''));

  // Per-device tray modules
  devices.forEach((el, i) => {
    const dev = lookupDevice(el.key);
    const devWt = dev?.wt ?? 1;
    const devH = dev?.h ?? el.h;
    const dims = computeTrayDimensions(el, wallT, assembly.trayFab);
    const mounts = computeMountPositions(el, wallT);
    const reinf = computeTrayReinforcement(
      { el, weight: devWt, deviceH: devH },
      dims.innerW, dims.innerD, dims.floorT, dims.wallT, assembly.trayFab,
    );
    const cx = sxN(el.x, panW);
    const cy = syN(el.y, panH);

    const useHex = el.floorStyle === 'hex';
    const hexFrame = Math.min(dims.totalW, dims.totalD) >= 45 ? 15 : 2;

    out.push(
      section(`Device Tray ${i}: ${el.label}`),
      L(`module device_tray_${i}() {`),
      L(`  // Floor${useHex ? ' (hex lightweighted)' : ''}`),
      L(`  translate([${fmt(cx)}, ${fmt(cy - el.h / 2 - dims.floorT / 2)}, -(wall_t/2 + ${fmt(dims.totalD / 2)})])`),
    );
    if (useHex) {
      out.push(L(`    hex_panel([${fmt(dims.totalW)}, ${fmt(dims.totalD)}, ${fmt(dims.floorT)}], strut=BASE_STRENGTH, spacing=BASE_UNIT/2, frame=${hexFrame});`));
    } else {
      out.push(L(`    cube([${fmt(dims.totalW)}, ${fmt(dims.floorT)}, ${fmt(dims.totalD)}], center = true);`));
    }
    out.push(
      L(`  // Left wall`),
      L(`  translate([${fmt(cx - dims.innerW / 2 - dims.wallT / 2)}, ${fmt(cy)}, -(wall_t/2 + ${fmt(dims.totalD / 2)})])`),
      L(`    cube([${fmt(dims.wallT)}, ${fmt(dims.sideH)}, ${fmt(dims.totalD)}], center = true);`),
      L(`  // Right wall`),
      L(`  translate([${fmt(cx + dims.innerW / 2 + dims.wallT / 2)}, ${fmt(cy)}, -(wall_t/2 + ${fmt(dims.totalD / 2)})])`),
      L(`    cube([${fmt(dims.wallT)}, ${fmt(dims.sideH)}, ${fmt(dims.totalD)}], center = true);`),
    );

    // Mounting tabs
    for (const mp of mounts) {
      out.push(
        L(`  // Tab at ${mp.side}`),
        L(`  translate([${fmt(sxN(mp.x, panW))}, ${fmt(syN(mp.y, panH))}, -wall_t/2])`),
        L(`    difference() {`),
        L(`      cube([tab_width, tab_depth, ${fmt(dims.wallT)}], center = true);`),
        L(`      cylinder(h = ${fmt(dims.wallT)} + eps*2, r = clearance_hole/2, $fn = 24, center = true);`),
        L(`    }`),
      );
    }

    // Floor ribs
    reinf.floorRibs.forEach((rib) => {
      out.push(
        L(`  // Floor rib`),
        L(`  translate([${fmt(cx + rib.x)}, ${fmt(cy - el.h / 2 - dims.floorT - rib.h / 2)}, -(wall_t/2 + ${fmt(dims.totalD / 2)})])`),
        L(`    cube([${fmt(rib.w)}, ${fmt(rib.h)}, ${fmt(rib.d)}], center = true);`),
      );
    });

    // Rear stoppers
    reinf.rearStoppers.forEach((rs) => {
      out.push(
        L(`  // Rear stopper`),
        L(`  translate([${fmt(cx + rs.x)}, ${fmt(cy)}, -(wall_t/2 + ${fmt(dims.totalD)} - ${fmt(rs.d / 2)})])`),
        L(`    cube([${fmt(rs.w)}, ${fmt(rs.h)}, ${fmt(rs.d)}], center = true);`),
      );
    });

    out.push(L('}'), L(''));
  });

  // Main assembly
  out.push(
    section('Modular Assembly'),
    L('// Render faceplate'),
    L('faceplate_assembly();'),
    L(''),
  );
  devices.forEach((_, i) => {
    out.push(L(`// Tray ${i}`), L(`device_tray_${i}();`), L(''));
  });

  return out.join('');
}
