import type { ExportConfig, ExportElement, FabConfigSM } from '../types';
import { FANS } from '../constants/fans';
import { BORE_HOLES, BASE } from '../constants/eia310';
import { MOUNTING } from '../constants/mounting';
import { holeToEdge } from '../constants/materials';
import { computeTrayDimensions, computeMountPositions, computeAlignPositions } from '../lib/trayGeometry';

/** Compute auto-number index for an export element in its label group */
function computeExportAutoNumber(el: ExportElement, allElements: ExportElement[]): number {
  const sameGroup = allElements
    .filter(e => e.type === el.type &&
                 e.labelConfig?.text === el.labelConfig?.text &&
                 e.labelConfig?.autoNumber)
    .sort((a, b) => a.x - b.x);
  return sameGroup.findIndex(e => e === el) + 1;
}

/**
 * Generates an ASCII DXF R12 flat pattern for sheet metal fabrication.
 * Layers:
 *   0-OUTLINE  — cut lines (red, color 1)
 *   1-BEND     — fold lines (blue dashed, color 5)
 *   2-CUTOUTS  — holes/openings (green, color 3)
 *   3-DIMS     — annotation text (gray, color 8)
 */
export function generateDXF(config: ExportConfig): string {
  const sm = config.fabrication as FabConfigSM;
  const { panelWidth: panW, panelHeight: panH, totalWidth: totW } = config.panel;
  const { flangeDepth, rearPanel, ventSlots } = config.enclosure;
  const ba90 = sm.ba90;
  const earW = 15.875;

  // Flat pattern dimensions: panel + bend allowances for top/bottom flanges
  const flatW = totW + 2 * (flangeDepth + ba90);
  const flatH = panH + 2 * (flangeDepth + ba90);

  // Offsets: the panel area starts offset by flange+BA from the flat pattern edge
  const offX = flangeDepth + ba90 + earW; // left edge of panel area in flat coords
  const offY = flangeDepth + ba90;        // bottom edge of panel area

  const sections: string[] = [];

  // ── DXF Header ──
  sections.push(dxfHeader());

  // ── Tables Section (layers, linetypes) ──
  sections.push(dxfTables());

  // ── Entities Section ──
  const entities: string[] = [];

  // Outer cut boundary
  entities.push(dxfComment(`Outer boundary — flat pattern ${flatW.toFixed(1)}x${flatH.toFixed(1)}mm`));
  entities.push(dxfRect(0, 0, flatW, flatH, '0-OUTLINE'));

  // Ear regions (left and right) — separate cuts at the corners
  // The ears extend beyond the panel; in flat pattern they're part of the outline
  // But the flange folds don't extend into the ear region, so we need relief cuts
  // at the ear/panel transition

  // Bend lines for top and bottom flanges
  entities.push(dxfComment('Bend lines — top flange'));
  entities.push(dxfLine(earW, offY + panH, flatW - earW, offY + panH, '1-BEND'));
  entities.push(dxfComment('Bend lines — bottom flange'));
  entities.push(dxfLine(earW, offY, flatW - earW, offY, '1-BEND'));

  // If we have side flanges too (left/right panel edges)
  entities.push(dxfComment('Bend lines — left panel edge'));
  entities.push(dxfLine(offX, offY, offX, offY + panH, '1-BEND'));
  entities.push(dxfComment('Bend lines — right panel edge'));
  entities.push(dxfLine(offX + panW, offY, offX + panW, offY + panH, '1-BEND'));

  // ── Bore slots in ear regions ──
  entities.push(dxfComment('EIA-310 mounting bores'));
  const boreYs: number[] = [];
  for (let u = 0; u < config.panel.uHeight; u++) {
    const base = u * 44.45;
    // EIA-310: 6.35, 22.225, 38.1mm from top of each U-space
    // Flip to Y-up (from panel bottom) — same transform as element cutouts
    boreYs.push(panH - (base + 6.35), panH - (base + 22.225), panH - (base + 38.1));
  }

  const boreDia = BORE_HOLES[config.panel.mountHoleType ?? '#10-32']?.diameter ?? 4.83;
  const boreSlotH = boreDia + 4.5; // elongated slot height

  for (const by of boreYs) {
    const yPos = offY + by;
    // Left ear bore — elongated slot
    const leftX = offX - earW / 2;
    entities.push(dxfOblong(leftX, yPos, boreDia, boreSlotH, '2-CUTOUTS'));
    // Right ear bore
    const rightX = offX + panW + earW / 2;
    entities.push(dxfOblong(rightX, yPos, boreDia, boreSlotH, '2-CUTOUTS'));
  }

  // ── Fan cutouts (faceplate only) ──
  const faceFans = config.elements.filter(e => e.type === 'fan' && (!e.surface || e.surface === 'faceplate'));
  if (faceFans.length > 0) {
    entities.push(dxfComment('Fan cutouts (faceplate)'));
    for (const el of faceFans) {
      const fan = FANS[el.key];
      if (!fan) continue;
      const cx = offX + el.x;
      const cy = offY + (panH - el.y);
      entities.push(dxfComment(`${el.label} — ${fan.size}mm fan`));
      entities.push(dxfCircle(cx, cy, fan.cutoutDiameter / 2 + 0.1, '2-CUTOUTS'));
      const hs = fan.holeSpacing / 2;
      for (const [dx, dy] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        entities.push(dxfCircle(cx + dx * hs, cy + dy * hs, fan.holeDiameter / 2, '2-CUTOUTS'));
      }
    }
  }

  // ── Rear fan annotations ──
  const rearFans = config.elements.filter(e => e.type === 'fan' && e.surface === 'rear');
  if (rearFans.length > 0) {
    entities.push(dxfComment('Rear fan annotations (not cut on faceplate)'));
    for (const el of rearFans) {
      const fan = FANS[el.key];
      if (!fan) continue;
      const cx = offX + el.x;
      const cy = offY + (panH - el.y);
      entities.push(dxfText(cx, cy, `REAR FAN ${fan.size}mm`, '3-DIMS', 2, 0));
    }
  }

  // ── Element cutouts ──
  entities.push(dxfComment('Element cutouts'));
  for (const el of config.elements) {
    if (el.type === 'fan') continue; // handled above
    const cx = offX + el.x;
    const cy = offY + (panH - el.y); // flip Y for DXF (Y-up)

    switch (el.cutout) {
      case 'round': {
        const r = el.radius ?? el.w / 2;
        entities.push(dxfComment(`${el.label} — round r=${r}mm`));
        entities.push(dxfCircle(cx, cy, r + 0.1, '2-CUTOUTS'));
        break;
      }
      case 'd-shape': {
        const r = el.radius ?? el.w / 2;
        // Approximate as circle in DXF; fabricator can refine
        entities.push(dxfComment(`${el.label} — D-shape r=${r}mm (circle approximation)`));
        entities.push(dxfCircle(cx, cy, r + 0.1, '2-CUTOUTS'));
        break;
      }
      case 'rect': {
        entities.push(dxfComment(`${el.label} — rect ${el.w}x${el.h}mm`));
        entities.push(dxfRect(
          cx - (el.w + 0.2) / 2, cy - (el.h + 0.2) / 2,
          el.w + 0.2, el.h + 0.2,
          '2-CUTOUTS'
        ));
        break;
      }
      case 'd-sub': {
        // D-sub as LWPOLYLINE trapezoid
        const tol = 0.2;
        const w = el.w + tol;
        const h = el.h + tol;
        const taper = 2.5;
        entities.push(dxfComment(`${el.label} — D-sub ${el.w}x${el.h}mm`));
        entities.push(dxfTrapezoid(cx, cy, w, h, taper, '2-CUTOUTS'));
        break;
      }
      default: {
        entities.push(dxfComment(`${el.label} — rect fallback`));
        entities.push(dxfRect(
          cx - (el.w + 0.2) / 2, cy - (el.h + 0.2) / 2,
          el.w + 0.2, el.h + 0.2,
          '2-CUTOUTS'
        ));
      }
    }
  }

  // ── Element labels on 5-LABELS layer ──
  const labeledElements = config.elements.filter(e => e.labelConfig?.text);
  if (labeledElements.length > 0) {
    entities.push(dxfComment('Element labels'));
    for (const el of labeledElements) {
      const lc = el.labelConfig!;
      const labelText = lc.autoNumber
        ? `${lc.text} ${computeExportAutoNumber(el, config.elements)}`
        : lc.text;
      const elCenterX = offX + el.x;
      const elCenterY = offY + (panH - el.y); // flip Y for DXF (Y-up)
      let labelY: number;
      switch (lc.position) {
        case 'above': labelY = elCenterY + el.h / 2 + 2; break;
        case 'inside': labelY = elCenterY; break;
        case 'below': default: labelY = elCenterY - el.h / 2 - 3; break;
      }
      entities.push(dxfText(elCenterX, labelY, labelText, '5-LABELS', 2, 0));
    }
  }

  // ── Mounting holes (modular mode) ──
  if (config.assembly?.mode === 'modular') {
    const devices = config.elements.filter(e => e.type === 'device');
    if (devices.length > 0) {
      entities.push(dxfComment('Mounting holes — modular assembly (4-MOUNT layer)'));
      const holeR = config.assembly.faceFab === 'sm' ? MOUNTING.PEM_HOLE / 2 : MOUNTING.PILOT_HOLE / 2;
      const alignR = MOUNTING.ALIGN_PIN_DIA / 2;

      for (const el of devices) {
        const mounts = computeMountPositions(el, sm.thickness);
        for (const mp of mounts) {
          const mx = offX + mp.x;
          const my = offY + (panH - mp.y);
          entities.push(dxfComment(`M3 mount hole (${mp.side})`));
          entities.push(dxfCircle(mx, my, holeR, '4-MOUNT'));
        }

        const aligns = computeAlignPositions(el, sm.thickness);
        for (const ap of aligns) {
          const ax = offX + ap.x;
          const ay = offY + (panH - ap.y);
          entities.push(dxfComment(`Alignment pin hole (${ap.side})`));
          entities.push(dxfCircle(ax, ay, alignR, '4-MOUNT'));
        }
      }
    }
  }

  // ── Dimension annotations ──
  entities.push(dxfComment('Dimension annotations'));
  // Overall flat dims
  entities.push(dxfText(-5, flatH / 2, `${flatH.toFixed(1)}`, '3-DIMS', 3, 90));
  entities.push(dxfText(flatW / 2, -5, `${flatW.toFixed(1)}`, '3-DIMS', 3, 0));
  // Panel dims
  entities.push(dxfText(offX + panW / 2, offY - 8, `Panel: ${panW.toFixed(1)}mm`, '3-DIMS', 2, 0));
  entities.push(dxfText(offX - 10, offY + panH / 2, `${panH.toFixed(1)}mm`, '3-DIMS', 2, 90));
  // Material note
  entities.push(dxfText(2, -12, `${sm.material} ${sm.thickness}mm / BR=${sm.bendRadius}mm / K=${sm.kFactor} / BA90=${ba90.toFixed(3)}mm`, '3-DIMS', 2, 0));

  sections.push('  0\nSECTION\n  2\nENTITIES\n');
  sections.push(entities.join(''));
  sections.push('  0\nENDSEC\n');

  // ── EOF ──
  sections.push('  0\nEOF\n');

  return sections.join('');
}

