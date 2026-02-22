/**
 * Auto-layout V2 engine.
 * Pure function — no React or store dependencies.
 *
 * Improvements over V1 (layout.ts):
 *   - Connector grouping by type family (all RJ45 together, all BNC together)
 *   - Weight-aware device placement (heaviest at ears, alternating inward)
 *   - Configurable connector zone (between, left, right, split)
 *   - Overflow detection with actionable suggestions
 *   - Post-layout validation (overlap + out-of-bounds checks)
 */

import type { PanelElement, ElementType, ConnectorDef, DeviceDef } from '../types';
import { CONNECTORS } from '../constants/connectors';
import { FANS } from '../constants/fans';
import { lookupDevice } from '../constants/deviceLookup';
import { lookupConnector } from '../constants/connectorLookup';

// ─── Public Types ─────────────────────────────────────────────

export type ConnectorZone = 'between' | 'left' | 'right' | 'split';

export interface LayoutV2Options {
  spacing?: number;             // min gap between elements (mm), default 4
  connectorZone?: ConnectorZone; // where connectors go relative to devices, default 'between'
}

export interface OverflowSuggestion {
  message: string;              // e.g., "Elements exceed panel width by 42mm"
  suggestions: string[];        // actionable suggestions list
  totalWidth: number;           // total width needed (mm)
  availableWidth: number;       // panel width available (mm)
}

export interface LayoutV2Result {
  elements: PanelElement[];
  overflow: OverflowSuggestion | null;
  validationIssues: string[];   // element ids with validation issues
}

// ─── Connector Family Mapping ─────────────────────────────────

/**
 * Maps known connector slugs to grouping family keys.
 * Connectors in the same family are placed adjacently.
 */
const CONNECTOR_FAMILIES: Record<string, string> = {
  'rj45-keystone': 'rj45',
  'rj45-ks': 'rj45',
  'bnc-bulkhead': 'bnc',
  'bnc-kfb2': 'bnc',
  'bnc': 'bnc',
  'sma-bulkhead': 'sma',
  'sma': 'sma',
  'fiber-lc': 'fiber',
  'fiber-sc': 'fiber',
  'usb-a': 'usb',
  'usb-c': 'usb',
  'hdmi-bulkhead': 'hdmi',
  'hdmi': 'hdmi',
  'neutrik-d': 'neutrik-d',
  'iec-c14': 'iec',
  'powercon': 'powercon',
  'db9': 'dsub',
  'db15': 'dsub',
  'db25': 'dsub',
};

/** Known family prefixes for fallback extraction */
const KNOWN_PREFIXES = ['rj45', 'bnc', 'sma', 'fiber', 'usb', 'hdmi'];

function connectorFamily(key: string): string {
  if (CONNECTOR_FAMILIES[key]) return CONNECTOR_FAMILIES[key];
  // Fallback: split on '-', try first segment against known prefixes
  const prefix = key.split('-')[0];
  if (KNOWN_PREFIXES.includes(prefix)) return prefix;
  return key;
}

// ─── Internal Resolved Types ──────────────────────────────────

interface ResolvedDevice {
  type: 'device';
  key: string;
  w: number;
  h: number;
  name: string;
  weight: number;
}

interface ResolvedConnector {
  type: 'connector';
  key: string;
  w: number;
  h: number;
  name: string;
  family: string;
}

interface ResolvedFan {
  type: 'fan';
  key: string;
  w: number;
  h: number;
  name: string;
}

// ─── Main Function ────────────────────────────────────────────

