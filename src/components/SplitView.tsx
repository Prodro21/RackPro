import { useConfigStore, selectPanelDims, selectNeedsSplit, selectSplitInfo, selectPrinter } from '../store';
import { BASE, LOCKPIN } from '../constants/eia310';
import { SectionLabel } from './ui/SectionLabel';
import { SpecTable } from './ui/SpecTable';

export function SplitView() {
  const fabMethod = useConfigStore(s => s.fabMethod);
  const panDims = useConfigStore(selectPanelDims);
  const needsSplit = useConfigStore(selectNeedsSplit);
  const splitInfo = useConfigStore(selectSplitInfo);
  const printer = useConfigStore(selectPrinter);
  const bedW = printer.bed[0];

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[680px]">
      <SectionLabel>SPLIT STRATEGY &mdash; {fabMethod === '3dp' ? printer.name : 'Sheet Metal'}</SectionLabel>

      {fabMethod !== '3dp' ? (
        <div className="text-[11px] text-text-secondary leading-relaxed">
          Sheet metal panels are fabricated flat and bent &mdash; no split needed regardless of size. The flat pattern is laser-cut or CNC-punched from a single sheet.
        </div>
      ) : (
        <>
          <div className="bg-bg-card border border-border rounded-[5px] p-[14px] mb-[10px]">
            <div className="font-bold text-[12px] mb-[6px]" style={{ color: needsSplit ? '#f7b600' : '#4ade80' }}>
              {needsSplit
                ? `\u26a0 Panel exceeds ${bedW}mm bed \u2192 ${splitInfo.type}`
                : `\u2713 Panel fits on ${printer.name} bed (${panDims.totalWidth.toFixed(0)}mm \u2264 ${bedW}mm)`
              }
            </div>
            {needsSplit && <div className="text-[10px] text-text-secondary mb-2">{splitInfo.desc}</div>}
            <SpecTable rows={splitInfo.parts.map(p => [p.name, `${p.w.toFixed(1)}mm wide \u2022 ${p.fitsX && p.fitsY ? '\u2713 fits' : '\u26a0'}`])} />
          </div>

          {needsSplit && splitInfo.type === '3-piece' && (
            <div className="bg-bg-card border border-border rounded-[5px] p-[14px] mb-[10px]">
              <div className="font-bold text-[12px] text-accent-green mb-[6px]">OpenSCAD-Style Lockpin Joint</div>
              <div className="text-[10px] text-text-secondary leading-relaxed mb-2">
                Adapted from the HomeRacker design. The center panel has <b className="text-[#ccc]">mountbars</b> (15&times;15mm posts) extending from the rear at each split line. Each mountbar has <b className="text-[#ccc]">lockpin holes</b> &mdash; chamfered 4&times;4mm square holes that accept printed or metal lock pins.
                <br /><br />
                The side ear pieces have matching <b className="text-[#ccc]">lockpin receptacles</b> &mdash; outer holes (4mm + chamfer + tolerance) that slide over the pins. The U-shaped connector on the side ear wraps around the mountbar creating a rigid mechanical interlock.
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
              <svg viewBox="0 0 300 120" className="w-full mt-3 bg-[#0e0e12] rounded">
                <text x={150} y={12} textAnchor="middle" fill="#555" fontSize={7} fontFamily="inherit">EXPLODED JOINT &mdash; TOP VIEW</text>
                {/* Center */}
                <rect x={100} y={25} width={100} height={70} fill="#1e1e26" stroke="#f7b600" strokeWidth={0.8} rx={1} />
                <text x={150} y={55} textAnchor="middle" fill="#f7b600" fontSize={7} fontFamily="inherit">CENTER</text>
                {/* Mountbar left */}
                <rect x={88} y={40} width={12} height={40} fill="#22c55e33" stroke="#22c55e" strokeWidth={0.8} rx={1} />
                <circle cx={94} cy={52} r={2} fill="none" stroke="#22c55e" strokeWidth={0.8} />
                <circle cx={94} cy={68} r={2} fill="none" stroke="#22c55e" strokeWidth={0.8} />
                <text x={94} y={86} textAnchor="middle" fill="#22c55e" fontSize={5}>MOUNTBAR</text>
                {/* Mountbar right */}
                <rect x={200} y={40} width={12} height={40} fill="#22c55e33" stroke="#22c55e" strokeWidth={0.8} rx={1} />
                <circle cx={206} cy={52} r={2} fill="none" stroke="#22c55e" strokeWidth={0.8} />
                <circle cx={206} cy={68} r={2} fill="none" stroke="#22c55e" strokeWidth={0.8} />
                {/* Left ear */}
                <rect x={30} y={25} width={50} height={70} fill="#1e1e2611" stroke="#22c55e" strokeWidth={0.8} rx={1} strokeDasharray="4,2" />
                <text x={55} y={55} textAnchor="middle" fill="#22c55e" fontSize={7}>LEFT EAR</text>
                <path d="M 80 38 L 80 30 L 90 30 L 90 38" fill="none" stroke="#22c55e" strokeWidth={0.8} />
                <path d="M 80 82 L 80 90 L 90 90 L 90 82" fill="none" stroke="#22c55e" strokeWidth={0.8} />
                {/* Right ear */}
                <rect x={220} y={25} width={50} height={70} fill="#1e1e2611" stroke="#4a90d9" strokeWidth={0.8} rx={1} strokeDasharray="4,2" />
                <text x={245} y={55} textAnchor="middle" fill="#4a90d9" fontSize={7}>RIGHT EAR</text>
                {/* Arrows */}
                <text x={78} y={62} textAnchor="middle" fill="#22c55e" fontSize={10}>&rarr;</text>
                <text x={222} y={62} textAnchor="middle" fill="#4a90d9" fontSize={10}>&larr;</text>
                <text x={150} y={110} textAnchor="middle" fill="#555" fontSize={6} fontFamily="inherit">Ears slide onto mountbar pins &bull; Friction-fit or M3 bolt</text>
              </svg>
            </div>
          )}

          <div className="bg-bg-card border border-border rounded-[5px] p-[14px]">
            <div className="font-bold text-[12px] text-[#f7f7f7] mb-[6px]">Material Considerations</div>
            <div className="text-[10px] text-text-secondary leading-relaxed">
              <b className="text-accent-green">3D Print (FDM)</b> &mdash; Lock pins can be printed separately in the same material. For PETG/ABS, the friction fit is usually sufficient. For PLA, consider adding an M3&times;12mm bolt through each lockpin hole for positive retention. Print mountbars with 4+ wall loops for strength.
              <br /><br />
              <b className="text-accent-gold">Sheet Metal</b> &mdash; No split needed. Panel is a single flat pattern with bend lines. The flange, side walls, and rear panel are all formed from one piece. PEM fasteners or weld nuts for assembly.
              <br /><br />
              <b className="text-[#888]">Rear support</b> &mdash; The tray/bracket extends across the full width including split lines, acting as a structural bridge. For 3D prints, this is critical &mdash; it prevents the joint from flexing under device weight.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
