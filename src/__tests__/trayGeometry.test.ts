import { describe, it, expect } from 'vitest';
import {
  computeTrayDimensions,
  computeMountPositions,
  computeAlignPositions,
  deriveTrayConfig,
} from '../lib/trayGeometry';
import { MOUNTING } from '../constants/mounting';
import { BASE } from '../constants/eia310';
import type { ExportElement } from '../types';

// ── Test fixtures ──────────────────────────────────────────────

/** USW-Lite-8: shallow/light device */
const LITE8: ExportElement = {
  type: 'device', key: 'usw-lite-8', label: 'USW-Lite-8',
  x: 100, y: 50, w: 200, h: 30.3,
  cutout: 'rect', depthBehind: 119,
};

/** USW-Pro-24: deep/heavy device (exceeds DEEP_TRAY_THRESHOLD) */
const PRO24: ExportElement = {
  type: 'device', key: 'usw-pro-24', label: 'USW-Pro-24',
  x: 225, y: 22, w: 442, h: 44,
  cutout: 'rect', depthBehind: 285,
};

/** Shallow device (depth < 100mm) */
const SHALLOW: ExportElement = {
  type: 'device', key: 'test-shallow', label: 'Shallow Box',
  x: 60, y: 30, w: 80, h: 25,
  cutout: 'rect', depthBehind: 60,
};

describe('computeTrayDimensions', () => {
  it('adds BASE.TOLERANCE to inner width', () => {
    const dims = computeTrayDimensions(LITE8, 2, '3dp');
    expect(dims.innerW).toBeCloseTo(LITE8.w + BASE.TOLERANCE, 4);
  });

  it('sets innerD to depthBehind', () => {
    const dims = computeTrayDimensions(PRO24, 2, '3dp');
    expect(dims.innerD).toBe(285);
  });

  it('scales wall thickness for deep trays', () => {
    const dims = computeTrayDimensions(PRO24, 2, '3dp');
    // trayWallT = 2 + max(0, (285-100)*0.02) = 2 + 3.7 = 5.7
    const expected = BASE.STRENGTH + Math.max(0, (285 - 100) * 0.02);
    expect(dims.wallT).toBeCloseTo(expected, 4);
  });

  it('uses base wall thickness for shallow trays', () => {
    const dims = computeTrayDimensions(SHALLOW, 3, '3dp');
    // trayWallT = 2 + max(0, (60-100)*0.02) = 2, but wallT param is 3 → max(3, 2) = 3
    expect(dims.wallT).toBe(3);
  });

  it('computes totalW = innerW + 2*wallT', () => {
    const dims = computeTrayDimensions(LITE8, 2, '3dp');
    expect(dims.totalW).toBeCloseTo(dims.innerW + 2 * dims.wallT, 4);
  });

  it('sets sideH to BASE.UNIT (15mm, open-top U-channel)', () => {
    const dims = computeTrayDimensions(LITE8, 2, '3dp');
    expect(dims.sideH).toBe(BASE.UNIT);
  });

  it('has stabilizers when device height > BASE.UNIT * 2', () => {
    const dims = computeTrayDimensions(LITE8, 2, '3dp');
    // LITE8.h = 30.3 > 30 → has stabilizers
    expect(dims.hasStabilizers).toBe(true);
    expect(dims.stabilizerH).toBeCloseTo(Math.min(LITE8.h - BASE.UNIT, dims.innerD), 4);
    expect(dims.stabilizerD).toBeCloseTo(Math.min(dims.stabilizerH, dims.innerD), 4);
  });

  it('has no stabilizers when device height <= BASE.UNIT * 2', () => {
    const dims = computeTrayDimensions(SHALLOW, 3, '3dp');
    // SHALLOW.h = 25 <= 30 → no stabilizers
    expect(dims.hasStabilizers).toBe(false);
    expect(dims.stabilizerH).toBe(0);
    expect(dims.stabilizerD).toBe(0);
  });

  it('computes floorT as max(BASE.STRENGTH, wallT*0.8)', () => {
    const dims = computeTrayDimensions(PRO24, 2, '3dp');
    const expected = Math.max(BASE.STRENGTH, dims.wallT * 0.8);
    expect(dims.floorT).toBeCloseTo(expected, 4);
  });
});

describe('computeMountPositions', () => {
  it('returns 2 positions for shallow trays', () => {
    const mounts = computeMountPositions(LITE8, 2);
    expect(mounts).toHaveLength(2);
    expect(mounts[0].side).toBe('top-left');
    expect(mounts[1].side).toBe('top-right');
  });

  it('returns 4 positions for deep trays (>150mm)', () => {
    const mounts = computeMountPositions(PRO24, 2);
    expect(mounts).toHaveLength(4);
    const sides = mounts.map(m => m.side);
    expect(sides).toContain('top-left');
    expect(sides).toContain('top-right');
    expect(sides).toContain('bottom-left');
    expect(sides).toContain('bottom-right');
  });

  it('positions are offset by MOUNT_INSET + wallT from element edges', () => {
    const wallT = 3;
    const mounts = computeMountPositions(LITE8, wallT);
    const inset = MOUNTING.MOUNT_INSET + wallT;

    // top-left: x = el.x - el.w/2 - inset
    expect(mounts[0].x).toBeCloseTo(LITE8.x - LITE8.w / 2 - inset, 4);
    // top-left: y = el.y - el.h/2 - inset
    expect(mounts[0].y).toBeCloseTo(LITE8.y - LITE8.h / 2 - inset, 4);
  });

  it('threshold is exactly 150mm', () => {
    const at150: ExportElement = { ...LITE8, depthBehind: 150 };
    const just150 = computeMountPositions(at150, 2);
    expect(just150).toHaveLength(2); // not >150

    const over150: ExportElement = { ...LITE8, depthBehind: 150.01 };
    const over = computeMountPositions(over150, 2);
    expect(over).toHaveLength(4);
  });
});

describe('computeAlignPositions', () => {
  it('always returns 2 positions (bottom-left, bottom-right)', () => {
    const aligns = computeAlignPositions(LITE8, 2);
    expect(aligns).toHaveLength(2);
    expect(aligns[0].side).toBe('bottom-left');
    expect(aligns[1].side).toBe('bottom-right');
  });

  it('positions are at bottom corners with correct inset', () => {
    const wallT = 2;
    const aligns = computeAlignPositions(LITE8, wallT);
    const inset = MOUNTING.MOUNT_INSET + wallT;
    expect(aligns[0].x).toBeCloseTo(LITE8.x - LITE8.w / 2 - inset, 4);
    expect(aligns[0].y).toBeCloseTo(LITE8.y + LITE8.h / 2 + inset / 2, 4);
  });
});

describe('deriveTrayConfig', () => {
  it('defaults to hex floorStyle for 3DP (no trayFab arg)', () => {
    const cfg = deriveTrayConfig(LITE8);
    expect(cfg.attachPoints).toBe(2);
    expect(cfg.hasRearWall).toBe(false);
    expect(cfg.floorStyle).toBe('hex');
  });

  it('returns solid floorStyle when trayFab is sm', () => {
    const cfg = deriveTrayConfig(LITE8, 'sm');
    expect(cfg.floorStyle).toBe('solid');
  });

  it('returns hex floorStyle when trayFab is 3dp', () => {
    const cfg = deriveTrayConfig(LITE8, '3dp');
    expect(cfg.floorStyle).toBe('hex');
  });

  it('returns 4 attach points for deep devices', () => {
    const cfg = deriveTrayConfig(PRO24);
    expect(cfg.attachPoints).toBe(4);
  });
});
