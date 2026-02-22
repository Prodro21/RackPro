import { z } from 'zod';
import { getState } from '../state';
import { panelDimensions, panelHeight } from '../../constants/eia310';
import { CONNECTORS } from '../../constants/connectors';
import { FANS } from '../../constants/fans';
import { DEVICES } from '../../constants/devices';
import { METALS, FILAMENTS, bendAllowance90 } from '../../constants/materials';
import { PRINTERS } from '../../constants/printers';
import { computeReinforcement } from '../../lib/reinforcement';
import { computeMarginWarnings, defaultMinGap } from '../../lib/margins';
import type { ExportConfig, SplitInfo, TrayConfig } from '../../types';
import { MOUNTING } from '../../constants/mounting';

// Import generators — these don't depend on React
import { generateOpenSCAD } from '../../export/openscadGen';
import { generateFusion360 } from '../../export/fusion360Gen';
import { generateDXF, generateAllTrayDXFs } from '../../export/dxfGen';
import { fusionBuild } from '../fusion-client';

export const exportSchema = z.object({
  format: z.enum(['openscad', 'fusion360', 'fusion360-live', 'dxf', 'dxf-trays', 'json']).describe('Export format: openscad, fusion360 (script), fusion360-live (send to bridge), dxf (faceplate flat pattern), dxf-trays (per-device tray flat patterns), json'),
});

export async function handleExport(args: z.infer<typeof exportSchema>) {
  const config = buildExportConfig();

  switch (args.format) {
    case 'json':
      return { success: true, format: 'json', content: JSON.stringify(config, null, 2) };
    case 'openscad':
      return { success: true, format: 'openscad', content: generateOpenSCAD(config) };
    case 'fusion360':
      return { success: true, format: 'fusion360', content: generateFusion360(config) };
    case 'fusion360-live': {
      try {
        const result = await fusionBuild(config);
        return { format: 'fusion360-live', ...result };
      } catch (err: unknown) {
        return { success: false, format: 'fusion360-live', error: err instanceof Error ? err.message : String(err) };
      }
    }
    case 'dxf':
      if (config.fabrication.method !== 'Sheet Metal') {
        return { success: false, error: 'DXF export requires sheet metal fabrication mode' };
      }
      return { success: true, format: 'dxf', content: generateDXF(config) };
    case 'dxf-trays': {
      if (config.fabrication.method !== 'Sheet Metal') {
        return { success: false, error: 'Tray DXF export requires sheet metal fabrication mode' };
      }
      const trays = generateAllTrayDXFs(config);
      if (trays.length === 0) {
        return { success: false, error: 'No device elements found — tray DXFs require at least one device' };
      }
      return { success: true, format: 'dxf-trays', trays };
    }
    default:
      return { success: false, error: `Unknown format: ${args.format}` };
  }
}

export function buildExportConfig(): ExportConfig {
  const s = getState();
  const dims = panelDimensions(s.standard);
  const panH = panelHeight(s.uHeight);
  const mt = METALS[s.metalKey];
  const fil = FILAMENTS[s.filamentKey];
  const pr = PRINTERS[s.printerKey];

  let maxD = 0;
  for (const el of s.elements) {
    if (el.type === 'device') maxD = Math.max(maxD, DEVICES[el.key]?.d ?? 0);
    else if (el.type === 'fan') maxD = Math.max(maxD, FANS[el.key]?.depthBehind ?? 0);
    else maxD = Math.max(maxD, CONNECTORS[el.key]?.depthBehind ?? 0);
  }
  const wallAdd = s.fabMethod === '3dp' ? s.wallThickness * 2 : mt.t * 2;
  const depth = Math.max(50, maxD + wallAdd + 10);

  // Compute split
  const splitInfo: SplitInfo = { type: 'none', parts: [{ name: 'Full Panel', w: dims.totalWidth, fitsX: true, fitsY: true, color: '#4ade80' }] };

  const ba90 = bendAllowance90(mt.br, mt.t, 0.40);

  const fab = s.fabMethod === '3dp'
    ? {
        method: '3D Print' as const,
        printer: pr.name,
        bed: pr.bed,
        filament: fil.name,
        wallThickness: s.wallThickness,
        split: splitInfo,
      }
    : {
        method: 'Sheet Metal' as const,
        material: mt.name,
        thickness: mt.t,
        bendRadius: mt.br,
        kFactor: 0.40,
        ba90: +ba90.toFixed(3),
        flangeDepth: s.flangeDepth,
      };

  // Determine tray floor style based on fabrication method
  const trayFabMethod = s.assemblyMode === 'modular' ? s.trayFabMethod : s.fabMethod;
  const trayFloorStyle: 'solid' | 'hex' = trayFabMethod === 'sm' ? 'solid' : 'hex';

  const ribs = s.autoReinforcement
    ? computeReinforcement(s.elements, dims.panelWidth, panH, s.wallThickness, depth, s.fabMethod)
    : [];
  const marginWarnings = computeMarginWarnings(
    s.elements.filter(e => !e.surface || e.surface === 'faceplate'),
    dims.panelWidth,
    panH,
    defaultMinGap(s.fabMethod, mt.t),
  );

  return {
    panel: {
      standard: s.standard,
      uHeight: s.uHeight,
      panelWidth: dims.panelWidth,
      panelHeight: panH,
      totalWidth: dims.totalWidth,
      mountHoleType: s.mountHoleType,
    },
    enclosure: {
      depth,
      maxDeviceDepth: maxD,
      rearPanel: s.rearPanel,
      ventSlots: s.ventSlots,
      flanges: s.flanges,
      flangeDepth: s.flangeDepth,
      chamfers: s.chamfers,
      style: s.enclosureStyle,
    },
    fabrication: fab,
    elements: s.elements.map(e => {
      const con = e.type === 'connector' ? CONNECTORS[e.key] : undefined;
      const dev = e.type === 'device' ? DEVICES[e.key] : undefined;
      const fan = e.type === 'fan' ? FANS[e.key] : undefined;
      return {
        type: e.type,
        key: e.key,
        label: e.label,
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
        w: e.w,
        h: e.h,
        cutout: fan ? 'round' as const : con?.cut ?? 'rect' as const,
        radius: fan ? fan.cutoutDiameter / 2 : con?.r,
        depthBehind: con?.depthBehind ?? dev?.d ?? fan?.depthBehind ?? 0,
        surface: e.surface,
        ...(e.type === 'device' ? { floorStyle: trayFloorStyle } : {}),
      };
    }),
    reinforcement: ribs.length > 0 ? ribs : undefined,
    marginWarnings: marginWarnings.length > 0 ? marginWarnings : undefined,
    assembly: s.assemblyMode === 'modular' ? {
      mode: 'modular',
      faceFab: s.faceFabMethod,
      trayFab: s.trayFabMethod,
      trays: s.elements
        .filter(e => e.type === 'device')
        .map(e => {
          const dev = DEVICES[e.key];
          return {
            elementId: e.id,
            hasRearWall: false,
            floorStyle: trayFloorStyle,
            attachPoints: (dev && dev.d > MOUNTING.DEEP_TRAY_THRESHOLD ? 4 : 2) as 2 | 4,
          } satisfies TrayConfig;
        }),
    } : undefined,
  };
}
