/**
 * RackPro — Fusion 360 Bridge HTTP Client
 *
 * Sends requests to the RackProBridge add-in running inside Fusion 360.
 * The add-in listens on localhost:9100.
 */

const BRIDGE_URL = 'http://localhost:9100';

export interface FusionPingResponse {
  ok: boolean;
  fusion_version?: string;
  document?: string | null;
}

export interface FusionBuildResponse {
  success: boolean;
  error?: string;
  features?: Array<{
    name: string;
    type: string;
    computed: boolean;
    error?: string;
  }>;
  bodies?: Array<{
    name: string;
    volume_cm3?: number;
    mass_g?: number;
    bbox?: { min: number[]; max: number[] };
    cog?: number[];
  }>;
  errors?: string[];
  warnings?: string[];
}

export interface FusionQueryResponse {
  success: boolean;
  error?: string;
  bodies?: Array<{
    name: string;
    visible: boolean;
    volume_cm3?: number | null;
    mass_g?: number | null;
    cog?: number[];
    bbox?: { min: number[]; max: number[] } | null;
  }>;
  features?: Array<{
    index: number;
    name: string;
    type: string;
    computed: boolean;
    suppressed: boolean;
    rolled_back: boolean;
  }>;
  interferences?: Array<{
    body1: string;
    body2: string;
    volume_cm3: number;
  }>;
  count?: number;
}

export interface FusionExportResponse {
  success: boolean;
  path?: string;
  size_bytes?: number;
  error?: string;
}

/**
 * Send a request to the Fusion 360 bridge.
 * Throws a descriptive error if the bridge is not running.
 */
export async function fusionRequest<T>(
  endpoint: string,
  body?: object,
  timeoutMs = 30000,
): Promise<T> {
  try {
    const res = await fetch(`${BRIDGE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const text = await res.text();
      let parsed: { error?: string } = {};
      try { parsed = JSON.parse(text); } catch {}
      throw new Error(parsed.error || `Bridge returned ${res.status}: ${text}`);
    }

    return await res.json() as T;
  } catch (err: unknown) {
    if (err instanceof TypeError) {
      const cause = (err as { cause?: { code?: string } }).cause;
      if (cause?.code === 'ECONNREFUSED') {
        throw new Error(
          'Cannot connect to Fusion 360 bridge (localhost:9100). ' +
          'Make sure Fusion 360 is running and the RackProBridge add-in is started. ' +
          'In Fusion: Utilities → Add-Ins → RackProBridge → Run'
        );
      }
    }
    throw err;
  }
}

/** Test connection to the Fusion 360 bridge. */
export function fusionPing(): Promise<FusionPingResponse> {
  return fusionRequest<FusionPingResponse>('/ping', undefined, 5000);
}

/** Build the model in Fusion 360 from an ExportConfig. */
export function fusionBuild(config: object, newDocument = false): Promise<FusionBuildResponse> {
  return fusionRequest<FusionBuildResponse>(
    '/build',
    { config, newDocument },
    120000, // 2 min timeout for complex builds
  );
}

/** Query physical properties of the current Fusion model. */
export function fusionQueryProperties(): Promise<FusionQueryResponse> {
  return fusionRequest<FusionQueryResponse>('/query', { what: 'properties' });
}

/** Query timeline features of the current Fusion model. */
export function fusionQueryFeatures(): Promise<FusionQueryResponse> {
  return fusionRequest<FusionQueryResponse>('/query', { what: 'features' });
}

/** Query body-to-body interference. */
export function fusionQueryInterference(): Promise<FusionQueryResponse> {
  return fusionRequest<FusionQueryResponse>('/query', { what: 'interference' });
}

/** Export the current Fusion model to a file. */
export function fusionExport(
  format: 'stl' | 'step' | 'dxf',
  path: string,
  bodyName?: string,
): Promise<FusionExportResponse> {
  return fusionRequest<FusionExportResponse>('/export', { format, path, bodyName });
}

/** Capture a screenshot of the Fusion viewport. */
export function fusionScreenshot(
  path: string,
  width = 1920,
  height = 1080,
): Promise<FusionExportResponse> {
  return fusionRequest<FusionExportResponse>('/screenshot', { path, width, height });
}
