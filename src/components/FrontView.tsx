import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectBores, selectNeedsSplit, selectSplitInfo, selectOverlaps, selectOutOfBounds, selectMarginWarnings, selectMountHoleDiameter, selectValidationIssueIds } from '../store';
import { EIA, BASE } from '../constants/eia310';
import { CONNECTORS } from '../constants/connectors';
import { DEVICES } from '../constants/devices';
import { FANS } from '../constants/fans';
import { useReinforcement } from '../hooks/useReinforcement';
import { loadOutlineIndex, loadOutlinePath, getCachedOutlinePath, hasOutline } from '../catalog/outlines';
import { parseCatalogDragData } from '../hooks/useCatalogDrag';
import { useCatalogStore, selectDeviceMap, selectConnectorMap } from '../catalog/useCatalogStore';
import { SVG_COLORS } from '../lib/svgTheme';
import type { PanelElement } from '../types';

const SC = 1.15;
const OX = 30;
const OY = 40;
const SNAP_THRESHOLD = 2; // mm

// ─── Label helpers ───────────────────────────────────────────

/** Category icon SVG paths (8x8 viewBox, simple outlines) */
const LABEL_ICONS: Record<string, string> = {
  network: 'M1,6 L3,6 L3,3 L5,3 L5,6 L7,6 L7,2 L1,2 Z',       // ethernet jack
  video:   'M1,2 L6,2 L6,6 L1,6 Z M6,3 L7.5,2 L7.5,6 L6,5 Z', // camera
  audio:   'M2,3 L2,5 L3.5,5 L5.5,7 L5.5,1 L3.5,3 Z',          // speaker
  power:   'M4.5,0.5 L2.5,4 L4,4 L3.5,7.5 L5.5,4 L4,4 L4.5,0.5 Z', // lightning bolt
};

/** Compute auto-number index for an element in its group */
function computeAutoNumber(el: PanelElement, allElements: PanelElement[]): number {
  const sameGroup = allElements
    .filter(e => e.type === el.type &&
                 e.labelConfig?.text === el.labelConfig?.text &&
                 e.labelConfig?.autoNumber)
    .sort((a, b) => a.x - b.x);
  return sameGroup.findIndex(e => e.id === el.id) + 1;
}

/** Compute staggered label positions to avoid horizontal overlap */
interface LabelPosition {
  id: string;
  cx: number;       // center X in SVG coords
  y: number;        // Y in SVG coords
  position: 'above' | 'below' | 'inside';
  displayText: string;
  icon?: string;
}

function computeLabelPositions(
  elements: PanelElement[],
  panH: number,
): LabelPosition[] {
  const labeled = elements.filter(e => e.labelConfig?.text);
  if (labeled.length === 0) return [];

  const positions: LabelPosition[] = labeled.map(el => {
    const lc = el.labelConfig!;
    const displayText = lc.autoNumber
      ? `${lc.text} ${computeAutoNumber(el, elements)}`
      : lc.text;

    // Compute Y in panel-relative mm
    const topY = el.y - el.h / 2;
    const botY = el.y + el.h / 2;
    let labelY: number;
    switch (lc.position) {
      case 'above': labelY = topY - 4; break;
      case 'inside': labelY = el.y; break;
      case 'below': default: labelY = botY + 5; break;
    }

    // Convert to SVG coords
    const svgCx = OX + EIA.EAR_WIDTH * SC + el.x * SC;
    const svgY = OY + labelY * SC;

    return {
      id: el.id,
      cx: svgCx,
      y: svgY,
      position: lc.position,
      displayText,
      icon: lc.icon,
    };
  });

  // Stagger collision handling: for adjacent labels within 20px X proximity
  // that are at the same position (both above or both below), alternate
  const sorted = [...positions].sort((a, b) => a.cx - b.cx);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (Math.abs(curr.cx - prev.cx) < 20 && curr.position === prev.position && curr.position !== 'inside') {
      // Flip current to opposite position
      const el = elements.find(e => e.id === curr.id)!;
      const topY = el.y - el.h / 2;
      const botY = el.y + el.h / 2;
      const newPos = curr.position === 'below' ? 'above' : 'below';
      const newLabelY = newPos === 'above' ? topY - 4 : botY + 5;
      curr.y = OY + newLabelY * SC;
      curr.position = newPos;
    }
  }

  return positions;
}

