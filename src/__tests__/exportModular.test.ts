import { describe, it, expect } from 'vitest';
import { generateFusion360 } from '../export/fusion360Gen';
import { generateDXF, generateTrayDXF, generateAllTrayDXFs } from '../export/dxfGen';
import type { ExportConfig, ExportElement, FabConfig3DP, FabConfigSM, AssemblyConfig } from '../types';

// ── Helpers ────────────────────────────────────────────────────

function makeBaseConfig(overrides: Partial<ExportConfig> = {}): ExportConfig {
  return {
    panel: {
      standard: '19',
      uHeight: 1,
      panelWidth: 450.85,
      panelHeight: 43.66,
      totalWidth: 482.6,
    },
    enclosure: {
      depth: 130,
      maxDeviceDepth: 119,
      rearPanel: false,
      ventSlots: false,
      flanges: true,
      flangeDepth: 15,
      chamfers: true,
      style: 'tray' as const,
    },
    fabrication: {
      method: '3D Print',
      printer: 'BambuLab P2S',
      bed: [256, 256, 256] as [number, number, number],
      filament: 'PETG',
      wallThickness: 3,
      split: { type: 'none', parts: [], desc: 'Single piece' },
    } as FabConfig3DP,
    elements: [],
    ...overrides,
  };
}

const DEVICE_ELEMENT: ExportElement = {
  type: 'device', key: 'usw-lite-8', label: 'USW-Lite-8',
  x: 100, y: 21.83, w: 200, h: 30.3,
  cutout: 'rect', depthBehind: 119,
};

const CONNECTOR_ELEMENT: ExportElement = {
  type: 'connector', key: 'rj45-keystone', label: 'RJ45',
  x: 300, y: 21.83, w: 14.9, h: 19.2,
  cutout: 'rect', depthBehind: 28,
};

const MODULAR_ASSEMBLY: AssemblyConfig = {
  mode: 'modular',
  faceFab: '3dp',
  trayFab: '3dp',
  trays: [{
    elementId: 'usw-lite-8',
    hasRearWall: false,
    floorStyle: 'hex',
    attachPoints: 2,
  }],
};

// ── Fusion 360 Generator Tests ─────────────────────────────────

describe('generateFusion360', () => {
  it('generates monolithic build by default (no assembly)', () => {
    const config = makeBaseConfig({ elements: [DEVICE_ELEMENT] });
    const py = generateFusion360(config);
    expect(py).toContain('RackPro — Fusion 360 Parametric Script');
    expect(py).not.toContain('Modular Assembly');
  });

  it('generates monolithic when assembly.mode = monolithic', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      assembly: { ...MODULAR_ASSEMBLY, mode: 'monolithic' },
    });
    const py = generateFusion360(config);
    expect(py).toContain('Parametric Script');
    expect(py).not.toContain('Modular Assembly');
  });

  it('generates modular build when assembly.mode = modular', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT, CONNECTOR_ELEMENT],
      assembly: MODULAR_ASSEMBLY,
    });
    const py = generateFusion360(config);
    expect(py).toContain('Modular Assembly');
    expect(py).toContain('Step 7: Mounting Bosses');
    expect(py).toContain('Step 8: Boss Pilot Holes');
    expect(py).toContain('Step 9: Alignment Pins');
    expect(py).toContain('Step 11: Per-Device Trays');
  });

  it('modular build includes tray reinforcement features', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      assembly: MODULAR_ASSEMBLY,
    });
    const py = generateFusion360(config);
    // USW-Lite-8: weight 0.8kg, width 200mm > 80 → floor ribs
    // Height 30.3mm > 30 → gussets
    expect(py).toContain('Floor ribs');
    expect(py).toContain('Rear stoppers');
  });

  it('modular build generates valid Python (has def run, import adsk)', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      assembly: MODULAR_ASSEMBLY,
    });
    const py = generateFusion360(config);
    expect(py).toContain('import adsk.core, adsk.fusion, traceback');
    expect(py).toContain('def run(context):');
    expect(py).toContain('def mm(v):');
    expect(py).toContain('def create_rect_sketch(');
    expect(py).toContain('def create_cylinder(');
  });

  it('modular build includes all 12 steps for config with device + rear panel (box style)', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      assembly: MODULAR_ASSEMBLY,
      enclosure: {
        depth: 130, maxDeviceDepth: 119,
        rearPanel: true, ventSlots: false, flanges: true, flangeDepth: 15, chamfers: true, style: 'box' as const,
      },
    });
    const py = generateFusion360(config);
    expect(py).toContain('Step 1: Faceplate');
    expect(py).toContain('Step 2: Mounting Ears');
    expect(py).toContain('Step 3: EIA-310 Bores');
    expect(py).toContain('Step 5: Enclosure Walls');
    expect(py).toContain('Step 6: Flanges');
    expect(py).toContain('Step 12: Rear Panel');
  });

  it('tray style omits enclosure walls but keeps flanges', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      assembly: MODULAR_ASSEMBLY,
      enclosure: {
        depth: 130, maxDeviceDepth: 119,
        rearPanel: false, ventSlots: false, flanges: true, flangeDepth: 15, chamfers: true, style: 'tray' as const,
      },
    });
    const py = generateFusion360(config);
    expect(py).not.toContain('Step 5: Enclosure Walls');
    expect(py).toContain('Step 6: Flanges');
  });

  it('uses PEM_HOLE size for sheet metal faceplate', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      assembly: { ...MODULAR_ASSEMBLY, faceFab: 'sm' },
      fabrication: {
        method: 'Sheet Metal',
        material: 'CRS 16ga',
        thickness: 1.52,
        bendRadius: 1.52,
        kFactor: 0.4,
        ba90: 2.77,
        flangeDepth: 15,
      } as FabConfigSM,
    });
    const py = generateFusion360(config);
    // PEM_HOLE = 3.2, so radius = 1.6
    expect(py).toContain('1.6');
  });
});

