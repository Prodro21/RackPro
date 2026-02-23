import { useState } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectMaxDeviceDepth, selectNeedsSplit, selectSplitInfo, selectUsedWidth, selectRemainingWidth, selectTotalWeight, selectSelectedElement, selectMetal, selectFilament, selectPrinter, selectMarginWarnings, selectAssemblyMode, selectMountHoleType, selectCostEstimate } from '../store';
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
import { Toggle } from './ui/toggle';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { CustomDeviceModal } from './CustomDeviceModal';

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
    <div className="text-xs font-semibold text-muted-foreground tracking-wide uppercase mb-1.5 mt-3 first:mt-0">
      {children}
    </div>
  );
}

function PropertyRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between py-1 border-b border-border/50 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/80 font-mono">{value}</span>
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
      className="flex items-center gap-2 w-full px-2 py-1.5 h-auto rounded-md text-left text-foreground text-xs justify-start"
    >
      <span className="text-base w-5 text-center" style={{ color: iconColor }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{name}</div>
        <div className="text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">{desc}</div>
      </div>
      {meta && <div className="text-[11px] text-muted-foreground/50 whitespace-nowrap font-mono">{meta}</div>}
    </Button>
  );
}

function CompactSelect({ label, value, onValueChange, options, full }: {
  label: string; value: string; onValueChange: (v: string) => void; options: [string | number, string][]; full?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${full ? 'flex-1 w-full' : ''}`}>
      <Label className="text-[11px] text-muted-foreground tracking-wide font-normal">{label}</Label>
      <Select value={String(value)} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 text-xs bg-background border-border px-2 py-1">
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
    <div className="flex items-center gap-2 text-xs mt-1.5">
      <span className="text-muted-foreground min-w-[60px]">{label}</span>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="flex-1"
      />
      <span className="text-muted-foreground/70 min-w-[30px] text-right font-mono">{value}{unit}</span>
    </div>
  );
}

function CompactCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v: boolean | 'indeterminate') => onChange(v === true)} className="size-3.5" />
      {label}
    </label>
  );
}

function FabToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <Toggle
      pressed={active}
      onPressedChange={() => onClick()}
      variant="outline"
      size="sm"
      className="flex-1 text-xs font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
    >
      {label}
    </Toggle>
  );
}

export function Sidebar() {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [editCustomKey, setEditCustomKey] = useState<string | undefined>();
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
    <div className="w-72 shrink-0 bg-card border-r border-border overflow-y-auto overflow-x-hidden p-4 text-sm">
      {/* Panel config */}
      <SectionLabel>Panel</SectionLabel>
      <div className="flex gap-2 mb-2">
        <CompactSelect
          label="Std"
          value={standard}
          onValueChange={v => setStandard(v as RackStandard)}
          options={[['19', '19"'], ['10', '10"']]}
        />
        <CompactSelect
          label="U"
          value={String(uHeight)}
          onValueChange={v => setUHeight(+v)}
          options={[[1, '1U'], [2, '2U'], [3, '3U'], [4, '4U']]}
        />
      </div>

      {/* Fabrication */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <SectionLabel>Fabrication</SectionLabel>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">3D Print (FDM) or Sheet Metal (laser cut + bend)</TooltipContent>
      </Tooltip>
      <div className="flex gap-2 mb-2">
        <FabToggle label="3D Print" active={fabMethod === '3dp'} onClick={() => setFabMethod('3dp')} />
        <FabToggle label="Sheet Metal" active={fabMethod === 'sm'} onClick={() => setFabMethod('sm')} />
      </div>

      {fabMethod === '3dp' ? (
        <div className="mt-1.5">
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
          <div className="flex items-center gap-2 text-xs mt-1.5">
            <span className="text-muted-foreground min-w-[60px]">$/kg</span>
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
              className="h-8 w-16 text-xs font-mono bg-background border-border px-2 py-1"
            />
            <span className="text-muted-foreground/50 text-[11px]">per kg</span>
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
            <div className="mt-1.5 px-3 py-2 bg-accent border border-primary/20 rounded-md text-xs text-primary font-medium">
              &#9888; {splitInfo.type}: {splitInfo.desc}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1.5 font-mono">Bed: {printer.bed.join('\u00d7')}mm</div>
        </div>
      ) : (
        <div className="mt-1.5">
          <CompactSelect
            label="Material" value={metalKey}
            onValueChange={setMetalKey}
            options={Object.entries(METALS).map(([k, v]) => [k, v.name])} full
          />
        </div>
      )}

      {/* Assembly */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <SectionLabel>Assembly</SectionLabel>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Monolithic = single body. Modular = separate faceplate + device trays.</TooltipContent>
      </Tooltip>
      <div className="flex gap-2 mb-2">
        <FabToggle label="Monolithic" active={assemblyMode === 'monolithic'} onClick={() => setAssemblyMode('monolithic')} />
        <FabToggle label="Modular" active={assemblyMode === 'modular'} onClick={() => setAssemblyMode('modular')} />
      </div>
      {assemblyMode === 'modular' && (
        <div className="mt-1.5">
          <div className="flex gap-2 mb-1 items-center">
            <span className="text-[11px] text-muted-foreground w-14">Faceplate</span>
            <FabToggle label="3DP" active={faceFabMethod === '3dp'} onClick={() => setFaceFabMethod('3dp')} />
            <FabToggle label="SM" active={faceFabMethod === 'sm'} onClick={() => setFaceFabMethod('sm')} />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-[11px] text-muted-foreground w-14">Trays</span>
            <FabToggle label="3DP" active={trayFabMethod === '3dp'} onClick={() => setTrayFabMethod('3dp')} />
            <FabToggle label="SM" active={trayFabMethod === 'sm'} onClick={() => setTrayFabMethod('sm')} />
          </div>
        </div>
      )}

      {/* Enclosure */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <SectionLabel>Enclosure</SectionLabel>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Tray = open sides. Box = fully enclosed with top/bottom walls.</TooltipContent>
      </Tooltip>
      <div className="flex gap-2 mb-2">
        <FabToggle label="Tray" active={enclosureStyle === 'tray'} onClick={() => setEnclosureStyle('tray')} />
        <FabToggle label="Box" active={enclosureStyle === 'box'} onClick={() => setEnclosureStyle('box')} />
      </div>
      <CompactSelect
        label="Mount Hole" value={mountHoleType}
        onValueChange={v => setMountHoleType(v as MountHoleType)}
        options={Object.entries(BORE_HOLES).map(([k, v]) => [k, v.name])} full
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <CompactSlider label="Flange Depth" value={flangeDepth} onChange={setFlangeDepth} min={10} max={40} step={1} unit="mm" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">Retention lip depth behind faceplate. Holds devices in place.</TooltipContent>
      </Tooltip>
      <div className="flex gap-3 mt-1.5">
        <CompactCheckbox label="Flanges" checked={flanges} onChange={setFlanges} />
        <CompactCheckbox label="Chamfers" checked={chamfers} onChange={setChamfers} />
      </div>
      <div className="flex gap-3 mt-1.5">
        <CompactCheckbox label="Rear Panel" checked={rearPanel} onChange={setRearPanel} />
        <CompactCheckbox label="Vent Slots" checked={ventSlots} onChange={setVentSlots} />
      </div>
      <div className="text-xs text-muted-foreground mt-1.5">
        Auto depth: <b className="text-foreground/70 font-mono">{enclosureDepth.toFixed(0)}mm</b> (deepest: {maxDeviceDepth || '\u2014'}mm)
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <CompactCheckbox label="Auto Ribs" checked={autoReinforcement} onChange={setAutoReinforcement} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Auto-add reinforcement ribs near thin margins</TooltipContent>
        </Tooltip>
        {marginWarnings.length > 0 && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-accent text-primary font-medium">
            {marginWarnings.length} margin{marginWarnings.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Width budget */}
      <div className="my-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span className="font-medium">Width</span>
          <span className="font-mono" style={{ color: budgetColor }}>{remainingWidth.toFixed(0)}mm free</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${budgetPct}%`, background: budgetColor }}
          />
        </div>
      </div>

      {/* Cost Summary Card */}
      {costEstimate && (
        <div className="bg-muted border border-border rounded-lg p-3 my-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground tracking-wide font-medium">
              {fabMethod === '3dp' ? 'EST. FDM' : 'EST. SHEET METAL'}
            </span>
            <button
              onClick={() => setActiveTab('export')}
              className="text-[11px] text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              Details in Export
            </button>
          </div>
          <div className="text-base font-bold text-foreground mt-0.5">
            ~${costEstimate.low.toFixed(0)}&ndash;${costEstimate.high.toFixed(0)}
          </div>
          <div className="text-xs text-muted-foreground">
            {costEstimate.assumptions.find(a => a.label === 'Material')?.value ?? ''}
          </div>
        </div>
      )}

      {/* Grid / Snap */}
      <SectionLabel>Grid / Snap</SectionLabel>
      <div className="flex gap-3 mt-1">
        <CompactCheckbox label="Grid (G)" checked={gridEnabled} onChange={setGridEnabled} />
        <CompactCheckbox label="Snap" checked={snapToEdges} onChange={setSnapToEdges} />
      </div>
      {gridEnabled && (
        <CompactSelect
          label="Grid Size" value={String(gridSize)}
          onValueChange={v => setGridSize(+v)}
          options={[['1', '1mm'], ['2.5', '2.5mm'], ['5', '5mm'], ['7.5', '7.5mm'], ['15', '15mm']]} full
        />
      )}

      {/* Divider */}
      <div className="h-px bg-border my-3" />

      {/* Add Elements */}
      <SectionLabel>Add Elements</SectionLabel>
      <div className="flex gap-2 mb-2 flex-wrap">
        <FabToggle label="+ Connector" active={addMode === 'con'} onClick={() => setAddMode(addMode === 'con' ? null : 'con')} />
        <FabToggle label="+ Device" active={addMode === 'dev'} onClick={() => setAddMode(addMode === 'dev' ? null : 'dev')} />
        <FabToggle label="+ Fan" active={addMode === 'fan'} onClick={() => setAddMode(addMode === 'fan' ? null : 'fan')} />
      </div>

      {addMode === 'con' && (
        <div className="bg-muted rounded-lg border border-border p-2 mb-2 max-h-56 overflow-y-auto">
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
        <div className="bg-muted rounded-lg border border-border p-2 mb-2 max-h-72 overflow-y-auto">
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
              <div className="h-px bg-border my-1.5" />
              <div className="text-[11px] text-muted-foreground tracking-wide px-2 mb-1 font-medium">CUSTOM</div>
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
                    className="h-6 w-6 text-muted-foreground text-xs"
                  >&#9998;</Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomDevice(k)}
                    className="h-6 w-6 text-destructive text-xs"
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
        <div className="bg-muted rounded-lg border border-border p-2 mb-2 max-h-56 overflow-y-auto">
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

      <div className="h-px bg-border my-3" />

      {/* Placed elements */}
      <SectionLabel>Placed ({elements.length})</SectionLabel>
      {elements.length === 0 && (
        <div className="text-xs text-muted-foreground/40 italic py-2">Add elements to begin</div>
      )}
      {elements.map(el => {
        const lib = el.type === 'connector' ? CONNECTORS[el.key] : el.type === 'fan' ? FANS[el.key] : (DEVICES[el.key] ?? customDevices[el.key]);
        const icon = el.type === 'fan' ? '\u25cb' : el.type === 'connector' && lib && 'icon' in lib ? (lib as typeof CONNECTORS[string]).icon : '\u25aa';
        const surfaceTag = el.surface === 'rear' ? ' [R]' : '';
        return (
          <div
            key={el.id}
            onClick={() => selectElement(el.id)}
            className={`flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer mb-0.5 border text-xs ${
              selectedId === el.id ? 'bg-accent border-primary' : 'border-transparent hover:bg-muted'
            }`}
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
                className="h-6 w-6 text-muted-foreground text-xs"
              >&#10697;</Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={e => { e.stopPropagation(); removeElement(el.id); }}
                className="h-6 w-6 text-destructive text-xs"
              >&#10005;</Button>
            </div>
          </div>
        );
      })}

      {/* Selected element properties */}
      {selEl && (
        <>
          <div className="h-px bg-border my-3" />
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
                <span className="text-muted-foreground">Source</span>
                <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold" style={{ background: badge.color + '20', color: badge.color }}>
                  {badge.label}
                </span>
              </div>
            );
          })()}

          {/* Label Editor */}
          <div className="h-px bg-border my-3" />
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
              <div className="px-2 space-y-2">
                <Input
                  type="text"
                  value={labelText}
                  onChange={e => updateLabel({ text: e.target.value })}
                  placeholder="Label text..."
                  className="h-8 text-xs bg-background"
                />
                <div className="flex gap-1 items-center text-xs text-muted-foreground">
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
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={autoNum}
                      onCheckedChange={(v: boolean | 'indeterminate') => updateLabel({ autoNumber: v === true })}
                      className="size-3.5"
                    />
                    Auto-number
                  </label>
                )}
                <div className="flex gap-1 items-center text-xs text-muted-foreground">
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
        </>
      )}

      {/* Load summary */}
      {totalWeight > 0 && (
        <>
          <div className="h-px bg-border my-3" />
          <SectionLabel>Load</SectionLabel>
          <PropertyRow label="Total" value={`${totalWeight.toFixed(2)}kg`} />
          <PropertyRow label="Ear-only" value={totalWeight < 7 ? '\u2713' : '\u26a0 Rails'} />
        </>
      )}

      <CustomDeviceModal
        open={showCustomModal}
        onClose={() => { setShowCustomModal(false); setEditCustomKey(undefined); }}
        editKey={editCustomKey}
        editDef={editCustomKey ? customDevices[editCustomKey] : undefined}
      />
    </div>
  );
}
