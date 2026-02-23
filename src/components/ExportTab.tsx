import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectNeedsSplit, selectSplitInfo, selectBendAllowance90, selectPrinter, selectAssemblyMode, selectFaceFabMethod, selectTrayFabMethod } from '../store';
import { estimatePrintCost, estimateSheetMetalCost, FILAMENT_DENSITY, DEFAULT_FILAMENT_PRICES, DEFAULT_FILL_FACTOR, SHEET_METAL_RATE_PER_CM2, FABRICATOR_URLS, type CostEstimate } from '../lib/costEstimation';
import { METALS, FILAMENTS, bendAllowance90 as computeBendAllowance90 } from '../constants/materials';
import { generateConfig, exportJSON, downloadFile } from '../export/configJson';
import { generateOpenSCAD } from '../export/openscadGen';
import { generateFusion360 } from '../export/fusion360Gen';
import { generateDXF, generateTrayDXF } from '../export/dxfGen';
import { generateProductionDocs } from '../export/productionDocs';
import { fusionPing, fusionBuild, fusionExport, fusionScreenshot, fusionQueryProperties, type FusionBuildResponse, type FusionExportResponse, type FusionQueryResponse } from '../mcp/fusion-client';
import { generateShareUrl } from '../hooks/useDesignPersistence';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { PreflightReport } from './PreflightReport';
import { validateExportConfig } from '../lib/validation';
import type { ValidationResult } from '../lib/validation';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold text-muted-foreground tracking-wide uppercase mb-2 mt-4 first:mt-0">
      {children}
    </div>
  );
}

function ExportCard({ title, desc, action, onClick, action2, onClick2, note, tooltip }: {
  title: string; desc: string; action?: string; onClick?: () => void; action2?: string; onClick2?: () => void; note?: string; tooltip?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 mb-2">
      {tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="font-bold text-sm text-foreground cursor-help">{title}</div>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      ) : (
        <div className="font-bold text-sm text-foreground">{title}</div>
      )}
      <div className="text-xs text-muted-foreground my-1">{desc}</div>
      <div className="flex gap-2 items-center">
        {action && (
          <Button
            onClick={onClick}
            disabled={!onClick}
            size="xs"
            variant="default"
            className="text-xs font-semibold"
          >
            {action}
          </Button>
        )}
        {action2 && (
          <Button
            onClick={onClick2}
            disabled={!onClick2}
            size="xs"
            variant="outline"
            className="text-xs font-semibold"
          >
            {action2}
          </Button>
        )}
      </div>
      {note && <div className="text-xs text-muted-foreground mt-1 italic">{note}</div>}
    </div>
  );
}

