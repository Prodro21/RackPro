# Testing Patterns

**Analysis Date:** 2026-02-21

## Test Framework

**Runner:**
- Vitest 3.2.4
- Config: `vite.config.ts` (inline `test: { globals: true }`)
- `/// <reference types="vitest" />` in vite config for type support

**Assertion Library:**
- Vitest built-in (`expect`) — no separate assertion library

**Run Commands:**
```bash
npm run test          # Run all tests once (vitest run)
npm run test:watch    # Watch mode (vitest)
# Coverage: not configured — no coverage command in package.json
```

## Test File Organization

**Location:** Centralized in `src/__tests__/` — NOT co-located with source files

**Naming:** `<module>.test.ts` — e.g., `trayGeometry.test.ts`, `trayReinforcement.test.ts`

**Structure:**
```
src/
└── __tests__/
    ├── exportModular.test.ts    # DXF + Fusion 360 export generators
    ├── mounting.test.ts         # MOUNTING constants verification
    ├── trayGeometry.test.ts     # computeTrayDimensions + mount positions
    └── trayReinforcement.test.ts # computeTrayReinforcement rules
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import { computeTrayDimensions } from '../lib/trayGeometry';

// Top-level describe per module/function
describe('computeTrayDimensions', () => {
  // Group related behaviors with nested describe
  describe('Rule 1: Floor longitudinal ribs', () => {
    it('adds ribs when weight > 0.8kg', () => { ... });
    it('does NOT add ribs when weight <= 0.8 AND width <= 80', () => { ... });
  });
});
```

**Patterns:**
- Flat `describe` blocks for constant tests (`mounting.test.ts`)
- Nested `describe` for rule-based logic (each rule gets its own block in `trayReinforcement.test.ts`)
- Descriptive `it` strings that read as specifications: `'adds 2 gussets when deviceH > BASE.UNIT * 2 (30mm)'`
- Values in test names for boundary conditions: `'threshold is exactly 150mm'`
- Negative tests named with `'does NOT'` prefix

## Mocking

**Framework:** None — no mocking library used

**Patterns:** No mocks anywhere in the test suite. All tests exercise real implementations directly.

**What IS tested:**
- Pure library functions: `computeTrayDimensions`, `computeTrayReinforcement`, `computeMountPositions`
- String-output generators: `generateFusion360`, `generateDXF`, `generateTrayDXF`, `generateAllTrayDXFs`
- Constant values: `MOUNTING` object properties

**What is NOT tested:**
- React components (no component testing)
- Zustand store actions/selectors
- Hooks (`useEnclosure`, `useSplitCalc`, `useDrag`, etc.)
- MCP server/tools
- Export generators: `generateOpenSCAD`, `generateConfig`

## Fixtures and Factories

**Test Data — Constant fixtures:**
```typescript
// Module-level typed constants reused across tests
const LITE8: ExportElement = {
  type: 'device', key: 'usw-lite-8', label: 'USW-Lite-8',
  x: 100, y: 50, w: 200, h: 30.3,
  cutout: 'rect', depthBehind: 119,
};

const PRO24: ExportElement = {
  type: 'device', key: 'usw-pro-24', label: 'USW-Pro-24',
  x: 225, y: 22, w: 442, h: 44,
  cutout: 'rect', depthBehind: 285,
};
```

**Test Data — Factory functions:**
```typescript
// Factory with spread overrides for parametric tests
const makeDevice = (overrides: Partial<ExportElement> = {}): ExportElement => ({
  type: 'device', key: 'test', label: 'Test',
  x: 100, y: 50, w: 200, h: 30, cutout: 'rect', depthBehind: 120,
  ...overrides,
});

// Config builder for export tests
function makeBaseConfig(overrides: Partial<ExportConfig> = {}): ExportConfig {
  return {
    panel: { standard: '19', uHeight: 1, panelWidth: 450.85, ... },
    enclosure: { depth: 130, ... },
    fabrication: { method: '3D Print', ... } as FabConfig3DP,
    elements: [],
    ...overrides,
  };
}
```

