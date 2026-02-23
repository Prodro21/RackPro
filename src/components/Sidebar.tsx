import { useState } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectMaxDeviceDepth, selectNeedsSplit, selectSplitInfo, selectUsedWidth, selectRemainingWidth, selectTotalWeight, selectSelectedElement, selectMetal, selectFilament, selectPrinter, selectMarginWarnings, selectAssemblyMode, selectMountHoleType, selectCostEstimate } from '../store';
import { useUIStore } from '../store/useUIStore';
import { DEFAULT_FILAMENT_PRICES } from '../lib/costEstimation';
import { useCustomDevices } from '../store/useCustomDevices';
import { useCatalogStore } from '../catalog/useCatalogStore';
import { CONNECTORS } from '../constants/connectors';
import { DEVICES } from '../constants/devices';
import { FANS } from '../constants/fans';
import { METALS, FILAMENTS } from '../constants/materials';
import { PRINTERS } from '../constants/printers';
import { BORE_HOLES } from '../constants/eia310';
import type { FabMethod, RackStandard, PlacementSurface, AssemblyMode, EnclosureStyle, MountHoleType, ElementLabel } from '../types';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { CustomDeviceModal } from './CustomDeviceModal';
import { cn } from '@/lib/utils';

function confidenceBadge(level: string): { label: string; color: string } {
  switch (level) {
    case 'manufacturer-datasheet': return { label: 'Datasheet', color: '#4ade80' };
    case 'user-calipered': return { label: 'Calipered', color: '#60a5fa' };
    case 'cross-referenced': return { label: 'Cross-ref', color: '#f7b600' };
    case 'estimated': return { label: 'Estimated', color: '#fb923c' };
    default: return { label: level, color: '#888' };
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold tracking-[0.08em] uppercase text-text-tertiary mb-2.5 px-0.5">
      {children}
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between py-1 border-b border-border-subtle text-xs">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary/80 font-mono">{value}</span>
    </div>
  );
}