/**
 * Generates a DXF flat pattern for a single device tray (sheet metal).
 * The tray is a cruciform: floor + 2 side walls (bend up) + rear wall (bend up)
 * + front mounting tab (same plane as floor, no bend).
 *
 * Flat layout (Y-up):
 *   bottom = front tab (tab extends below floor)
 *   middle = floor area flanked by side wall flaps
 *   top    = rear wall flap
 */
export function generateTrayDXF(config: ExportConfig, elementIndex: number): string {
  const el = config.elements[elementIndex];
  if (!el || el.type !== 'device') {
    throw new Error(`Element at index ${elementIndex} is not a device`);
  }
  if (config.fabrication.method !== 'Sheet Metal') {
    throw new Error('Tray DXF requires sheet metal fabrication mode');
  }

  const sm = config.fabrication as FabConfigSM;
  const T = sm.thickness;
  const ba90 = sm.ba90;
  const tray = computeTrayDimensions(el, T, 'sm');

  const sideH = tray.sideH;          // 15mm side wall height
  const rearWallH = sideH;           // rear wall same height as sides
  const innerW = tray.innerW;        // device width + tolerance
  const innerD = tray.innerD;        // device depth behind panel

  // Effective tab depth: ensure it satisfies minimum feature size for laser-cut sheet metal.
  // Must be at least 2 * holeToEdge so M3 holes can be centered with proper edge margins.
  const maxHoleR = Math.max(MOUNTING.CLEARANCE_HOLE, MOUNTING.ALIGN_PIN_DIA) / 2;
  const minTabFromHoles = 2 * holeToEdge(T, maxHoleR);
  const tabDepth = Math.max(MOUNTING.TAB_DEPTH, Math.ceil(minTabFromHoles));

  // Mount hole positions: inset from FLOOR edges (not from faceplate cutout edges).
  // computeMountPositions returns faceplate positions which fall outside the tray floor.
  // For the tray tab, place holes inset from the floor width.
  const m3Edge = holeToEdge(T, MOUNTING.CLEARANCE_HOLE / 2);
  const pinEdge = holeToEdge(T, MOUNTING.ALIGN_PIN_DIA / 2);
  const mountInsetX = m3Edge;  // M3 holes inset from floor edges
  const tabW = innerW;         // tab is same width as floor

  // Flat pattern dimensions
  const flatW = sideH + ba90 + innerW + ba90 + sideH;
  const flatH = tabDepth + innerD + ba90 + rearWallH;

  // Key Y positions (from bottom of flat pattern)
  const tabBot = 0;
  const tabTop = tabDepth;              // = floorBot
  const floorTop = tabDepth + innerD;   // bend line for rear wall
  const rearTop = flatH;               // top edge

  // Key X positions
  const floorL = sideH + ba90;          // left edge of floor
  const floorR = floorL + innerW;       // right edge of floor
  const tabL = floorL + (innerW - tabW) / 2;  // left edge of tab
  const tabR = tabL + tabW;                    // right edge of tab

  const sections: string[] = [];
  sections.push(dxfHeader());
  sections.push(dxfTables());

  const entities: string[] = [];

  // ── Cruciform outline (12-segment closed polygon) on 0-OUTLINE ──
  // ── Cruciform outline as closed LWPOLYLINE on 0-OUTLINE ──
  // LWPOLYLINE (not individual LINEs) so CAM tools recognize a single closed boundary.
  entities.push(dxfComment(`Tray flat pattern for ${el.label} — ${flatW.toFixed(1)}x${flatH.toFixed(1)}mm`));
  const outline: [number, number][] = [
    [tabL,  tabBot],   // P1 — bottom-left of tab
    [tabR,  tabBot],   // P2 — bottom-right of tab
    [tabR,  tabTop],   // P3 — tab meets floor right
    [flatW, tabTop],   // P4 — right side wall outer bottom
    [flatW, floorTop], // P5 — right side wall outer top
    [floorR, floorTop],// P6 — floor right top (rear bend)
    [floorR, rearTop], // P7 — rear wall right top
    [floorL, rearTop], // P8 — rear wall left top
    [floorL, floorTop],// P9 — floor left top (rear bend)
    [0,     floorTop], // P10 — left side wall outer top
    [0,     tabTop],   // P11 — left side wall outer bottom
    [tabL,  tabTop],   // P12 — tab meets floor left
  ];
  entities.push(dxfLWPolyline(outline, '0-OUTLINE'));

  // ── Bend lines on 1-BEND ──
  entities.push(dxfComment('Bend lines — left side wall up'));
  entities.push(dxfLine(floorL, tabTop, floorL, floorTop, '1-BEND'));
  entities.push(dxfComment('Bend lines — right side wall up'));
  entities.push(dxfLine(floorR, tabTop, floorR, floorTop, '1-BEND'));
  entities.push(dxfComment('Bend lines — rear wall up'));
  entities.push(dxfLine(floorL, floorTop, floorR, floorTop, '1-BEND'));

  // ── Mount holes on 2-CUTOUTS (same layer as other cuts for CAM compatibility) ──
  // Holes inset from floor edges so they're well within the tab outline.
  const holeR = MOUNTING.CLEARANCE_HOLE / 2;
  const alignR = MOUNTING.ALIGN_PIN_DIA / 2;
  const holeY = tabDepth / 2;

  // M3 holes: left and right, inset from floor edges by holeToEdge
  const m3Left = floorL + mountInsetX;
  const m3Right = floorR - mountInsetX;
  // Alignment pins: inboard of M3 by enough clearance
  const alignGap = MOUNTING.CLEARANCE_HOLE / 2 + MOUNTING.ALIGN_PIN_DIA / 2 + 2;
  const alignLeft = m3Left + alignGap;
  const alignRight = m3Right - alignGap;

  entities.push(dxfComment('Mounting holes — M3 clearance'));
  entities.push(dxfComment('M3 mount hole (left)'));
  entities.push(dxfCircle(m3Left, holeY, holeR, '2-CUTOUTS'));
  entities.push(dxfComment('M3 mount hole (right)'));
  entities.push(dxfCircle(m3Right, holeY, holeR, '2-CUTOUTS'));

  entities.push(dxfComment('Alignment pin holes'));
  entities.push(dxfComment('Alignment pin hole (left)'));
  entities.push(dxfCircle(alignLeft, holeY, alignR, '2-CUTOUTS'));
  entities.push(dxfComment('Alignment pin hole (right)'));
  entities.push(dxfCircle(alignRight, holeY, alignR, '2-CUTOUTS'));

  // ── Dimension annotations on 3-DIMS ──
  entities.push(dxfComment('Dimension annotations'));
  entities.push(dxfText(-5, flatH / 2, `${flatH.toFixed(1)}`, '3-DIMS', 3, 90));
  entities.push(dxfText(flatW / 2, -5, `${flatW.toFixed(1)}`, '3-DIMS', 3, 0));
  entities.push(dxfText(floorL + innerW / 2, floorTop + rearWallH / 2, `floor ${innerW.toFixed(1)}x${innerD.toFixed(1)}`, '3-DIMS', 2, 0));
  entities.push(dxfText(2, -12, `${sm.material} ${T}mm / BA90=${ba90.toFixed(3)}mm / Tray: ${el.label}`, '3-DIMS', 2, 0));

  // Deep tray annotation
  if (el.depthBehind > MOUNTING.DEEP_TRAY_THRESHOLD) {
    entities.push(dxfText(flatW / 2, -18, '4-point attach — rear bracket recommended', '3-DIMS', 2, 0));
  }

  sections.push('  0\nSECTION\n  2\nENTITIES\n');
  sections.push(entities.join(''));
  sections.push('  0\nENDSEC\n');
  sections.push('  0\nEOF\n');

  return sections.join('');
}

