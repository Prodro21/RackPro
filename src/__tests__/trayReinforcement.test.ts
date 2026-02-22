import { describe, it, expect } from 'vitest';
import { computeTrayReinforcement } from '../lib/trayReinforcement';
import { BASE } from '../constants/eia310';
import type { ExportElement } from '../types';

// ── Test fixtures ──────────────────────────────────────────────

const makeDevice = (overrides: Partial<ExportElement> = {}): ExportElement => ({
  type: 'device', key: 'test', label: 'Test',
  x: 100, y: 50, w: 200, h: 30, cutout: 'rect', depthBehind: 120,
  ...overrides,
});

describe('computeTrayReinforcement', () => {
  describe('Rule 1: Floor longitudinal ribs', () => {
    it('adds ribs when weight > 0.8kg', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.2, deviceH: 30 },
        200, 120, 2, 2, '3dp',
      );
      expect(result.floorRibs.length).toBeGreaterThan(0);
      expect(result.floorRibs.every(r => r.type === 'floor-rib')).toBe(true);
    });

    it('adds ribs when width > 80mm (even if weight is low)', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 0.3, deviceH: 30 },
        100, 120, 2, 2, '3dp',
      );
      expect(result.floorRibs.length).toBeGreaterThan(0);
    });

    it('does NOT add ribs when weight <= 0.8 AND width <= 80', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice({ w: 60 }), weight: 0.5, deviceH: 25 },
        60, 80, 2, 2, '3dp',
      );
      expect(result.floorRibs).toHaveLength(0);
    });

    it('spaces ribs evenly: count = floor(width/60)', () => {
      const width = 200;
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.0, deviceH: 30 },
        width, 120, 2, 2, '3dp',
      );
      const expectedCount = Math.max(1, Math.floor(width / 60));
      expect(result.floorRibs).toHaveLength(expectedCount);
    });

    it('rib depth is 90% of tray depth', () => {
      const trayDepth = 120;
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.2, deviceH: 30 },
        200, trayDepth, 2, 2, '3dp',
      );
      expect(result.floorRibs[0].d).toBeCloseTo(trayDepth * 0.9, 4);
    });
  });

  describe('Rule 2: Stabilizer gussets', () => {
    it('adds 2 gussets when deviceH > BASE.UNIT * 2 (30mm)', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.0, deviceH: 43.7 },
        200, 120, 2, 2, '3dp',
      );
      expect(result.gussets).toHaveLength(2);
      expect(result.gussets[0].side).toBe('left');
      expect(result.gussets[1].side).toBe('right');
    });

    it('does NOT add gussets when deviceH <= BASE.UNIT * 2 (30mm)', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.0, deviceH: 30 },
        200, 120, 2, 2, '3dp',
      );
      expect(result.gussets).toHaveLength(0);
    });

    it('gusset height = min(deviceH - BASE.UNIT, trayDepth)', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.0, deviceH: 43.7 },
        200, 120, 2, 2, '3dp',
      );
      expect(result.gussets[0].height).toBeCloseTo(Math.min(43.7 - BASE.UNIT, 120), 4);
    });

    it('gusset depth = min(gussetH, trayDepth)', () => {
      const trayDepth = 120;
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.0, deviceH: 43.7 },
        200, trayDepth, 2, 2, '3dp',
      );
      const gH = Math.min(43.7 - BASE.UNIT, trayDepth);
      expect(result.gussets[0].depth).toBeCloseTo(Math.min(gH, trayDepth), 4);
    });
  });

  describe('Rule 3: Rear stoppers', () => {
    it('always adds 2 rear stoppers', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 0.5, deviceH: 25 },
        60, 80, 2, 2, '3dp',
      );
      expect(result.rearStoppers).toHaveLength(2);
      expect(result.rearStoppers.every(r => r.type === 'rear-stopper')).toBe(true);
    });

    it('stopper height equals BASE.UNIT (15mm, not device height)', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.0, deviceH: 43.7 },
        200, 120, 2, 2, '3dp',
      );
      expect(result.rearStoppers[0].h).toBe(BASE.UNIT);
    });

    it('stopper depth equals BASE.UNIT - wallT', () => {
      const wallT = 2;
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.0, deviceH: 30 },
        200, 120, 2, wallT, '3dp',
      );
      expect(result.rearStoppers[0].d).toBe(BASE.UNIT - wallT);
    });

    it('stoppers positioned at left and right edges', () => {
      const trayWidth = 200;
      const wallT = 2;
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.0, deviceH: 30 },
        trayWidth, 120, 2, wallT, '3dp',
      );
      expect(result.rearStoppers[0].x).toBeCloseTo(-trayWidth / 2 + wallT / 2, 4);
      expect(result.rearStoppers[1].x).toBeCloseTo(trayWidth / 2 - wallT / 2, 4);
    });
  });

  describe('Rule 4: Cross-ribs', () => {
    it('adds cross-rib when depth > 150 AND weight > 1.5', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 2.0, deviceH: 30 },
        200, 200, 2, 2, '3dp',
      );
      expect(result.crossRibs).toHaveLength(1);
      expect(result.crossRibs[0].type).toBe('cross-rib');
    });

    it('does NOT add cross-rib when depth <= 150', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 2.0, deviceH: 30 },
        200, 150, 2, 2, '3dp',
      );
      expect(result.crossRibs).toHaveLength(0);
    });

    it('does NOT add cross-rib when weight <= 1.5', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 1.5, deviceH: 30 },
        200, 200, 2, 2, '3dp',
      );
      expect(result.crossRibs).toHaveLength(0);
    });

    it('cross-rib spans full tray width', () => {
      const trayWidth = 200;
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 2.0, deviceH: 30 },
        trayWidth, 200, 2, 2, '3dp',
      );
      expect(result.crossRibs[0].w).toBe(trayWidth);
    });
  });

  describe('Suggested thicknesses', () => {
    it('suggestedFloorT = max(2, 1.5 + ceil(weight * 0.5))', () => {
      // 0.4kg → ceil(0.4*0.5) = ceil(0.2) = 1 → max(2, 1.5+1) = 2.5
      expect(computeTrayReinforcement(
        { el: makeDevice(), weight: 0.4, deviceH: 30 },
        100, 100, 2, 2, '3dp',
      ).suggestedFloorT).toBe(2.5);

      // 1.2kg → max(2, 1.5+1) = 2.5
      expect(computeTrayReinforcement(
        { el: makeDevice(), weight: 1.2, deviceH: 30 },
        100, 100, 2, 2, '3dp',
      ).suggestedFloorT).toBe(2.5);

      // 5.1kg → max(2, 1.5+3) = 4.5
      expect(computeTrayReinforcement(
        { el: makeDevice(), weight: 5.1, deviceH: 30 },
        100, 100, 2, 2, '3dp',
      ).suggestedFloorT).toBe(4.5);
    });

    it('suggestedWallT scales with depth and weight', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 3.0, deviceH: 40 },
        200, 200, 2, 2, '3dp',
      );
      const expected = Math.max(
        BASE.STRENGTH,
        BASE.STRENGTH + Math.max(0, (200 - 100) * 0.02) + Math.max(0, (3.0 - 2) * 0.5),
      );
      expect(result.suggestedWallT).toBeCloseTo(expected, 4);
    });
  });

  describe('Structural warnings', () => {
    it('warns when heavy device on wide tray (weight > 3 && width > 150)', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 3.5, deviceH: 30 },
        200, 120, 2, 2, '3dp',
      );
      const heavyWarn = result.warnings.find(w =>
        w.message.includes('Heavy device')
      );
      expect(heavyWarn).toBeDefined();
      expect(heavyWarn!.severity).toBe('warning');
    });

    it('warns when floor thickness below suggested', () => {
      // weight 2kg → suggestedFloorT = max(2, 1.5+1) = 2.5
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 2.0, deviceH: 30 },
        200, 120, 1.5, 2, '3dp', // floorT=1.5 < suggested=2.5
      );
      const floorWarn = result.warnings.find(w =>
        w.message.includes('Floor thickness')
      );
      expect(floorWarn).toBeDefined();
    });

    it('no warnings for light device shorter than tray walls', () => {
      // deviceH=10 <= BASE.UNIT (15mm) → no "taller than walls" warning
      const result = computeTrayReinforcement(
        { el: makeDevice({ w: 60 }), weight: 0.4, deviceH: 10 },
        60, 80, 3, 2, '3dp', // floorT=3 >= suggested=2
      );
      expect(result.warnings).toHaveLength(0);
    });

    it('warns when device taller than tray walls (15mm)', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice(), weight: 0.4, deviceH: 25 },
        60, 80, 3, 2, '3dp',
      );
      const tallWarn = result.warnings.find(w => w.message.includes('taller than tray walls'));
      expect(tallWarn).toBeDefined();
    });
  });

  describe('Real device scenarios (from plan verification)', () => {
    it('USW-Lite-8 (0.8kg, 200×119mm) — gussets for height 30.3mm', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice({ w: 200, depthBehind: 119 }), weight: 0.8, deviceH: 30.3 },
        200, 119, 2, 2, '3dp',
      );
      // Weight exactly 0.8 — NOT > 0.8, but width 200 > 80 → ribs
      expect(result.floorRibs.length).toBeGreaterThan(0);
      // Height 30.3 > 30 → gussets
      expect(result.gussets).toHaveLength(2);
      // Depth 119 < 150 → no cross-ribs
      expect(result.crossRibs).toHaveLength(0);
      // suggestedFloorT = max(2, 1.5+ceil(0.8*0.5)) = max(2, 1.5+1) = 2.5
      expect(result.suggestedFloorT).toBe(2.5);
    });

    it('USW-Pro-24 (5.1kg, 442×285mm) — heavy, deep: full reinforcement', () => {
      const result = computeTrayReinforcement(
        { el: makeDevice({ w: 442, depthBehind: 285 }), weight: 5.1, deviceH: 44 },
        442, 285, 2, 2, '3dp',
      );
      // Width 442mm → floor(442/60)=7 ribs
      expect(result.floorRibs).toHaveLength(7);
      // Height 44 > 30 → gussets
      expect(result.gussets).toHaveLength(2);
      // Depth 285 > 150 AND weight 5.1 > 1.5 → cross-rib
      expect(result.crossRibs).toHaveLength(1);
      // Rear stoppers always present
      expect(result.rearStoppers).toHaveLength(2);
      // suggestedFloorT = max(2, 1.5+ceil(5.1*0.5)) = max(2, 1.5+3) = 4.5
      expect(result.suggestedFloorT).toBe(4.5);
      // Heavy + wide → warning
      expect(result.warnings.some(w => w.message.includes('Heavy device'))).toBe(true);
    });
  });
});
