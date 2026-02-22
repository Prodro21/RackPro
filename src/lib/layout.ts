import type { PanelElement, ElementType, PlacementSurface } from '../types';
import { CONNECTORS } from '../constants/connectors';
import { FANS } from '../constants/fans';
import { lookupDevice } from '../constants/deviceLookup';

interface ElementDef {
  type: ElementType;
  key: string;
}

interface LayoutOptions {
  spacing?: number;       // min gap between elements (mm), default 4
  verticalCenter?: boolean; // center elements vertically, default true
}

/**
 * Auto-layout engine for MCP `suggest_layout` tool.
 * Pure function — no React dependencies.
 *
 * Strategy: greedy left-to-right placement.
 *   1. Devices first (largest → smallest by width)
 *   2. Connectors next
 *   3. Fans default to rear surface
 *
 * Returns positioned elements with no overlaps.
 * Returns empty array if elements don't fit.
 */
export function autoLayout(
  elementDefs: ElementDef[],
  panW: number,
  panH: number,
  options?: LayoutOptions,
): PanelElement[] {
  const spacing = options?.spacing ?? 4;
  const verticalCenter = options?.verticalCenter ?? true;

  // Resolve dimensions for each element def
  const resolved = elementDefs.map(def => {
    const dims = resolveDims(def);
    if (!dims) return null;
    return { ...def, ...dims };
  }).filter((e): e is NonNullable<typeof e> => e !== null);

  // Separate fans (rear surface) from faceplate elements
  const faceplateEls = resolved.filter(e => e.type !== 'fan');
  const fanEls = resolved.filter(e => e.type === 'fan');

  // Sort faceplate elements: devices first (largest width), then connectors
  faceplateEls.sort((a, b) => {
    if (a.type === 'device' && b.type !== 'device') return -1;
    if (a.type !== 'device' && b.type === 'device') return 1;
    return b.w - a.w; // larger first within same type
  });

  const placed: PanelElement[] = [];
  let cursor = spacing; // start with left margin

  // Place faceplate elements left-to-right
  for (const el of faceplateEls) {
    const centerX = cursor + el.w / 2;
    if (centerX + el.w / 2 + spacing > panW) {
      // Doesn't fit — skip (caller can check placed.length < defs.length)
      continue;
    }
    const centerY = verticalCenter ? panH / 2 : el.h / 2 + spacing;

    placed.push({
      id: uid(),
      type: el.type,
      key: el.key,
      x: +centerX.toFixed(2),
      y: +centerY.toFixed(2),
      w: el.w,
      h: el.h,
      label: el.name,
      surface: 'faceplate',
    });

    cursor = centerX + el.w / 2 + spacing;
  }

  // Place fans on rear surface (same X/Y layout, different surface)
  let fanCursor = spacing;
  for (const fan of fanEls) {
    const centerX = fanCursor + fan.w / 2;
    if (centerX + fan.w / 2 + spacing > panW) continue;
    const centerY = verticalCenter ? panH / 2 : fan.h / 2 + spacing;

    placed.push({
      id: uid(),
      type: 'fan',
      key: fan.key,
      x: +centerX.toFixed(2),
      y: +centerY.toFixed(2),
      w: fan.w,
      h: fan.h,
      label: fan.name,
      surface: 'rear',
    });

    fanCursor = centerX + fan.w / 2 + spacing;
  }

  return placed;
}

// ─── Helpers ─────────────────────────────────────────────────

function resolveDims(def: ElementDef): { w: number; h: number; name: string } | null {
  if (def.type === 'connector') {
    const con = CONNECTORS[def.key];
    if (!con) return null;
    return { w: con.w, h: con.h, name: con.name };
  }
  if (def.type === 'device') {
    const dev = lookupDevice(def.key);
    if (!dev) return null;
    return { w: dev.w, h: dev.h, name: dev.name };
  }
  if (def.type === 'fan') {
    const fan = FANS[def.key];
    if (!fan) return null;
    return { w: fan.size, h: fan.size, name: fan.name };
  }
  return null;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}