/**
 * Generates tray DXFs for all device elements in the config.
 * Returns an array of {label, dxf} objects (one per device).
 */
export function generateAllTrayDXFs(config: ExportConfig): { label: string; dxf: string }[] {
  const results: { label: string; dxf: string }[] = [];
  for (let i = 0; i < config.elements.length; i++) {
    const el = config.elements[i];
    if (el.type !== 'device') continue;
    results.push({
      label: el.label,
      dxf: generateTrayDXF(config, i),
    });
  }
  return results;
}

// ─── DXF Primitives ──────────────────────────────────────────

function dxfHeader(): string {
  return [
    '  0', 'SECTION',
    '  2', 'HEADER',
    '  9', '$ACADVER', '  1', 'AC1009',
    '  9', '$INSUNITS', ' 70', '4',  // mm
    '  9', '$EXTMIN', ' 10', '0.0', ' 20', '0.0',
    '  9', '$EXTMAX', ' 10', '600.0', ' 20', '200.0',
    '  0', 'ENDSEC',
  ].join('\n') + '\n';
}

function dxfTables(): string {
  return [
    '  0', 'SECTION',
    '  2', 'TABLES',
    // Linetype table
    '  0', 'TABLE',
    '  2', 'LTYPE',
    ' 70', '2',
    // Continuous
    '  0', 'LTYPE',
    '  2', 'CONTINUOUS',
    ' 70', '0',
    '  3', 'Solid line',
    ' 72', '65',
    ' 73', '0',
    ' 40', '0.0',
    // Dashed
    '  0', 'LTYPE',
    '  2', 'DASHED',
    ' 70', '0',
    '  3', '__ __ __ __',
    ' 72', '65',
    ' 73', '2',
    ' 40', '6.0',
    ' 49', '4.0',
    ' 49', '-2.0',
    '  0', 'ENDTAB',
    // Layer table
    '  0', 'TABLE',
    '  2', 'LAYER',
    ' 70', '6',
    // 0-OUTLINE
    '  0', 'LAYER',
    '  2', '0-OUTLINE',
    ' 70', '0',
    ' 62', '1',    // red
    '  6', 'CONTINUOUS',
    // 1-BEND
    '  0', 'LAYER',
    '  2', '1-BEND',
    ' 70', '0',
    ' 62', '5',    // blue
    '  6', 'DASHED',
    // 2-CUTOUTS
    '  0', 'LAYER',
    '  2', '2-CUTOUTS',
    ' 70', '0',
    ' 62', '3',    // green
    '  6', 'CONTINUOUS',
    // 3-DIMS
    '  0', 'LAYER',
    '  2', '3-DIMS',
    ' 70', '0',
    ' 62', '8',    // gray
    '  6', 'CONTINUOUS',
    // 4-MOUNT
    '  0', 'LAYER',
    '  2', '4-MOUNT',
    ' 70', '0',
    ' 62', '4',    // cyan
    '  6', 'CONTINUOUS',
    // 5-LABELS
    '  0', 'LAYER',
    '  2', '5-LABELS',
    ' 70', '0',
    ' 62', '7',    // white
    '  6', 'CONTINUOUS',
    '  0', 'ENDTAB',
    '  0', 'ENDSEC',
  ].join('\n') + '\n';
}

