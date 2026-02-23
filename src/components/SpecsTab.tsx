import { useMemo } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectMaxDeviceDepth, selectTotalWeight, selectNeedsSplit, selectSplitInfo, selectBendAllowance90, selectMetal, selectFilament, selectPrinter, selectMarginWarnings, selectAssemblyMode, selectTrayReinforcements, selectMountHoleType } from '../store';
import { useCatalogStore } from '../catalog/useCatalogStore';
import { FANS } from '../constants/fans';
import { lookupDevice } from '../constants/deviceLookup';
import { lookupConnector } from '../constants/connectorLookup';
import { BORE_HOLES } from '../constants/eia310';
import { useReinforcement } from '../hooks/useReinforcement';
import { generateConfig } from '../export/configJson';
import { computeBom } from '../lib/bom';
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold text-muted-foreground tracking-wide uppercase mb-2 mt-4 first:mt-0">
      {children}
    </div>
  );
}

function SpecTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {rows.map(([label, value], i) => (
        <div
          key={i}
          className="flex justify-between px-2 py-1 text-xs border-t border-border first:border-t-0"
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground/90 font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}

function confidenceBadge(level: string): { label: string; color: string } {
  switch (level) {
    case 'manufacturer-datasheet': return { label: 'Datasheet', color: '#4ade80' };
    case 'user-calipered': return { label: 'Calipered', color: '#60a5fa' };
    case 'cross-referenced': return { label: 'Cross-ref', color: '#f7b600' };
    case 'estimated': return { label: 'Estimated', color: '#fb923c' };
    default: return { label: level, color: '#888' };
  }
}

export function SpecsTab() {
  const standard = useConfigStore(s => s.standard);
  const uHeight = useConfigStore(s => s.uHeight);
  const fabMethod = useConfigStore(s => s.fabMethod);
  const wallThickness = useConfigStore(s => s.wallThickness);
  const flangeDepth = useConfigStore(s => s.flangeDepth);
  const rearPanel = useConfigStore(s => s.rearPanel);
  const ventSlots = useConfigStore(s => s.ventSlots);
  const elements = useConfigStore(s => s.elements);

  const panDims = useConfigStore(selectPanelDims);
  const panH = useConfigStore(selectPanelHeight);
  const depth = useConfigStore(selectEnclosureDepth);
  const maxDeviceDepth = useConfigStore(selectMaxDeviceDepth);
  const totalWeight = useConfigStore(selectTotalWeight);
  const needsSplit = useConfigStore(selectNeedsSplit);
  const splitInfo = useConfigStore(selectSplitInfo);
  const ba90 = useConfigStore(selectBendAllowance90);
  const metal = useConfigStore(selectMetal);
  const filament = useConfigStore(selectFilament);
  const printer = useConfigStore(selectPrinter);
  const marginWarnings = useConfigStore(selectMarginWarnings);
  const assemblyMode = useConfigStore(selectAssemblyMode);
  const mountHoleType = useConfigStore(selectMountHoleType);
  const trayReinforcements = useConfigStore(selectTrayReinforcements);
  const ribs = useReinforcement();
  const catalogDevices = useCatalogStore(s => s.devices);
  const catalogConnectors = useCatalogStore(s => s.connectors);
  const bom = useMemo(() => computeBom(generateConfig()), [standard, uHeight, fabMethod, wallThickness, flangeDepth, rearPanel, ventSlots, elements, mountHoleType]);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[680px]">
      <SectionLabel>PANEL</SectionLabel>
      <SpecTable rows={[
        ['Standard', `${standard}" (EIA-310-E)`],
        ['U-Height', `${uHeight}U`],
        ['Panel W', `${panDims.panelWidth.toFixed(2)}mm`],
        ['Panel H', `${panH.toFixed(2)}mm`],
        ['Total W', `${panDims.totalWidth.toFixed(1)}mm`],
        ['Depth', `${depth.toFixed(0)}mm (auto)`],
        ['Mount Hole', `${mountHoleType} (\u2300${BORE_HOLES[mountHoleType]?.diameter ?? '?'}mm)`],
      ]} />

      <div className="h-4" />
      <SectionLabel>ENCLOSURE</SectionLabel>
      <SpecTable rows={[
        ['Flange Depth', `${flangeDepth}mm`],
        ['Rear Panel', rearPanel ? 'Yes' : 'No (open back)'],
        ['Ventilation', ventSlots ? 'Slotted' : 'Solid'],
        ['Deepest Device', `${maxDeviceDepth || '\u2014'}mm`],
        ['Total Weight', `${totalWeight.toFixed(2)}kg`],
        ['Ear-mount Safe', totalWeight < 7 ? '\u2713 (<7kg)' : '\u26a0 Use slide rails'],
      ]} />

      <div className="h-4" />
      {fabMethod === 'sm' ? (
        <>
          <SectionLabel>SHEET METAL</SectionLabel>
          <SpecTable rows={[
            ['Material', metal.name],
            ['Thickness', `${metal.t}mm`],
            ['Bend Radius', `${metal.br.toFixed(2)}mm`],
            ['BA (90\u00b0)', `${ba90.toFixed(2)}mm`],
            ['Min Flange', `${(2.5 * metal.t + metal.br).toFixed(2)}mm`],
            ['Hole\u2192Edge', `\u2265${(2 * metal.t).toFixed(1)}mm+r`],
            ['Hole\u2192Bend', `\u2265${(2 * metal.t + metal.br).toFixed(1)}mm+r`],
          ]} />
        </>
      ) : (
        <>
          <SectionLabel>3D PRINT</SectionLabel>
          <SpecTable rows={[
            ['Printer', printer.name],
            ['Bed', printer.bed.join('\u00d7') + 'mm'],
            ['Filament', filament.name],
            ['Wall', `${wallThickness}mm`],
            ['Heat', filament.heat],
            ['Split', needsSplit ? splitInfo.type : 'None needed'],
          ]} />
        </>
      )}

      {elements.length > 0 && (
        <>
          <div className="h-4" />
          <SectionLabel>CUTOUT SCHEDULE ({elements.length})</SectionLabel>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs">
                  <th className="px-2.5 py-1 text-left font-semibold">#</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Type</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Cut</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Size</th>
                  <th className="px-2.5 py-1 text-left font-semibold">X</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Y</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Behind</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el, i) => {
                  const c = el.type === 'connector' ? lookupConnector(el.key) : null;
                  const d = el.type === 'device' ? lookupDevice(el.key) : null;
                  const f = el.type === 'fan' ? FANS[el.key] : null;
                  return (
                    <tr key={el.id} className="border-t border-border">
                      <td className="px-2.5 py-1 text-foreground/80">{i + 1}</td>
                      <td className="px-2.5 py-1 text-foreground/80">{el.label}{el.surface === 'rear' ? ' [R]' : ''}</td>
                      <td className="px-2.5 py-1 text-foreground/80">{f ? 'circle+4\u00d7bolt' : c?.cut || 'rect'}</td>
                      <td className="px-2.5 py-1 text-foreground/80">
                        {f ? `\u2300${f.cutoutDiameter}` : c?.cut === 'round' ? `\u2300${((c.r ?? 0) * 2).toFixed(1)}` : `${el.w}\u00d7${el.h}`}
                      </td>
                      <td className="px-2.5 py-1 text-foreground/80">{el.x.toFixed(1)}</td>
                      <td className="px-2.5 py-1 text-foreground/80">{el.y.toFixed(1)}</td>
                      <td className="px-2.5 py-1 text-foreground/80">{c?.depthBehind || d?.d || f?.depthBehind || '\u2014'}mm</td>
                      <td className="px-2.5 py-1">
                        {(() => {
                          const entry = el.type === 'device'
                            ? catalogDevices.find(dd => dd.slug === el.key)
                            : el.type === 'connector'
                            ? catalogConnectors.find(cc => cc.slug === el.key)
                            : null;
                          if (!entry) return <span className="text-muted-foreground">{'\u2014'}</span>;
                          const badge = confidenceBadge(entry.dataSource);
                          return (
                            <span className="px-1.5 py-0.5 rounded-lg text-xs" style={{ background: badge.color + '20', color: badge.color }}>
                              {badge.label}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {bom.length > 0 && (
        <>
          <div className="h-4" />
          <SectionLabel>HARDWARE BOM ({bom.reduce((s, b) => s + b.qty, 0)} pcs)</SectionLabel>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs">
                  <th className="px-2.5 py-1 text-left font-semibold">Qty</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Part</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Spec</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Note</th>
                </tr>
              </thead>
              <tbody>
                {bom.map((b, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2.5 py-1 text-primary font-bold">{b.qty}</td>
                    <td className="px-2.5 py-1 text-foreground/80">{b.part}</td>
                    <td className="px-2.5 py-1 text-foreground/80">{b.spec}</td>
                    <td className="px-2.5 py-1 text-muted-foreground">{b.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {ribs.length > 0 && (
        <>
          <div className="h-4" />
          <SectionLabel>REINFORCEMENT ({ribs.length})</SectionLabel>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs">
                  <th className="px-2.5 py-1 text-left font-semibold">#</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Type</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Size</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Depth</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {ribs.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2.5 py-1 text-foreground/80">{i + 1}</td>
                    <td className="px-2.5 py-1 text-[#8b5cf6]">{r.type}</td>
                    <td className="px-2.5 py-1 text-foreground/80">{r.w.toFixed(1)}{'\u00d7'}{r.h.toFixed(1)}</td>
                    <td className="px-2.5 py-1 text-foreground/80">{r.depth.toFixed(0)}mm</td>
                    <td className="px-2.5 py-1 text-muted-foreground">{r.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {marginWarnings.length > 0 && (
        <>
          <div className="h-4" />
          <SectionLabel>MARGIN WARNINGS ({marginWarnings.length})</SectionLabel>
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-secondary text-muted-foreground text-xs">
                  <th className="px-2.5 py-1 text-left font-semibold">Element</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Edge</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Gap</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Min</th>
                  <th className="px-2.5 py-1 text-left font-semibold">Severity</th>
                </tr>
              </thead>
              <tbody>
                {marginWarnings.map((w, i) => {
                  const el = elements.find(e => e.id === w.elementId);
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2.5 py-1 text-foreground/80">{el?.label ?? w.elementId.slice(0, 6)}</td>
                      <td className="px-2.5 py-1 text-foreground/80">{w.edge}{w.neighborId ? ` (${elements.find(e => e.id === w.neighborId)?.label ?? '?'})` : ''}</td>
                      <td className="px-2.5 py-1 text-foreground/80">{w.gap.toFixed(1)}mm</td>
                      <td className="px-2.5 py-1 text-foreground/80">{w.minGap.toFixed(1)}mm</td>
                      <td className="px-2.5 py-1" style={{ color: w.severity === 'error' ? '#ef4444' : '#fb923c' }}>{w.severity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Structural Analysis (modular mode) */}
      {assemblyMode === 'modular' && trayReinforcements.length > 0 && (
        <>
          <div className="h-4" />
          <SectionLabel>STRUCTURAL ANALYSIS</SectionLabel>

          {/* Weight budget */}
          <div className="bg-card rounded-lg border border-border p-3 mb-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Total device weight</span>
              <span className={totalWeight > 7 ? 'text-destructive font-bold' : 'text-foreground/80'}>{totalWeight.toFixed(2)}kg</span>
            </div>
            <div className="h-1.5 bg-input rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, (totalWeight / 7) * 100)}%`,
                  background: totalWeight > 7 ? '#ef4444' : totalWeight > 5 ? '#fb923c' : '#4ade80',
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {totalWeight > 7 ? '\u26d4 Exceeds 7kg ear-mount limit — use slide rails' : `${(7 - totalWeight).toFixed(1)}kg headroom (7kg ear-mount limit)`}
            </div>
          </div>

          {/* Per-tray analysis */}
          {trayReinforcements.map(tr => (
            <div key={tr.elementId} className="bg-card rounded-lg border border-border p-3 mb-2">
              <div className="text-xs text-foreground/80 font-semibold mb-1">Tray: {tr.label}</div>
              <SpecTable rows={[
                ['Floor ribs', `${tr.result.floorRibs.length}`],
                ['Gussets', `${tr.result.gussets.length > 0 ? `${tr.result.gussets.length} (h=${tr.result.gussets[0]?.height.toFixed(0)}mm)` : 'none'}`],
                ['Rear stoppers', `${tr.result.rearStoppers.length}`],
                ['Cross-ribs', `${tr.result.crossRibs.length}`],
                ['Suggested floor', `${tr.result.suggestedFloorT}mm`],
                ['Suggested wall', `${tr.result.suggestedWallT.toFixed(1)}mm`],
              ]} />
              {tr.result.warnings.length > 0 && (
                <div className="mt-1">
                  {tr.result.warnings.map((w, wi) => (
                    <div key={wi} className="text-xs px-1 py-0.5 flex items-start gap-1" style={{ color: w.severity === 'error' ? '#ef4444' : w.severity === 'warning' ? '#fb923c' : '#888' }}>
                      <span>{w.severity === 'error' ? '\u26d4' : w.severity === 'warning' ? '\u26a0' : '\u2139'}</span>
                      <span>{w.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
