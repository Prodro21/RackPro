interface SelectFieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  options: [string | number, string][];
  full?: boolean;
}

export function SelectField({ label, value, onChange, options, full }: SelectFieldProps) {
  return (
    <label className={`flex flex-col gap-[1px] ${full ? 'flex-1 w-full' : ''}`}>
      <span className="text-[7px] text-text-label tracking-[.08em]">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-bg-input text-[#ddd] border border-border rounded-[3px] px-[5px] py-[3px] text-[9px] font-mono cursor-pointer outline-none"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