function dxfComment(text: string): string {
  return `999\n${text}\n`;
}

function dxfLine(x1: number, y1: number, x2: number, y2: number, layer: string): string {
  return [
    '  0', 'LINE',
    '  8', layer,
    ' 10', x1.toFixed(4),
    ' 20', y1.toFixed(4),
    ' 11', x2.toFixed(4),
    ' 21', y2.toFixed(4),
  ].join('\n') + '\n';
}

function dxfRect(x: number, y: number, w: number, h: number, layer: string): string {
  return dxfLWPolyline([
    [x, y], [x + w, y], [x + w, y + h], [x, y + h],
  ], layer);
}

/** Closed LWPOLYLINE — CAM tools recognize this as a single boundary. */
function dxfLWPolyline(points: [number, number][], layer: string): string {
  const parts: string[] = [
    '  0', 'LWPOLYLINE',
    '  8', layer,
    ' 70', '1',   // closed flag
    ' 90', String(points.length),
  ];
  for (const [x, y] of points) {
    parts.push(' 10', x.toFixed(4), ' 20', y.toFixed(4));
  }
  return parts.join('\n') + '\n';
}

function dxfCircle(cx: number, cy: number, r: number, layer: string): string {
  return [
    '  0', 'CIRCLE',
    '  8', layer,
    ' 10', cx.toFixed(4),
    ' 20', cy.toFixed(4),
    ' 40', r.toFixed(4),
  ].join('\n') + '\n';
}

