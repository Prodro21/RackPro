interface PropertyRowProps {
  label: string;
  value: string | undefined;
}

export function PropertyRow({ label, value }: PropertyRowProps) {
  return (
    <div className="flex justify-between py-[1px] border-b border-[#151520] text-[9px]">
      <span className="text-text-label">{label}</span>
      <span className="text-[#bbb]">{value}</span>
    </div>
  );
}
