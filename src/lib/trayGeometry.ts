/**
 * Pure functions for tray dimensions and mount positions.
 * Shared by all generators (Fusion, OpenSCAD, DXF).
 */

import type { ExportElement, FabMethod, TrayConfig } from '../types';
import { MOUNTING } from '../constants/mounting';
import { BASE } from '../constants/eia310';

export interface TrayDims {
  innerW: number;     // device width + tolerance
  innerD: number;     // device depth behind panel
  wallT: number;      // side wall thickness
  floorT: number;     // floor thickness
  sideH: number;      // side wall height = BASE.UNIT (15mm)
  totalW: number;     // innerW + 2*wallT
  totalD: number;     // innerD
  hasStabilizers: boolean;  // true when device height > BASE.UNIT * 2
  stabilizerH: number;      // height above side wall (0 if no stabilizers)
  stabilizerD: number;      // depth along tray (0 if no stabilizers)
}

export interface MountPosition {
  x: number;          // panel-relative X
  y: number;          // panel-relative Y
  side: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export interface AlignPosition {
  x: number;
  y: number;
  side: 'bottom-left' | 'bottom-right';
}

/** Compute tray inner/outer dimensions. */
export function computeTrayDimensions(
  el: ExportElement,
  wallT: number,
  fabMethod: FabMethod,
): TrayDims {
  const innerW = el.w + BASE.TOLERANCE;
  const innerD = el.depthBehind;
  const trayWallT = BASE.STRENGTH + Math.max(0, (innerD - 100) * 0.02);
  const effectiveWallT = Math.max(wallT, trayWallT);
  const floorT = Math.max(BASE.STRENGTH, effectiveWallT * 0.8);
  const sideH = BASE.UNIT;  // 15mm — open-top U-channel per OpenSCAD reference

  const hasStabilizers = el.h > BASE.UNIT * 2;
  const stabilizerH = hasStabilizers ? Math.min(el.h - BASE.UNIT, innerD) : 0;
  const stabilizerD = hasStabilizers ? Math.min(stabilizerH, innerD) : 0;

  return {
    innerW,
    innerD,
    wallT: effectiveWallT,
    floorT,
    sideH,
    totalW: innerW + 2 * effectiveWallT,
    totalD: innerD,
    hasStabilizers,
    stabilizerH,
    stabilizerD,
  };
}

/** Compute mounting boss positions on the faceplate rear face (panel-relative coords). */
export function computeMountPositions(
  el: ExportElement,
  wallT: number,
): MountPosition[] {
  const inset = MOUNTING.MOUNT_INSET + wallT;
  const positions: MountPosition[] = [
    { x: el.x - el.w / 2 - inset, y: el.y - el.h / 2 - inset, side: 'top-left' },
    { x: el.x + el.w / 2 + inset, y: el.y - el.h / 2 - inset, side: 'top-right' },
  ];

  // For deep trays (>150mm), add 2 rear-side attach points
  if (el.depthBehind > MOUNTING.DEEP_TRAY_THRESHOLD) {
    positions.push(
      { x: el.x - el.w / 2 - inset, y: el.y + el.h / 2 + inset, side: 'bottom-left' },
      { x: el.x + el.w / 2 + inset, y: el.y + el.h / 2 + inset, side: 'bottom-right' },
    );
  }

  return positions;
}

/** Compute alignment pin positions at bottom corners of device bay. */
export function computeAlignPositions(
  el: ExportElement,
  wallT: number,
): AlignPosition[] {
  const inset = MOUNTING.MOUNT_INSET + wallT;
  return [
    { x: el.x - el.w / 2 - inset, y: el.y + el.h / 2 + inset / 2, side: 'bottom-left' },
    { x: el.x + el.w / 2 + inset, y: el.y + el.h / 2 + inset / 2, side: 'bottom-right' },
  ];
}

/** Generate TrayConfig for a device element (derive from element properties).
 *  trayFab: fabrication method for the tray — 'sm' forces solid, otherwise hex. */
export function deriveTrayConfig(el: ExportElement, trayFab?: string): TrayConfig {
  return {
    elementId: el.key, // will be overridden by caller with actual id
    hasRearWall: false,
    floorStyle: trayFab === 'sm' ? 'solid' : 'hex',
    attachPoints: el.depthBehind > MOUNTING.DEEP_TRAY_THRESHOLD ? 4 : 2,
  };
}
