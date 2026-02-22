interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit: string;
  color?: string;
}

export function SliderField({ label, value, onChange, min, max, step, unit, color }: SliderFieldProps) {
  return (
    <div className="flex items-center gap-[6px] text-[9px] mt-1">
      <span className="text-text-dim min-w-[60px]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(+e.target.value)}
        className="flex-1"
        style={{ accentColor: color || '#f7b600' }}
      />
      <span className="text-[#aaa] min-w-[30px] text-right">{value}{unit}</span>
    </div>
  );
}
