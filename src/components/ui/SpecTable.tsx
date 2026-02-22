interface SpecTableProps {
  rows: [string, string][];
}

export function SpecTable({ rows }: SpecTableProps) {
  return (
    <div className="bg-bg-card rounded border border-border overflow-hidden">
      {rows.map(([label, value], i) => (
        <div
          key={i}
          className="flex justify-between px-2 py-1 text-[9px]"
          style={{ borderTop: i ? '1px solid #1e1e28' : 'none' }}
        >
          <span className="text-text-dim">{label}</span>
          <span className="text-[#ddd] font-medium">{value}</span>
        </div>
      ))}
    </div>
  );
}
