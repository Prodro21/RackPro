interface ExportCardProps {
  title: string;
  desc: string;
  action?: string;
  onClick?: () => void;
  action2?: string;
  onClick2?: () => void;
  note?: string;
}

export function ExportCard({ title, desc, action, onClick, action2, onClick2, note }: ExportCardProps) {
  return (
    <div className="bg-bg-card border border-border rounded-[5px] p-3 mb-2">
      <div className="font-bold text-[11px] text-[#f7f7f7]">{title}</div>
      <div className="text-[9px] text-[#666] my-1">{desc}</div>
      <div className="flex gap-[6px] items-center">
        {action && (
          <button
            onClick={onClick}
            className="border-none rounded-[3px] px-[10px] py-1 text-[9px] font-semibold font-mono"
            style={{
              background: onClick ? '#f7b600' : '#252530',
              color: onClick ? '#111' : '#555',
              cursor: onClick ? 'pointer' : 'default',
            }}
          >
            {action}
          </button>
        )}
        {action2 && (
          <button
            onClick={onClick2}
            className="border-none rounded-[3px] px-[10px] py-1 text-[9px] font-semibold font-mono"
            style={{
              background: onClick2 ? '#4a90d9' : '#252530',
              color: onClick2 ? '#fff' : '#555',
              cursor: onClick2 ? 'pointer' : 'default',
            }}
          >
            {action2}
          </button>
        )}
      </div>
      {note && <div className="text-[8px] text-text-muted mt-1 italic">{note}</div>}
    </div>
  );
}
