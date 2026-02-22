/**
 * Design persistence — localStorage auto-save with debounced writes
 * and URL-based design sharing via base64-encoded hash parameter.
 *
 * Two concerns:
 * A) Auto-save to localStorage (debounced 500ms)
 * B) Initial state load from URL param or localStorage
 *
 * URL format: #/?design=<base64>  (hash history parameter)
 * URL wins on load. Toast offers to restore localStorage design.
 */

import { useEffect } from 'react';
import { useConfigStore } from '../store/useConfigStore';
import {
  extractSerializable,
  encodeDesign,
  decodeDesign,
  applyDesignToStore,
} from '../lib/designSerializer';
import { showToast } from '../components/Toast';

// ─── Constants ────────────────────────────────────────────────

const STORAGE_KEY = 'rackpro-design';
const DEBOUNCE_MS = 500;

// ─── Part A: localStorage Auto-Save ───────────────────────────

/**
 * Subscribe to config store changes and auto-save to localStorage
 * with debounced writes. Returns unsubscribe function.
 */
export function initDesignPersistence(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const unsubscribe = useConfigStore.subscribe((state) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const serializable = extractSerializable(state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
      } catch {
        // Quota exceeded — silent fail
      }
    }, DEBOUNCE_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

// ─── Part B: Restore from localStorage ────────────────────────

/**
 * Reads design from localStorage and applies to store.
 * Returns true if successfully restored.
 */
export function restoreFromLocalStorage(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.elements)) return false;
    applyDesignToStore(parsed);
    return true;
  } catch {
    return false;
  }
}

// ─── Part C: Initial Load Logic ───────────────────────────────

/**
 * Load initial design from URL hash or localStorage.
 * URL wins if present. Shows toast offering to restore localStorage version.
 */
function loadInitialDesign(): void {
  // Parse URL hash for design search param.
  // With TanStack Router hash history, URL is: #/?design=... or #/catalog?design=...
  const hashContent = window.location.hash.slice(1); // remove leading #
  const queryIndex = hashContent.indexOf('?');
  const searchStr = queryIndex >= 0 ? hashContent.slice(queryIndex) : '';
  const params = new URLSearchParams(searchStr);
  const designParam = params.get('design');

  if (designParam) {
    const design = decodeDesign(designParam);
    if (design) {
      applyDesignToStore(design);

      // Show toast offering to restore localStorage design
      showToast('Loaded shared design. Your saved design is still available.', {
        label: 'Restore saved',
        onClick: () => restoreFromLocalStorage(),
      });

      // Clean up: remove design param from URL to prevent re-loading on refresh.
      // Use replaceState to strip the param without triggering TanStack Router navigation.
      params.delete('design');
      const remainingSearch = params.toString();
      const pathPart = queryIndex >= 0 ? hashContent.slice(0, queryIndex) : hashContent;
      const newHash = remainingSearch ? `${pathPart}?${remainingSearch}` : pathPart;
      window.history.replaceState(null, '', `#${newHash}`);

      return; // skip localStorage load
    }
  }

  // No URL design param — restore from localStorage
  restoreFromLocalStorage();
}

// ─── Part D: Share URL Generator ──────────────────────────────

/**
 * Generate a share URL with the current design encoded as base64
 * in the URL hash fragment.
 */
export function generateShareUrl(): string {
  const state = useConfigStore.getState();
  const design = extractSerializable(state);
  const encoded = encodeDesign(design);
  const base = window.location.href.split('#')[0];
  return `${base}#/?design=${encoded}`;
}

// ─── Part E: React Hook ───────────────────────────────────────

/**
 * React hook that initializes design persistence.
 * Call once in the root layout.
 *
 * On mount: loads initial design (URL or localStorage), starts auto-save.
 * On unmount: stops auto-save subscription.
 */
export function useDesignPersistence(): void {
  useEffect(() => {
    // Load initial design (URL or localStorage)
    loadInitialDesign();

    // Start auto-save subscription
    const unsubscribe = initDesignPersistence();
    return unsubscribe;
  }, []);
}