export function autoLayoutV2(
  elementDefs: Array<{ type: ElementType; key: string }>,
  panW: number,
  panH: number,
  options?: LayoutV2Options,
): LayoutV2Result {
  const spacing = options?.spacing ?? 4;
  const connectorZone = options?.connectorZone ?? 'between';

  // Step 1: Resolve dimensions
  const devices: ResolvedDevice[] = [];
  const connectors: ResolvedConnector[] = [];
  const fans: ResolvedFan[] = [];

  for (const def of elementDefs) {
    if (def.type === 'device') {
      const dev = lookupDevice(def.key);
      if (!dev) continue;
      devices.push({
        type: 'device',
        key: def.key,
        w: dev.w,
        h: dev.h,
        name: dev.name,
        weight: dev.wt ?? 0,
      });
    } else if (def.type === 'connector') {
      const con = lookupConnector(def.key);
      if (!con) continue;
      connectors.push({
        type: 'connector',
        key: def.key,
        w: con.w,
        h: con.h,
        name: con.name,
        family: connectorFamily(def.key),
      });
    } else if (def.type === 'fan') {
      const fan = FANS[def.key];
      if (!fan) continue;
      fans.push({
        type: 'fan',
        key: def.key,
        w: fan.size,
        h: fan.size,
        name: fan.name,
      });
    }
  }

  // Step 2: Place devices (weight-aware, heaviest toward ears)
  const sortedDevices = [...devices].sort((a, b) => b.weight - a.weight);
  const devicePlacements: Array<{ el: ResolvedDevice; cx: number }> = [];
  let leftCursor = spacing;
  let rightCursor = panW - spacing;
  let placeLeft = true;

  for (const dev of sortedDevices) {
    if (placeLeft) {
      const cx = leftCursor + dev.w / 2;
      devicePlacements.push({ el: dev, cx });
      leftCursor = cx + dev.w / 2 + spacing;
    } else {
      const cx = rightCursor - dev.w / 2;
      devicePlacements.push({ el: dev, cx });
      rightCursor = cx - dev.w / 2 - spacing;
    }
    placeLeft = !placeLeft;
  }

  // Step 3: Group connectors by family
  const familyGroups = groupConnectorsByFamily(connectors);

  // Step 4: Place connectors based on zone
  const connectorPlacements = placeConnectorsInZone(
    familyGroups,
    devicePlacements,
    connectorZone,
    spacing,
    panW,
  );

  // Step 5: Build final placed elements
  const placed: PanelElement[] = [];
  const centerY = panH / 2;

  for (const dp of devicePlacements) {
    placed.push({
      id: uid(),
      type: 'device',
      key: dp.el.key,
      x: +dp.cx.toFixed(2),
      y: +centerY.toFixed(2),
      w: dp.el.w,
      h: dp.el.h,
      label: dp.el.name,
      surface: 'faceplate',
    });
  }

  for (const cp of connectorPlacements) {
    placed.push({
      id: uid(),
      type: 'connector',
      key: cp.el.key,
      x: +cp.cx.toFixed(2),
      y: +centerY.toFixed(2),
      w: cp.el.w,
      h: cp.el.h,
      label: cp.el.name,
      surface: 'faceplate',
    });
  }

  // Step 5b: Place fans on rear surface (greedy left-to-right)
  let fanCursor = spacing;
  for (const fan of fans) {
    const cx = fanCursor + fan.w / 2;
    if (cx + fan.w / 2 + spacing > panW) continue; // skip if doesn't fit
    placed.push({
      id: uid(),
      type: 'fan',
      key: fan.key,
      x: +cx.toFixed(2),
      y: +centerY.toFixed(2),
      w: fan.w,
      h: fan.h,
      label: fan.name,
      surface: 'rear',
    });
    fanCursor = cx + fan.w / 2 + spacing;
  }

  // Step 6: Overflow detection
  const overflow = detectOverflow(placed, panW, panH, spacing);

  // Step 7: Post-layout validation (overlaps + OOB)
  const validationIssues = validateLayout(placed, panW, panH);

  return { elements: placed, overflow, validationIssues };
}

// ─── Connector Grouping ───────────────────────────────────────

interface ConnectorGroup {
  family: string;
  connectors: ResolvedConnector[];
  totalWidth: number;
}

function groupConnectorsByFamily(connectors: ResolvedConnector[]): ConnectorGroup[] {
  const groupMap = new Map<string, ResolvedConnector[]>();
  for (const con of connectors) {
    const existing = groupMap.get(con.family);
    if (existing) {
      existing.push(con);
    } else {
      groupMap.set(con.family, [con]);
    }
  }

  const groups: ConnectorGroup[] = [];
  for (const [family, cons] of groupMap) {
    groups.push({
      family,
      connectors: cons,
      totalWidth: cons.reduce((sum, c) => sum + c.w, 0),
    });
  }

  // Sort alphabetically by family for deterministic output
  groups.sort((a, b) => a.family.localeCompare(b.family));
  return groups;
}

// ─── Connector Zone Placement ─────────────────────────────────

interface ConnectorPlacement {
  el: ResolvedConnector;
  cx: number;
}

