import type { ExportConfig } from '../types';
import { useConfigStore } from '../store/useConfigStore';
import { selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectMaxDeviceDepth, selectSplitInfo, selectBendAllowance90, selectMetal, selectFilament, selectPrinter, selectMarginWarnings } from '../store/selectors';
import { FANS } from '../constants/fans';
import { lookupDevice } from '../constants/deviceLookup';
import { lookupConnector } from '../constants/connectorLookup';
import { computeReinforcement } from '../lib/reinforcement';
import { getCachedOutlinePath } from '../catalog/outlines';

export function generateConfig(): ExportConfig {
  const s = useConfigStore.getState();
  const panDims = selectPanelDims(s);
  const panH = selectPanelHeight(s);
  const depth = selectEnclosureDepth(s);
  const maxD = selectMaxDeviceDepth(s);
  const splitInfo = selectSplitInfo(s);
  const mt = selectMetal(s);
  const fil = selectFilament(s);
  const pr = selectPrinter(s);
  const ba90 = selectBendAllowance90(s);

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

  const marginWarnings = selectMarginWarnings(s);
  const ribs = s.autoReinforcement
    ? computeReinforcement(s.elements, panDims.panelWidth, panH, s.wallThickness, depth, s.fabMethod, splitInfo)
    : [];

  const fanElements = s.elements.filter(e => e.type === 'fan');

  return {
    panel: {
      standard: s.standard,
      uHeight: s.uHeight,
      panelWidth: panDims.panelWidth,
      panelHeight: panH,
      totalWidth: panDims.totalWidth,
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
      const con = e.type === 'connector' ? lookupConnector(e.key) : undefined;
      const dev = e.type === 'device' ? lookupDevice(e.key) : undefined;
      const fan = e.type === 'fan' ? FANS[e.key] : undefined;
      const outlinePath = e.type === 'device' ? getCachedOutlinePath(e.key, 'top') : undefined;
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
        ...(outlinePath ? { outlinePath } : {}),
        ...(e.labelConfig ? { labelConfig: e.labelConfig } : {}),
      };
    }),
    reinforcement: ribs.length > 0 ? ribs : undefined,
    marginWarnings: marginWarnings.length > 0 ? marginWarnings : undefined,
    fans: fanElements.length > 0 ? fanElements.map(e => {
      const fan = FANS[e.key];
      return {
        type: e.type,
        key: e.key,
        label: e.label,
        x: +e.x.toFixed(2),
        y: +e.y.toFixed(2),
        w: e.w,
        h: e.h,
        cutout: 'round' as const,
        radius: fan ? fan.cutoutDiameter / 2 : e.w / 2,
        depthBehind: fan?.depthBehind ?? 0,
        surface: e.surface,
      };
    }) : undefined,
  };
}

export function exportJSON(config: ExportConfig): string {
  return JSON.stringify(config, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