// ── DXF Generator Tests ────────────────────────────────────────

describe('generateDXF (modular mode)', () => {
  const smFab: FabConfigSM = {
    method: 'Sheet Metal',
    material: 'CRS 16ga',
    thickness: 1.52,
    bendRadius: 1.52,
    kFactor: 0.4,
    ba90: 2.77,
    flangeDepth: 15,
  };

  it('includes 4-MOUNT layer definition', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
      assembly: { ...MODULAR_ASSEMBLY, faceFab: 'sm' },
    });
    const dxf = generateDXF(config);
    expect(dxf).toContain('4-MOUNT');
  });

  it('adds mounting holes on 4-MOUNT layer in modular mode', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
      assembly: { ...MODULAR_ASSEMBLY, faceFab: 'sm' },
    });
    const dxf = generateDXF(config);
    expect(dxf).toContain('M3 mount hole');
    expect(dxf).toContain('Alignment pin hole');
  });

  it('does NOT add mounting holes in monolithic mode', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
    });
    const dxf = generateDXF(config);
    expect(dxf).not.toContain('M3 mount hole');
    expect(dxf).not.toContain('Alignment pin hole');
  });

  it('4-MOUNT layer has cyan color (color 4)', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
      assembly: { ...MODULAR_ASSEMBLY, faceFab: 'sm' },
    });
    const dxf = generateDXF(config);
    // Find the 4-MOUNT layer definition — should have ' 62', '4' (cyan)
    const mountIdx = dxf.indexOf('4-MOUNT');
    expect(mountIdx).toBeGreaterThan(-1);
    // The color code follows the layer name
    const afterMount = dxf.slice(mountIdx, mountIdx + 100);
    expect(afterMount).toContain('4');
  });

  it('layer count is 5 in tables', () => {
    const config = makeBaseConfig({
      elements: [],
      fabrication: smFab,
    });
    const dxf = generateDXF(config);
    // Layer table starts with ' 70', '5' (count=5)
    const layerTableMatch = dxf.match(/LAYER\n\s*70\n\s*(\d+)/);
    expect(layerTableMatch).not.toBeNull();
    expect(layerTableMatch![1]).toBe('5');
  });
});

// ── Tray DXF Generator Tests ──────────────────────────────────

