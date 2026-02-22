import type { PanelElement, FabMethod } from '../types';
import type { TrayGeometry, EnclosureGeometry } from '../hooks/useEnclosure';
import { BASE } from '../constants/eia310';
import { FANS } from '../constants/fans';
import { lookupDevice } from '../constants/deviceLookup';

interface EnclosureInput {
  elements: PanelElement[];
  panelWidth: number;
  panelHeight: number;
  depth: number;
  wallThickness: number;
  rearPanel: boolean;
  fabMethod: FabMethod;
  metalThickness: number;
}

/**
 * Compute enclosure geometry from config inputs.
 * Pure function — no React dependencies.
 */
export function computeEnclosure(input: EnclosureInput): EnclosureGeometry {
  const { elements, panelWidth: panW, panelHeight: panH, depth, rearPanel, fabMethod, wallThickness, metalThickness } = input;
  const wallT = fabMethod === '3dp' ? wallThickness : metalThickness;

  const trays: TrayGeometry[] = elements
    .filter(e => e.type === 'device')
    .map(e => {
      const dev = lookupDevice(e.key);
      if (!dev) return null;
      const trayWallT = BASE.STRENGTH + Math.max(0, (dev.d - 100) * 0.02);
      const floorStyle: TrayGeometry['floorStyle'] = fabMethod === 'sm' ? 'solid' : 'hex';
      return {
        elementId: e.id,
        x: e.x,
        y: e.y,
        w: dev.w + BASE.TOLERANCE,
        h: dev.h,
        d: dev.d,
        wallT: trayWallT,
        floorStyle,
      };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null) as TrayGeometry[];

  return {
    depth,
    faceplate: { w: panW, h: panH, t: wallT },
    topWall: { w: panW, d: depth, t: wallT },
    bottomWall: { w: panW, d: depth, t: wallT },
    trays,
    rearPanel: rearPanel ? { w: panW, h: panH, t: wallT } : null,
  };
}

/**
 * Compute enclosure depth from elements, including fan depths.
 */
export function computeEnclosureDepth(
  elements: PanelElement[],
  wallAdd: number,
): number {
  let maxD = 0;
  for (const el of elements) {
    if (el.type === 'device') {
      const dev = lookupDevice(el.key);
      if (dev) maxD = Math.max(maxD, dev.d);
    } else if (el.type === 'fan') {
      const fan = FANS[el.key];
      if (fan) maxD = Math.max(maxD, fan.depthBehind);
    } else {
      // connector - use depthBehind from CONNECTORS via dynamic import
      // Keep simple: connector depths already covered by the main selector
    }
  }
  return Math.max(50, maxD + wallAdd + 10);
}
