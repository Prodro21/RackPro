import { useConfigStore, selectPanelHeight, selectEnclosureDepth, selectMetal, selectAssemblyMode, selectEnclosureStyle } from '../store';
import { CONNECTORS } from '../constants/connectors';
import { DEVICES } from '../constants/devices';
import { FANS } from '../constants/fans';
import { useReinforcement } from '../hooks/useReinforcement';
import { useEnclosure } from '../hooks/useEnclosure';
import { SVG_COLORS } from '../lib/svgTheme';

const SC = 1.15;
const OY = 40;

export function SideView() {
  const fabMethod = useConfigStore(s => s.fabMethod);
  const wallThickness = useConfigStore(s => s.wallThickness);
  const flangeDepth = useConfigStore(s => s.flangeDepth);
  const rearPanel = useConfigStore(s => s.rearPanel);
  const ventSlots = useConfigStore(s => s.ventSlots);
  const elements = useConfigStore(s => s.elements);
  const panH = useConfigStore(selectPanelHeight);
  const enclosureDepth = useConfigStore(selectEnclosureDepth);
  const metal = useConfigStore(selectMetal);
  const assemblyMode = useConfigStore(selectAssemblyMode);
  const enclosureStyle = useConfigStore(selectEnclosureStyle);
  const ribs = useReinforcement();
  const enclosure = useEnclosure();
  const isModular = assemblyMode === 'modular';
  const isTrayStyle = enclosureStyle === 'tray';

  const sideVW = enclosureDepth * SC + 100;
  const sideVH = panH * SC + 80;
  const sx = 40;
  const sy = OY;
  const faceW = (fabMethod === '3dp' ? wallThickness : metal.t) * SC;
  const depthPx = enclosureDepth * SC;
  const hPx = panH * SC;
  const wt = faceW;

  return (
    <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-bg-main">
      <svg viewBox={`0 0 ${sideVW} ${sideVH}`} className="max-w-full max-h-full" style={{ filter: 'drop-shadow(0 2px 16px rgba(0,0,0,.35))' }}>
        <defs>
          <pattern id="gs" width={5 * SC} height={5 * SC} patternUnits="userSpaceOnUse">
            <circle cx={5 * SC} cy={5 * SC} r={0.3} fill={SVG_COLORS.gridDot} />
          </pattern>
          {/* Hex lightweighting pattern for tray floors */}
          <pattern id="hex-pat" width={6} height={5.2} patternUnits="userSpaceOnUse" patternTransform="scale(0.8)">
            <polygon points="3,0.6 5.6,1.9 5.6,4.5 3,5.8 0.4,4.5 0.4,1.9" fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.4} opacity={0.5} />
          </pattern>
        </defs>
        <rect width={sideVW} height={sideVH} fill={SVG_COLORS.canvasBg} />
        <rect width={sideVW} height={sideVH} fill="url(#gs)" />

        {/* Front face */}
        <rect x={sx} y={sy} width={faceW} height={hPx} fill={SVG_COLORS.crossSection} stroke={fabMethod === '3dp' ? SVG_COLORS.splitLine : SVG_COLORS.warning} strokeWidth={0.8} />
        <text x={sx + faceW / 2} y={sy - 8} textAnchor="middle" fill={SVG_COLORS.elementText} fontSize={6} fontFamily="inherit">FRONT</text>

        {/* Top/Bottom walls (box style only) */}
        {!isTrayStyle && (
          <>
            <rect x={sx} y={sy} width={depthPx} height={wt} fill={SVG_COLORS.wallFill} stroke={SVG_COLORS.elementStroke} strokeWidth={0.4} />
            <rect x={sx} y={sy + hPx - wt} width={depthPx} height={wt} fill={SVG_COLORS.wallFill} stroke={SVG_COLORS.elementStroke} strokeWidth={0.4} />
          </>
        )}

        {/* Flange */}
        <rect x={sx + faceW} y={sy + wt} width={flangeDepth * SC} height={hPx - wt * 2} fill="none" stroke={SVG_COLORS.accent} strokeWidth={0.6} strokeDasharray="3,2" opacity={0.4} />
        <text x={sx + faceW + (flangeDepth * SC) / 2} y={sy + hPx / 2} textAnchor="middle" dominantBaseline="central" fill={SVG_COLORS.accent} fontSize={5} fontFamily="inherit" opacity={0.4}>
          FLANGE {flangeDepth}mm
        </text>

        {/* Rear panel */}
        {rearPanel && <rect x={sx + depthPx - wt} y={sy} width={wt} height={hPx} fill={SVG_COLORS.crossSection} stroke={SVG_COLORS.elementStroke} strokeWidth={0.5} />}
        <text x={sx + depthPx + 6} y={sy + hPx / 2} textAnchor="start" dominantBaseline="central" fill={SVG_COLORS.elementText} fontSize={6} fontFamily="inherit">
          {rearPanel ? 'REAR' : '(open)'}
        </text>

        {/* Vent slots */}
        {ventSlots && Array.from({ length: 3 }).map((_, i) => (
          <rect key={`vs${i}`} x={sx + depthPx * 0.4 + i * 12 * SC} y={sy + hPx - wt} width={8 * SC} height={wt} fill={SVG_COLORS.canvasBg} stroke={SVG_COLORS.elementStroke} strokeWidth={0.3} />
        ))}

        {/* Device outlines with tray cross-sections */}
        {elements.filter(e => e.type === 'device').map(el => {
          const dev = DEVICES[el.key];
          if (!dev) return null;
          const dH = dev.h * SC;
          const dD = dev.d * SC;
          const dY = sy + wt + (hPx - wt * 2 - dH) / 2;
          const trayGap = isModular ? 2 : 0;
          const sideWallH = 15 * SC;  // BASE_UNIT = 15mm
          const floorT = wt * 0.8;
          const trayInfo = enclosure.trays.find(t => t.elementId === el.id);
          const isHex = trayInfo?.floorStyle === 'hex';
          return (
            <g key={el.id}>
              {/* Tray U-channel cross-section (tray style) */}
              {isTrayStyle && (
                <>
                  {/* Floor */}
                  <rect x={sx + faceW} y={dY + dH} width={dD} height={floorT} fill={isHex ? SVG_COLORS.splitFill : SVG_COLORS.crossSection} stroke={isHex ? SVG_COLORS.splitLine : SVG_COLORS.elementStroke} strokeWidth={0.4} />
                  {isHex && <rect x={sx + faceW} y={dY + dH} width={dD} height={floorT} fill="url(#hex-pat)" />}
                  {/* Left side wall */}
                  <rect x={sx + faceW} y={dY + dH - sideWallH} width={wt} height={sideWallH} fill={SVG_COLORS.wallFill} stroke={SVG_COLORS.elementStroke} strokeWidth={0.4} />
                  {/* Right side wall (at rear) */}
                  <rect x={sx + faceW + dD - wt} y={dY + dH - sideWallH} width={wt} height={sideWallH} fill={SVG_COLORS.wallFill} stroke={SVG_COLORS.elementStroke} strokeWidth={0.4} />
                  {/* Wedge stopper (small block at rear) */}
                  <rect x={sx + faceW + dD - wt - 8 * SC} y={dY + dH - sideWallH} width={8 * SC} height={sideWallH * 0.6} fill={SVG_COLORS.crossSection} stroke={SVG_COLORS.elementStroke} strokeWidth={0.3} opacity={0.5} />
                  {/* Stabilizer triangles (when device height > 30mm) */}
                  {dev.h > 30 && (
                    <polygon
                      points={`${sx + faceW},${dY + dH - sideWallH} ${sx + faceW},${dY} ${sx + faceW + Math.min(dH - sideWallH, dD) * 0.4},${dY + dH - sideWallH}`}
                      fill={SVG_COLORS.modularFill} stroke={SVG_COLORS.modularStroke} strokeWidth={0.4}
                    />
                  )}
                </>
              )}
              {isModular && !isTrayStyle && (
                <>
                  <rect x={sx + faceW + trayGap} y={dY - 2} width={dD} height={dH + 4} fill={SVG_COLORS.modularFill} stroke={SVG_COLORS.modularStroke} strokeWidth={0.5} strokeDasharray="3,2" />
                  <text x={sx + faceW + trayGap + dD + 3} y={dY - 1} fill={SVG_COLORS.modularStroke} fontSize={4} fontFamily="inherit">TRAY</text>
                </>
              )}
              <rect x={sx + faceW + trayGap + 2} y={dY} width={dD - 4} height={dH} fill={SVG_COLORS.splitFill} stroke={dev.color} strokeWidth={0.6} strokeDasharray="4,2" />
              <text x={sx + faceW + trayGap + dD / 2} y={dY + dH / 2} textAnchor="middle" dominantBaseline="central" fill={SVG_COLORS.elementText} fontSize={5} fontFamily="inherit">{dev.name}</text>
              <text x={sx + faceW + trayGap + dD / 2} y={dY + dH / 2 + 8} textAnchor="middle" fill={SVG_COLORS.textSecondary} fontSize={4} fontFamily="inherit">{dev.d}mm deep</text>
            </g>
          );
        })}

        {/* Connector depth indicators */}
        {elements.filter(e => e.type === 'connector').slice(0, 3).map((el, i) => {
          const con = CONNECTORS[el.key];
          if (!con) return null;
          const cD = con.depthBehind * SC;
          const cY = sy + wt + 6 + i * 8 * SC;
          return (
            <line key={el.id} x1={sx + faceW} y1={cY} x2={sx + faceW + cD} y2={cY} stroke={con.color} strokeWidth={1} opacity={0.5} />
          );
        })}

        {/* Reinforcement rib cross-sections */}
        {ribs.map((rib, i) => {
          const ribDepthPx = rib.depth * SC;
          const ribHPx = rib.h * SC;
          return (
            <rect
              key={`rib${i}`}
              x={sx + faceW}
              y={sy + wt + (hPx - wt * 2 - ribHPx) / 2}
              width={ribDepthPx}
              height={Math.min(ribHPx, 4)}
              fill={SVG_COLORS.ribFill} stroke={SVG_COLORS.ribStroke} strokeWidth={0.4}
            />
          );
        })}

        {/* Rear fan outlines */}
        {elements.filter(e => e.type === 'fan' && e.surface === 'rear').map(el => {
          const fan = FANS[el.key];
          if (!fan) return null;
          const fanD = fan.depthBehind * SC;
          const fanH = fan.size * SC;
          const fanY = sy + wt + (hPx - wt * 2 - fanH) / 2;
          const fanX = sx + depthPx - wt - fanD;
          return (
            <g key={`rfan-${el.id}`}>
              <rect x={fanX} y={fanY} width={fanD} height={fanH} fill={SVG_COLORS.elementFill} stroke={SVG_COLORS.elementText} strokeWidth={0.5} strokeDasharray="3,2" opacity={0.5} />
              <text x={fanX + fanD / 2} y={fanY + fanH / 2} textAnchor="middle" dominantBaseline="central" fill={SVG_COLORS.elementText} fontSize={4} fontFamily="inherit">{fan.name}</text>
            </g>
          );
        })}

        {/* Stiffener wedge triangles (from reinforcement) */}
        {ribs.filter(r => r.type === 'stiffener-wedge').map((rib, i) => {
          const isTop = rib.y < panH / 2;
          const wedgeSize = rib.w * SC;
          const baseY = isTop ? sy + wt : sy + hPx - wt;
          const tipY = isTop ? baseY + wedgeSize : baseY - wedgeSize;
          return (
            <polygon
              key={`wedge${i}`}
              points={`${sx + faceW},${baseY} ${sx + faceW + wedgeSize},${baseY} ${sx + faceW},${tipY}`}
              fill={SVG_COLORS.ribFill} stroke={SVG_COLORS.ribStroke} strokeWidth={0.4}
            />
          );
        })}

        {/* Dimension lines */}
        <line x1={sx} y1={sy + hPx + 16} x2={sx + depthPx} y2={sy + hPx + 16} stroke={SVG_COLORS.accent} strokeWidth={0.4} opacity={0.5} />
        <text x={sx + depthPx / 2} y={sy + hPx + 26} textAnchor="middle" fill={SVG_COLORS.accent} fontSize={7} fontFamily="inherit">{enclosureDepth.toFixed(0)}mm depth</text>

        <line x1={sx - 12} y1={sy} x2={sx - 12} y2={sy + hPx} stroke={SVG_COLORS.accent} strokeWidth={0.4} opacity={0.5} />
        <text x={sx - 18} y={sy + hPx / 2} textAnchor="middle" dominantBaseline="central" fill={SVG_COLORS.accent} fontSize={7} fontFamily="inherit" transform={`rotate(-90 ${sx - 18} ${sy + hPx / 2})`}>
          {panH.toFixed(1)}mm
        </text>
      </svg>
    </div>
  );
}
