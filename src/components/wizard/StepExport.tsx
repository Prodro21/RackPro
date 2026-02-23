/**
 * StepExport -- Wizard Step 6: Export options.
 *
 * Reuses export functions from src/export/ modules.
 * Provides download buttons for JSON, OpenSCAD, Fusion 360, DXF.
 * Includes "Start Over" and "Done" actions.
 */

import { useCallback, useState } from 'react';
import { useConfigStore } from '../../store/useConfigStore';
import { generateConfig, exportJSON, downloadFile } from '../../export/configJson';
import { generateOpenSCAD } from '../../export/openscadGen';
import { generateFusion360 } from '../../export/fusion360Gen';
import { generateDXF } from '../../export/dxfGen';
import { generateProductionDocs } from '../../export/productionDocs';
import { toast } from 'sonner';
import { Button } from '../ui/button';

interface StepExportProps {
  onBack: () => void;
  onDone: () => void;
  onStartOver: () => void;
}

export function StepExport({ onBack, onDone, onStartOver }: StepExportProps) {
  // Extract store selectors at top level per MEMORY.md
  const fabMethod = useConfigStore((s) => s.fabMethod);
  const elements = useConfigStore((s) => s.elements);

  const [copied, setCopied] = useState<string | null>(null);

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const getConfig = useCallback(() => generateConfig(), []);

  const handleDownloadJSON = useCallback(() => {
    const config = getConfig();
    const json = exportJSON(config);
    downloadFile(json, 'rack-config.json', 'application/json');
    toast('JSON config downloaded');
  }, [getConfig]);

  const handleCopyJSON = useCallback(() => {
    const config = getConfig();
    const json = exportJSON(config);
    navigator.clipboard?.writeText(json);
    flash('json');
  }, [getConfig]);

  const handleDownloadOpenSCAD = useCallback(() => {
    const config = getConfig();
    const scad = generateOpenSCAD(config);
    downloadFile(scad, 'rackmount.scad', 'text/plain');
    toast('OpenSCAD file downloaded');
  }, [getConfig]);

  const handleDownloadFusion360 = useCallback(() => {
    const config = getConfig();
    const py = generateFusion360(config);
    downloadFile(py, 'rackmount_fusion360.py', 'text/x-python');
    toast('Fusion 360 script downloaded');
  }, [getConfig]);

  const handleDownloadDXF = useCallback(() => {
    const config = getConfig();
    const dxf = generateDXF(config);
    downloadFile(dxf, 'rackmount-flat.dxf', 'application/dxf');
    toast('DXF flat pattern downloaded');
  }, [getConfig]);

  const handleDownloadProductionDocs = useCallback(() => {
    const config = getConfig();
    const md = generateProductionDocs(config);
    downloadFile(md, 'rackpro-production-notes.md', 'text/markdown');
    toast('Production notes downloaded');
  }, [getConfig]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h2 className="text-sm font-bold text-text-primary mb-1">Export</h2>
        <p className="text-xs text-text-secondary">
          Download your panel design in various formats for fabrication.
        </p>
      </div>

      {/* Export buttons */}
      <div className="space-y-2">
        {/* JSON Config */}
        <ExportRow
          title="JSON Config"
          desc="Complete parametric configuration. Drives OpenSCAD and Fusion 360 generators."
          actions={[
            {
              label: copied === 'json' ? 'Copied!' : 'Copy JSON',
              onClick: handleCopyJSON,
              primary: false,
            },
            {
              label: 'Download .json',
              onClick: handleDownloadJSON,
              primary: true,
            },
          ]}
        />

        {/* OpenSCAD (3DP only) */}
        {fabMethod === '3dp' && (
          <ExportRow
            title="OpenSCAD (.scad)"
            desc="BOSL2-dependent parametric model with faceplate, ears, bores, cutouts, and enclosure."
            actions={[
              {
                label: 'Download .scad',
                onClick: handleDownloadOpenSCAD,
                primary: true,
              },
            ]}
          />
        )}

        {/* Fusion 360 */}
        <ExportRow
          title="Fusion 360 Script (.py)"
          desc="Python API script for Fusion 360. Generates full parametric model."
          actions={[
            {
              label: 'Download .py',
              onClick: handleDownloadFusion360,
              primary: true,
            },
          ]}
        />

        {/* DXF (Sheet Metal) */}
        {fabMethod === 'sm' && (
          <ExportRow
            title="DXF Flat Pattern"
            desc="ASCII DXF R12 with cut, fold, cutout, and dimension layers."
            actions={[
              {
                label: 'Download .dxf',
                onClick: handleDownloadDXF,
                primary: true,
              },
            ]}
          />
        )}

        {/* Production Notes */}
        <ExportRow
          title="Production Notes (.md)"
          desc="Markdown doc with dimensions, cutout schedule, hardware BOM, and assembly instructions."
          actions={[
            {
              label: 'Download .md',
              onClick: handleDownloadProductionDocs,
              primary: true,
            },
          ]}
        />
      </div>

      {/* Empty panel notice */}
      {elements.length === 0 && (
        <div className="bg-bg-card border border-border-default rounded p-3 text-xs text-text-secondary text-center">
          Exporting a blank panel with mounting ears and bore pattern.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-default">
        <div className="flex items-center gap-2">
          <Button
            onClick={onBack}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Back
          </Button>
          <Button
            onClick={onStartOver}
            variant="ghost"
            size="xs"
            className="text-xs text-danger hover:text-danger/80"
          >
            Start Over
          </Button>
        </div>
        <Button
          onClick={onDone}
          size="sm"
          className="text-xs font-bold bg-success text-white hover:bg-success/90"
        >
          Done
        </Button>
      </div>
    </div>
  );
}

// ─── Helper Component ────────────────────────────────────────

interface ExportAction {
  label: string;
  onClick: () => void;
  primary: boolean;
}

function ExportRow({
  title,
  desc,
  actions,
}: {
  title: string;
  desc: string;
  actions: ExportAction[];
}) {
  return (
    <div className="bg-bg-card border border-border-default rounded p-3 hover:border-border-strong transition-colors">
      <div className="text-sm font-bold text-text-primary mb-0.5">{title}</div>
      <div className="text-xs text-text-secondary mb-2">{desc}</div>
      <div className="flex items-center gap-2">
        {actions.map((a) => (
          <Button
            key={a.label}
            onClick={a.onClick}
            variant={a.primary ? 'default' : 'outline'}
            size="xs"
            className="text-xs font-bold"
          >
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
