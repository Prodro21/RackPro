import type { ExportConfig, BomItem, FabConfig3DP } from '../types';
import { BORE_HOLES } from '../constants/eia310';

/**
 * Compute a hardware Bill of Materials from the export config.
 * Returns screw/nut counts for rack mounting, split joints, and modular assembly.
 */
export function computeBom(config: ExportConfig): BomItem[] {
  const items: BomItem[] = [];
  const mountType = config.panel.mountHoleType ?? '#10-32';
  const boreDia = BORE_HOLES[mountType]?.diameter ?? 4.83;
  const boresPerU = 3;
  const sides = 2;
  const totalBores = config.panel.uHeight * boresPerU * sides;

  // 1. Rack mounting hardware
  const isMetric = mountType.startsWith('M');
  const screwSpec = isMetric
    ? `${mountType}x12mm`
    : `${mountType} x 1/2"`;

  items.push({
    qty: totalBores,
    part: `Rack screw`,
    spec: screwSpec,
    note: `${mountType} — ${totalBores} bores (${config.panel.uHeight}U x ${boresPerU} x ${sides} sides)`,
  });

  items.push({
    qty: totalBores,
    part: isMetric ? 'Cage nut' : 'Cage nut / clip nut',
    spec: mountType,
    note: `Matching ${mountType} for square-hole rack rails`,
  });

  // 2. Split joint hardware (3D print only)
  const is3dp = config.fabrication.method === '3D Print';
  if (is3dp) {
    const fab = config.fabrication as FabConfig3DP;
    const split = fab.split;

    if (split.type === '3-piece') {
      items.push({
        qty: 4,
        part: 'Lockpin',
        spec: `${split.lockpinHole ?? 4}mm square, 3D printed`,
        note: '2 per side — slide through aligned holes in mountbar/ear joint',
      });

      // PLA reinforcement bolts
      if (fab.filament.toLowerCase().includes('pla')) {
        items.push({
          qty: 4,
          part: 'M3x12mm bolt',
          spec: 'M3x12mm socket head cap',
          note: 'PLA reinforcement — through lockpin holes for positive retention',
        });
        items.push({
          qty: 4,
          part: 'M3 nut',
          spec: 'M3 hex nut',
        });
      }
    } else if (split.type === '2-piece') {
      items.push({
        qty: 4,
        part: 'M3x12mm bolt',
        spec: 'M3x12mm socket head cap',
        note: 'Center-split alignment and retention',
      });
      items.push({
        qty: 4,
        part: 'M3 nut',
        spec: 'M3 hex nut',
      });
    }
  }

  // 3. Modular assembly hardware
  if (config.assembly?.mode === 'modular') {
    const devices = config.elements.filter(e => e.type === 'device');
    const mountsPerDevice = 4; // 2 or 4 tabs per tray (default 4 for robustness)
    const totalMounts = devices.length * mountsPerDevice;

    if (totalMounts > 0) {
      if (is3dp) {
        // 3D print: heat-set inserts + M3 bolts
        items.push({
          qty: totalMounts,
          part: 'M3x8mm bolt',
          spec: 'M3x8mm socket head cap',
          note: `${mountsPerDevice} per device tray — secure trays to faceplate`,
        });
        items.push({
          qty: totalMounts,
          part: 'M3x5mm heat-set insert',
          spec: 'M3x5x4mm brass knurled',
          note: 'Press into faceplate mounting bosses with soldering iron',
        });
      } else {
        // Sheet metal: PEM clinch nuts + M3 bolts
        items.push({
          qty: totalMounts,
          part: 'M3x8mm bolt',
          spec: 'M3x8mm socket head cap',
          note: `${mountsPerDevice} per device tray`,
        });
        items.push({
          qty: totalMounts,
          part: 'M3 PEM clinch nut',
          spec: 'CLS-M3-1 or equivalent',
          note: 'Press-fit into faceplate mounting holes',
        });
      }
    }
  }

  return items;
}
