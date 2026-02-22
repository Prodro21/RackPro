/**
 * CatalogCard — Adaptive card with compact/expanded states.
 *
 * Compact: name, brand (devices only), key dimension, confidence dot.
 * Expanded: full dimensions, category, weight, SVG outline thumbnail,
 *           compatible modules (connectors), "Add to Panel" button.
 *
 * Draggable via HTML5 drag API with `application/rackpro-item` data payload.
 */

import type { CatalogItem } from '../hooks/useCatalogSearch';
import { getCachedOutlinePath } from '../catalog/outlines';

// ─── Confidence Dot ─────────────────────────────────────────

const CONFIDENCE_COLORS: Record<string, string> = {
  'manufacturer-datasheet': '#22c55e',
  'user-calipered': '#eab308',
  'cross-referenced': '#f97316',
  estimated: '#6b7280',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  'manufacturer-datasheet': 'Manufacturer datasheet',
  'user-calipered': 'User-calipered',
  'cross-referenced': 'Cross-referenced',
  estimated: 'Estimated',
};

// ─── Props ──────────────────────────────────────────────────

interface CatalogCardProps {
  item: CatalogItem;
  isExpanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
}

// ─── Component ──────────────────────────────────────────────

export function CatalogCard({ item, isExpanded, onToggle, onAdd }: CatalogCardProps) {
  const dotColor = CONFIDENCE_COLORS[item.dataSource] ?? '#6b7280';

  // Dimension summary for compact state
  const dimensionLine =
    item.itemType === 'device'
      ? `${item.width}x${item.height}mm`
      : `${item.cutoutWidth}x${item.cutoutHeight}mm`;

  // Drag handler: set application/rackpro-item payload
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData(
      'application/rackpro-item',
      JSON.stringify({ itemType: item.itemType, slug: item.slug }),
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  // SVG outline path for expanded device cards
  const outlinePath =
    item.itemType === 'device' ? getCachedOutlinePath(item.slug, 'front') : null;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onToggle}
      className={`border rounded p-2 cursor-pointer transition-colors ${
        isExpanded
          ? 'border-accent-gold/50 bg-bg-secondary'
          : 'border-border hover:border-accent-gold/50'
      }`}
    >
      {/* ── Compact state (always visible) ── */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-medium truncate">{item.name}</span>
        <span
          className="shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: dotColor }}
          title={CONFIDENCE_LABELS[item.dataSource] ?? 'Unknown'}
        />
      </div>

      {item.itemType === 'device' && (
        <div className="text-xs text-text-dim truncate">{item.brand}</div>
      )}

      <div className="text-xs text-text-muted mt-0.5">{dimensionLine}</div>

      {/* ── Expanded state ── */}
      {isExpanded && (
        <div className="mt-2 border-t border-border pt-2 space-y-1.5">
          {/* Full dimensions */}
          {item.itemType === 'device' ? (
            <>
              <div className="text-xs text-text-muted">
                {item.width} x {item.depth} x {item.height} mm (W x D x H)
              </div>
              <div className="text-xs text-text-muted">
                Weight: {item.weight} kg
              </div>
            </>
          ) : (
            <div className="text-xs text-text-muted">
              Cutout: {item.cutoutWidth} x {item.cutoutHeight} mm ({item.cutoutType})
            </div>
          )}

          {/* Category tag */}
          <div className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-bg-primary border border-border text-text-dim">
            {item.itemType === 'device' ? item.category : 'connector'}
          </div>

          {/* Confidence badge text */}
          <div className="flex items-center gap-1 text-[10px] text-text-dim">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
            {CONFIDENCE_LABELS[item.dataSource] ?? 'Unknown'}
          </div>

          {/* SVG outline thumbnail (devices only, if cached) */}
          {outlinePath && (
            <div className="flex justify-center py-1">
              <svg
                viewBox="0 0 100 50"
                className="w-24 h-12 opacity-60"
                preserveAspectRatio="xMidYMid meet"
              >
                <path
                  d={outlinePath}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1}
                  className="text-text-muted"
                />
              </svg>
            </div>
          )}

          {/* Compatible modules (connectors only) */}
          {item.itemType === 'connector' && item.compatibleModules.length > 0 && (
            <div className="text-[10px] text-text-dim">
              <span className="font-medium">Modules:</span>{' '}
              {item.compatibleModules.map((m) => m.name).join(', ')}
            </div>
          )}

          {/* Add to Panel button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="w-full bg-accent-gold text-bg-primary font-bold px-3 py-1 rounded text-xs hover:brightness-110 transition-all mt-1"
          >
            + Add to Panel
          </button>
        </div>
      )}
    </div>
  );
}
