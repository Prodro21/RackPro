import { useState } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectMaxDeviceDepth, selectNeedsSplit, selectSplitInfo, selectUsedWidth, selectRemainingWidth, selectTotalWeight, selectSelectedElement, selectMetal, selectFilament, selectPrinter, selectMarginWarnings, selectAssemblyMode, selectMountHoleType } from '../store';
import { useCustomDevices } from '../store/useCustomDevices';
import { useCatalogStore } from '../catalog/useCatalogStore';
import { CONNECTORS } from '../constants/connectors';
import { DEVICES } from '../constants/devices';
import { FANS } from '../constants/fans';
import { METALS, FILAMENTS } from '../constants/materials';
import { PRINTERS } from '../constants/printers';
import { BORE_HOLES } from '../constants/eia310';
import type { FabMethod, RackStandard, PlacementSurface, AssemblyMode, EnclosureStyle, MountHoleType, ElementLabel } from '../types';
import { SectionLabel } from './ui/SectionLabel';
import { SelectField } from './ui/SelectField';
import { SliderField } from './ui/SliderField';
import { Checkbox } from './ui/Checkbox';
import { ToggleButton } from './ui/ToggleButton';
import { PaletteItem } from './ui/PaletteItem';
import { PropertyRow } from './ui/PropertyRow';
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

  const budgetPct = Math.min(100, (usedWidth / panDims.panelWidth) * 100);
  const budgetColor = remainingWidth < 0 ? '#ef4444' : remainingWidth < 30 ? '#f7b600' : '#4ade80';

  return (
    <div className="w-[264px] shrink-0 bg-bg-secondary border-r border-border overflow-y-auto overflow-x-hidden p-3 text-[10px]">
      {/* Panel config */}
      <SectionLabel>PANEL</SectionLabel>
      <div className="flex gap-[5px] mb-[6px]">
        <SelectField
          label="Std"
          value={standard}
          onChange={v => setStandard(v as RackStandard)}
          options={[['19', '19"'], ['10', '10"']]}
        />
        <SelectField
          label="U"
          value={uHeight}
          onChange={v => setUHeight(+v)}
          options={[[1, '1U'], [2, '2U'], [3, '3U'], [4, '4U']]}
        />
      </div>

      {/* Fabrication */}
      <SectionLabel>FABRICATION</SectionLabel>
      <div className="flex gap-[5px] mb-[6px]">
        <ToggleButton active={fabMethod === '3dp'} onClick={() => setFabMethod('3dp')} color="#22c55e">3D Print</ToggleButton>
        <ToggleButton active={fabMethod === 'sm'} onClick={() => setFabMethod('sm')} color="#f7b600">Sheet Metal</ToggleButton>
      </div>

      {fabMethod === '3dp' ? (
        <div className="mt-[6px]">
          <SelectField
            label="Printer" value={printerKey}
            onChange={setPrinterKey}
            options={Object.entries(PRINTERS).map(([k, v]) => [k, v.name])} full
          />
          <SelectField
            label="Filament" value={filamentKey}
            onChange={setFilamentKey}
            options={Object.entries(FILAMENTS).map(([k, v]) => [k, `${v.name} (${v.heat})`])} full
          />
          <SliderField label="Wall" value={wallThickness} onChange={setWallThickness} min={2} max={6} step={0.5} unit="mm" color="#22c55e" />
          {needsSplit && (
            <div className="mt-[6px] px-[7px] py-[5px] bg-[#1a1406] border border-[#f7b60033] rounded-[3px] text-[9px] text-accent-gold">
              &#9888; {splitInfo.type}: {splitInfo.desc}
            </div>
          )}
          <div className="text-[8px] text-text-muted mt-1">Bed: {printer.bed.join('\u00d7')}mm</div>
        </div>
      ) : (
        <div className="mt-[6px]">
          <SelectField
            label="Material" value={metalKey}
            onChange={setMetalKey}
            options={Object.entries(METALS).map(([k, v]) => [k, v.name])} full
          />
        </div>
      )}

      {/* Assembly */}
      <SectionLabel>ASSEMBLY</SectionLabel>
      <div className="flex gap-[5px] mb-[6px]">
        <ToggleButton active={assemblyMode === 'monolithic'} onClick={() => setAssemblyMode('monolithic')} color="#888">Monolithic</ToggleButton>
        <ToggleButton active={assemblyMode === 'modular'} onClick={() => setAssemblyMode('modular')} color="#4a90d9">Modular</ToggleButton>
      </div>
      {assemblyMode === 'modular' && (
        <div className="mt-[6px]">
          <div className="flex gap-[5px] mb-[3px]">
            <span className="text-[8px] text-text-label w-[50px]">Faceplate</span>
            <ToggleButton active={faceFabMethod === '3dp'} onClick={() => setFaceFabMethod('3dp')} color="#22c55e">3DP</ToggleButton>
            <ToggleButton active={faceFabMethod === 'sm'} onClick={() => setFaceFabMethod('sm')} color="#f7b600">SM</ToggleButton>
          </div>
          <div className="flex gap-[5px]">
            <span className="text-[8px] text-text-label w-[50px]">Trays</span>
            <ToggleButton active={trayFabMethod === '3dp'} onClick={() => setTrayFabMethod('3dp')} color="#22c55e">3DP</ToggleButton>
            <ToggleButton active={trayFabMethod === 'sm'} onClick={() => setTrayFabMethod('sm')} color="#f7b600">SM</ToggleButton>
          </div>
        </div>
      )}

      {/* Enclosure */}
      <SectionLabel>ENCLOSURE</SectionLabel>
      <div className="flex gap-[5px] mb-[6px]">
        <ToggleButton active={enclosureStyle === 'tray'} onClick={() => setEnclosureStyle('tray')} color="#4a90d9">Tray</ToggleButton>
        <ToggleButton active={enclosureStyle === 'box'} onClick={() => setEnclosureStyle('box')} color="#888">Box</ToggleButton>
      </div>
      <SelectField
        label="Mount Hole" value={mountHoleType}
        onChange={v => setMountHoleType(v as MountHoleType)}
        options={Object.entries(BORE_HOLES).map(([k, v]) => [k, v.name])} full
      />
      <SliderField label="Flange Depth" value={flangeDepth} onChange={setFlangeDepth} min={10} max={40} step={1} unit="mm" color="#f7b600" />
      <div className="flex gap-2 mt-1">
        <Checkbox label="Flanges" checked={flanges} onChange={setFlanges} />
        <Checkbox label="Chamfers" checked={chamfers} onChange={setChamfers} />
      </div>
      <div className="flex gap-2 mt-1">
        <Checkbox label="Rear Panel" checked={rearPanel} onChange={setRearPanel} />
        <Checkbox label="Vent Slots" checked={ventSlots} onChange={setVentSlots} />
      </div>
      <div className="text-[9px] text-text-dim mt-1">
        Auto depth: <b className="text-[#aaa]">{enclosureDepth.toFixed(0)}mm</b> (deepest: {maxDeviceDepth || '\u2014'}mm)
      </div>
      <div className="flex items-center gap-2 mt-1">
        <Checkbox label="Auto Ribs" checked={autoReinforcement} onChange={setAutoReinforcement} />
        {marginWarnings.length > 0 && (
          <span className="text-[8px] px-[4px] py-[1px] rounded bg-[#f7b60020] text-accent-gold">
            {marginWarnings.length} margin{marginWarnings.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Width budget */}
      <div className="my-2">
        <div className="flex justify-between text-[8px] text-text-dim mb-[2px]">
          <span>WIDTH</span>
          <span style={{ color: budgetColor }}>{remainingWidth.toFixed(0)}mm free</span>
        </div>
        <div className="h-[3px] bg-bg-input rounded-sm overflow-hidden">
          <div
            className="h-full rounded-sm transition-[width] duration-300"
            style={{ width: `${budgetPct}%`, background: budgetColor }}
          />
        </div>
      </div>

      {/* Grid / Snap */}
      <SectionLabel>GRID / SNAP</SectionLabel>
      <div className="flex gap-2 mt-1">
        <Checkbox label="Grid (G)" checked={gridEnabled} onChange={setGridEnabled} />
        <Checkbox label="Snap" checked={snapToEdges} onChange={setSnapToEdges} />
      </div>
      {gridEnabled && (
        <SelectField
          label="Grid Size" value={String(gridSize)}
          onChange={v => setGridSize(+v)}
          options={[['1', '1mm'], ['2.5', '2.5mm'], ['5', '5mm'], ['7.5', '7.5mm'], ['15', '15mm']]} full
        />
      )}

      {/* Divider */}
      <div className="h-px bg-border my-2" />

      {/* Add Elements */}
      <SectionLabel>ADD ELEMENTS</SectionLabel>
      <div className="flex gap-[5px] mb-[6px] flex-wrap">
        <ToggleButton active={addMode === 'con'} onClick={() => setAddMode(addMode === 'con' ? null : 'con')} color="#4a90d9">+ Connector</ToggleButton>
        <ToggleButton active={addMode === 'dev'} onClick={() => setAddMode(addMode === 'dev' ? null : 'dev')} color="#22c55e">+ Device</ToggleButton>
        <ToggleButton active={addMode === 'fan'} onClick={() => setAddMode(addMode === 'fan' ? null : 'fan')} color="#888">+ Fan</ToggleButton>
      </div>

      {addMode === 'con' && (
        <div className="bg-[#151520] rounded border border-border p-[5px] mb-[6px] max-h-[220px] overflow-y-auto">
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
        <div className="bg-[#151520] rounded border border-border p-[5px] mb-[6px] max-h-[280px] overflow-y-auto">
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
              <div className="h-px bg-border my-1" />
              <div className="text-[7px] text-text-label tracking-[.08em] px-1 mb-1">CUSTOM</div>
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
                  <button
                    onClick={() => { setEditCustomKey(k); setShowCustomModal(true); }}
                    className="bg-transparent border-none text-text-muted cursor-pointer text-[8px] font-mono px-px"
                  >&#9998;</button>
                  <button
                    onClick={() => removeCustomDevice(k)}
                    className="bg-transparent border-none text-accent-danger cursor-pointer text-[8px] font-mono px-px"
                  >&#10005;</button>
                </div>
              ))}
            </>
          )}
          <button
            onClick={() => { setEditCustomKey(undefined); setShowCustomModal(true); }}
            className="w-full mt-1 py-1 rounded-[3px] text-[9px] font-bold font-mono cursor-pointer border border-dashed border-border bg-transparent text-text-muted"
          >
            + New Custom Device
          </button>
        </div>
      )}

      {addMode === 'fan' && (
        <div className="bg-[#151520] rounded border border-border p-[5px] mb-[6px] max-h-[220px] overflow-y-auto">
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

      <div className="h-px bg-border my-2" />

      {/* Placed elements */}
      <SectionLabel>PLACED ({elements.length})</SectionLabel>
      {elements.length === 0 && (
        <div className="text-[9px] text-[#3a3a3a] italic py-1">Add elements to begin</div>
      )}
      {elements.map(el => {
        const lib = el.type === 'connector' ? CONNECTORS[el.key] : el.type === 'fan' ? FANS[el.key] : (DEVICES[el.key] ?? customDevices[el.key]);
        const icon = el.type === 'fan' ? '\u25cb' : el.type === 'connector' && lib && 'icon' in lib ? (lib as typeof CONNECTORS[string]).icon : '\u25aa';
        const surfaceTag = el.surface === 'rear' ? ' [R]' : '';
        return (
          <div
            key={el.id}
            onClick={() => selectElement(el.id)}
            className="flex items-center justify-between px-[6px] py-1 rounded-[3px] cursor-pointer mb-[1px]"
            style={{
              background: selectedId === el.id ? '#1a1a28' : 'transparent',
              border: selectedId === el.id ? '1px solid #f7b600' : '1px solid transparent',
            }}
          >
            <div className="flex items-center gap-1 overflow-hidden">
              <span className="text-[12px]" style={{ color: lib?.color || '#888' }}>{icon}</span>
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">{el.label}{surfaceTag}</span>
            </div>
            <div className="flex gap-[2px]">
              <button
                onClick={() => duplicateElement(el.id)}
                className="bg-transparent border-none text-text-muted cursor-pointer text-[10px] px-[1px] font-mono"
              >&#10697;</button>
              <button
                onClick={e => { e.stopPropagation(); removeElement(el.id); }}
                className="bg-transparent border-none text-danger cursor-pointer text-[10px] px-[1px] font-mono"
              >&#10005;</button>
            </div>
          </div>
        );
      })}

      {/* Selected element properties */}
      {selEl && (
        <>
          <div className="h-px bg-border my-2" />
          <SectionLabel>PROPERTIES</SectionLabel>
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
            <SelectField
              label="Surface"
              value={selEl.surface ?? 'faceplate'}
              onChange={v => setElementSurface(selEl.id, v as PlacementSurface)}
              options={[['faceplate', 'Faceplate'], ['rear', 'Rear'], ['side-top', 'Side Top'], ['side-bottom', 'Side Bottom']]}
              full
            />
          )}
          {(() => {
            const catStore = useCatalogStore.getState();
            const entry = selEl.type === 'device'
              ? catStore.devices.find(d => d.slug === selEl.key)
              : selEl.type === 'connector'
              ? catStore.connectors.find(c => c.slug === selEl.key)
              : null;
            if (!entry) return null;
            const badge = confidenceBadge(entry.dataSource);
            return (
              <div className="flex items-center justify-between px-[6px] py-[2px] text-[9px]">
                <span className="text-text-label">Source</span>
                <span className="px-[4px] py-[1px] rounded text-[8px] font-semibold" style={{ background: badge.color + '20', color: badge.color }}>
                  {badge.label}
                </span>
              </div>
            );
          })()}

          {/* Label Editor */}
          <div className="h-px bg-border my-2" />
          <SectionLabel>LABEL</SectionLabel>
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
              // Clear labelConfig if text is empty and no icon
              if (!current.text && !current.icon) {
                setElementLabel(selEl.id, undefined);
              } else {
                setElementLabel(selEl.id, current);
              }
            };

            return (
              <div className="px-[6px] space-y-[4px]">
                <input
                  type="text"
                  value={labelText}
                  onChange={e => updateLabel({ text: e.target.value })}
                  placeholder="Label text..."
                  className="w-full bg-bg-input border border-border rounded px-[6px] py-[3px] text-[10px] text-text-primary outline-none focus:border-accent-gold"
                />
                <div className="flex gap-1 items-center text-[8px] text-text-label">
                  <span className="w-[28px]">Pos</span>
                  {(['above', 'below', 'inside'] as const).map(pos => (
                    <button
                      key={pos}
                      onClick={() => updateLabel({ position: pos })}
                      className="px-[5px] py-[2px] rounded text-[8px] font-mono cursor-pointer border"
                      style={{
                        background: labelPos === pos ? '#1a1a28' : 'transparent',
                        borderColor: labelPos === pos ? '#f7b600' : '#333',
                        color: labelPos === pos ? '#f7b600' : '#888',
                      }}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
                {selEl.type === 'connector' && (
                  <label className="flex items-center gap-[4px] text-[9px] text-text-label cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoNum}
                      onChange={e => updateLabel({ autoNumber: e.target.checked })}
                      className="accent-accent-gold"
                    />
                    Auto-number
                  </label>
                )}
                <div className="flex gap-1 items-center text-[8px] text-text-label">
                  <span className="w-[28px]">Icon</span>
                  {([undefined, 'network', 'video', 'audio', 'power'] as const).map(ic => (
                    <button
                      key={ic ?? 'none'}
                      onClick={() => updateLabel({ icon: ic })}
                      className="px-[4px] py-[2px] rounded text-[8px] cursor-pointer border"
                      style={{
                        background: labelIcon === ic ? '#1a1a28' : 'transparent',
                        borderColor: labelIcon === ic ? '#f7b600' : '#333',
                        color: labelIcon === ic ? '#f7b600' : '#888',
                      }}
                    >
                      {ic ?? '--'}
                    </button>
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
          <div className="h-px bg-border my-2" />
          <SectionLabel>LOAD</SectionLabel>
          <PropertyRow label="Total" value={`${totalWeight.toFixed(2)}kg`} />
          <PropertyRow label="Ear-only" value={totalWeight < 7 ? '\u2713' : '\u26a0 Rails'} />
        </>
      )}

      {showCustomModal && (
        <CustomDeviceModal
          onClose={() => { setShowCustomModal(false); setEditCustomKey(undefined); }}
          editKey={editCustomKey}
          editDef={editCustomKey ? customDevices[editCustomKey] : undefined}
        />
      )}
    </div>
  );
}