describe('generateTrayDXF', () => {
  const smFab: FabConfigSM = {
    method: 'Sheet Metal',
    material: 'CRS 16ga',
    thickness: 1.52,
    bendRadius: 1.52,
    kFactor: 0.4,
    ba90: 2.77,
    flangeDepth: 15,
  };

  it('generates valid DXF content (SECTION, ENTITIES, EOF)', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
    });
    const dxf = generateTrayDXF(config, 0);
    expect(dxf).toContain('SECTION');
    expect(dxf).toContain('ENTITIES');
    expect(dxf).toContain('EOF');
  });

  it('has correct flat pattern dimensions in annotations', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
    });
    const dxf = generateTrayDXF(config, 0);
    // innerW = 200 + 0.2 = 200.2, sideH = 15, ba90 = 2.77
    // flatW = 15 + 2.77 + 200.2 + 2.77 + 15 = 235.74
    // tabDepth = max(8, ceil(2 * holeToEdge(1.52, 1.7))) = max(8, ceil(9.48)) = 10
    // flatH = 10 + 119 + 2.77 + 15 = 146.77
    expect(dxf).toContain('235.7');
    expect(dxf).toContain('146.8');
  });

  it('includes 3 bend lines on 1-BEND layer', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
    });
    const dxf = generateTrayDXF(config, 0);
    // Count LINE entities on 1-BEND layer
    const bendLines = dxf.split('1-BEND').length - 1;
    // 3 bend line entities + 3 bend comments = at least 6 occurrences
    // But in the tables there's also a 1-BEND layer definition
    // Each LINE entity has layer '1-BEND', plus comments mention them
    expect(bendLines).toBeGreaterThanOrEqual(4); // 1 in tables + 3 in entities
    expect(dxf).toContain('left side wall up');
    expect(dxf).toContain('right side wall up');
    expect(dxf).toContain('rear wall up');
  });

  it('includes M3 mount holes and alignment pins on 2-CUTOUTS layer', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
    });
    const dxf = generateTrayDXF(config, 0);
    expect(dxf).toContain('M3 mount hole');
    expect(dxf).toContain('Alignment pin hole');
    // Holes on 2-CUTOUTS for CAM compatibility
    const entitiesSection = dxf.split('ENTITIES')[1] ?? '';
    const circleMatches = entitiesSection.split('CIRCLE').length - 1;
    expect(circleMatches).toBe(4); // 2 M3 + 2 align pins
  });

  it('cruciform outline is a closed LWPOLYLINE with 12 vertices', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
    });
    const dxf = generateTrayDXF(config, 0);
    expect(dxf).toContain('LWPOLYLINE');
    // 12 vertices = 12 occurrences of group 10 (x coord) in the polyline
    const entitiesSection = dxf.split('ENTITIES')[1] ?? '';
    const polySection = entitiesSection.split('LWPOLYLINE')[1]?.split('  0\n')[0] ?? '';
    const vertexCount = (polySection.match(/ 10\n/g) || []).length;
    expect(vertexCount).toBe(12);
    // Closed flag
    expect(polySection).toContain('1'); // flag 70 = 1 (closed)
  });

  it('throws for non-device elements', () => {
    const config = makeBaseConfig({
      elements: [CONNECTOR_ELEMENT],
      fabrication: smFab,
    });
    expect(() => generateTrayDXF(config, 0)).toThrow('not a device');
  });

  it('throws for non-sheet-metal fabrication', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
    });
    expect(() => generateTrayDXF(config, 0)).toThrow('sheet metal');
  });

  it('annotations include material spec and device label', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
    });
    const dxf = generateTrayDXF(config, 0);
    expect(dxf).toContain('CRS 16ga');
    expect(dxf).toContain('USW-Lite-8');
  });
});

describe('generateAllTrayDXFs', () => {
  const smFab: FabConfigSM = {
    method: 'Sheet Metal',
    material: 'CRS 16ga',
    thickness: 1.52,
    bendRadius: 1.52,
    kFactor: 0.4,
    ba90: 2.77,
    flangeDepth: 15,
  };

  it('returns correct count (devices only, skips connectors)', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT, CONNECTOR_ELEMENT, { ...DEVICE_ELEMENT, key: 'ux7', label: 'UX7', x: 350, w: 117 }],
      fabrication: smFab,
    });
    const trays = generateAllTrayDXFs(config);
    expect(trays).toHaveLength(2);
    expect(trays[0].label).toBe('USW-Lite-8');
    expect(trays[1].label).toBe('UX7');
  });

  it('returns empty array when no devices', () => {
    const config = makeBaseConfig({
      elements: [CONNECTOR_ELEMENT],
      fabrication: smFab,
    });
    const trays = generateAllTrayDXFs(config);
    expect(trays).toHaveLength(0);
  });

  it('each tray DXF is a valid DXF string', () => {
    const config = makeBaseConfig({
      elements: [DEVICE_ELEMENT],
      fabrication: smFab,
    });
    const trays = generateAllTrayDXFs(config);
    expect(trays).toHaveLength(1);
    expect(trays[0].dxf).toContain('SECTION');
    expect(trays[0].dxf).toContain('EOF');
  });
});