function computeSnapGuides(
  el: { x: number; y: number; w: number; h: number },
  others: { x: number; y: number; w: number; h: number }[],
  panW: number,
  panH: number,
): { x: number; y: number; guidesH: number[]; guidesV: number[] } {
  let x = el.x, y = el.y;
  const guidesH: number[] = [];
  const guidesV: number[] = [];

  const elL = x - el.w / 2, elR = x + el.w / 2;
  const elT = y - el.h / 2, elB = y + el.h / 2;

  // Check edge alignment with other elements
  for (const o of others) {
    const oL = o.x - o.w / 2, oR = o.x + o.w / 2;
    const oT = o.y - o.h / 2, oB = o.y + o.h / 2;

    // Vertical edge snap (X-axis)
    if (Math.abs(elL - oL) < SNAP_THRESHOLD) { x = oL + el.w / 2; guidesV.push(oL); }
    else if (Math.abs(elR - oR) < SNAP_THRESHOLD) { x = oR - el.w / 2; guidesV.push(oR); }
    else if (Math.abs(elL - oR) < SNAP_THRESHOLD) { x = oR + el.w / 2; guidesV.push(oR); }
    else if (Math.abs(elR - oL) < SNAP_THRESHOLD) { x = oL - el.w / 2; guidesV.push(oL); }

    // Center alignment
    if (Math.abs(x - o.x) < SNAP_THRESHOLD) { x = o.x; guidesV.push(o.x); }

    // Horizontal edge snap (Y-axis)
    if (Math.abs(elT - oT) < SNAP_THRESHOLD) { y = oT + el.h / 2; guidesH.push(oT); }
    else if (Math.abs(elB - oB) < SNAP_THRESHOLD) { y = oB - el.h / 2; guidesH.push(oB); }
    else if (Math.abs(elT - oB) < SNAP_THRESHOLD) { y = oB + el.h / 2; guidesH.push(oB); }
    else if (Math.abs(elB - oT) < SNAP_THRESHOLD) { y = oT - el.h / 2; guidesH.push(oT); }

    if (Math.abs(y - o.y) < SNAP_THRESHOLD) { y = o.y; guidesH.push(o.y); }
  }

  // Panel center snap
  if (Math.abs(x - panW / 2) < SNAP_THRESHOLD) { x = panW / 2; guidesV.push(panW / 2); }
  if (Math.abs(y - panH / 2) < SNAP_THRESHOLD) { y = panH / 2; guidesH.push(panH / 2); }

  // Panel edge snap
  if (Math.abs(elL) < SNAP_THRESHOLD) { x = el.w / 2; guidesV.push(0); }
  if (Math.abs(elR - panW) < SNAP_THRESHOLD) { x = panW - el.w / 2; guidesV.push(panW); }
  if (Math.abs(elT) < SNAP_THRESHOLD) { y = el.h / 2; guidesH.push(0); }
  if (Math.abs(elB - panH) < SNAP_THRESHOLD) { y = panH - el.h / 2; guidesH.push(panH); }

  return { x, y, guidesH, guidesV };
}

