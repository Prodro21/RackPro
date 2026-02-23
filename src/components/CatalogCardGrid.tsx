/**
 * CatalogCardGrid — Grouped collapsible sections of CatalogCards.
 *
 * Items are grouped by category (devices by their category, connectors
 * under "connector"). Sections are collapsible with click-to-toggle headers.
 * Cards use accordion behavior (one expanded at a time).
 */

import { useMemo, useState, useCallback } from 'react';
import type { CatalogItem } from '../hooks/useCatalogSearch';
import { CatalogCard } from './CatalogCard';

// ─── Props ──────────────────────────────────────────────────

interface CatalogCardGridProps {
  items: CatalogItem[];
  expandedSlug: string | null;
  onToggle: (slug: string) => void;
  onAdd: (item: CatalogItem) => void;
}

// ─── Collapsible Section ────────────────────────────────────

function CollapsibleSection({
  title,
  count,
  isOpen,
  onToggleSection,
  children,
}: {
  title: string;
  count: number;
  isOpen: boolean;
  onToggleSection: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <button
        onClick={onToggleSection}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-text-tertiary hover:text-text-primary transition-colors"
      >
        <span className="flex items-center gap-2">
          <span
            className="text-xs transition-transform"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            &#9654;
          </span>
          {title}
        </span>
        <span className="text-xs font-normal bg-bg-elevated border border-border-default rounded-full px-1.5 py-0.5">
          {count}
        </span>
      </button>
      {isOpen && <div className="grid grid-cols-2 gap-2 mt-1">{children}</div>}
    </div>
  );
}

// ─── Display name for categories ────────────────────────────

const CATEGORY_DISPLAY: Record<string, string> = {
  switch: 'Switches',
  router: 'Routers',
  gateway: 'Gateways',
  'access-point': 'Access Points',
  nas: 'NAS',
  compute: 'Compute',
  converter: 'Converters',
  'patch-panel': 'Patch Panels',
  ups: 'UPS',
  pdu: 'PDU',
  other: 'Other',
  connector: 'Connectors',
};

function displayName(category: string): string {
  return CATEGORY_DISPLAY[category] ?? category;
}

// ─── Component ──────────────────────────────────────────────

export function CatalogCardGrid({
  items,
  expandedSlug,
  onToggle,
  onAdd,
}: CatalogCardGridProps) {
  // Track collapsed sections (all start open)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((cat: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  // Group items by category; devices first (sorted), then connectors
  const grouped = useMemo(() => {
    const groups: Record<string, CatalogItem[]> = {};
    for (const item of items) {
      const cat = item.itemType === 'device' ? item.category : 'connector';
      (groups[cat] ??= []).push(item);
    }

    // Sort: device categories alphabetically, "connector" last
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'connector') return 1;
      if (b === 'connector') return -1;
      return a.localeCompare(b);
    });

    return sortedKeys.map((cat) => ({
      category: cat,
      items: groups[cat],
    }));
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm p-8">
        No items match your search.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-2">
      {grouped.map(({ category, items: groupItems }) => (
        <CollapsibleSection
          key={category}
          title={displayName(category)}
          count={groupItems.length}
          isOpen={!collapsedSections.has(category)}
          onToggleSection={() => toggleSection(category)}
        >
          {groupItems.map((item) => (
            <CatalogCard
              key={item.slug}
              item={item}
              isExpanded={expandedSlug === item.slug}
              onToggle={() => onToggle(item.slug)}
              onAdd={() => onAdd(item)}
            />
          ))}
        </CollapsibleSection>
      ))}
    </div>
  );
}