**Location:** All fixtures defined at module level within the test file that uses them (no shared fixture files)

**Shared constants:** Test files import real constants from source (`BASE` from `eia310`, `MOUNTING` from `mounting`) and use them directly in assertions — this ensures tests stay in sync with constants.

## Coverage

**Requirements:** None enforced — no coverage threshold configured, no `--coverage` flag in scripts

**View Coverage:**
```bash
# Not configured. To add ad-hoc:
npx vitest run --coverage
```

## Test Types

**Unit Tests:** All current tests are unit tests exercising pure functions in isolation.

**Integration Tests:** Not present. No tests cross module boundaries (e.g., store → selector → component).

**E2E Tests:** Not used.

**Component Tests:** Not used. No React Testing Library or similar.

## Common Patterns

**Numeric precision testing:**
```typescript
// toBeCloseTo for floating point calculations (4 decimal places)
expect(dims.innerW).toBeCloseTo(LITE8.w + BASE.TOLERANCE, 4);
expect(dims.totalW).toBeCloseTo(dims.innerW + 2 * dims.wallT, 4);

// toBe for integer/exact values
expect(result.rearStoppers).toHaveLength(2);
expect(result.rearStoppers[0].h).toBe(BASE.UNIT);
```

**Generator output testing (string-based):**
```typescript
// Assert on substring presence — not full output comparison
const py = generateFusion360(config);
expect(py).toContain('import adsk.core, adsk.fusion, traceback');
expect(py).toContain('Step 7: Mounting Bosses');
expect(py).not.toContain('Modular Assembly');
```

**Error testing:**
```typescript
// Use arrow function wrapper with toThrow
expect(() => generateTrayDXF(config, 0)).toThrow('not a device');
expect(() => generateTrayDXF(config, 0)).toThrow('sheet metal');
```

**Boundary condition testing:**
```typescript
// Explicit at-boundary and over-boundary cases
const at150: ExportElement = { ...LITE8, depthBehind: 150 };
const just150 = computeMountPositions(at150, 2);
expect(just150).toHaveLength(2); // not > 150

const over150: ExportElement = { ...LITE8, depthBehind: 150.01 };
const over = computeMountPositions(over150, 2);
expect(over).toHaveLength(4);
```

**Real device scenario tests:**
```typescript
// Integration-style named tests using actual Ubiquiti device specs
describe('Real device scenarios (from plan verification)', () => {
  it('USW-Lite-8 (0.8kg, 200×119mm) — gussets for height 30.3mm', () => { ... });
  it('USW-Pro-24 (5.1kg, 442×285mm) — heavy, deep: full reinforcement', () => { ... });
});
```

**DXF structural testing:**
```typescript
// Parse DXF sections with string split, count entity occurrences
const entitiesSection = dxf.split('ENTITIES')[1] ?? '';
const circleMatches = entitiesSection.split('CIRCLE').length - 1;
expect(circleMatches).toBe(4); // 2 M3 + 2 align pins

// Regex for structured data
const layerTableMatch = dxf.match(/LAYER\n\s*70\n\s*(\d+)/);
expect(layerTableMatch![1]).toBe('5');
```

## What to Test When Adding New Features

**New lib function** (`src/lib/*.ts`):
- Create `src/__tests__/<module>.test.ts`
- Follow named-fixture + factory pattern
- Cover all conditional branches (rules/thresholds)
- Test boundary conditions explicitly (exactly at threshold, just over)
- Use real device specs from `CLAUDE.md` for scenario tests

**New export generator** (`src/export/*.ts`):
- Add to `src/__tests__/exportModular.test.ts` or create new test file
- Use `makeBaseConfig()` factory with overrides
- Assert on string substrings with `toContain` / `not.toContain`
- Test error cases with `toThrow`

**New constant** (`src/constants/*.ts`):
- Add to `src/__tests__/mounting.test.ts` pattern (or create new constant test file)
- One `it` per constant value — explicit documentation of expected values

---

*Testing analysis: 2026-02-21*