function PaletteItem({ onClick, icon, iconColor, name, desc, meta }: {
  onClick: () => void; icon: string; iconColor: string; name: string; desc: string; meta?: string;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 h-auto rounded-md text-left text-text-primary text-xs justify-start"
    >
      <span className="text-base w-5 text-center" style={{ color: iconColor }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{name}</div>
        <div className="text-[11px] text-text-secondary whitespace-nowrap overflow-hidden text-ellipsis">{desc}</div>
      </div>
      {meta && <div className="text-[11px] text-text-tertiary whitespace-nowrap font-mono">{meta}</div>}
    </Button>
  );
}

function CompactSelect({ label, value, onValueChange, options, full }: {
  label: string; value: string; onValueChange: (v: string) => void; options: [string | number, string][]; full?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? 'flex-1 w-full' : ''}`}>
      <Label className="text-[11px] text-text-secondary tracking-wide font-normal">{label}</Label>
      <Select value={String(value)} onValueChange={onValueChange}>
        <SelectTrigger className="h-[30px] text-xs bg-bg-input border-border-default rounded-md px-[10px] py-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={String(v)} className="text-xs">{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CompactSlider({ label, value, onChange, min, max, step, unit }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; unit: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs mt-1.5">
      <span className="text-text-secondary min-w-[44px] whitespace-nowrap">{label}</span>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="flex-1"
      />
      <span className="text-text-primary font-mono font-medium min-w-[30px] text-right">{value}{unit}</span>
    </div>
  );
}

function CompactCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v: boolean | 'indeterminate') => onChange(v === true)} className="size-3.5" />
      {label}
    </label>
  );
}

function SegmentControl({ options, value, onChange }: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-px bg-seg-bg p-[3px] rounded-lg border border-seg-border w-full">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 h-7 flex items-center justify-center text-xs font-medium rounded-md transition-all border border-transparent cursor-pointer",
            value === opt.value
              ? "bg-seg-active border-border-default text-text-primary shadow-sm"
              : "text-text-tertiary hover:text-text-secondary"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function Sidebar() {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [editCustomKey, setEditCustomKey] = useState<string | undefined>();
  const openCatalogModal = useUIStore(s => s.openCatalogModal);
  const openWizardModal = useUIStore(s => s.openWizardModal);
  const customDevices = useCustomDevices(s => s.customDevices);
  const removeCustomDevice = useCustomDevices(s => s.removeCustomDevice);
  const standard = useConfigStore(s => s.standard);
  const uHeight = useConfigStore(s => s.uHeight);
  const fabMethod = useConfigStore(s => s.fabMethod);
  const metalKey = useConfigStore(s => s.metalKey);
  const filamentKey = useConfigStore(s => s.filamentKey);
  const printerKey = useConfigStore(s => s.printerKey);
  const wallThickness = useConfigStore(s => s.wallThickness);
  const flangeDepth = useConfigStore(s => s.flangeDepth);
  const rearPanel = useConfigStore(s => s.rearPanel);
  const ventSlots = useConfigStore(s => s.ventSlots);
  const elements = useConfigStore(s => s.elements);
  const selectedId = useConfigStore(s => s.selectedId);
  const addMode = useConfigStore(s => s.addMode);

  const setStandard = useConfigStore(s => s.setStandard);
  const setUHeight = useConfigStore(s => s.setUHeight);
  const setFabMethod = useConfigStore(s => s.setFabMethod);
  const setMetalKey = useConfigStore(s => s.setMetalKey);
  const setFilamentKey = useConfigStore(s => s.setFilamentKey);
  const setPrinterKey = useConfigStore(s => s.setPrinterKey);
  const setWallThickness = useConfigStore(s => s.setWallThickness);
  const setFlangeDepth = useConfigStore(s => s.setFlangeDepth);
  const setRearPanel = useConfigStore(s => s.setRearPanel);
  const setVentSlots = useConfigStore(s => s.setVentSlots);
  const gridEnabled = useConfigStore(s => s.gridEnabled);
  const gridSize = useConfigStore(s => s.gridSize);
  const snapToEdges = useConfigStore(s => s.snapToEdges);
  const setGridEnabled = useConfigStore(s => s.setGridEnabled);
  const setGridSize = useConfigStore(s => s.setGridSize);
  const setSnapToEdges = useConfigStore(s => s.setSnapToEdges);
  const autoReinforcement = useConfigStore(s => s.autoReinforcement);
  const setAutoReinforcement = useConfigStore(s => s.setAutoReinforcement);
  const assemblyMode = useConfigStore(selectAssemblyMode);
  const faceFabMethod = useConfigStore(s => s.faceFabMethod);
  const trayFabMethod = useConfigStore(s => s.trayFabMethod);
  const setAssemblyMode = useConfigStore(s => s.setAssemblyMode);
  const setFaceFabMethod = useConfigStore(s => s.setFaceFabMethod);
  const setTrayFabMethod = useConfigStore(s => s.setTrayFabMethod);
  const enclosureStyle = useConfigStore(s => s.enclosureStyle);
  const setEnclosureStyle = useConfigStore(s => s.setEnclosureStyle);
  const chamfers = useConfigStore(s => s.chamfers);
  const setChamfers = useConfigStore(s => s.setChamfers);
  const mountHoleType = useConfigStore(selectMountHoleType);
  const setMountHoleType = useConfigStore(s => s.setMountHoleType);
  const flanges = useConfigStore(s => s.flanges);
  const setFlanges = useConfigStore(s => s.setFlanges);
  const setElementSurface = useConfigStore(s => s.setElementSurface);
  const setElementLabel = useConfigStore(s => s.setElementLabel);
  const setAddMode = useConfigStore(s => s.setAddMode);
  const addElement = useConfigStore(s => s.addElement);
  const removeElement = useConfigStore(s => s.removeElement);
  const duplicateElement = useConfigStore(s => s.duplicateElement);
  const selectElement = useConfigStore(s => s.selectElement);
  const marginWarnings = useConfigStore(selectMarginWarnings);

  const panDims = useConfigStore(selectPanelDims);
  const needsSplit = useConfigStore(selectNeedsSplit);
  const splitInfo = useConfigStore(selectSplitInfo);
  const enclosureDepth = useConfigStore(selectEnclosureDepth);
  const maxDeviceDepth = useConfigStore(selectMaxDeviceDepth);
  const usedWidth = useConfigStore(selectUsedWidth);
  const remainingWidth = useConfigStore(selectRemainingWidth);
  const totalWeight = useConfigStore(selectTotalWeight);
  const selEl = useConfigStore(selectSelectedElement);
  const metal = useConfigStore(selectMetal);
  const filament = useConfigStore(selectFilament);
  const printer = useConfigStore(selectPrinter);
  const costEstimate = useConfigStore(selectCostEstimate);
  const filamentPriceOverrides = useConfigStore(s => s.filamentPriceOverrides);
  const setFilamentPriceOverride = useConfigStore(s => s.setFilamentPriceOverride);
  const setActiveTab = useConfigStore(s => s.setActiveTab);

  const catalogDevices = useCatalogStore(s => s.devices);
  const catalogConnectors = useCatalogStore(s => s.connectors);

  const budgetPct = Math.min(100, (usedWidth / panDims.panelWidth) * 100);
  const budgetColor = remainingWidth < 0 ? '#ef4444' : remainingWidth < 30 ? 'oklch(0.637 0.259 29.23)' : '#4ade80';

  return (
    <div className="w-[296px] shrink-0 bg-bg-sidebar border-r border-border-subtle flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-5" style={{ paddingLeft: 10, paddingRight: 10 }}>

        {/* Panel config */}
        <div>
          <SectionLabel>Panel Standard</SectionLabel>
          <div className="flex gap-2">
            <CompactSelect
              label="Std"
              value={standard}
              onValueChange={v => setStandard(v as RackStandard)}
              options={[['19', '19"'], ['10', '10"']]}
              full
            />
            <CompactSelect
              label="U"
              value={String(uHeight)}
              onValueChange={v => setUHeight(+v)}
              options={[[1, '1U'], [2, '2U'], [3, '3U'], [4, '4U']]}
              full
            />
          </div>
        </div>

        {/* Fabrication */}
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><SectionLabel>Fabrication</SectionLabel></div>
            </TooltipTrigger>
            <TooltipContent side="right">3D Print (FDM) or Sheet Metal (laser cut + bend)</TooltipContent>
          </Tooltip>
          <SegmentControl
            options={[
              { label: '3D Print', value: '3dp' },
              { label: 'Sheet Metal', value: 'sm' },
            ]}
            value={fabMethod}
            onChange={v => setFabMethod(v as FabMethod)}
          />

          {fabMethod === '3dp' ? (
            <div className="mt-2 space-y-1.5">
              <CompactSelect
                label="Printer" value={printerKey}
                onValueChange={setPrinterKey}
                options={Object.entries(PRINTERS).map(([k, v]) => [k, v.name])} full
              />
              <CompactSelect
                label="Filament" value={filamentKey}
                onValueChange={setFilamentKey}
                options={Object.entries(FILAMENTS).map(([k, v]) => [k, `${v.name} (${v.heat})`])} full
              />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-secondary min-w-[44px]">$/kg</span>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  step={1}
                  value={filamentPriceOverrides[filamentKey] ?? DEFAULT_FILAMENT_PRICES[filamentKey] ?? 22}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) setFilamentPriceOverride(filamentKey, v);
                  }}
                  className="h-[30px] w-14 text-xs font-mono bg-bg-input border-border-default px-2 py-1"
                />
                <span className="text-text-tertiary text-[11px]">per kg</span>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <CompactSlider label="Wall" value={wallThickness} onChange={setWallThickness} min={2} max={6} step={0.5} unit="mm" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Min wall thickness. 2mm connectors only, 3-4mm for devices.</TooltipContent>
              </Tooltip>
              {needsSplit && (
                <div className="px-3 py-2 bg-accent-subtle border border-accent/20 rounded-md text-xs text-accent-text font-medium">
                  &#9888; {splitInfo.type}: {splitInfo.desc}
                </div>
              )}
              <div className="text-xs text-text-tertiary font-mono">Bed: {printer.bed.join('\u00d7')}mm</div>
            </div>
          ) : (
            <div className="mt-2">
              <CompactSelect
                label="Material" value={metalKey}
                onValueChange={setMetalKey}
                options={Object.entries(METALS).map(([k, v]) => [k, v.name])} full
              />
            </div>
          )}
        </div>

        {/* Assembly */}
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><SectionLabel>Assembly</SectionLabel></div>
            </TooltipTrigger>
            <TooltipContent side="right">Monolithic = single body. Modular = separate faceplate + device trays.</TooltipContent>
          </Tooltip>
          <SegmentControl
            options={[
              { label: 'Monolithic', value: 'monolithic' },
              { label: 'Modular', value: 'modular' },
            ]}
            value={assemblyMode}
            onChange={v => setAssemblyMode(v as AssemblyMode)}
          />
          {assemblyMode === 'modular' && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-2 items-center">
                <span className="text-[11px] text-text-secondary w-14">Faceplate</span>
                <SegmentControl
                  options={[{ label: '3DP', value: '3dp' }, { label: 'SM', value: 'sm' }]}
                  value={faceFabMethod}
                  onChange={v => setFaceFabMethod(v as FabMethod)}
                />
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-[11px] text-text-secondary w-14">Trays</span>
                <SegmentControl
                  options={[{ label: '3DP', value: '3dp' }, { label: 'SM', value: 'sm' }]}
                  value={trayFabMethod}
                  onChange={v => setTrayFabMethod(v as FabMethod)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Enclosure */}
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div><SectionLabel>Enclosure</SectionLabel></div>
            </TooltipTrigger>
            <TooltipContent side="right">Tray = open sides. Box = fully enclosed with top/bottom walls.</TooltipContent>
          </Tooltip>
          <SegmentControl
            options={[
              { label: 'Tray', value: 'tray' },
              { label: 'Box', value: 'box' },
            ]}
            value={enclosureStyle}
            onChange={v => setEnclosureStyle(v as EnclosureStyle)}
          />
          <div className="mt-2 space-y-1.5">
            <CompactSelect
              label="Mount Hole" value={mountHoleType}
              onValueChange={v => setMountHoleType(v as MountHoleType)}
              options={Object.entries(BORE_HOLES).map(([k, v]) => [k, v.name])} full
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CompactSlider label="Flange" value={flangeDepth} onChange={setFlangeDepth} min={10} max={40} step={1} unit="mm" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">Retention lip depth behind faceplate. Holds devices in place.</TooltipContent>
            </Tooltip>
            <div className="flex gap-3">
              <CompactCheckbox label="Flanges" checked={flanges} onChange={setFlanges} />
              <CompactCheckbox label="Chamfers" checked={chamfers} onChange={setChamfers} />
            </div>
            <div className="flex gap-3">
              <CompactCheckbox label="Rear Panel" checked={rearPanel} onChange={setRearPanel} />
              <CompactCheckbox label="Vent Slots" checked={ventSlots} onChange={setVentSlots} />
            </div>
            <div className="text-xs text-text-secondary">
              Auto depth: <b className="text-text-primary/70 font-mono">{enclosureDepth.toFixed(0)}mm</b> (deepest: {maxDeviceDepth || '\u2014'}mm)
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <CompactCheckbox label="Auto Ribs" checked={autoReinforcement} onChange={setAutoReinforcement} />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">Auto-add reinforcement ribs near thin margins</TooltipContent>
              </Tooltip>
              {marginWarnings.length > 0 && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-accent-subtle text-accent-text font-medium">
                  {marginWarnings.length} margin{marginWarnings.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Width budget */}
        <div>
          <div className="flex justify-between text-xs text-text-secondary mb-1">
            <span className="font-medium">Width</span>
            <span className="font-mono" style={{ color: budgetColor }}>{remainingWidth.toFixed(0)}mm free</span>
          </div>
          <div className="h-1 bg-bg-input rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${budgetPct}%`, background: budgetColor }}
            />
          </div>
        </div>

        {/* Cost Summary Card */}
        {costEstimate && (
          <div className="bg-bg-card border border-border-subtle rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-tertiary tracking-[0.08em] uppercase font-semibold">
                {fabMethod === '3dp' ? 'EST. FDM' : 'EST. SHEET METAL'}
              </span>
              <button
                onClick={() => setActiveTab('export')}
                className="text-[11px] text-accent-text hover:underline cursor-pointer bg-transparent border-none p-0"
              >
                Details in Export
              </button>
            </div>
            <div className="text-lg font-semibold text-text-primary mt-0.5 tracking-tight">
              ~${costEstimate.low.toFixed(0)}&ndash;${costEstimate.high.toFixed(0)}
            </div>
            <div className="text-[11px] text-text-tertiary mt-0.5">
              {costEstimate.assumptions.find(a => a.label === 'Material')?.value ?? ''}
            </div>
          </div>
        )}

        {/* Grid / Snap */}
        <div>
          <SectionLabel>Grid / Snap</SectionLabel>
          <div className="flex gap-3">
            <CompactCheckbox label="Grid (G)" checked={gridEnabled} onChange={setGridEnabled} />
            <CompactCheckbox label="Snap" checked={snapToEdges} onChange={setSnapToEdges} />
          </div>
          {gridEnabled && (
            <div className="mt-1.5">
              <CompactSelect
                label="Grid Size" value={String(gridSize)}
                onValueChange={v => setGridSize(+v)}
                options={[['1', '1mm'], ['2.5', '2.5mm'], ['5', '5mm'], ['7.5', '7.5mm'], ['15', '15mm']]} full
              />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border-subtle" />

        {/* Add Elements */}
        <div>
          <SectionLabel>Add Elements</SectionLabel>
          <div className="flex gap-1.5">
            <button
              onClick={() => setAddMode(addMode === 'con' ? null : 'con')}
              className={cn(
                "flex-1 h-[30px] flex items-center justify-center gap-1 text-xs font-medium rounded-md border transition-all cursor-pointer",
                addMode === 'con'
                  ? "bg-seg-active border-border-default text-text-primary"
                  : "bg-bg-input border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong"
              )}
            >+ Connector</button>
            <button
              onClick={() => setAddMode(addMode === 'dev' ? null : 'dev')}
              className={cn(
                "flex-1 h-[30px] flex items-center justify-center gap-1 text-xs font-medium rounded-md border transition-all cursor-pointer",
                addMode === 'dev'
                  ? "bg-seg-active border-border-default text-text-primary"
                  : "bg-bg-input border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong"
              )}
            >+ Device</button>
            <button
              onClick={() => setAddMode(addMode === 'fan' ? null : 'fan')}
              className={cn(
                "flex-1 h-[30px] flex items-center justify-center gap-1 text-xs font-medium rounded-md border transition-all cursor-pointer",
                addMode === 'fan'
                  ? "bg-seg-active border-border-default text-text-primary"
                  : "bg-bg-input border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong"
              )}
            >+ Fan</button>
          </div>

          {addMode === 'con' && (
            <div className="bg-bg-elevated rounded-lg border border-border-default p-2 mt-2 max-h-56 overflow-y-auto">
              {Object.entries(CONNECTORS).map(([k, c]) => (
                <PaletteItem
                  key={k}
                  onClick={() => addElement('connector', k)}
                  icon={c.icon}
                  iconColor={c.color}
                  name={c.name}
                  desc={c.desc}
                  meta={`${c.w}\u00d7${c.h}`}
                />
              ))}
            </div>
          )}

          {addMode === 'dev' && (
            <div className="bg-bg-elevated rounded-lg border border-border-default p-2 mt-2 max-h-72 overflow-y-auto">
              {Object.entries(DEVICES).map(([k, d]) => (
                <PaletteItem
                  key={k}
                  onClick={() => addElement('device', k)}
                  icon={'\u25aa'}
                  iconColor={d.color}
                  name={d.name}
                  desc={`${d.w}\u00d7${d.d}\u00d7${d.h}mm`}
                  meta={d.poe !== '\u2013' ? d.poe : ''}
                />
              ))}
              {Object.keys(customDevices).length > 0 && (
                <>
                  <div className="h-px bg-border-subtle my-1.5" />
                  <div className="text-[10px] text-text-tertiary tracking-[0.08em] uppercase px-2 mb-1 font-semibold">CUSTOM</div>
                  {Object.entries(customDevices).map(([k, d]) => (
                    <div key={k} className="flex items-center gap-1">
                      <div className="flex-1">
                        <PaletteItem
                          onClick={() => addElement('device', k)}
                          icon={'\u25aa'}
                          iconColor={d.color}
                          name={d.name}
                          desc={`${d.w}\u00d7${d.d}\u00d7${d.h}mm`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditCustomKey(k); setShowCustomModal(true); }}
                        className="h-6 w-6 text-text-tertiary text-xs"
                      >&#9998;</Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomDevice(k)}
                        className="h-6 w-6 text-danger text-xs"
                      >&#10005;</Button>
                    </div>
                  ))}
                </>
              )}
              <Button
                variant="outline"
                onClick={() => { setEditCustomKey(undefined); setShowCustomModal(true); }}
                className="w-full mt-1.5 py-1.5 h-auto text-xs font-semibold border-dashed"
              >
                + New Custom Device
              </Button>
            </div>
          )}

          {addMode === 'fan' && (
            <div className="bg-bg-elevated rounded-lg border border-border-default p-2 mt-2 max-h-56 overflow-y-auto">
              {Object.entries(FANS).map(([k, f]) => (
                <PaletteItem
                  key={k}
                  onClick={() => addElement('fan', k)}
                  icon={'\u25cb'}
                  iconColor={f.color}
                  name={f.name}
                  desc={`${f.size}\u00d7${f.size}mm, ${f.cfm ?? '?'}CFM`}
                  meta={`${f.depthBehind}mm`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-border-subtle" />

        {/* Placed elements */}
        <div>
          <SectionLabel>Placed ({elements.length})</SectionLabel>
          {elements.length === 0 && (
            <div className="border border-dashed border-border-default rounded-lg p-4 flex items-center justify-center text-text-tertiary text-xs">
              No elements placed
            </div>
          )}
          {elements.map(el => {
            const lib = el.type === 'connector' ? CONNECTORS[el.key] : el.type === 'fan' ? FANS[el.key] : (DEVICES[el.key] ?? customDevices[el.key]);
            const icon = el.type === 'fan' ? '\u25cb' : el.type === 'connector' && lib && 'icon' in lib ? (lib as typeof CONNECTORS[string]).icon : '\u25aa';
            const surfaceTag = el.surface === 'rear' ? ' [R]' : '';
            return (
              <div
                key={el.id}
                onClick={() => selectElement(el.id)}
                className={cn(
                  "flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer mb-0.5 border text-xs transition-colors",
                  selectedId === el.id
                    ? "bg-accent-subtle border-accent/30 text-text-primary"
                    : "border-transparent hover:bg-bg-hover text-text-secondary"
                )}
              >
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-sm" style={{ color: lib?.color || '#888' }}>{icon}</span>
                  <span className="whitespace-nowrap overflow-hidden text-ellipsis">{el.label}{surfaceTag}</span>
                </div>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicateElement(el.id)}
                    className="h-6 w-6 text-text-tertiary text-xs"
                  >&#10697;</Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => { e.stopPropagation(); removeElement(el.id); }}
                    className="h-6 w-6 text-danger text-xs"
                  >&#10005;</Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected element properties */}
        {selEl && (
          <>
            <div className="h-px bg-border-subtle" />
            <div>
              <SectionLabel>Properties</SectionLabel>
              <PropertyRow label="X" value={`${selEl.x.toFixed(1)}mm`} />
              <PropertyRow label="Y" value={`${selEl.y.toFixed(1)}mm`} />
              <PropertyRow label="W" value={`${selEl.w}mm`} />
              <PropertyRow label="H" value={`${selEl.h}mm`} />
              {selEl.type === 'connector' && (
                <>
                  <PropertyRow label="Cutout" value={CONNECTORS[selEl.key]?.cut} />
                  <PropertyRow label="Behind" value={`${CONNECTORS[selEl.key]?.depthBehind}mm`} />
                </>
              )}
              {selEl.type === 'device' && (
                <>
                  <PropertyRow label="Depth" value={`${DEVICES[selEl.key]?.d}mm`} />
                  <PropertyRow label="Weight" value={`${DEVICES[selEl.key]?.wt}kg`} />
                </>
              )}
              {selEl.type === 'fan' && (
                <>
                  <PropertyRow label="Size" value={`${FANS[selEl.key]?.size}mm`} />
                  <PropertyRow label="CFM" value={`${FANS[selEl.key]?.cfm ?? '?'}`} />
                  <PropertyRow label="Depth" value={`${FANS[selEl.key]?.depthBehind}mm`} />
                </>
              )}
              {(selEl.type === 'fan') && (
                <CompactSelect
                  label="Surface"
                  value={selEl.surface ?? 'faceplate'}
                  onValueChange={v => setElementSurface(selEl.id, v as PlacementSurface)}
                  options={[['faceplate', 'Faceplate'], ['rear', 'Rear'], ['side-top', 'Side Top'], ['side-bottom', 'Side Bottom']]}
                  full
                />
              )}
              {(() => {
                const entry = selEl.type === 'device'
                  ? catalogDevices.find(d => d.slug === selEl.key)
                  : selEl.type === 'connector'
                  ? catalogConnectors.find(c => c.slug === selEl.key)
                  : null;
                if (!entry) return null;
                const badge = confidenceBadge(entry.dataSource);
                return (
                  <div className="flex items-center justify-between px-2 py-1 text-xs">
                    <span className="text-text-secondary">Source</span>
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ background: badge.color + '20', color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                );
              })()}

              {/* Label Editor */}
              <div className="h-px bg-border-subtle my-3" />
              <SectionLabel>Label</SectionLabel>
              {(() => {
                const lc = selEl.labelConfig;
                const labelText = lc?.text ?? '';
                const labelPos = lc?.position ?? 'below';
                const autoNum = lc?.autoNumber ?? false;
                const labelIcon = lc?.icon;

                const updateLabel = (patch: Partial<ElementLabel>) => {
                  const current: ElementLabel = {
                    text: labelText,
                    position: labelPos,
                    autoNumber: autoNum,
                    icon: labelIcon,
                    ...patch,
                  };
                  if (!current.text && !current.icon) {
                    setElementLabel(selEl.id, undefined);
                  } else {
                    setElementLabel(selEl.id, current);
                  }
                };

                return (
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={labelText}
                      onChange={e => updateLabel({ text: e.target.value })}
                      placeholder="Label text..."
                      className="h-[30px] text-xs bg-bg-input"
                    />
                    <div className="flex gap-1 items-center text-xs text-text-secondary">
                      <span className="w-8">Pos</span>
                      {(['above', 'below', 'inside'] as const).map(pos => (
                        <Button
                          key={pos}
                          variant={labelPos === pos ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateLabel({ position: pos })}
                          className="h-7 px-2 text-xs"
                        >
                          {pos}
                        </Button>
                      ))}
                    </div>
                    {selEl.type === 'connector' && (
                      <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                        <Checkbox
                          checked={autoNum}
                          onCheckedChange={(v: boolean | 'indeterminate') => updateLabel({ autoNumber: v === true })}
                          className="size-3.5"
                        />
                        Auto-number
                      </label>
                    )}
                    <div className="flex gap-1 items-center text-xs text-text-secondary">
                      <span className="w-8">Icon</span>
                      {([undefined, 'network', 'video', 'audio', 'power'] as const).map(ic => (
                        <Button
                          key={ic ?? 'none'}
                          variant={labelIcon === ic ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => updateLabel({ icon: ic })}
                          className="h-7 px-2 text-xs"
                        >
                          {ic ?? '--'}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* Load summary */}
        {totalWeight > 0 && (
          <>
            <div className="h-px bg-border-subtle" />
            <div>
              <SectionLabel>Load</SectionLabel>
              <PropertyRow label="Total" value={`${totalWeight.toFixed(2)}kg`} />
              <PropertyRow label="Ear-only" value={totalWeight < 7 ? '\u2713' : '\u26a0 Rails'} />
            </div>
          </>
        )}
      </div>

      {/* Modal trigger buttons */}
      <div className="h-px bg-border-subtle" />
      <div className="space-y-1.5 py-3 shrink-0" style={{ paddingLeft: 10, paddingRight: 10 }}>
        <button
          onClick={openCatalogModal}
          className="w-full h-9 text-xs font-medium rounded-md border border-border-default hover:bg-bg-elevated hover:border-border-strong transition-colors"
        >
          Browse Catalog...
        </button>
        <button
          onClick={openWizardModal}
          className="w-full h-9 text-xs font-medium rounded-md border border-dashed border-border-default hover:bg-bg-elevated hover:border-border-strong transition-colors"
        >
          Quick Setup Wizard
        </button>
      </div>

      <CustomDeviceModal
        open={showCustomModal}
        onClose={() => { setShowCustomModal(false); setEditCustomKey(undefined); }}
        editKey={editCustomKey}
        editDef={editCustomKey ? customDevices[editCustomKey] : undefined}
      />
    </div>
  );
}
