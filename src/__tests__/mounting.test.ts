import { describe, it, expect } from 'vitest';
import { MOUNTING } from '../constants/mounting';

describe('MOUNTING constants', () => {
  it('TAB_WIDTH is 12mm', () => expect(MOUNTING.TAB_WIDTH).toBe(12));
  it('TAB_DEPTH is 8mm', () => expect(MOUNTING.TAB_DEPTH).toBe(8));
  it('BOSS_DIA is 8mm', () => expect(MOUNTING.BOSS_DIA).toBe(8));
  it('BOSS_HEIGHT is 6mm', () => expect(MOUNTING.BOSS_HEIGHT).toBe(6));
  it('CLEARANCE_HOLE is 3.4mm (M3)', () => expect(MOUNTING.CLEARANCE_HOLE).toBe(3.4));
  it('PILOT_HOLE is 2.5mm (heat-set)', () => expect(MOUNTING.PILOT_HOLE).toBe(2.5));
  it('PEM_HOLE is 3.2mm (clinch nut)', () => expect(MOUNTING.PEM_HOLE).toBe(3.2));
  it('ALIGN_PIN_DIA is 3.0mm', () => expect(MOUNTING.ALIGN_PIN_DIA).toBe(3.0));
  it('ALIGN_SOCKET_DIA is 3.2mm (0.2mm clearance)', () => {
    expect(MOUNTING.ALIGN_SOCKET_DIA).toBe(3.2);
    expect(MOUNTING.ALIGN_SOCKET_DIA - MOUNTING.ALIGN_PIN_DIA).toBeCloseTo(0.2, 4);
  });
  it('SLIDE_CLEARANCE is 0.3mm', () => expect(MOUNTING.SLIDE_CLEARANCE).toBe(0.3));
  it('DEEP_TRAY_THRESHOLD is 150mm', () => expect(MOUNTING.DEEP_TRAY_THRESHOLD).toBe(150));
});
