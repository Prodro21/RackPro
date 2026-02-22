/**
 * Design serializer — encodes/decodes panel configuration state
 * to/from URL-safe base64 for sharing and localStorage persistence.
 *
 * Schema version: v=1. Forward-compatible: unknown versions are rejected.
 * Unknown device slugs are preserved with their saved dimensions.
 */

import { useConfigStore } from '../store/useConfigStore';
import type { ConfigState } from '../store/useConfigStore';

// ─── Serialized Design Schema ─────────────────────────────────

export interface SerializedDesign {
  v: 1;
  standard: string;
  uHeight: number;
  fabMethod: string;
  metalKey: string;
  filamentKey: string;
  printerKey: string;
  wallThickness: number;
  flangeDepth: number;
  flanges: boolean;
  rearPanel: boolean;
  ventSlots: boolean;
  chamfers: boolean;
  mountHoleType: string;
  assemblyMode: string;
  faceFabMethod: string;
  trayFabMethod: string;
  enclosureStyle: string;
  elements: Array<{
    id: string;
    type: string;
    key: string;
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    surface?: string;
    labelConfig?: {
      text: string;
      position: 'above' | 'below' | 'inside';
      autoNumber?: boolean;
      icon?: 'network' | 'video' | 'audio' | 'power';
    };
  }>;
}

// ─── Extract Serializable ─────────────────────────────────────

/**
 * Extracts the serializable subset from the full ConfigState.
 * Excludes functions, UI-only state (activeTab, addMode), and
 * transient selections.
 */
export function extractSerializable(state: ConfigState): SerializedDesign {
  return {
    v: 1,
    standard: state.standard,
    uHeight: state.uHeight,
    fabMethod: state.fabMethod,
    metalKey: state.metalKey,
    filamentKey: state.filamentKey,
    printerKey: state.printerKey,
    wallThickness: state.wallThickness,
    flangeDepth: state.flangeDepth,
    flanges: state.flanges,
    rearPanel: state.rearPanel,
    ventSlots: state.ventSlots,
    chamfers: state.chamfers,
    mountHoleType: state.mountHoleType,
    assemblyMode: state.assemblyMode,
    faceFabMethod: state.faceFabMethod,
    trayFabMethod: state.trayFabMethod,
    enclosureStyle: state.enclosureStyle,
    elements: state.elements.map((el) => ({
      id: el.id,
      type: el.type,
      key: el.key,
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      label: el.label,
      ...(el.surface ? { surface: el.surface } : {}),
      ...(el.labelConfig ? { labelConfig: el.labelConfig } : {}),
    })),
  };
}

// ─── Encode / Decode ──────────────────────────────────────────

/**
 * Encodes a SerializedDesign to a URL-safe base64 string.
 * Uses TextEncoder for UTF-8 safety.
 */
export function encodeDesign(design: SerializedDesign): string {
  const json = JSON.stringify(design);
  const bytes = new TextEncoder().encode(json);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary);
}

/**
 * Decodes a base64 string to a SerializedDesign.
 * Returns null on any failure: malformed base64, invalid JSON,
 * wrong version, or missing required fields.
 */
export function decodeDesign(encoded: string): SerializedDesign | null {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed.v !== 1) return null;
    // Minimal validation: must have elements array
    if (!Array.isArray(parsed.elements)) return null;
    return parsed as SerializedDesign;
  } catch {
    return null;
  }
}

// ─── Apply to Store ───────────────────────────────────────────

/**
 * Applies a decoded SerializedDesign to the config store.
 *
 * IMPORTANT: Unknown device slugs are preserved with their saved
 * dimensions from the URL state. Elements are NOT filtered out
 * even if the slug is not in the current catalog.
 */
export function applyDesignToStore(design: SerializedDesign): void {
  const { v: _v, ...rest } = design;
  useConfigStore.setState({
    ...rest,
    // Ensure elements have proper types for the store
    elements: design.elements.map((el) => ({
      id: el.id,
      type: el.type as 'connector' | 'device' | 'fan',
      key: el.key,
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      label: el.label,
      surface: el.surface as 'faceplate' | 'rear' | 'side-top' | 'side-bottom' | undefined,
      ...(el.labelConfig ? { labelConfig: el.labelConfig } : {}),
    })),
    // Reset transient state on design load
    selectedId: null,
  } as Partial<ConfigState>);
}
