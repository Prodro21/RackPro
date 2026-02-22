import { useState, useCallback, useEffect, useRef } from 'react';
import { useConfigStore } from '../store';
import { panelDimensions, panelHeight } from '../constants/eia310';

interface DragState {
  id: string;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

interface SnapGuides {
  horizontal: number[];
  vertical: number[];
}

function snapToGrid(pos: number, gridSize: number): number {
  return Math.round(pos / gridSize) * gridSize;
}

function findEdgeSnaps(
  x: number, y: number, w: number, h: number,
  elements: { id: string; x: number; y: number; w: number; h: number }[],
  dragId: string, panW: number, panH: number, threshold: number
): { snapX: number | null; snapY: number | null; guides: SnapGuides } {
  const guides: SnapGuides = { horizontal: [], vertical: [] };
  let snapX: number | null = null;
  let snapY: number | null = null;

  const myLeft = x - w / 2, myRight = x + w / 2;
  const myTop = y - h / 2, myBot = y + h / 2;

  // Check against panel center
  if (Math.abs(x - panW / 2) < threshold) {
    snapX = panW / 2;
    guides.vertical.push(panW / 2);
  }
  if (Math.abs(y - panH / 2) < threshold) {
    snapY = panH / 2;
    guides.horizontal.push(panH / 2);
  }

  // Check against other elements
  for (const el of elements) {
    if (el.id === dragId) continue;
    const eLeft = el.x - el.w / 2, eRight = el.x + el.w / 2;
    const eTop = el.y - el.h / 2, eBot = el.y + el.h / 2;

    // Vertical edge snaps (left/right alignment)
    if (Math.abs(myLeft - eLeft) < threshold) {
      snapX = eLeft + w / 2;
      guides.vertical.push(eLeft);
    } else if (Math.abs(myRight - eRight) < threshold) {
      snapX = eRight - w / 2;
      guides.vertical.push(eRight);
    } else if (Math.abs(myLeft - eRight) < threshold) {
      snapX = eRight + w / 2;
      guides.vertical.push(eRight);
    } else if (Math.abs(myRight - eLeft) < threshold) {
      snapX = eLeft - w / 2;
      guides.vertical.push(eLeft);
    }
    // Center-to-center alignment
    if (Math.abs(x - el.x) < threshold) {
      snapX = el.x;
      guides.vertical.push(el.x);
    }

    // Horizontal edge snaps (top/bottom alignment)
    if (Math.abs(myTop - eTop) < threshold) {
      snapY = eTop + h / 2;
      guides.horizontal.push(eTop);
    } else if (Math.abs(myBot - eBot) < threshold) {
      snapY = eBot - h / 2;
      guides.horizontal.push(eBot);
    } else if (Math.abs(myTop - eBot) < threshold) {
      snapY = eBot + h / 2;
      guides.horizontal.push(eBot);
    } else if (Math.abs(myBot - eTop) < threshold) {
      snapY = eTop - h / 2;
      guides.horizontal.push(eTop);
    }
    if (Math.abs(y - el.y) < threshold) {
      snapY = el.y;
      guides.horizontal.push(el.y);
    }
  }

  return { snapX, snapY, guides };
}

export function useDrag(svgRef: React.RefObject<SVGSVGElement | null>, scale: number) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({ horizontal: [], vertical: [] });
  const dragRef = useRef(drag);
  dragRef.current = drag;

  const elements = useConfigStore(s => s.elements);
  const gridEnabled = useConfigStore(s => s.gridEnabled);
  const gridSize = useConfigStore(s => s.gridSize);
  const snapToEdges = useConfigStore(s => s.snapToEdges);
  const moveElement = useConfigStore(s => s.moveElement);
  const selectElement = useConfigStore(s => s.selectElement);
  const standard = useConfigStore(s => s.standard);
  const uHeight = useConfigStore(s => s.uHeight);

  const { panelWidth: panW } = panelDimensions(standard);
  const panH = panelHeight(uHeight);

  const onDown = useCallback((ev: React.MouseEvent, id: string) => {
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
  }, [svgRef, elements, selectElement]);

  const onMove = useCallback((ev: MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const sp = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const dx = (sp.x - d.sx) / scale;
    const dy = (sp.y - d.sy) / scale;
    const el = elements.find(e => e.id === d.id);
    if (!el) return;

    let nx = d.ox + dx;
    let ny = d.oy + dy;

    // Grid snap
    if (gridEnabled) {
      nx = snapToGrid(nx, gridSize);
      ny = snapToGrid(ny, gridSize);
    }

    // Edge snap
    let guides: SnapGuides = { horizontal: [], vertical: [] };
    if (snapToEdges) {
      const result = findEdgeSnaps(nx, ny, el.w, el.h, elements, d.id, panW, panH, 2);
      if (result.snapX !== null) nx = result.snapX;
      if (result.snapY !== null) ny = result.snapY;
      guides = result.guides;
    }

    // Clamp to panel bounds
    nx = Math.max(el.w / 2, Math.min(panW - el.w / 2, nx));
    ny = Math.max(el.h / 2, Math.min(panH - el.h / 2, ny));

    moveElement(d.id, nx, ny);
    setSnapGuides(guides);
  }, [svgRef, scale, elements, gridEnabled, gridSize, snapToEdges, panW, panH, moveElement]);

  const onUp = useCallback(() => {
    setDrag(null);
    setSnapGuides({ horizontal: [], vertical: [] });
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

  return { drag, onDown, snapGuides };
}
