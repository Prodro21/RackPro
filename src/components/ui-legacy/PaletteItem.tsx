import { useState } from 'react';

interface PaletteItemProps {
  onClick: () => void;
  icon: string;
  iconColor: string;
  name: string;
  desc: string;
  meta?: string;
}

export function PaletteItem({ onClick, icon, iconColor, name, desc, meta }: PaletteItemProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-[6px] w-full px-[5px] py-1 border-none rounded-[2px] cursor-pointer text-left text-text-primary font-mono text-[9px]"
      style={{ background: hovered ? '#1e1e2a' : 'transparent' }}
    >
      <span className="text-[13px] w-[18px] text-center" style={{ color: iconColor }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{name}</div>
        <div className="text-[7px] text-text-dim whitespace-nowrap overflow-hidden text-ellipsis">{desc}</div>
      </div>
      {meta && <div className="text-[7px] text-[#3a3a3a] whitespace-nowrap">{meta}</div>}
    </button>
  );
}
