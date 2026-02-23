import { Link, useMatches } from '@tanstack/react-router';
import { cn } from '../lib/utils';

const NAV_ITEMS = [
  {
    to: '/' as const,
    label: 'Config',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    to: '/catalog' as const,
    label: 'Catalog',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    to: '/wizard' as const,
    label: 'Wizard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
] as const;

export function NavSidebar() {
  const matches = useMatches();
  // Get the last (most specific) match to determine the active route
  const currentPath = matches[matches.length - 1]?.pathname ?? '/';

  return (
    <nav className="w-[52px] shrink-0 bg-bg-nav border-r border-border-subtle flex flex-col items-center py-3 gap-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.to === '/'
            ? currentPath === '/' || currentPath === ''
            : currentPath.startsWith(item.to);

        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'relative w-10 h-10 flex flex-col items-center justify-center rounded-md transition-all gap-0.5 no-underline',
              isActive
                ? "text-text-primary bg-bg-elevated before:content-[''] before:absolute before:left-[-6px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-4 before:bg-accent before:rounded-r-sm"
                : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
            )}
          >
            {item.icon}
            <span className="text-[9px] font-medium tracking-[0.02em] leading-none">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
