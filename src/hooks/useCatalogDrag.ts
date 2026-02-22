/**
 * Catalog drag utilities — parse drag data from catalog card drops.
 *
 * The drag data format is `application/rackpro-item` containing
 * a JSON payload with { itemType, slug }. This matches the format
 * set by CatalogCard's onDragStart handler.
 */

/**
 * Parse catalog drag data from a DragEvent.
 * Returns null if the event doesn't contain valid catalog drag data.
 */
export function parseCatalogDragData(
  e: React.DragEvent,
): { itemType: 'device' | 'connector'; slug: string } | null {
  try {
    const raw = e.dataTransfer.getData('application/rackpro-item');
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      itemType?: string;
      slug?: string;
    };

    if (
      (parsed.itemType === 'device' || parsed.itemType === 'connector') &&
      typeof parsed.slug === 'string' &&
      parsed.slug.length > 0
    ) {
      return { itemType: parsed.itemType, slug: parsed.slug };
    }

    return null;
  } catch {
    return null;
  }
}
