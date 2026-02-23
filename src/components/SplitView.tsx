import { useConfigStore, selectPanelDims, selectNeedsSplit, selectSplitInfo, selectPrinter } from '../store';
import { BASE, LOCKPIN } from '../constants/eia310';
import { SVG_COLORS } from '../lib/svgTheme';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-semibold text-text-tertiary tracking-wide uppercase mb-2 mt-4 first:mt-0">
      {children}
    </div>
  );
}

function SpecTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="bg-bg-card rounded-lg border border-border-default overflow-hidden">
      {rows.map(([label, value], i) => (
        <div
          key={i}
          className="flex justify-between px-3 py-1.5 text-xs border-t border-border-subtle first:border-t-0"
        >
          <span className="text-text-secondary">{label}</span>
          <span className="text-text-primary/90 font-medium font-mono">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function SplitView() {
  const fabMethod = useConfigStore(s => s.fabMethod);
  const panDims = useConfigStore(selectPanelDims);
  const needsSplit = useConfigStore(selectNeedsSplit);
  const splitInfo = useConfigStore(selectSplitInfo);
  const printer = useConfigStore(selectPrinter);
  const bedW = printer.bed[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[680px]">
      <SectionLabel>Split Strategy &mdash; {fabMethod === '3dp' ? printer.name : 'Sheet Metal'}</SectionLabel>

      {fabMethod !== '3dp' ? (
        <div className="text-sm text-text-secondary leading-relaxed">
          Sheet metal panels are fabricated flat and bent &mdash; no split needed regardless of size. The flat pattern is laser-cut or CNC-punched from a single sheet.
        </div>
      ) : (
        <>
          <div className="bg-bg-card border border-border-default rounded-lg p-4 mb-3">
            <div className="font-bold text-sm mb-1.5" style={{ color: needsSplit ? SVG_COLORS.warning : SVG_COLORS.success }}>
              {needsSplit
                ? `\u26a0 Panel exceeds ${bedW}mm bed \u2192 ${splitInfo.type}`
                : `\u2713 Panel fits on ${printer.name} bed (${panDims.totalWidth.toFixed(0)}mm \u2264 ${bedW}mm)`
              }
            </div>
            {needsSplit && <div className="text-xs text-text-secondary mb-2">{splitInfo.desc}</div>}
            <SpecTable rows={splitInfo.parts.map(p => [p.name, `${p.w.toFixed(1)}mm wide \u2022 ${p.fitsX && p.fitsY ? '\u2713 fits' : '\u26a0'}`])} />
          </div>

          {needsSplit && splitInfo.type === '3-piece' && (
            <div className="bg-bg-card border border-border-default rounded-lg p-4 mb-3">
              <div className="font-bold text-sm text-success mb-1.5">OpenSCAD-Style Lockpin Joint</div>
              <div className="text-xs text-text-secondary leading-relaxed mb-3">
                Adapted from the HomeRacker design. The center panel has <b className="text-text-primary">mountbars</b> (15&times;15mm posts) extending from the rear at each split line. Each mountbar has <b className="text-text-primary">lockpin holes</b> &mdash; chamfered 4&times;4mm square holes that accept printed or metal lock pins.
                <br /><br />
                The side ear pieces have matching <b className="text-text-primary">lockpin receptacles</b> &mdash; outer holes (4mm + chamfer + tolerance) that slide over the pins. The U-shaped connector on the side ear wraps around the mountbar creating a rigid mechanical interlock.
                <br /><br />
                The rear support structure (tray/bracket) spans the split line, adding additional rigidity.
              </div>
              <SpecTable rows={[
                ['Mountbar', `${BASE.UNIT}\u00d7${BASE.UNIT}mm (${BASE.UNIT}mm deep)`],
                ['Lockpin Hole', `${LOCKPIN.HOLE_SIDE}\u00d7${LOCKPIN.HOLE_SIDE}mm square, ${LOCKPIN.CHAMFER}mm chamfer`],
                ['Outer Width', `${LOCKPIN.WIDTH_OUTER.toFixed(1)}mm (pin + walls + tolerance)`],
                ['Pins per joint', '2 (spaced 15mm vertically)'],
                ['Tolerance', `${BASE.TOLERANCE}mm`],
                ['Assembly', 'Slide ears onto center pins, friction-fit or M3 bolt through'],
              ]} />

              {/* Exploded joint SVG */}
              <svg viewBox="0 0 300 120" className="w-full mt-3 rounded-lg border border-border-default" style={{ backgroundColor: SVG_COLORS.canvasBg }}>
                <text x={150} y={12} textAnchor="middle" fill={SVG_COLORS.elementText} fontSize={7} fontFamily="inherit">EXPLODED JOINT &mdash; TOP VIEW</text>
                {/* Center */}
                <rect x={100} y={25} width={100} height={70} fill={SVG_COLORS.panelFace} stroke={SVG_COLORS.accent} strokeWidth={0.8} rx={1} />
                <text x={150} y={55} textAnchor="middle" fill={SVG_COLORS.accent} fontSize={7} fontFamily="inherit">CENTER</text>
                {/* Mountbar left */}
                <rect x={88} y={40} width={12} height={40} fill={SVG_COLORS.splitFill} stroke={SVG_COLORS.splitLine} strokeWidth={0.8} rx={1} />
                <circle cx={94} cy={52} r={2} fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.8} />
                <circle cx={94} cy={68} r={2} fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.8} />
                <text x={94} y={86} textAnchor="middle" fill={SVG_COLORS.splitLine} fontSize={5}>MOUNTBAR</text>
                {/* Mountbar right */}
                <rect x={200} y={40} width={12} height={40} fill={SVG_COLORS.splitFill} stroke={SVG_COLORS.splitLine} strokeWidth={0.8} rx={1} />
                <circle cx={206} cy={52} r={2} fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.8} />
                <circle cx={206} cy={68} r={2} fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.8} />
                {/* Left ear */}
                <rect x={30} y={25} width={50} height={70} fill={SVG_COLORS.splitFill} stroke={SVG_COLORS.splitLine} strokeWidth={0.8} rx={1} strokeDasharray="4,2" />
                <text x={55} y={55} textAnchor="middle" fill={SVG_COLORS.splitLine} fontSize={7}>LEFT EAR</text>
                <path d="M 80 38 L 80 30 L 90 30 L 90 38" fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.8} />
                <path d="M 80 82 L 80 90 L 90 90 L 90 82" fill="none" stroke={SVG_COLORS.splitLine} strokeWidth={0.8} />
                {/* Right ear */}
                <rect x={220} y={25} width={50} height={70} fill={SVG_COLORS.modularFill} stroke={SVG_COLORS.modularStroke} strokeWidth={0.8} rx={1} strokeDasharray="4,2" />
                <text x={245} y={55} textAnchor="middle" fill={SVG_COLORS.modularStroke} fontSize={7}>RIGHT EAR</text>
                {/* Arrows */}
                <text x={78} y={62} textAnchor="middle" fill={SVG_COLORS.splitLine} fontSize={10}>&rarr;</text>
                <text x={222} y={62} textAnchor="middle" fill={SVG_COLORS.modularStroke} fontSize={10}>&larr;</text>
                <text x={150} y={110} textAnchor="middle" fill={SVG_COLORS.elementText} fontSize={6} fontFamily="inherit">Ears slide onto mountbar pins &bull; Friction-fit or M3 bolt</text>
              </svg>
            </div>
          )}

          <div className="bg-bg-card border border-border-default rounded-lg p-4">
            <div className="font-bold text-sm text-text-primary mb-1.5">Material Considerations</div>
            <div className="text-xs text-text-secondary leading-relaxed">
              <b className="text-success">3D Print (FDM)</b> &mdash; Lock pins can be printed separately in the same material. For PETG/ABS, the friction fit is usually sufficient. For PLA, consider adding an M3&times;12mm bolt through each lockpin hole for positive retention. Print mountbars with 4+ wall loops for strength.
              <br /><br />
              <b className="text-accent-text">Sheet Metal</b> &mdash; No split needed. Panel is a single flat pattern with bend lines. The flange, side walls, and rear panel are all formed from one piece. PEM fasteners or weld nuts for assembly.
              <br /><br />
              <b className="text-text-secondary">Rear support</b> &mdash; The tray/bracket extends across the full width including split lines, acting as a structural bridge. For 3D prints, this is critical &mdash; it prevents the joint from flexing under device weight.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
