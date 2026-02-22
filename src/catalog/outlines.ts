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

// ─── Slug normalization ──────────────────────────────────────
//
// DEVICES constant keys (e.g. 'usw-lite-16') don't always match
// outline index slugs (e.g. 'usw-lite-16-poe'). This mapping
// bridges the gap so all API functions work with either form.

const SLUG_ALIASES: Record<string, string> = {
  'usw-lite-16': 'usw-lite-16-poe',
  'usw-lite-8': 'usw-lite-8-poe',
};

/**
 * Resolve a device key to its outline index slug.
 * - If the key exists directly in the index, return as-is.
 * - If a known alias exists, return the mapped slug.
 * - Otherwise return unchanged (hasOutline will return false).
 */
export function resolveOutlineSlug(key: string): string {
  // Direct match in index — most common path
  if (indexData?.outlines[key]) return key;

  // Known alias mapping
  if (key in SLUG_ALIASES) return SLUG_ALIASES[key];

  // Unknown key — return as-is, downstream will handle gracefully
  return key;
}

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
  const resolved = resolveOutlineSlug(slug);
  return indexData?.outlines[resolved]?.faces ?? [];
}

/**
 * Check if a device has an outline for a given face (sync, from cached index).
 */
export function hasOutline(slug: string, face: DeviceFace): boolean {
  const resolved = resolveOutlineSlug(slug);
  return indexData?.outlines[resolved]?.faces.includes(face) ?? false;
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
  const resolved = resolveOutlineSlug(slug);
  const key = cacheKey(resolved, face);

  // Return cached value (including cached null for missing outlines)
  if (pathCache.has(key)) return pathCache.get(key)!;

  // Ensure index is loaded
  await loadOutlineIndex();

  // Check if resolved slug+face exists in index
  if (!hasOutline(resolved, face)) {
    pathCache.set(key, null);
    return null;
  }

  try {
    const res = await fetch(`/catalog/outlines/${resolved}-${face}.svg`);
    if (!res.ok) {
      pathCache.set(key, null);
      return null;
    }

    const svgText = await res.text();
    // Extract path d attribute using regex
    const match = svgText.match(/d="([^"]+)"/);
    if (!match) {
      console.warn(`No path d="" found in ${resolved}-${face}.svg`);
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
  const resolved = resolveOutlineSlug(slug);
  return pathCache.get(cacheKey(resolved, face)) ?? null;
}