function placeConnectorsInZone(
  groups: ConnectorGroup[],
  devicePlacements: Array<{ el: ResolvedDevice; cx: number }>,
  zone: ConnectorZone,
  spacing: number,
  panW: number,
): ConnectorPlacement[] {
  // Flatten groups into ordered list (grouped connectors stay adjacent)
  const ordered: ResolvedConnector[] = [];
  for (const g of groups) {
    ordered.push(...g.connectors);
  }

  if (ordered.length === 0) return [];

  // Determine device bounds
  let devLeftEdge = panW;
  let devRightEdge = 0;
  for (const dp of devicePlacements) {
    const left = dp.cx - dp.el.w / 2;
    const right = dp.cx + dp.el.w / 2;
    if (left < devLeftEdge) devLeftEdge = left;
    if (right > devRightEdge) devRightEdge = right;
  }

  // If no devices, treat as if connectors fill the whole panel
  if (devicePlacements.length === 0) {
    devLeftEdge = panW / 2;
    devRightEdge = panW / 2;
  }

  const placements: ConnectorPlacement[] = [];

  switch (zone) {
    case 'between': {
      // Place connectors in the gap between device clusters
      const gapStart = devicePlacements.length > 0 ? devLeftEdge : spacing;
      // Find actual gap between left-cluster and right-cluster
      const sortedByX = [...devicePlacements].sort((a, b) => a.cx - b.cx);
      let betweenStart: number;
      let betweenEnd: number;
      if (sortedByX.length >= 2) {
        // Gap between last left-placed device and first right-placed device
        const leftDevices = sortedByX.filter(d => d.cx <= panW / 2);
        const rightDevices = sortedByX.filter(d => d.cx > panW / 2);
        if (leftDevices.length > 0 && rightDevices.length > 0) {
          const lastLeft = leftDevices[leftDevices.length - 1];
          const firstRight = rightDevices[0];
          betweenStart = lastLeft.cx + lastLeft.el.w / 2 + spacing;
          betweenEnd = firstRight.cx - firstRight.el.w / 2 - spacing;
        } else {
          // All devices on one side
          betweenStart = devRightEdge + spacing;
          betweenEnd = panW - spacing;
        }
      } else if (sortedByX.length === 1) {
        // Single device — place connectors to its right
        betweenStart = devRightEdge + spacing;
        betweenEnd = panW - spacing;
      } else {
        // No devices — use full panel width
        betweenStart = spacing;
        betweenEnd = panW - spacing;
      }

      let cursor = betweenStart;
      for (const con of ordered) {
        const cx = cursor + con.w / 2;
        placements.push({ el: con, cx });
        cursor = cx + con.w / 2 + spacing;
      }
      break;
    }

    case 'left': {
      // Place connectors starting from left edge, shift devices rightward if needed
      let cursor = spacing;
      for (const con of ordered) {
        const cx = cursor + con.w / 2;
        placements.push({ el: con, cx });
        cursor = cx + con.w / 2 + spacing;
      }
      // Shift devices rightward by the total connector width if they overlap
      const connectorRightEdge = cursor;
      if (devicePlacements.length > 0 && connectorRightEdge > devLeftEdge) {
        const shift = connectorRightEdge - devLeftEdge + spacing;
        for (const dp of devicePlacements) {
          dp.cx += shift;
        }
      }
      break;
    }

    case 'right': {
      // Place connectors starting from right edge, shift devices leftward if needed
      let cursor = panW - spacing;
      // Place right-to-left, then reverse for correct ordering
      const reversePlacements: ConnectorPlacement[] = [];
      for (let i = ordered.length - 1; i >= 0; i--) {
        const con = ordered[i];
        const cx = cursor - con.w / 2;
        reversePlacements.unshift({ el: con, cx });
        cursor = cx - con.w / 2 - spacing;
      }
      placements.push(...reversePlacements);
      // Shift devices leftward if they overlap with connectors
      const connectorLeftEdge = cursor + spacing;
      if (devicePlacements.length > 0 && connectorLeftEdge < devRightEdge) {
        const shift = devRightEdge - connectorLeftEdge + spacing;
        for (const dp of devicePlacements) {
          dp.cx -= shift;
        }
      }
      break;
    }

    case 'split': {
      // Split connector groups evenly — first half on left, second half on right
      const midpoint = Math.ceil(groups.length / 2);
      const leftGroups = groups.slice(0, midpoint);
      const rightGroups = groups.slice(midpoint);

      // Left-side connectors
      const leftConnectors: ResolvedConnector[] = [];
      for (const g of leftGroups) leftConnectors.push(...g.connectors);

      // Right-side connectors
      const rightConnectors: ResolvedConnector[] = [];
      for (const g of rightGroups) rightConnectors.push(...g.connectors);

      // Place left connectors starting from left edge
      let leftCurs = spacing;
      for (const con of leftConnectors) {
        const cx = leftCurs + con.w / 2;
        placements.push({ el: con, cx });
        leftCurs = cx + con.w / 2 + spacing;
      }

      // Place right connectors from right edge
      let rightCurs = panW - spacing;
      const rightPlacements: ConnectorPlacement[] = [];
      for (let i = rightConnectors.length - 1; i >= 0; i--) {
        const con = rightConnectors[i];
        const cx = rightCurs - con.w / 2;
        rightPlacements.unshift({ el: con, cx });
        rightCurs = cx - con.w / 2 - spacing;
      }
      placements.push(...rightPlacements);

      // Shift devices to fit between connector zones
      if (devicePlacements.length > 0) {
        const leftConRight = leftCurs;
        const rightConLeft = rightCurs + spacing;

        // Check if devices overlap with left connectors
        if (leftConRight > devLeftEdge) {
          const shift = leftConRight - devLeftEdge + spacing;
          for (const dp of devicePlacements) {
            dp.cx += shift;
          }
        }
        // Recalculate device bounds after shift
        let newDevRight = 0;
        for (const dp of devicePlacements) {
          const right = dp.cx + dp.el.w / 2;
          if (right > newDevRight) newDevRight = right;
        }
        // Check if devices overlap with right connectors
        if (newDevRight > rightConLeft) {
          // Compress right connectors further right or leave as-is
          // (overflow detection will catch it)
        }
      }
      break;
    }
  }

  return placements;
}