export function ExportTab() {
  const [copied, setCopied] = useState<string | null>(null);
  const fabMethod = useConfigStore(s => s.fabMethod);
  const flangeDepth = useConfigStore(s => s.flangeDepth);
  const rearPanel = useConfigStore(s => s.rearPanel);
  const elements = useConfigStore(s => s.elements);
  const needsSplit = useConfigStore(selectNeedsSplit);
  const splitInfo = useConfigStore(selectSplitInfo);
  const depth = useConfigStore(selectEnclosureDepth);
  const ba90 = useConfigStore(selectBendAllowance90);
  const panDims = useConfigStore(selectPanelDims);
  const panH = useConfigStore(selectPanelHeight);
  const printer = useConfigStore(selectPrinter);
  const assemblyMode = useConfigStore(selectAssemblyMode);
  const faceFab = useConfigStore(selectFaceFabMethod);
  const trayFab = useConfigStore(selectTrayFabMethod);
  const isModular = assemblyMode === 'modular';
  const filamentKey = useConfigStore(s => s.filamentKey);
  const metalKey = useConfigStore(s => s.metalKey);
  const filamentPriceOverrides = useConfigStore(s => s.filamentPriceOverrides);
  const wallThickness = useConfigStore(s => s.wallThickness);

  // Compute cost estimates for both fab methods (for comparison toggle)
  const [showCompare, setShowCompare] = useState(false);

  const currentCost = useMemo((): CostEstimate | null => {
    if (fabMethod === '3dp') {
      const density = FILAMENT_DENSITY[filamentKey] ?? 1.24;
      const pricePerKg = filamentPriceOverrides[filamentKey] ?? DEFAULT_FILAMENT_PRICES[filamentKey] ?? 22;
      const fil = FILAMENTS[filamentKey];
      return estimatePrintCost({
        panelWidth: panDims.totalWidth,
        panelHeight: panH,
        enclosureDepth: depth,
        fillFactor: DEFAULT_FILL_FACTOR,
        materialDensity: density,
        pricePerKg,
        materialName: fil?.name ?? filamentKey,
      });
    } else {
      const mt = METALS[metalKey];
      if (!mt) return null;
      const ba = computeBendAllowance90(mt.br, mt.t, 0.40);
      const flatW = panDims.totalWidth + 2 * (flangeDepth + ba);
      const flatH = panH + 2 * (flangeDepth + ba);
      const rate = SHEET_METAL_RATE_PER_CM2[metalKey] ?? 0.07;
      return estimateSheetMetalCost({ flatWidth: flatW, flatHeight: flatH, ratePerCm2: rate, materialName: mt.name });
    }
  }, [fabMethod, filamentKey, metalKey, filamentPriceOverrides, panDims.totalWidth, panH, depth, flangeDepth]);

  const compareCost = useMemo((): CostEstimate | null => {
    if (!showCompare) return null;
    // Compute the OTHER fab method
    if (fabMethod === '3dp') {
      // Compare: sheet metal
      const mt = METALS[metalKey];
      if (!mt) return null;
      const ba = computeBendAllowance90(mt.br, mt.t, 0.40);
      const flatW = panDims.totalWidth + 2 * (flangeDepth + ba);
      const flatH = panH + 2 * (flangeDepth + ba);
      const rate = SHEET_METAL_RATE_PER_CM2[metalKey] ?? 0.07;
      return estimateSheetMetalCost({ flatWidth: flatW, flatHeight: flatH, ratePerCm2: rate, materialName: mt.name });
    } else {
      // Compare: 3D print
      const density = FILAMENT_DENSITY[filamentKey] ?? 1.24;
      const pricePerKg = filamentPriceOverrides[filamentKey] ?? DEFAULT_FILAMENT_PRICES[filamentKey] ?? 22;
      const fil = FILAMENTS[filamentKey];
      return estimatePrintCost({
        panelWidth: panDims.totalWidth,
        panelHeight: panH,
        enclosureDepth: depth,
        fillFactor: DEFAULT_FILL_FACTOR,
        materialDensity: density,
        pricePerKg,
        materialName: fil?.name ?? filamentKey,
      });
    }
  }, [showCompare, fabMethod, filamentKey, metalKey, filamentPriceOverrides, panDims.totalWidth, panH, depth, flangeDepth]);

  // Preflight validation state
  const [preflightResult, setPreflightResult] = useState<ValidationResult | null>(null);

  const runPreflight = useCallback(() => {
    const config = generateConfig();
    const result = validateExportConfig(config);
    setPreflightResult(result);
    // Map validation issue elementIds (key-index format) to PanelElement.id values
    // for FrontView red highlighting. The store elements array matches config.elements
    // order, so we extract indices from issue IDs and look up the actual element IDs.
    const storeElements = useConfigStore.getState().elements;
    const panelElementIds = new Set<string>();
    for (const issue of result.issues) {
      // elementId format is "key-index", extract the index
      const lastDash = issue.elementId.lastIndexOf('-');
      const idx = parseInt(issue.elementId.slice(lastDash + 1), 10);
      if (!isNaN(idx) && idx >= 0 && idx < storeElements.length) {
        panelElementIds.add(storeElements[idx].id);
      }
    }
    useConfigStore.getState().setValidationIssueIds([...panelElementIds]);
    return result;
  }, []);

  // Position-sensitive key so preflight re-runs on moves, not just count changes
  const positionKey = useMemo(
    () => elements.map(e => `${e.id}:${e.x}:${e.y}`).join(','),
    [elements],
  );

  // Run preflight on mount and when element positions or fab method change
  useEffect(() => {
    runPreflight();
    return () => {
      useConfigStore.getState().setValidationIssueIds([]);
    };
  }, [positionKey, fabMethod, runPreflight]);

  /** Gate function: re-runs validation and returns true if export is allowed. */
  const checkBeforeExport = useCallback((): boolean => {
    const result = runPreflight();
    if (result.hasCritical) {
      toast(`Export blocked: ${result.summary.critical} critical issue(s) found`);
      return false;
    }
    return true;
  }, [runPreflight]);

  // Fusion 360 bridge state
  const [bridgeStatus, setBridgeStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [bridgeDoc, setBridgeDoc] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [buildResult, setBuildResult] = useState<FusionBuildResponse | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

  // Fusion export state
  const [exportPath, setExportPath] = useState('~/Desktop/rackpro-panel');
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<string | null>(null);
  const [physProps, setPhysProps] = useState<FusionQueryResponse | null>(null);

  const checkBridge = useCallback(async () => {
    try {
      const res = await fusionPing();
      setBridgeStatus(res.ok ? 'connected' : 'disconnected');
      setBridgeDoc(res.document ?? null);
    } catch {
      setBridgeStatus('disconnected');
      setBridgeDoc(null);
    }
  }, []);

  // Check bridge on mount and every 10s
  useEffect(() => {
    checkBridge();
    const iv = setInterval(checkBridge, 10000);
    return () => clearInterval(iv);
  }, [checkBridge]);

  const handleBuildInFusion = async () => {
    setBuilding(true);
    setBuildResult(null);
    setBuildError(null);
    try {
      const config = getConfig();
      const res = await fusionBuild(config);
      setBuildResult(res);
      if (!res.success) {
        setBuildError(res.errors?.join('; ') ?? 'Build failed');
      } else {
        // Auto-fetch physical properties after successful build
        handleFetchProperties();
      }
    } catch (err: unknown) {
      setBuildError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setBuilding(false);
    }
  };

  const handleFusionExport = async (format: 'stl' | 'step') => {
    setExporting(format);
    setExportResult(null);
    try {
      const path = `${exportPath}.${format}`;
      const res = await fusionExport(format, path);
      if (res.success) {
        setExportResult(`${format.toUpperCase()} saved: ${res.path ?? path} (${((res.size_bytes ?? 0) / 1024).toFixed(0)} KB)`);
      } else {
        setExportResult(`Export failed: ${res.error ?? 'Unknown error'}`);
      }
    } catch (err: unknown) {
      setExportResult(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  };

  const handleFusionScreenshot = async () => {
    setExporting('screenshot');
    setExportResult(null);
    try {
      const path = `${exportPath}.png`;
      const res = await fusionScreenshot(path);
      if (res.success) {
        setExportResult(`Screenshot saved: ${res.path ?? path}`);
      } else {
        setExportResult(`Screenshot failed: ${res.error ?? 'Unknown error'}`);
      }
    } catch (err: unknown) {
      setExportResult(`Screenshot failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  };

  const handleFetchProperties = async () => {
    try {
      const res = await fusionQueryProperties();
      setPhysProps(res);
    } catch {
      setPhysProps(null);
    }
  };

  // Auto-fetch properties after successful build
  const handleBuildAndProps = async () => {
    await handleBuildInFusion();
  };

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const getConfig = () => generateConfig();
  const getJSON = () => exportJSON(getConfig());

  const copyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    flash(key);
  };

  const downloadJSON = () => {
    if (!checkBeforeExport()) return;
    downloadFile(getJSON(), 'rack-config.json', 'application/json');
  };

  const copyOpenSCAD = () => {
    if (!checkBeforeExport()) return;
    const config = getConfig();
    const scad = generateOpenSCAD(config);
    copyText(scad, 'scad');
  };

  const downloadOpenSCAD = () => {
    if (!checkBeforeExport()) return;
    const config = getConfig();
    const scad = generateOpenSCAD(config);
    downloadFile(scad, 'rackmount.scad', 'text/plain');
  };

  const copyFusion360 = () => {
    if (!checkBeforeExport()) return;
    const config = getConfig();
    const py = generateFusion360(config);
    copyText(py, 'fusion');
  };

  const downloadFusion360 = () => {
    if (!checkBeforeExport()) return;
    const config = getConfig();
    const py = generateFusion360(config);
    downloadFile(py, 'rackmount_fusion360.py', 'text/x-python');
  };

  const downloadDXF = () => {
    if (!checkBeforeExport()) return;
    const config = getConfig();
    const dxf = generateDXF(config);
    downloadFile(dxf, 'rackmount-flat.dxf', 'application/dxf');
  };

  const downloadTrayDXF = (elementIndex: number) => {
    if (!checkBeforeExport()) return;
    const config = getConfig();
    const el = config.elements[elementIndex];
    const dxf = generateTrayDXF(config, elementIndex);
    const slug = el.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadFile(dxf, `tray-${slug}.dxf`, 'application/dxf');
  };

  const downloadProductionDocs = () => {
    if (!checkBeforeExport()) return;
    const config = getConfig();
    const md = generateProductionDocs(config);
    downloadFile(md, 'rackpro-production-notes.md', 'text/markdown');
  };

  const handleCopyShareUrl = useCallback(async () => {
    const url = generateShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast('Share URL copied to clipboard');
    } catch {
      // Fallback for browsers that block clipboard API
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      toast('Share URL copied to clipboard');
    }
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-[680px]">
      {/* Share Design */}
      <SectionLabel>SHARE</SectionLabel>
      <ExportCard
        title="Copy Share URL"
        desc="Copy a link that recreates this exact design in any browser"
        action={copied === 'share' ? 'Copied!' : 'Copy Share URL'}
        onClick={() => { handleCopyShareUrl(); flash('share'); }}
        note="Design is encoded in the URL — no server required"
      />

      {/* Preflight Validation Report */}
      {preflightResult && (
        <PreflightReport
          result={preflightResult}
          onProceed={() => {
            // Generic proceed — user can download any format below
            if (preflightResult.hasCritical) {
              toast(`Export blocked: ${preflightResult.summary.critical} critical issue(s)`);
            }
          }}
          format="All Formats"
        />
      )}

      {/* Cost Breakdown */}
      {currentCost && (
        <div className="bg-card border border-border rounded-lg p-4 mb-3">
          <SectionLabel>COST ESTIMATE</SectionLabel>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-xl font-bold text-foreground">
              ~${currentCost.low.toFixed(0)}&ndash;${currentCost.high.toFixed(0)}
            </span>
            <span className="text-xs text-muted-foreground">
              {fabMethod === '3dp' ? 'FDM 3D Print' : 'Sheet Metal'}
            </span>
          </div>

          {/* Assumptions */}
          <div className="space-y-1 mb-3">
            {currentCost.assumptions.map((a, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{a.label}</span>
                <span className="text-foreground/80 font-mono">{a.value}</span>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground/70 italic mb-3">
            Estimate only -- actual cost varies by print settings, supports, and waste. Get an exact quote from a fabrication service.
          </div>

          {/* Fabricator links (sheet metal) */}
          {fabMethod === 'sm' && (
            <div className="flex gap-2 mb-3">
              <a
                href={FABRICATOR_URLS.sendcutsend}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-primary hover:underline"
              >
                Get Quote: SendCutSend
              </a>
              <span className="text-muted-foreground/30">|</span>
              <a
                href={FABRICATOR_URLS.protocase}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-primary hover:underline"
              >
                Get Quote: Protocase
              </a>
            </div>
          )}

          {/* Compare toggle */}
          <button
            onClick={() => setShowCompare(p => !p)}
            className="text-xs text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
          >
            {showCompare ? 'Hide comparison' : `Compare: ${fabMethod === '3dp' ? 'Sheet Metal' : '3D Print'}`}
          </button>

          {showCompare && compareCost && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-base font-bold text-foreground/70">
                  ~${compareCost.low.toFixed(0)}&ndash;${compareCost.high.toFixed(0)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fabMethod === '3dp' ? 'Sheet Metal' : 'FDM 3D Print'}
                </span>
              </div>
              <div className="space-y-1 mb-2">
                {compareCost.assumptions.map((a, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{a.label}</span>
                    <span className="text-foreground/80 font-mono">{a.value}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground/70 italic">
                Estimate only -- actual cost varies by fabrication service, material availability, and quantity.
              </div>
              {/* Show fab links for the compared method too if it's SM */}
              {fabMethod !== 'sm' && (
                <div className="flex gap-2 mt-2">
                  <a
                    href={FABRICATOR_URLS.sendcutsend}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Get Quote: SendCutSend
                  </a>
                  <span className="text-muted-foreground/30">|</span>
                  <a
                    href={FABRICATOR_URLS.protocase}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Get Quote: Protocase
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <SectionLabel>EXPORT</SectionLabel>

      {/* JSON Config */}
      <ExportCard
        title="JSON Config"
        desc="Complete parametric config: panel + enclosure + cutouts + split + fabrication params. Drives OpenSCAD and Fusion 360 generators."
        action={copied === 'json' ? 'Copied!' : 'Copy JSON'}
        onClick={() => copyText(getJSON(), 'json')}
        action2="Download .json"
        onClick2={downloadJSON}
        tooltip="Machine-readable configuration for scripting and automation"
      />

      {/* OpenSCAD */}
      {fabMethod === '3dp' && (
        <ExportCard
          title="OpenSCAD (.scad)"
          desc={`BOSL2-dependent parametric model. ${needsSplit ? `${splitInfo.type} split with ${splitInfo.joint} joints.` : 'Single-piece.'} Includes faceplate, ears, bores, cutouts, enclosure walls, flanges${elements.filter(e => e.type === 'device').length > 0 ? ', device trays' : ''}${rearPanel ? ', rear panel' : ''}.`}
          action={copied === 'scad' ? 'Copied!' : 'Copy .scad'}
          onClick={copyOpenSCAD}
          action2="Download .scad"
          onClick2={downloadOpenSCAD}
          note="Requires BOSL2 library: github.com/BelfrySCAD/BOSL2"
          tooltip="Parametric 3D model using BOSL2 library. Requires OpenSCAD installed."
        />
      )}

      {/* STL Instructions */}
      {fabMethod === '3dp' && (
        <ExportCard
          title={`STL \u2192 ${printer.name}`}
          desc={`Open .scad in OpenSCAD \u2192 F6 (Render) \u2192 Export STL. ${needsSplit ? `Export ${splitInfo.parts.length} pieces separately.` : 'Single-piece export.'} Slice in BambuStudio / PrusaSlicer with PETG, 25% gyroid infill, face-down on bed.`}
        />
      )}

      {/* Fusion 360 Bridge — live build */}
      <div className="bg-card border border-border rounded-lg p-4 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-bold text-foreground">Fusion 360 Bridge</div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${bridgeStatus === 'connected' ? 'bg-green-500' : bridgeStatus === 'disconnected' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
            <span className="text-xs text-muted-foreground">
              {bridgeStatus === 'connected' ? `Connected${bridgeDoc ? ` \u2014 ${bridgeDoc}` : ''}` : bridgeStatus === 'disconnected' ? 'Not connected' : 'Checking...'}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground mb-2">
          Build directly in Fusion 360 via the RackProBridge add-in (localhost:9100).
          {bridgeStatus === 'disconnected' && (
            <span className="text-muted-foreground/60"> Start it in Fusion: Utilities → Add-Ins → RackProBridge → Run</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={handleBuildInFusion}
            disabled={bridgeStatus !== 'connected' || building}
            size="xs"
            className="text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {building ? 'Building...' : 'Build in Fusion'}
          </Button>
          <Button
            onClick={() => handleFusionExport('stl')}
            disabled={bridgeStatus !== 'connected' || !buildResult?.success || !!exporting}
            size="xs"
            variant="outline"
            className="text-xs font-bold text-green-500"
          >
            {exporting === 'stl' ? 'Exporting...' : 'Export STL'}
          </Button>
          <Button
            onClick={() => handleFusionExport('step')}
            disabled={bridgeStatus !== 'connected' || !buildResult?.success || !!exporting}
            size="xs"
            variant="outline"
            className="text-xs font-bold text-[#4a90d9]"
          >
            {exporting === 'step' ? 'Exporting...' : 'Export STEP'}
          </Button>
          <Button
            onClick={handleFusionScreenshot}
            disabled={bridgeStatus !== 'connected' || !!exporting}
            size="xs"
            variant="outline"
            className="text-xs text-muted-foreground"
          >
            {exporting === 'screenshot' ? 'Capturing...' : 'Screenshot'}
          </Button>
          <Button
            onClick={checkBridge}
            size="xs"
            variant="outline"
            className="text-xs text-muted-foreground"
          >
            Refresh
          </Button>
        </div>

        {/* Export path input */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground shrink-0">Path:</span>
          <Input
            type="text"
            value={exportPath}
            onChange={e => setExportPath(e.target.value)}
            className="flex-1 h-8 px-2 py-1 text-xs font-mono"
            placeholder="~/Desktop/rackpro-panel"
          />
        </div>

        {buildResult && buildResult.success && (
          <div className="mt-2 text-xs text-green-500">
            Build complete — {buildResult.bodies?.length ?? 0} bodies, {buildResult.features?.length ?? 0} features
            {buildResult.warnings && buildResult.warnings.length > 0 && (
              <div className="text-primary mt-1">{buildResult.warnings.join('; ')}</div>
            )}
          </div>
        )}
        {buildError && (
          <div className="mt-2 text-xs text-destructive">{buildError}</div>
        )}
        {exportResult && (
          <div className="mt-1 text-xs text-[#4a90d9]">{exportResult}</div>
        )}

        {/* Physical properties after build */}
        {physProps?.success && physProps.bodies && physProps.bodies.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <div className="text-xs text-muted-foreground tracking-wide mb-1">PHYSICAL PROPERTIES</div>
            {physProps.bodies.map((body, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-t border-border first:border-t-0">
                <span className="text-foreground/80">{body.name}</span>
                <span className="text-muted-foreground">
                  {body.mass_g != null ? `${body.mass_g.toFixed(1)}g` : ''}
                  {body.volume_cm3 != null ? ` / ${body.volume_cm3.toFixed(2)}cm\u00b3` : ''}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-1 border-t border-border mt-1">
              <span className="text-primary font-bold">Total</span>
              <span className="text-primary font-bold">
                {physProps.bodies.reduce((s, b) => s + (b.mass_g ?? 0), 0).toFixed(1)}g
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Fusion 360 */}
      <ExportCard
        title="Fusion 360 Script (.py)"
        desc={`Python API script generates: faceplate + ${flangeDepth}mm flanges + ${depth.toFixed(0)}mm enclosure + EIA-310 bores + all cutouts${elements.filter(e => e.type === 'device').length > 0 ? ' + device trays' : ''}. ${fabMethod === 'sm' ? 'Sheet metal body with bend features.' : 'Solid body for 3D printing.'}`}
        action={copied === 'fusion' ? 'Copied!' : 'Copy .py'}
        onClick={copyFusion360}
        action2="Download .py"
        onClick2={downloadFusion360}
        note="Run via: Utilities \u2192 Scripts and Add-Ins \u2192 Run"
        tooltip="Python API script for Autodesk Fusion 360 parametric modeling"
      />

      {/* DXF Flat Pattern */}
      {fabMethod === 'sm' && (
        <ExportCard
          title="DXF Flat Pattern"
          desc={`ASCII DXF R12 with layers: 0-OUTLINE (cut), 1-BEND (fold), 2-CUTOUTS (holes), 3-DIMS (annotations). Est. flat: ${(panDims.totalWidth + 2 * (flangeDepth + ba90)).toFixed(0)} \u00d7 ${(panH + 2 * (flangeDepth + ba90)).toFixed(0)}mm`}
          action="Download .dxf"
          onClick={downloadDXF}
          note="Open in LibreCAD, DraftSight, or upload to SendCutSend/Protocase"
          tooltip="Flat pattern for laser cutting. Import into SendCutSend or Protocase."
        />
      )}

      {/* Device Tray DXF Flat Patterns */}
      {fabMethod === 'sm' && elements.filter(e => e.type === 'device').length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 mb-3">
          <div className="text-sm font-bold text-foreground mb-1">Device Tray DXFs</div>
          <div className="text-xs text-muted-foreground mb-2">
            Cruciform flat patterns for laser-cut sheet metal trays. Each tray has a floor, side walls, rear wall, and front mounting tab with M3 holes.
          </div>
          <div className="flex gap-2 flex-wrap">
            {elements.map((el, i) =>
              el.type === 'device' ? (
                <Button
                  key={el.id}
                  onClick={() => downloadTrayDXF(i)}
                  size="xs"
                  variant="outline"
                  className="text-xs font-bold text-green-500"
                >
                  {el.label} Tray .dxf
                </Button>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* Modular Assembly Info */}
      {isModular && (
        <ExportCard
          title="Modular Assembly"
          desc={`Faceplate (${faceFab === 'sm' ? 'Sheet Metal' : '3D Print'}) + ${elements.filter(e => e.type === 'device').length} device tray(s) (${trayFab === 'sm' ? 'Sheet Metal' : '3D Print'}). Trays slide in from rear and fasten with M3 screws via mounting bosses.${faceFab === 'sm' ? ' DXF includes 4-MOUNT layer with M3 mounting holes.' : ''}`}
        />
      )}

      {/* Production Notes */}
      <ExportCard
        title="Production Notes (.md)"
        desc={`Markdown doc with critical dimensions, cutout schedule, hardware BOM, ${fabMethod === '3dp' ? 'print settings, ' : 'sheet metal specs, '}and assembly instructions.`}
        action="Download .md"
        onClick={downloadProductionDocs}
      />

      {/* Fab Service */}
      <ExportCard
        title="Fabrication Services"
        desc={fabMethod === 'sm'
          ? 'Upload STEP/DXF: Protocase (instant quote), SendCutSend (laser+bend), PCBWay (sheet metal)'
          : 'STL \u2192 PCBWay (SLS/MJF/FDM), JLCPCB (3D printing service), or slice locally for FDM'
        }
      />

      {/* Config Preview */}
      {elements.length > 0 && (
        <div className="mt-4 bg-card border border-border rounded-lg p-4">
          <SectionLabel>CONFIG PREVIEW</SectionLabel>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-all max-h-[260px] overflow-auto m-0 font-mono">{getJSON()}</pre>
        </div>
      )}
    </div>
  );
}
