import { useState } from 'react';
import { useCustomDevices } from '../store/useCustomDevices';
import type { DeviceDef } from '../types';

interface CustomDeviceModalProps {
  onClose: () => void;
  editKey?: string;
  editDef?: DeviceDef;
}

export function CustomDeviceModal({ onClose, editKey, editDef }: CustomDeviceModalProps) {
  const addCustomDevice = useCustomDevices(s => s.addCustomDevice);
  const updateCustomDevice = useCustomDevices(s => s.updateCustomDevice);

  const [name, setName] = useState(editDef?.name ?? '');
  const [w, setW] = useState(editDef?.w ?? 150);
  const [d, setD] = useState(editDef?.d ?? 100);
  const [h, setH] = useState(editDef?.h ?? 30);
  const [wt, setWt] = useState(editDef?.wt ?? 0.5);
  const [color, setColor] = useState(editDef?.color ?? '#cccccc');
  const [ports, setPorts] = useState(editDef?.ports ?? '');
  const [poe, setPoe] = useState(editDef?.poe ?? '–');
  const [error, setError] = useState('');

  const isEdit = !!editKey;

  const handleSave = () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (w < 15 || w > 390) { setError('Width must be 15–390mm'); return; }
    if (d < 30 || d > 400) { setError('Depth must be 30–400mm'); return; }
    if (h < 11 || h > 250) { setError('Height must be 11–250mm'); return; }
    if (wt < 0 || wt > 15) { setError('Weight must be 0–15kg'); return; }

    const def = { name: name.trim(), w, d, h, wt, color, ports: ports || '–', poe: poe || '–' };

    if (isEdit) {
      updateCustomDevice(editKey!, def);
    } else {
      const key = `custom-${Date.now()}`;
      addCustomDevice(key, def);
    }
    onClose();
  };

  // Preview scale
  const maxPreviewW = 200;
  const maxPreviewH = 44; // 1U height for reference
  const scale = Math.min(maxPreviewW / Math.max(w, 1), 40 / Math.max(h, 1));
  const pw = w * scale;
  const ph = h * scale;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border rounded-lg p-5 w-[380px] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-sm font-bold text-text-primary mb-4">
          {isEdit ? 'Edit Custom Device' : 'New Custom Device'}
        </div>

        <div className="space-y-3">
          <Field label="Name" value={name} onChange={setName} type="text" />
          <div className="flex gap-3">
            <Field label="Width (mm)" value={w} onChange={v => setW(+v)} type="number" min={15} max={390} />
            <Field label="Depth (mm)" value={d} onChange={v => setD(+v)} type="number" min={30} max={400} />
            <Field label="Height (mm)" value={h} onChange={v => setH(+v)} type="number" min={11} max={250} />
          </div>
          <div className="flex gap-3">
            <Field label="Weight (kg)" value={wt} onChange={v => setWt(+v)} type="number" min={0} max={15} step={0.1} />
            <div className="flex flex-col gap-px flex-1">
              <span className="text-[7px] text-text-label tracking-[.08em]">Color</span>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full h-[26px] rounded border border-border cursor-pointer bg-bg-input"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Field label="Ports" value={ports} onChange={setPorts} type="text" />
            <Field label="PoE" value={poe} onChange={setPoe} type="text" />
          </div>
        </div>

        {/* Preview */}
        <div className="mt-4 bg-bg-primary rounded p-3">
          <div className="text-[8px] text-text-label mb-2">PREVIEW (relative to 1U)</div>
          <svg width={maxPreviewW + 20} height={60} viewBox={`0 0 ${maxPreviewW + 20} 60`}>
            {/* 1U reference */}
            <rect x={10} y={5} width={maxPreviewW} height={maxPreviewH * scale} fill="none" stroke="#333" strokeWidth={0.5} strokeDasharray="3,2" />
            <text x={maxPreviewW + 14} y={5 + maxPreviewH * scale / 2} fill="#333" fontSize={5} textAnchor="start" dominantBaseline="central">1U</text>
            {/* Device */}
            <rect
              x={10 + (maxPreviewW - pw) / 2}
              y={5 + (maxPreviewH * scale - ph) / 2}
              width={pw} height={ph}
              fill={color + '33'} stroke={color} strokeWidth={1} rx={1}
            />
            <text
              x={10 + maxPreviewW / 2}
              y={5 + maxPreviewH * scale / 2}
              textAnchor="middle" dominantBaseline="central"
              fill={color} fontSize={Math.min(pw, ph) * 0.2}
            >
              {name || 'Device'}
            </text>
          </svg>
        </div>

        {error && <div className="mt-2 text-[9px] text-accent-danger">{error}</div>}

        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-[9px] font-bold font-mono border border-border bg-transparent text-text-muted cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded text-[9px] font-bold font-mono border-none bg-accent-gold text-[#111] cursor-pointer"
          >
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type, min, max, step,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-px flex-1">
      <span className="text-[7px] text-text-label tracking-[.08em]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        className="bg-bg-input text-text-primary border border-border rounded-[3px] px-1.5 py-[3px] text-[9px] font-mono outline-none"
      />
    </label>
  );
}
