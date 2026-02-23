import { useConfigStore } from '../store';
import { Button } from './ui/button';
import type { TabId } from '../types';

const TABS: TabId[] = ['front', 'side', '3d', 'split', 'specs', 'export'];

export function Header() {
  const activeTab = useConfigStore(s => s.activeTab);
  const setActiveTab = useConfigStore(s => s.setActiveTab);

  const undo = useConfigStore(s => s.undo);
  const redo = useConfigStore(s => s.redo);

  return (
    <div className="bg-secondary border-b border-border px-3 py-[10px] flex items-center justify-between gap-2 shrink-0 min-w-0">
      <div className="flex items-center gap-[10px] min-w-0 shrink-1">
        <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-primary to-primary/70 rounded-[5px] flex items-center justify-center text-[16px] font-black text-primary-foreground">
          &#8862;
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-[.05em] truncate">RACK MOUNT CONFIGURATOR</div>
          <div className="text-[8px] text-muted-foreground tracking-[.12em] truncate">EIA-310 &bull; 3D PRINT / SHEET METAL &bull; FULL ENCLOSURE</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex gap-[2px]">
          <Button
            onClick={undo}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            title="Undo (Ctrl+Z)"
          >
            &#8617;
          </Button>
          <Button
            onClick={redo}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[11px] font-mono text-muted-foreground hover:text-foreground"
            title="Redo (Ctrl+Shift+Z)"
          >
            &#8618;
          </Button>
        </div>
        <div className="flex gap-[1px]">
          {TABS.map(t => (
            <Button
              key={t}
              onClick={() => setActiveTab(t)}
              variant={activeTab === t ? 'default' : 'ghost'}
              size="xs"
              className={`text-[9px] font-bold tracking-[.08em] uppercase font-mono ${
                activeTab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
