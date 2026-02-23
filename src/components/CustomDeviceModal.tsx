import { useState } from 'react';
import { useCustomDevices } from '../store/useCustomDevices';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { DeviceDef } from '../types';

interface CustomDeviceModalProps {
  open: boolean;
  onClose: () => void;
  editKey?: string;
  editDef?: DeviceDef;
}

export function CustomDeviceModal({ open, onClose, editKey, editDef }: CustomDeviceModalProps) {
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
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="bg-secondary border-border max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold">
            {isEdit ? 'Edit Custom Device' : 'New Custom Device'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Define custom device dimensions for your rack panel layout.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground tracking-[.08em]">Name</Label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground tracking-[.08em]">Width (mm)</Label>
              <Input type="number" value={w} onChange={e => setW(+e.target.value)} min={15} max={390} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground tracking-[.08em]">Depth (mm)</Label>
              <Input type="number" value={d} onChange={e => setD(+e.target.value)} min={30} max={400} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground tracking-[.08em]">Height (mm)</Label>
              <Input type="number" value={h} onChange={e => setH(+e.target.value)} min={11} max={250} className="h-8 text-xs font-mono" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground tracking-[.08em]">Weight (kg)</Label>
              <Input type="number" value={wt} onChange={e => setWt(+e.target.value)} min={0} max={15} step={0.1} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground tracking-[.08em]">Color</Label>
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full h-8 rounded border border-border cursor-pointer bg-input"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground tracking-[.08em]">Ports</Label>
              <Input type="text" value={ports} onChange={e => setPorts(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs text-muted-foreground tracking-[.08em]">PoE</Label>
              <Input type="text" value={poe} onChange={e => setPoe(e.target.value)} className="h-8 text-xs font-mono" />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-2 bg-background rounded p-3">
          <div className="text-xs text-muted-foreground mb-2">PREVIEW (relative to 1U)</div>
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

        {error && <div className="text-xs text-destructive">{error}</div>}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="text-xs font-bold">
            {isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