function dxfOblong(cx: number, cy: number, w: number, h: number, layer: string): string {
  // Elongated slot (stadium): two semicircles connected by straight lines
  const r = w / 2;
  const halfH = (h - w) / 2; // half-height of the straight section between arc centers
  if (halfH <= 0) {
    return dxfCircle(cx, cy, r, layer);
  }
  const lines: string[] = [];
  // Left line: bottom-left to top-left
  lines.push(dxfLine(cx - r, cy - halfH, cx - r, cy + halfH, layer));
  // Right line: top-right to bottom-right
  lines.push(dxfLine(cx + r, cy + halfH, cx + r, cy - halfH, layer));
  // Top semicircle: arc center at (cx, cy+halfH), sweeps from 0 to π
  // Connects right line top (cx+r, cy+halfH) to left line top (cx-r, cy+halfH)
  const segs = 12;
  for (let i = 0; i < segs; i++) {
    const a1 = (Math.PI * i) / segs;
    const a2 = (Math.PI * (i + 1)) / segs;
    lines.push(dxfLine(
      cx + r * Math.cos(a1), cy + halfH + r * Math.sin(a1),
      cx + r * Math.cos(a2), cy + halfH + r * Math.sin(a2),
      layer
    ));
  }
  // Bottom semicircle: arc center at (cx, cy-halfH), sweeps from π to 2π
  // Connects left line bottom (cx-r, cy-halfH) to right line bottom (cx+r, cy-halfH)
  for (let i = 0; i < segs; i++) {
    const a1 = Math.PI + (Math.PI * i) / segs;
    const a2 = Math.PI + (Math.PI * (i + 1)) / segs;
    lines.push(dxfLine(
      cx + r * Math.cos(a1), cy - halfH + r * Math.sin(a1),
      cx + r * Math.cos(a2), cy - halfH + r * Math.sin(a2),
      layer
    ));
  }
  return lines.join('');
}

function dxfTrapezoid(cx: number, cy: number, w: number, h: number, taper: number, layer: string): string {
  // D-sub trapezoid: wider at bottom, narrower at top
  const bw = w / 2;       // bottom half-width
  const tw = w / 2 - taper; // top half-width
  const hh = h / 2;

  return dxfLWPolyline([
    [cx - bw, cy - hh], [cx + bw, cy - hh],
    [cx + tw, cy + hh], [cx - tw, cy + hh],
  ], layer);
}

function dxfText(x: number, y: number, text: string, layer: string, height: number, rotation: number): string {
  return [
    '  0', 'TEXT',
    '  8', layer,
    ' 10', x.toFixed(4),
    ' 20', y.toFixed(4),
    ' 40', height.toFixed(1),
    ' 50', rotation.toFixed(1),
    '  1', text,
  ].join('\n') + '\n';
}