// ─── Overflow Detection ───────────────────────────────────────

function detectOverflow(
  placed: PanelElement[],
  panW: number,
  panH: number,
  _spacing: number,
): OverflowSuggestion | null {
  // Check if any faceplate elements exceed panel bounds
  let maxRight = 0;
  let maxBottom = 0;
  for (const el of placed) {
    if (el.surface === 'rear') continue; // fans on rear don't count for faceplate overflow
    const right = el.x + el.w / 2;
    const bottom = el.y + el.h / 2;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }

  const widthOverflow = maxRight > panW;
  const heightOverflow = maxBottom > panH;

  if (!widthOverflow && !heightOverflow) return null;

  const totalWidthNeeded = maxRight;
  const suggestions: string[] = [];

  if (widthOverflow) {
    // Determine current standard from panel width
    const is10inch = panW < 300; // 10" panels are ~222mm
    if (is10inch) {
      suggestions.push('Switch to 19" standard (450.85mm panel width)');
    }
    suggestions.push(`Remove items to fit within ${panW.toFixed(1)}mm panel width`);
  }

  if (heightOverflow) {
    suggestions.push('Increase to 2U for more vertical space');
  }

  return {
    message: `Elements exceed panel bounds by ${(Math.max(maxRight - panW, 0)).toFixed(1)}mm wide, ${(Math.max(maxBottom - panH, 0)).toFixed(1)}mm tall`,
    suggestions,
    totalWidth: +totalWidthNeeded.toFixed(2),
    availableWidth: panW,
  };
}

// ─── Post-Layout Validation ───────────────────────────────────

function validateLayout(
  placed: PanelElement[],
  panW: number,
  panH: number,
): string[] {
  const issues: string[] = [];

  for (const el of placed) {
    if (el.surface === 'rear') continue; // skip rear surface elements for faceplate validation

    // Out-of-bounds check
    const left = el.x - el.w / 2;
    const right = el.x + el.w / 2;
    const top = el.y - el.h / 2;
    const bottom = el.y + el.h / 2;

    if (left < 0 || right > panW || top < 0 || bottom > panH) {
      if (!issues.includes(el.id)) issues.push(el.id);
    }
  }

  // AABB overlap check between all faceplate element pairs
  const faceplate = placed.filter(e => e.surface !== 'rear');
  for (let i = 0; i < faceplate.length; i++) {
    for (let j = i + 1; j < faceplate.length; j++) {
      const a = faceplate[i];
      const b = faceplate[j];
      if (aabbOverlap(a, b)) {
        if (!issues.includes(a.id)) issues.push(a.id);
        if (!issues.includes(b.id)) issues.push(b.id);
      }
    }
  }

  return issues;
}

function aabbOverlap(a: PanelElement, b: PanelElement): boolean {
  const aLeft = a.x - a.w / 2;
  const aRight = a.x + a.w / 2;
  const aTop = a.y - a.h / 2;
  const aBottom = a.y + a.h / 2;

  const bLeft = b.x - b.w / 2;
  const bRight = b.x + b.w / 2;
  const bTop = b.y - b.h / 2;
  const bBottom = b.y + b.h / 2;

  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
}

// ─── Helpers ──────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
