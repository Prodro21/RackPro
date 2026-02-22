import { useConfigStore } from '../store';
import type { TabId } from '../types';

const TABS: TabId[] = ['front', 'side', '3d', 'split', 'specs', 'export'];

export function Header() {
  const activeTab = useConfigStore(s => s.activeTab);
  const setActiveTab = useConfigStore(s => s.setActiveTab);

  const undo = useConfigStore(s => s.undo);
  const redo = useConfigStore(s => s.redo);

  return (
    <div className="bg-bg-secondary border-b border-border px-3 py-[10px] flex items-center justify-between gap-2 shrink-0 min-w-0">
      <div className="flex items-center gap-[10px] min-w-0 shrink-1">
        <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-accent-gold to-[#d4a017] rounded-[5px] flex items-center justify-center text-[16px] font-black text-[#111]">
          &#8862;
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-[.05em] truncate">RACK MOUNT CONFIGURATOR</div>
          <div className="text-[8px] text-text-dim tracking-[.12em] truncate">EIA-310 &bull; 3D PRINT / SHEET METAL &bull; FULL ENCLOSURE</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex gap-[2px]">
          <button
            onClick={undo}
            className="border-none px-2 py-1 rounded-[3px] text-[11px] cursor-pointer font-mono bg-transparent text-text-muted hover:text-text-primary"
            title="Undo (Ctrl+Z)"
          >
            &#8617;
          </button>
          <button
            onClick={redo}
            className="border-none px-2 py-1 rounded-[3px] text-[11px] cursor-pointer font-mono bg-transparent text-text-muted hover:text-text-primary"
            title="Redo (Ctrl+Shift+Z)"
          >
            &#8618;
          </button>
        </div>
        <div className="flex gap-[1px]">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="border-none px-2 py-1 rounded-[3px] text-[9px] font-bold tracking-[.08em] cursor-pointer uppercase font-mono"
              style={{
                background: activeTab === t ? '#f7b600' : 'transparent',
                color: activeTab === t ? '#111' : '#666',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
