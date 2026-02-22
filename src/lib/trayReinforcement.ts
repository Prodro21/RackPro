/**
 * Weight/span-based tray structural analysis.
 * Pure function — no React dependencies.
 *
 * Computes floor ribs, stabilizer gussets, rear stoppers, cross-ribs,
 * and structural warnings based on device weight & tray dimensions.
 */

import type { ExportElement, FabMethod, TrayRib, TrayGusset, StructuralWarning, TrayReinforcementResult } from '../types';
import { BASE } from '../constants/eia310';

interface TrayDevice {
  el: ExportElement;
  weight: number;        // kg (from DeviceDef.wt)
  deviceH: number;       // device physical height (mm)
}

export function computeTrayReinforcement(
  device: TrayDevice,
  trayWidth: number,
  trayDepth: number,
  floorT: number,
  wallT: number,
  fabMethod: FabMethod,
): TrayReinforcementResult {
  const { weight, deviceH } = device;
  const warnings: StructuralWarning[] = [];

  // ─── Suggested thicknesses ──────────────────────────────────
  const suggestedFloorT = Math.max(2, 1.5 + Math.ceil(weight * 0.5));
  const suggestedWallT = Math.max(
    BASE.STRENGTH,
    BASE.STRENGTH + Math.max(0, (trayDepth - 100) * 0.02) + Math.max(0, (weight - 2) * 0.5),
  );

  // ─── Rule 1: Floor longitudinal ribs ────────────────────────
  const floorRibs: TrayRib[] = [];
  if (weight > 0.8 || trayWidth > 80) {
    const ribCount = Math.max(1, Math.floor(trayWidth / 60));
    const ribT = Math.max(1.5, wallT / 2);
    const spacing = trayWidth / (ribCount + 1);
    for (let i = 0; i < ribCount; i++) {
      const ribX = -trayWidth / 2 + spacing * (i + 1);
      floorRibs.push({
        x: ribX,
        y: 0,
        z: -(floorT + 5 / 2), // below floor
        w: ribT,
        h: 5,
        d: trayDepth * 0.9,
        type: 'floor-rib',
      });
    }
  }

  // ─── Rule 2: Stabilizer gussets ─────────────────────────────
  // Triggered when device height > BASE.UNIT * 2 (30mm) — matches OpenSCAD
  const gussets: TrayGusset[] = [];
  if (deviceH > BASE.UNIT * 2) {
    const gussetH = Math.min(deviceH - BASE.UNIT, trayDepth);
    const gussetD = Math.min(gussetH, trayDepth);
    gussets.push(
      { side: 'left', height: gussetH, depth: gussetD },
      { side: 'right', height: gussetH, depth: gussetD },
    );
  }

  // ─── Rule 3: Rear stoppers (wedge blocks at rear corners) ──
  // OpenSCAD dims: wallT × BASE_UNIT × (BASE_UNIT - wallT)
  const rearStoppers: TrayRib[] = [];
  const sideWallH = BASE.UNIT;  // 15mm — open-top U-channel
  const wedgeDepth = BASE.UNIT - wallT;
  rearStoppers.push(
    {
      x: -trayWidth / 2 + wallT / 2,
      y: 0,
      z: -(trayDepth - wedgeDepth / 2),
      w: wallT,
      h: sideWallH,
      d: wedgeDepth,
      type: 'rear-stopper',
    },
    {
      x: trayWidth / 2 - wallT / 2,
      y: 0,
      z: -(trayDepth - wedgeDepth / 2),
      w: wallT,
      h: sideWallH,
      d: wedgeDepth,
      type: 'rear-stopper',
    },
  );

  // ─── Rule 4: Cross-ribs for deep + heavy trays ─────────────
  const crossRibs: TrayRib[] = [];
  if (trayDepth > 150 && weight > 1.5) {
    const ribT = Math.max(1.5, wallT / 2);
    crossRibs.push({
      x: 0,
      y: 0,
      z: -(trayDepth / 2),
      w: trayWidth,
      h: 5,
      d: ribT,
      type: 'cross-rib',
    });
  }

  // ─── Structural warnings ────────────────────────────────────
  if (weight > 3 && trayWidth > 150) {
    warnings.push({
      severity: 'warning',
      message: `Heavy device (${weight}kg) on wide tray — add floor ribs or increase floor to ${suggestedFloorT}mm`,
    });
  }

  if (deviceH > sideWallH) {
    warnings.push({
      severity: 'warning',
      message: 'Device taller than tray walls — risk of tipping',
    });
  }

  // CG estimate: device center of gravity ≈ deviceH / 2
  if (deviceH > 0 && deviceH / 2 > sideWallH * 2) {
    warnings.push({
      severity: 'info',
      message: 'High center of gravity — consider bracket variant instead of tray',
    });
  }

  if (floorT < suggestedFloorT) {
    warnings.push({
      severity: 'warning',
      message: `Floor thickness ${floorT}mm below recommended ${suggestedFloorT}mm for ${weight}kg device`,
    });
  }

  return {
    floorRibs,
    gussets,
    rearStoppers,
    crossRibs,
    warnings,
    suggestedFloorT,
    suggestedWallT,
  };
}
