import { useConfigStore } from '../store';
import { Button } from './ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import type { TabId } from '../types';

const TABS: TabId[] = ['front', 'side', '3d', 'split', 'specs', 'export'];

export function Header() {
  const activeTab = useConfigStore(s => s.activeTab);
  const setActiveTab = useConfigStore(s => s.setActiveTab);

  const undo = useConfigStore(s => s.undo);
  const redo = useConfigStore(s => s.redo);

  return (
    <div className="bg-card border-b border-border px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 min-w-0">
      <div className="flex items-center gap-3 min-w-0 shrink-1">
        <div className="w-8 h-8 shrink-0 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center text-base font-black text-primary-foreground">
          &#8862;
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-wide truncate">Rack Mount Configurator</div>
          <div className="text-xs text-muted-foreground truncate">EIA-310 &bull; 3D Print / Sheet Metal &bull; Full Enclosure</div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={undo}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sm text-muted-foreground hover:text-foreground"
              >
                &#8617;
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={redo}
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sm text-muted-foreground hover:text-foreground"
              >
                &#8618;
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex gap-1">
          {TABS.map(t => (
            <Button
              key={t}
              onClick={() => setActiveTab(t)}
              variant={activeTab === t ? 'default' : 'ghost'}
              size="sm"
              className={`text-xs font-semibold tracking-wide uppercase ${
                activeTab === t
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
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
