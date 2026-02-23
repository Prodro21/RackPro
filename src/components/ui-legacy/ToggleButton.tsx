interface ToggleButtonProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color: string;
}

export function ToggleButton({ children, active, onClick, color }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-[6px] py-[5px] rounded-[3px] text-[9px] font-bold cursor-pointer font-mono"
      style={{
        background: active ? color : '#1a1a22',
        color: active ? '#111' : '#777',
        border: active ? 'none' : '1px solid #252530',
      }}
    >
      {children}
    </button>
  );
}
