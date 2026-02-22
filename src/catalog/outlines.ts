// ─── Device Outline Loading & Caching ─────────────────────────
//
// On-demand SVG outline loader with module-level cache.
// Outlines are static assets — NOT user state — so they live
// outside Zustand, per MEMORY.md convention for static data.

export type DeviceFace = 'top' | 'front' | 'side';

interface OutlineEntry {
  faces: DeviceFace[];
  bboxW: number;
  bboxD: number;
  bboxH: number;
}

interface OutlineIndex {
  schemaVersion: number;
  outlines: Record<string, OutlineEntry>;
}

// ─── Module-level cache ──────────────────────────────────────

let indexPromise: Promise<OutlineIndex> | null = null;
let indexData: OutlineIndex | null = null;
const pathCache = new Map<string, string | null>();

// ─── Cache key helper ────────────────────────────────────────

function cacheKey(slug: string, face: DeviceFace): string {
  return `${slug}:${face}`;
}

// ─── Public API ──────────────────────────────────────────────

/**
 * Load the outline index manifest.
 * Called once; cached in module scope.
 * Deduplicates concurrent calls via shared promise.
 */
export async function loadOutlineIndex(): Promise<OutlineIndex> {
  if (indexData) return indexData;

  if (indexPromise) return indexPromise;

  indexPromise = fetch('/catalog/outlines/index.json')
    .then(res => {
      if (!res.ok) throw new Error(`Outline index fetch failed: ${res.status}`);
      return res.json() as Promise<OutlineIndex>;
    })
    .then(data => {
      indexData = data;
      return data;
    })
    .catch(err => {
      console.warn('Failed to load outline index, outlines disabled:', err);
      indexData = { schemaVersion: 1, outlines: {} };
      return indexData;
    });

  return indexPromise;
}

/**
 * Get available faces for a device slug (sync, from cached index).
 * Returns empty array if index not loaded or device has no outlines.
 */
export function getOutlineFaces(slug: string): DeviceFace[] {
  return indexData?.outlines[slug]?.faces ?? [];
}

/**
 * Check if a device has an outline for a given face (sync, from cached index).
 */
export function hasOutline(slug: string, face: DeviceFace): boolean {
  return indexData?.outlines[slug]?.faces.includes(face) ?? false;
}

/**
 * Load an SVG outline path `d` string for a device face.
 * Returns null if no outline exists. Caches in module scope.
 *
 * This is async. Components needing sync access should use
 * getCachedOutlinePath() and trigger loading separately.
 */
export async function loadOutlinePath(
  slug: string,
  face: DeviceFace,
): Promise<string | null> {
  const key = cacheKey(slug, face);

  // Return cached value (including cached null for missing outlines)
  if (pathCache.has(key)) return pathCache.get(key)!;

  // Ensure index is loaded
  await loadOutlineIndex();

  // Check if slug+face exists in index
  if (!hasOutline(slug, face)) {
    pathCache.set(key, null);
    return null;
  }

  try {
    const res = await fetch(`/catalog/outlines/${slug}-${face}.svg`);
    if (!res.ok) {
      pathCache.set(key, null);
      return null;
    }

    const svgText = await res.text();
    // Extract path d attribute using regex
    const match = svgText.match(/d="([^"]+)"/);
    if (!match) {
      console.warn(`No path d="" found in ${slug}-${face}.svg`);
      pathCache.set(key, null);
      return null;
    }

    const pathD = match[1];
    pathCache.set(key, pathD);
    return pathD;
  } catch {
    pathCache.set(key, null);
    return null;
  }
}

/**
 * Get a cached outline path synchronously.
 * Returns null if not yet loaded.
 * For use in synchronous render contexts.
 */
export function getCachedOutlinePath(
  slug: string,
  face: DeviceFace,
): string | null {
  return pathCache.get(cacheKey(slug, face)) ?? null;
}
