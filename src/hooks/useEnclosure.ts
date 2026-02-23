import { useMemo } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectMetal } from '../store';
import { BASE } from '../constants/eia310';
import { lookupDevice } from '../constants/deviceLookup';

export interface TrayGeometry {
  elementId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  wallT: number;
  floorStyle: 'solid' | 'hex' | 'slatted';
}

export interface EnclosureGeometry {
  depth: number;
  faceplate: { w: number; h: number; t: number };
  topWall: { w: number; d: number; t: number };
  bottomWall: { w: number; d: number; t: number };
  trays: TrayGeometry[];
  rearPanel: { w: number; h: number; t: number } | null;
}

export function useEnclosure(): EnclosureGeometry {
  const fabMethod = useConfigStore(s => s.fabMethod);
  const wallThickness = useConfigStore(s => s.wallThickness);
  const rearPanel = useConfigStore(s => s.rearPanel);
  const elements = useConfigStore(s => s.elements);
  const panDims = useConfigStore(selectPanelDims);
  const panH = useConfigStore(selectPanelHeight);
  const depth = useConfigStore(selectEnclosureDepth);
  const metal = useConfigStore(selectMetal);
  const assemblyMode = useConfigStore(s => s.assemblyMode);
  const trayFabMethod = useConfigStore(s => s.trayFabMethod);

  return useMemo(() => {
    const wallT = fabMethod === '3dp' ? wallThickness : metal.t;
    const effectiveTrayFab = assemblyMode === 'modular' ? trayFabMethod : fabMethod;
    const floorStyle: TrayGeometry['floorStyle'] = effectiveTrayFab === 'sm' ? 'solid' : 'hex';

    const trays: TrayGeometry[] = elements
      .filter(e => e.type === 'device')
      .map(e => {
        const dev = lookupDevice(e.key);
        if (!dev) return null;
        // Tray wall strength auto-scales with depth (from OpenSCAD)
        const trayWallT = BASE.STRENGTH + Math.max(0, (dev.d - 100) * 0.02);
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
      faceplate: { w: panDims.panelWidth, h: panH, t: wallT },
      topWall: { w: panDims.panelWidth, d: depth, t: wallT },
      bottomWall: { w: panDims.panelWidth, d: depth, t: wallT },
      trays,
      rearPanel: rearPanel ? { w: panDims.panelWidth, h: panH, t: wallT } : null,
    };
  }, [fabMethod, wallThickness, rearPanel, elements, panDims, panH, depth, metal, assemblyMode, trayFabMethod]);
}
