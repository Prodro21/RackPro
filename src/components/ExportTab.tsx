import { useState, useEffect, useCallback, useMemo } from 'react';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectEnclosureDepth, selectNeedsSplit, selectSplitInfo, selectBendAllowance90, selectPrinter, selectAssemblyMode, selectFaceFabMethod, selectTrayFabMethod } from '../store';
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
import { PreflightReport } from './PreflightReport';
import { validateExportConfig } from '../lib/validation';
import type { ValidationResult } from '../lib/validation';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8px] font-bold text-muted-foreground tracking-[.12em] uppercase mb-[5px] mt-2">
      {children}
    </div>
  );
}

function ExportCard({ title, desc, action, onClick, action2, onClick2, note }: {
  title: string; desc: string; action?: string; onClick?: () => void; action2?: string; onClick2?: () => void; note?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[5px] p-3 mb-2">
      <div className="font-bold text-[11px] text-foreground">{title}</div>
      <div className="text-[9px] text-muted-foreground my-1">{desc}</div>
      <div className="flex gap-[6px] items-center">
        {action && (
          <Button
            onClick={onClick}
            disabled={!onClick}
            size="xs"
            variant="default"
            className="text-[9px] font-semibold font-mono"
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
            className="text-[9px] font-semibold font-mono"
          >
            {action2}
          </Button>
        )}
      </div>
      {note && <div className="text-[8px] text-muted-foreground mt-1 italic">{note}</div>}
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

  // Run preflight on mount and when elements or fab method change
  useEffect(() => {
    runPreflight();
  }, [elements.length, fabMethod, runPreflight]);

  // Clear validation IDs when unmounting (leaving export tab)
  useEffect(() => {
    return () => {
      useConfigStore.getState().setValidationIssueIds([]);
    };
  }, []);

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

      <SectionLabel>EXPORT</SectionLabel>

      {/* JSON Config */}
      <ExportCard
        title="JSON Config"
        desc="Complete parametric config: panel + enclosure + cutouts + split + fabrication params. Drives OpenSCAD and Fusion 360 generators."
        action={copied === 'json' ? 'Copied!' : 'Copy JSON'}
        onClick={() => copyText(getJSON(), 'json')}
        action2="Download .json"
        onClick2={downloadJSON}
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
      <div className="bg-card border border-border rounded-[5px] p-[14px] mb-[10px]">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[11px] font-bold text-foreground">Fusion 360 Bridge</div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-[6px] h-[6px] rounded-full ${bridgeStatus === 'connected' ? 'bg-green-500' : bridgeStatus === 'disconnected' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
            <span className="text-[8px] text-muted-foreground">
              {bridgeStatus === 'connected' ? `Connected${bridgeDoc ? ` \u2014 ${bridgeDoc}` : ''}` : bridgeStatus === 'disconnected' ? 'Not connected' : 'Checking...'}
            </span>
          </div>
        </div>
        <div className="text-[9px] text-muted-foreground mb-2">
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
            className="text-[9px] font-bold font-mono bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {building ? 'Building...' : 'Build in Fusion'}
          </Button>
          <Button
            onClick={() => handleFusionExport('stl')}
            disabled={bridgeStatus !== 'connected' || !buildResult?.success || !!exporting}
            size="xs"
            variant="outline"
            className="text-[9px] font-bold font-mono text-green-500"
          >
            {exporting === 'stl' ? 'Exporting...' : 'Export STL'}
          </Button>
          <Button
            onClick={() => handleFusionExport('step')}
            disabled={bridgeStatus !== 'connected' || !buildResult?.success || !!exporting}
            size="xs"
            variant="outline"
            className="text-[9px] font-bold font-mono text-[#4a90d9]"
          >
            {exporting === 'step' ? 'Exporting...' : 'Export STEP'}
          </Button>
          <Button
            onClick={handleFusionScreenshot}
            disabled={bridgeStatus !== 'connected' || !!exporting}
            size="xs"
            variant="outline"
            className="text-[9px] font-mono text-muted-foreground"
          >
            {exporting === 'screenshot' ? 'Capturing...' : 'Screenshot'}
          </Button>
          <Button
            onClick={checkBridge}
            size="xs"
            variant="outline"
            className="text-[9px] font-mono text-muted-foreground"
          >
            Refresh
          </Button>
        </div>

        {/* Export path input */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[8px] text-muted-foreground shrink-0">Path:</span>
          <Input
            type="text"
            value={exportPath}
            onChange={e => setExportPath(e.target.value)}
            className="flex-1 h-6 px-2 py-[3px] text-[9px] font-mono"
            placeholder="~/Desktop/rackpro-panel"
          />
        </div>

        {buildResult && buildResult.success && (
          <div className="mt-2 text-[9px] text-green-500">
            Build complete — {buildResult.bodies?.length ?? 0} bodies, {buildResult.features?.length ?? 0} features
            {buildResult.warnings && buildResult.warnings.length > 0 && (
              <div className="text-primary mt-1">{buildResult.warnings.join('; ')}</div>
            )}
          </div>
        )}
        {buildError && (
          <div className="mt-2 text-[9px] text-destructive">{buildError}</div>
        )}
        {exportResult && (
          <div className="mt-1 text-[9px] text-[#4a90d9]">{exportResult}</div>
        )}

        {/* Physical properties after build */}
        {physProps?.success && physProps.bodies && physProps.bodies.length > 0 && (
          <div className="mt-2 border-t border-border pt-2">
            <div className="text-[8px] text-muted-foreground tracking-[.08em] mb-1">PHYSICAL PROPERTIES</div>
            {physProps.bodies.map((body, i) => (
              <div key={i} className="flex justify-between text-[9px] py-[1px]">
                <span className="text-foreground/80">{body.name}</span>
                <span className="text-muted-foreground">
                  {body.mass_g != null ? `${body.mass_g.toFixed(1)}g` : ''}
                  {body.volume_cm3 != null ? ` / ${body.volume_cm3.toFixed(2)}cm\u00b3` : ''}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-[9px] pt-1 border-t border-border mt-1">
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
      />

      {/* DXF Flat Pattern */}
      {fabMethod === 'sm' && (
        <ExportCard
          title="DXF Flat Pattern"
          desc={`ASCII DXF R12 with layers: 0-OUTLINE (cut), 1-BEND (fold), 2-CUTOUTS (holes), 3-DIMS (annotations). Est. flat: ${(panDims.totalWidth + 2 * (flangeDepth + ba90)).toFixed(0)} \u00d7 ${(panH + 2 * (flangeDepth + ba90)).toFixed(0)}mm`}
          action="Download .dxf"
          onClick={downloadDXF}
          note="Open in LibreCAD, DraftSight, or upload to SendCutSend/Protocase"
        />
      )}

      {/* Device Tray DXF Flat Patterns */}
      {fabMethod === 'sm' && elements.filter(e => e.type === 'device').length > 0 && (
        <div className="bg-card border border-border rounded-[5px] p-[14px] mb-[10px]">
          <div className="text-[11px] font-bold text-foreground mb-1">Device Tray DXFs</div>
          <div className="text-[9px] text-muted-foreground mb-2">
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
                  className="text-[9px] font-bold font-mono text-green-500"
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
        <div className="mt-[14px] bg-card border border-border rounded-[5px] p-[14px]">
          <SectionLabel>CONFIG PREVIEW</SectionLabel>
          <pre className="text-[8px] text-muted-foreground whitespace-pre-wrap break-all max-h-[260px] overflow-auto m-0">{getJSON()}</pre>
        </div>
      )}
    </div>
  );
}