export function FrontView() {
  const elements = useConfigStore(s => s.elements);
  const selectedId = useConfigStore(s => s.selectedId);
  const fabMethod = useConfigStore(s => s.fabMethod);
  const gridEnabled = useConfigStore(s => s.gridEnabled);
  const gridSize = useConfigStore(s => s.gridSize);
  const snapToEdges = useConfigStore(s => s.snapToEdges);
  const selectElement = useConfigStore(s => s.selectElement);
  const moveElement = useConfigStore(s => s.moveElement);
  const panDims = useConfigStore(selectPanelDims);
  const panH = useConfigStore(selectPanelHeight);
  const bores = useConfigStore(selectBores);
  const needsSplit = useConfigStore(selectNeedsSplit);
  const splitInfo = useConfigStore(selectSplitInfo);
  const overlaps = useConfigStore(selectOverlaps);
  const outOfBounds = useConfigStore(selectOutOfBounds);
  const marginWarnings = useConfigStore(selectMarginWarnings);
  const boreDia = useConfigStore(selectMountHoleDiameter);
  const validationIssueIds = useConfigStore(selectValidationIssueIds);
  const ribs = useReinforcement();

  // Catalog maps for unknown-slug detection (extracted at top per MEMORY.md)
  const catalogDeviceMap = useCatalogStore(selectDeviceMap);
  const catalogConnectorMap = useCatalogStore(selectConnectorMap);

  // Build a set of known slugs from both catalog and legacy constants
  const knownSlugs = useMemo(() => {
    const slugs = new Set<string>();
    // Legacy constants
    for (const key of Object.keys(DEVICES)) slugs.add(key);
    for (const key of Object.keys(CONNECTORS)) slugs.add(key);
    for (const key of Object.keys(FANS)) slugs.add(key);
    // Catalog entries
    for (const key of Object.keys(catalogDeviceMap)) slugs.add(key);
    for (const key of Object.keys(catalogConnectorMap)) slugs.add(key);
    return slugs;
  }, [catalogDeviceMap, catalogConnectorMap]);

  // Outline loading: async load with sync read-back for render
  const [outlineVersion, setOutlineVersion] = useState(0);

  // Load outline index once on mount
  useEffect(() => {
    loadOutlineIndex().then(() => setOutlineVersion(v => v + 1));
  }, []);

  // Load outlines for placed device elements (both front and top faces)
  useEffect(() => {
    const deviceEls = elements.filter(el => el.type === 'device');
    const promises: Promise<string | null>[] = [];
    for (const el of deviceEls) {
      if (hasOutline(el.key, 'front') && getCachedOutlinePath(el.key, 'front') === null) {
        promises.push(loadOutlinePath(el.key, 'front'));
      }
      if (hasOutline(el.key, 'top') && getCachedOutlinePath(el.key, 'top') === null) {
        promises.push(loadOutlinePath(el.key, 'top'));
      }
    }
    if (promises.length === 0) return;
    Promise.all(promises).then(() => setOutlineVersion(v => v + 1));
  }, [elements, outlineVersion]);

  const { totalWidth: totW, panelWidth: panW } = panDims;
  const vW = totW * SC + 60;
  const vH = panH * SC + 80;

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [snapGuides, setSnapGuides] = useState<{ guidesH: number[]; guidesV: number[] }>({ guidesH: [], guidesV: [] });

  const overlapIds = useMemo(() => new Set(overlaps.flatMap(([a, b]) => [a, b])), [overlaps]);
  const oobIds = useMemo(() => new Set(outOfBounds), [outOfBounds]);
  const marginIds = useMemo(() => new Set(marginWarnings.map(w => w.elementId)), [marginWarnings]);
  const validationIds = useMemo(() => new Set(validationIssueIds), [validationIssueIds]);

  // Compute label positions (memoized on elements reference; recalculates on drag end)
  const labelPositions = useMemo(
    () => computeLabelPositions(elements, panH),
    [elements, panH],
  );
  const labelMap = useMemo(() => {
    const map = new Map<string, LabelPosition>();
    for (const lp of labelPositions) map.set(lp.id, lp);
    return map;
  }, [labelPositions]);

  const onDown = (ev: React.MouseEvent, id: string) => {
    ev.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const sp = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const el = elements.find(e => e.id === id);
    if (!el) return;
    setDrag({ id, sx: sp.x, sy: sp.y, ox: el.x, oy: el.y });
    selectElement(id);
  };

  const onMove = useCallback((ev: MouseEvent) => {
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const sp = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const dx = (sp.x - drag.sx) / SC;
    const dy = (sp.y - drag.sy) / SC;
    const el = elements.find(e => e.id === drag.id);
    if (!el) return;

    let nx = drag.ox + dx;
    let ny = drag.oy + dy;

    // Grid snap
    if (gridEnabled) {
      nx = Math.round(nx / gridSize) * gridSize;
      ny = Math.round(ny / gridSize) * gridSize;
    }

    // Clamp
    nx = Math.max(el.w / 2, Math.min(panW - el.w / 2, nx));
    ny = Math.max(el.h / 2, Math.min(panH - el.h / 2, ny));

    // Edge snap
    if (snapToEdges) {
      const others = elements.filter(e => e.id !== drag.id);
      const snap = computeSnapGuides({ x: nx, y: ny, w: el.w, h: el.h }, others, panW, panH);
      nx = snap.x;
      ny = snap.y;
      setSnapGuides({ guidesH: snap.guidesH, guidesV: snap.guidesV });
    } else {
      setSnapGuides({ guidesH: [], guidesV: [] });
    }

    moveElement(drag.id, nx, ny);
  }, [drag, panW, panH, gridEnabled, gridSize, snapToEdges, elements, moveElement]);

  const onUp = useCallback(() => {
    setDrag(null);
    setSnapGuides({ guidesH: [], guidesV: [] });
  }, []);

  useEffect(() => {
    if (drag) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      return () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
    }
  }, [drag, onMove, onUp]);

  // Grid dots
  const gridDots = useMemo(() => {
    if (!gridEnabled) return null;
    const dots: React.ReactNode[] = [];
    for (let gx = gridSize; gx < panW; gx += gridSize) {
      for (let gy = gridSize; gy < panH; gy += gridSize) {
        dots.push(
          <circle
            key={`g${gx}_${gy}`}
            cx={OX + EIA.EAR_WIDTH * SC + gx * SC}
            cy={OY + gy * SC}
            r={0.4}
            fill={SVG_COLORS.gridDot}
          />
        );
      }
    }
    return dots;
  }, [gridEnabled, gridSize, panW, panH]);

  // ─── Catalog drag-to-canvas drop handling ─────────────────
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only set false if leaving the container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const data = parseCatalogDragData(e);
    if (!data) return;

    const svg = svgRef.current;
    if (!svg) return;

    // Convert drop pixel coordinates to panel mm coordinates
    const rect = svg.getBoundingClientRect();
    const scaleX = (vW) / rect.width;
    const scaleY = (vH) / rect.height;
    const svgX = (e.clientX - rect.left) * scaleX;
    const svgY = (e.clientY - rect.top) * scaleY;

    // Convert from SVG viewBox coords to panel mm (accounting for ear offset)
    const panelX = (svgX - OX - EIA.EAR_WIDTH * SC) / SC;
    const panelY = (svgY - OY) / SC;

    // Add element then move to drop position
    const store = useConfigStore.getState();
    const type = data.itemType === 'device' ? 'device' : 'connector';
    store.addElement(type as 'device' | 'connector', data.slug);

    // Get the newly added element (last in array)
    const updatedElements = useConfigStore.getState().elements;
    const newEl = updatedElements[updatedElements.length - 1];
    if (newEl) {
      // Clamp to panel bounds
      const clampedX = Math.max(newEl.w / 2, Math.min(panW - newEl.w / 2, panelX));
      const clampedY = Math.max(newEl.h / 2, Math.min(panH - newEl.h / 2, panelY));
      useConfigStore.getState().moveElement(newEl.id, clampedX, clampedY);
    }
  }, [vW, vH, panW, panH]);

  return (
    <div
      className={`flex-1 flex items-center justify-center overflow-auto p-4 bg-bg-main transition-all ${
        isDragOver ? 'ring-2 ring-primary/30 ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${vW} ${vH}`}
        className="max-w-full max-h-full"
        style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,.35))' }}
        onMouseDown={() => selectElement(null)}
      >
        {/* Background + grid dots */}
        <defs>
          <pattern id="g" width={5 * SC} height={5 * SC} patternUnits="userSpaceOnUse" patternTransform={`translate(${OX},${OY})`}>
            <circle cx={5 * SC} cy={5 * SC} r={0.3} fill={SVG_COLORS.gridDot} />
          </pattern>
        </defs>
        <rect width={vW} height={vH} fill={SVG_COLORS.canvasBg} />
        <rect width={vW} height={vH} fill="url(#g)" />

        {/* Total panel outline (dashed) */}
        <rect x={OX} y={OY} width={totW * SC} height={panH * SC} fill="none" stroke={SVG_COLORS.panelStroke} strokeWidth={0.4} strokeDasharray="4,4" />

        {/* Split lines */}
        {needsSplit && splitInfo.type === '3-piece' && (() => {
          const earW = splitInfo.parts[1].w;
          return [earW, totW - earW].map((sx, i) => (
            <line key={`sl${i}`} x1={OX + sx * SC} y1={OY - 8} x2={OX + sx * SC} y2={OY + panH * SC + 8} stroke={SVG_COLORS.splitLine} strokeWidth={1} strokeDasharray="6,3" />
          ));
        })()}
        {needsSplit && splitInfo.type === '2-piece' && (
          <line x1={OX + (totW / 2) * SC} y1={OY - 8} x2={OX + (totW / 2) * SC} y2={OY + panH * SC + 8} stroke={SVG_COLORS.splitLine} strokeWidth={1} strokeDasharray="6,3" />
        )}

        {/* Ears */}
        {[0, 1].map(s => (
          <rect
            key={`ear${s}`}
            x={OX + (s === 0 ? 0 : (totW - EIA.EAR_WIDTH) * SC)}
            y={OY}
            width={EIA.EAR_WIDTH * SC}
            height={panH * SC}
            fill={SVG_COLORS.earFill} stroke={SVG_COLORS.earStroke} strokeWidth={0.4}
          />
        ))}

        {/* Bores */}
        {bores.map((by, i) => {
          const boreR = boreDia / 2;
          const boreW = boreDia;
          const boreH = boreDia + 4.5;
          return [0, 1].map(s => (
            <rect
              key={`b${i}${s}`}
              x={OX + (s === 0 ? (EIA.EAR_WIDTH / 2 - boreW / 2) * SC : (totW - EIA.EAR_WIDTH / 2 - boreW / 2) * SC)}
              y={OY + by * SC - boreH / 2 * SC}
              width={boreW * SC} height={boreH * SC} rx={boreR * SC}
              fill={SVG_COLORS.boreFill} stroke={SVG_COLORS.boreStroke} strokeWidth={0.35}
            />
          ));
        })}

        {/* Panel face */}
        <rect
          x={OX + EIA.EAR_WIDTH * SC} y={OY}
          width={panW * SC} height={panH * SC}
          fill={SVG_COLORS.panelFace}
          stroke={fabMethod === '3dp' ? SVG_COLORS.splitLine : SVG_COLORS.warning}
          strokeWidth={0.8}
        />

        {/* Center guide */}
        <line
          x1={OX + (totW / 2) * SC} y1={OY}
          x2={OX + (totW / 2) * SC} y2={OY + panH * SC}
          stroke={SVG_COLORS.gridDot} strokeWidth={0.3} strokeDasharray="2,4"
        />

        {/* Lockpin indicators for 3-piece split */}
        {needsSplit && splitInfo.type === '3-piece' && (() => {
          const earW = splitInfo.parts[1].w;
          const mbW = (splitInfo.mountbarW ?? BASE.UNIT) * SC;
          const pinY1 = OY + panH * SC * 0.33;
          const pinY2 = OY + panH * SC * 0.67;
          return [earW, totW - earW].map((sx, i) => (
            <g key={`lp${i}`}>
              <rect
                x={OX + (sx - BASE.UNIT / 2) * SC} y={OY}
                width={mbW} height={panH * SC}
                fill={SVG_COLORS.splitFill} stroke={SVG_COLORS.splitLine} strokeWidth={0.5} strokeDasharray="3,2"
              />
              <circle cx={OX + sx * SC} cy={pinY1} r={2.5} fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.8} />
              <circle cx={OX + sx * SC} cy={pinY2} r={2.5} fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.8} />
              <text x={OX + sx * SC} y={OY - 12} textAnchor="middle" fill={SVG_COLORS.splitLine} fontSize={6} fontFamily="inherit">LOCKPIN</text>
            </g>
          ));
        })()}

        {/* Grid dots */}
        {gridDots}

        {/* Snap guide lines during drag */}
        {drag && snapGuides.guidesV.map((gx, i) => (
          <line
            key={`sv${i}`}
            x1={OX + EIA.EAR_WIDTH * SC + gx * SC}
            y1={OY - 4}
            x2={OX + EIA.EAR_WIDTH * SC + gx * SC}
            y2={OY + panH * SC + 4}
            stroke={SVG_COLORS.accent} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.7}
          />
        ))}
        {drag && snapGuides.guidesH.map((gy, i) => (
          <line
            key={`sh${i}`}
            x1={OX + EIA.EAR_WIDTH * SC - 4}
            y1={OY + gy * SC}
            x2={OX + EIA.EAR_WIDTH * SC + panW * SC + 4}
            y2={OY + gy * SC}
            stroke={SVG_COLORS.accent} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.7}
          />
        ))}

        {/* Reinforcement rib overlay */}
        {ribs.map((rib, i) => (
          <rect
            key={`rib${i}`}
            x={OX + EIA.EAR_WIDTH * SC + (rib.x - rib.w / 2) * SC}
            y={OY + (rib.y - rib.h / 2) * SC}
            width={rib.w * SC}
            height={rib.h * SC}
            fill={SVG_COLORS.ribFill} stroke={SVG_COLORS.ribStroke} strokeWidth={0.5} strokeDasharray="2,2"
            rx={1}
          />
        ))}

        {/* Elements */}
        {elements.map(el => {
          // Skip rear-surface elements in front view (show as ghost)
          const isRearSurface = el.surface === 'rear';
          const lib = el.type === 'connector' ? CONNECTORS[el.key] : el.type === 'fan' ? FANS[el.key] : DEVICES[el.key];
          const ex = OX + EIA.EAR_WIDTH * SC + (el.x - el.w / 2) * SC;
          const ey = OY + (el.y - el.h / 2) * SC;
          const ew = el.w * SC;
          const eh = el.h * SC;
          const cx = ex + ew / 2;
          const cy = ey + eh / 2;
          const isSel = selectedId === el.id;
          const isOverlap = overlapIds.has(el.id);
          const isOOB = oobIds.has(el.id);
          const hasMarginWarn = marginIds.has(el.id);
          const hasValidationIssue = validationIds.size > 0 && validationIds.has(el.id);
          const isR = el.type === 'connector' && lib && 'cut' in lib && ((lib as typeof CONNECTORS[string]).cut === 'round' || (lib as typeof CONNECTORS[string]).cut === 'd-shape');
          const isFan = el.type === 'fan';

          return (
            <g key={el.id} onMouseDown={e => onDown(e, el.id)} style={{ cursor: drag ? 'grabbing' : 'grab' }} opacity={isRearSurface ? 0.35 : 1}>
              {/* Selection outline */}
              {isSel && (
                <rect
                  x={ex - 3} y={ey - 3}
                  width={ew + 6} height={eh + 6}
                  fill="none" stroke={SVG_COLORS.accent} strokeWidth={1} strokeDasharray="3,2"
                  rx={isR || isFan ? (ew + 6) / 2 : 2}
                />
              )}

              {/* Overlap outline */}
              {isOverlap && (
                <rect
                  x={ex - 2} y={ey - 2}
                  width={ew + 4} height={eh + 4}
                  fill="none" stroke={SVG_COLORS.danger} strokeWidth={0.8} strokeDasharray="2,2" rx={2}
                />
              )}

              {/* Out of bounds outline */}
              {isOOB && (
                <rect
                  x={ex - 2} y={ey - 2}
                  width={ew + 4} height={eh + 4}
                  fill="none" stroke={SVG_COLORS.warning} strokeWidth={0.8} strokeDasharray="2,2" rx={2}
                />
              )}

              {/* Margin warning outline */}
              {hasMarginWarn && !isOverlap && !isOOB && (
                <rect
                  x={ex - 1.5} y={ey - 1.5}
                  width={ew + 3} height={eh + 3}
                  fill="none" stroke={SVG_COLORS.warning} strokeWidth={0.6} strokeDasharray="3,1" rx={2}
                />
              )}

              {/* Validation preflight issue highlight (red dashed) */}
              {hasValidationIssue && !isOverlap && !isOOB && (
                <rect
                  x={ex - 2.5} y={ey - 2.5}
                  width={ew + 5} height={eh + 5}
                  fill={SVG_COLORS.accentSubtle} stroke={SVG_COLORS.danger} strokeWidth={1} strokeDasharray="4,2" rx={2}
                />
              )}

              {/* Fan shape (circle + 4 bolt holes) */}
              {isFan ? (
                <>
                  <circle cx={cx} cy={cy} r={ew / 2} fill={isRearSurface ? 'transparent' : SVG_COLORS.deviceFill} stroke={SVG_COLORS.elementStroke} strokeWidth={0.6} strokeDasharray={isRearSurface ? '3,2' : 'none'} />
                  {/* Center cutout circle */}
                  <circle cx={cx} cy={cy} r={((lib as typeof FANS[string])?.cutoutDiameter ?? el.w * 0.8) / 2 * SC} fill={SVG_COLORS.connectorFill} stroke={SVG_COLORS.boreStroke} strokeWidth={0.4} />
                  {/* 4 bolt holes */}
                  {(() => {
                    const hs = ((lib as typeof FANS[string])?.holeSpacing ?? el.w * 0.85) / 2 * SC;
                    return [[-1,-1],[-1,1],[1,-1],[1,1]].map(([dx,dy], bi) => (
                      <circle key={bi} cx={cx + dx * hs} cy={cy + dy * hs} r={1.5} fill={SVG_COLORS.connectorFill} stroke={SVG_COLORS.boreStroke} strokeWidth={0.3} />
                    ));
                  })()}
                  {isRearSurface && <text x={cx} y={cy - ew / 2 - 4} textAnchor="middle" fill={SVG_COLORS.elementText} fontSize={5} fontFamily="inherit">REAR</text>}
                </>
              ) : el.type === 'connector' ? (
                isR ? (
                  <circle
                    cx={cx} cy={cy}
                    r={((lib && 'r' in lib ? (lib as typeof CONNECTORS[string]).r : el.w / 2) ?? el.w / 2) * SC}
                    fill={SVG_COLORS.connectorFill}
                    stroke={lib && 'color' in lib ? lib.color : SVG_COLORS.boreStroke}
                    strokeWidth={1}
                  />
                ) : (
                  <rect
                    x={ex} y={ey} width={ew} height={eh}
                    rx={1} fill={SVG_COLORS.connectorFill}
                    stroke={lib && 'color' in lib ? lib.color : SVG_COLORS.boreStroke}
                    strokeWidth={1}
                  />
                )
              ) : (
                (() => {
                  const outlinePath = getCachedOutlinePath(el.key, 'front');
                  if (outlinePath) {
                    return (
                      <path
                        d={outlinePath}
                        transform={`translate(${ex}, ${ey}) scale(${SC})`}
                        fill={SVG_COLORS.deviceFill}
                        stroke={lib && 'color' in lib ? lib.color : SVG_COLORS.elementText}
                        strokeWidth={0.6 / SC}
                      />
                    );
                  }
                  return (
                    <>
                      <rect
                        x={ex} y={ey} width={ew} height={eh}
                        rx={1.5} fill={SVG_COLORS.deviceFill}
                        stroke={lib && 'color' in lib ? lib.color : SVG_COLORS.elementText}
                        strokeWidth={0.6}
                      />
                      <line x1={ex} y1={ey} x2={ex + ew} y2={ey + eh} stroke={SVG_COLORS.panelStroke} strokeWidth={0.3} />
                      <line x1={ex + ew} y1={ey} x2={ex} y2={ey + eh} stroke={SVG_COLORS.panelStroke} strokeWidth={0.3} />
                    </>
                  );
                })()
              )}

              {/* Label */}
              <text
                x={cx} y={cy + 1}
                textAnchor="middle" dominantBaseline="central"
                fill={isFan ? SVG_COLORS.elementText : el.type === 'connector' ? (lib && 'color' in lib ? lib.color : SVG_COLORS.elementText) : SVG_COLORS.textSecondary}
                fontSize={Math.min(ew, eh) * (el.type === 'connector' ? 0.38 : isFan ? 0.2 : 0.1)}
                fontFamily="inherit"
              >
                {isFan ? '\u2601' : el.type === 'connector' ? (lib && 'icon' in lib ? (lib as typeof CONNECTORS[string]).icon : '') : el.label}
              </text>

              {/* Unknown slug warning badge */}
              {!knownSlugs.has(el.key) && (
                <g>
                  <title>Device not found in current catalog</title>
                  <polygon
                    points={`${ex + ew - 1},${ey + 1} ${ex + ew + 7},${ey + 1} ${ex + ew + 3},${ey + 9}`}
                    fill={SVG_COLORS.warning}
                    stroke={SVG_COLORS.panelStroke}
                    strokeWidth={0.5}
                  />
                  <text
                    x={ex + ew + 3}
                    y={ey + 6.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={SVG_COLORS.canvasBg}
                    fontSize={6}
                    fontWeight="bold"
                    fontFamily="inherit"
                  >
                    !
                  </text>
                </g>
              )}

              {/* Custom text label */}
              {(() => {
                const lp = labelMap.get(el.id);
                if (!lp) return null;
                const iconPath = lp.icon ? LABEL_ICONS[lp.icon] : undefined;
                const iconOffset = iconPath ? 5 : 0; // shift text right if icon present
                return (
                  <g className="pointer-events-none select-none">
                    {iconPath && (
                      <path
                        d={iconPath}
                        transform={`translate(${lp.cx - iconOffset - 4}, ${lp.y - 4}) scale(1)`}
                        fill={SVG_COLORS.labelIcon}
                        stroke="none"
                      />
                    )}
                    <text
                      x={lp.cx + (iconPath ? iconOffset / 2 : 0)}
                      y={lp.y}
                      textAnchor="middle"
                      dominantBaseline={lp.position === 'inside' ? 'central' : 'auto'}
                      fill={SVG_COLORS.labelText}
                      fontSize={5}
                      fontFamily="inherit"
                    >
                      {lp.displayText}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Dimension annotations */}
        <text
          x={OX + (EIA.EAR_WIDTH + panW / 2) * SC}
          y={OY + panH * SC + 24}
          textAnchor="middle" fill={SVG_COLORS.accent} fontSize={7} fontFamily="inherit"
        >
          {panW.toFixed(1)}mm ({totW === EIA.RACK_19 ? '19' : '10'}")
        </text>
        <text
          x={OX + totW * SC + 20}
          y={OY + panH * SC / 2}
          textAnchor="start" dominantBaseline="central"
          fill={SVG_COLORS.accent} fontSize={7} fontFamily="inherit"
          transform={`rotate(90 ${OX + totW * SC + 20} ${OY + panH * SC / 2})`}
        >
          {panH.toFixed(1)}mm ({useConfigStore.getState().uHeight}U)
        </text>
      </svg>
    </div>
  );
}
