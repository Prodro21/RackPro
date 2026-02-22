import type { PanelElement, RibGeometry, FabMethod, SplitInfo } from '../types';

/**
 * Compute auto-reinforcement ribs for the enclosure.
 * Pure function — no React dependencies.
 *
 * Rules:
 * 1. Stiffener wedges at panel corners (top/bottom × left/right)
 * 2. Vertical ribs in gaps between elements (>30mm gap)
 * 3. Inter-device dividers when two devices are adjacent
 * 4. Thin-wall reinforcement for wallT < 3mm on spans > 150mm
 * 5. Cross-bracing for panels wider than 300mm with few elements
 *
 * Sheet metal panels skip reinforcement (bends provide stiffness).
 * Ribs near split boundaries are excluded (would interfere with joints).
 */
export function computeReinforcement(
  elements: PanelElement[],
  panW: number,
  panH: number,
  wallT: number,
  depth: number,
  fabMethod: FabMethod,
  splitInfo?: SplitInfo,
): RibGeometry[] {
  // Sheet metal doesn't need ribs — bends provide stiffness
  if (fabMethod === 'sm') return [];

  const ribs: RibGeometry[] = [];
  const ribT = Math.max(wallT / 2, 1.5); // rib thickness = half wall thickness, min 1.5mm
  const ribH = Math.min(panH * 0.6, 30); // rib height = 60% of panel or 30mm max
  const ribDepth = Math.min(depth * 0.6, 40); // rib depth behind panel

  // Determine split exclusion zones
  const splitExclusions = getSplitExclusions(panW, splitInfo);

  // Sort elements by X position for gap analysis
  const sorted = [...elements].sort((a, b) => (a.x - a.w / 2) - (b.x - b.w / 2));

  // Rule 1: Stiffener wedges at corners (if depth > 50mm)
  if (depth > 50) {
    const wedgeSize = Math.min(15, depth * 0.2);
    const wedgePositions = [
      { x: ribT / 2, y: ribT / 2, reason: 'Corner stiffener (top-left)' },
      { x: panW - ribT / 2, y: ribT / 2, reason: 'Corner stiffener (top-right)' },
      { x: ribT / 2, y: panH - ribT / 2, reason: 'Corner stiffener (bottom-left)' },
      { x: panW - ribT / 2, y: panH - ribT / 2, reason: 'Corner stiffener (bottom-right)' },
    ];
    for (const pos of wedgePositions) {
      if (!inExclusionZone(pos.x, splitExclusions)) {
        ribs.push({
          type: 'stiffener-wedge',
          x: pos.x,
          y: pos.y,
          w: wedgeSize,
          h: wedgeSize,
          depth: wedgeSize,
          reason: pos.reason,
        });
      }
    }
  }

  // Rule 2: Vertical ribs in gaps > 30mm between elements
  const gaps = findGaps(sorted, panW);
  for (const gap of gaps) {
    if (gap.width > 30) {
      const ribX = gap.center;
      if (!inExclusionZone(ribX, splitExclusions) && !overlapsElement(ribX, ribT, elements)) {
        ribs.push({
          type: 'vertical-rib',
          x: ribX,
          y: panH / 2,
          w: ribT,
          h: ribH,
          depth: ribDepth,
          reason: `Vertical rib in ${gap.width.toFixed(0)}mm gap`,
        });
      }
    }
  }

  // Rule 3: Inter-device dividers
  const devices = sorted.filter(e => e.type === 'device');
  for (let i = 0; i < devices.length - 1; i++) {
    const a = devices[i];
    const b = devices[i + 1];
    const gapStart = a.x + a.w / 2;
    const gapEnd = b.x - b.w / 2;
    const gapW = gapEnd - gapStart;
    if (gapW > 5 && gapW < 40) {
      const divX = (gapStart + gapEnd) / 2;
      if (!inExclusionZone(divX, splitExclusions)) {
        ribs.push({
          type: 'divider',
          x: divX,
          y: panH / 2,
          w: ribT,
          h: panH * 0.8,
          depth: ribDepth,
          reason: `Divider between ${a.label} and ${b.label}`,
        });
      }
    }
  }

  // Rule 4: Thin-wall reinforcement (wallT < 3mm, span > 150mm)
  if (wallT < 3 && panW > 150) {
    const bigGaps = gaps.filter(g => g.width > 150);
    for (const gap of bigGaps) {
      // Add horizontal stiffener in the large gap
      const stiffY = panH / 2;
      if (!inExclusionZone(gap.center, splitExclusions)) {
        ribs.push({
          type: 'horizontal-rib',
          x: gap.center,
          y: stiffY,
          w: gap.width * 0.6,
          h: ribT,
          depth: ribDepth * 0.5,
          reason: `Thin-wall stiffener across ${gap.width.toFixed(0)}mm span`,
        });
      }
    }
  }

  // Rule 5: Cross-bracing for wide panels (>300mm) with few elements
  if (panW > 300 && elements.length <= 2) {
    const midX = panW / 2;
    if (!inExclusionZone(midX, splitExclusions) && !overlapsElement(midX, ribT, elements)) {
      ribs.push({
        type: 'cross-brace',
        x: midX,
        y: panH / 2,
        w: ribT,
        h: panH * 0.7,
        depth: ribDepth,
        reason: 'Center brace for wide panel',
      });
    }
  }

  return ribs;
}

// ─── Helpers ─────────────────────────────────────────────────

interface Gap {
  start: number;
  end: number;
  width: number;
  center: number;
}

function findGaps(sortedElements: PanelElement[], panW: number): Gap[] {
  const gaps: Gap[] = [];
  let cursor = 0;

  for (const el of sortedElements) {
    const elLeft = el.x - el.w / 2;
    if (elLeft > cursor) {
      const w = elLeft - cursor;
      gaps.push({ start: cursor, end: elLeft, width: w, center: cursor + w / 2 });
    }
    cursor = Math.max(cursor, el.x + el.w / 2);
  }

  // Trailing gap
  if (cursor < panW) {
    const w = panW - cursor;
    gaps.push({ start: cursor, end: panW, width: w, center: cursor + w / 2 });
  }

  return gaps;
}

function getSplitExclusions(panW: number, splitInfo?: SplitInfo): [number, number][] {
  if (!splitInfo || splitInfo.type === 'none') return [];
  const margin = 20; // keep ribs 20mm from split lines

  if (splitInfo.type === '2-piece') {
    const mid = panW / 2;
    return [[mid - margin, mid + margin]];
  }

  if (splitInfo.type === '3-piece') {
    const earTotalW = splitInfo.parts[1]?.w ?? 40;
    const leftLine = earTotalW - 15.875; // ear width offset to panel coords
    const rightLine = panW - leftLine;
    return [
      [Math.max(0, leftLine - margin), leftLine + margin],
      [rightLine - margin, Math.min(panW, rightLine + margin)],
    ];
  }

  return [];
}

function inExclusionZone(x: number, zones: [number, number][]): boolean {
  return zones.some(([lo, hi]) => x >= lo && x <= hi);
}

function overlapsElement(x: number, w: number, elements: PanelElement[]): boolean {
  const half = w / 2 + 2; // 2mm clearance
  return elements.some(el => {
    const elLeft = el.x - el.w / 2;
    const elRight = el.x + el.w / 2;
    return (x + half > elLeft) && (x - half < elRight);
  });
}
