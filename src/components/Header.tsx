import { useConfigStore } from '../store';
import { useTheme } from '../hooks/useTheme';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { cn } from '../lib/utils';
import type { TabId } from '../types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'side', label: 'Side' },
  { id: '3d', label: '3D' },
  { id: 'split', label: 'Split' },
  { id: 'specs', label: 'Specs' },
  { id: 'export', label: 'Export' },
];

export function Header() {
  const activeTab = useConfigStore(s => s.activeTab);
  const setActiveTab = useConfigStore(s => s.setActiveTab);
  const undo = useConfigStore(s => s.undo);
  const redo = useConfigStore(s => s.redo);
  const { theme, toggle: toggleTheme } = useTheme();

  return (
    <header className="h-12 flex items-center px-4 gap-4 bg-bg-nav border-b border-border-subtle shrink-0">
      {/* Brand section */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        {/* Logo: orange gradient rounded square with rack icon */}
        <div className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent), #ff8c4a)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="10" rx="1" />
            <line x1="6" y1="7" x2="6" y2="17" />
            <line x1="18" y1="7" x2="18" y2="17" />
          </svg>
        </div>
        <span className="text-sm font-semibold text-text-primary tracking-tight whitespace-nowrap">
          RackPro
        </span>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-border-default shrink-0" />

      {/* Segmented tab bar */}
      <div className="flex gap-px p-[3px] rounded-lg border border-border-subtle" style={{ background: 'var(--seg-bg)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'px-3 py-[5px] text-[11px] font-medium uppercase tracking-wider rounded-md transition-all whitespace-nowrap border',
              activeTab === t.id
                ? 'text-text-primary bg-seg-active border-border-default shadow-sm'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover border-transparent'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Toolbar section (right) */}
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={undo}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
              aria-label="Undo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={redo}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
              aria-label="Redo"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3L21 13" />
              </svg>
            </button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? (
                /* Sun icon — shown when dark, click switches to light */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                /* Moon icon — shown when light, click switches to dark */
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
