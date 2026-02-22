import { getState } from '../state';
import { computeMarginWarnings, defaultMinGap } from '../../lib/margins';
import { computeReinforcement } from '../../lib/reinforcement';
import { panelDimensions, panelHeight } from '../../constants/eia310';
import { METALS } from '../../constants/materials';
import { DEVICES } from '../../constants/devices';
import { CONNECTORS } from '../../constants/connectors';
import { FANS } from '../../constants/fans';

export function handleValidate() {
  const s = getState();
  const dims = panelDimensions(s.standard);
  const panH = panelHeight(s.uHeight);
  const mt = METALS[s.metalKey];
  const minGap = defaultMinGap(s.fabMethod, mt?.t);

  const faceplateEls = s.elements.filter(e => !e.surface || e.surface === 'faceplate');
  const marginWarnings = computeMarginWarnings(faceplateEls, dims.panelWidth, panH, minGap);

  // Check overlaps
  const overlaps: { a: string; b: string }[] = [];
  for (let i = 0; i < faceplateEls.length; i++) {
    for (let j = i + 1; j < faceplateEls.length; j++) {
      const a = faceplateEls[i], b = faceplateEls[j];
      if (
        a.x - a.w / 2 < b.x + b.w / 2 &&
        a.x + a.w / 2 > b.x - b.w / 2 &&
        a.y - a.h / 2 < b.y + b.h / 2 &&
        a.y + a.h / 2 > b.y - b.h / 2
      ) {
        overlaps.push({ a: a.label, b: b.label });
      }
    }
  }

  // Check out of bounds
  const outOfBounds = faceplateEls.filter(e =>
    e.x - e.w / 2 < 0 || e.x + e.w / 2 > dims.panelWidth ||
    e.y - e.h / 2 < 0 || e.y + e.h / 2 > panH
  ).map(e => e.label);

  // Width budget
  const usedWidth = s.elements.reduce((sum, e) => sum + e.w + 4, 0);
  const remainingWidth = dims.panelWidth - usedWidth;

  // Structural info
  const wallAdd = s.fabMethod === '3dp' ? s.wallThickness * 2 : (mt?.t ?? 1.5) * 2;
  let maxD = 0;
  for (const el of s.elements) {
    if (el.type === 'device') maxD = Math.max(maxD, DEVICES[el.key]?.d ?? 0);
    else if (el.type === 'fan') maxD = Math.max(maxD, FANS[el.key]?.depthBehind ?? 0);
    else maxD = Math.max(maxD, CONNECTORS[el.key]?.depthBehind ?? 0);
  }
  const depth = Math.max(50, maxD + wallAdd + 10);

  const ribs = s.autoReinforcement
    ? computeReinforcement(s.elements, dims.panelWidth, panH, s.wallThickness, depth, s.fabMethod)
    : [];

  const errors: string[] = [];
  const warnings: string[] = [];

  if (overlaps.length > 0) errors.push(`${overlaps.length} overlapping element pair(s): ${overlaps.map(o => `${o.a}/${o.b}`).join(', ')}`);
  if (outOfBounds.length > 0) errors.push(`${outOfBounds.length} element(s) out of bounds: ${outOfBounds.join(', ')}`);
  if (remainingWidth < 0) warnings.push(`Width budget exceeded by ${(-remainingWidth).toFixed(0)}mm`);
  for (const w of marginWarnings) {
    const el = s.elements.find(e => e.id === w.elementId);
    const name = el?.label ?? w.elementId.slice(0, 6);
    if (w.severity === 'error') errors.push(`${name}: ${w.edge} gap ${w.gap.toFixed(1)}mm < ${w.minGap}mm`);
    else warnings.push(`${name}: ${w.edge} gap ${w.gap.toFixed(1)}mm < ${w.minGap}mm`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    overlaps,
    outOfBounds,
    marginWarnings: marginWarnings.length,
    reinforcementRibs: ribs.length,
    widthBudget: { used: usedWidth, remaining: remainingWidth, panelWidth: dims.panelWidth },
  };
}
