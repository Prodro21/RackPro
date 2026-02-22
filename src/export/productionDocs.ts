import type { ExportConfig, FabConfig3DP, FabConfigSM } from '../types';
import { BORE_HOLES } from '../constants/eia310';
import { computeBom } from '../lib/bom';

/**
 * Generate print settings recommendation for 3D printing.
 */
function generatePrintSettings(config: ExportConfig): string {
  if (config.fabrication.method !== '3D Print') return '';
  const fab = config.fabrication as FabConfig3DP;
  const wallLoops = Math.ceil(fab.wallThickness / 0.4);

  const lines = [
    '## Print Settings',
    '',
    `- **Printer:** ${fab.printer}`,
    `- **Build volume:** ${fab.bed.join(' x ')}mm`,
    `- **Filament:** ${fab.filament}`,
    `- **Wall thickness:** ${fab.wallThickness}mm (${wallLoops} wall loops @ 0.4mm nozzle)`,
    `- **Layer height:** 0.2mm (standard) or 0.16mm (fine detail for tight cutouts)`,
    `- **Infill:** 25-40% gyroid or cubic`,
    `- **Supports:** Only for rear flanges if overhang > 45\u00b0`,
    `- **Orientation:** Face-down on bed for best front surface finish`,
    '',
  ];

  if (fab.split.type !== 'none') {
    lines.push(
      `### Split: ${fab.split.type}`,
      '',
      `This panel is ${fab.split.desc}. Print each piece separately:`,
      '',
    );
    fab.split.parts.forEach((p, i) => {
      lines.push(`${i + 1}. **${p.name}** — ${p.w.toFixed(1)}mm wide ${p.fitsX ? '\u2713 fits bed' : '\u26a0 check fit'}`);
    });
    lines.push('');
    if (fab.split.joint === 'lockpin') {
      lines.push(
        '**Assembly:** Slide side ears onto center mountbar posts. Insert lockpins through aligned square holes.',
        `For PLA: add M3x12mm bolts through lockpin holes for positive retention.`,
        '',
      );
    } else if (fab.split.joint === 'dovetail+bolt') {
      lines.push(
        '**Assembly:** Align left and right halves using dovetail interlock. Secure with 4x M3x12mm bolts.',
        '',
      );
    }
  }

  return lines.join('\n');
}

/**
 * Generate assembly notes.
 */
function generateAssemblyNotes(config: ExportConfig): string {
  const lines = ['## Assembly Instructions', ''];

  if (config.assembly?.mode === 'modular') {
    lines.push(
      `**Mode:** Modular (separate faceplate + device trays)`,
      '',
      `1. **Faceplate** (${config.assembly.faceFab === 'sm' ? 'Sheet Metal' : '3D Print'}):`,
      `   - Contains all connector cutouts, device bay openings, and mounting ears`,
      `   - Mounting bosses on rear face accept M3 screws from trays`,
      '',
    );
    const devices = config.elements.filter(e => e.type === 'device');
    devices.forEach((d, i) => {
      lines.push(
        `${i + 2}. **Tray: ${d.label}** (${config.assembly!.trayFab === 'sm' ? 'Sheet Metal' : '3D Print'}):`,
        `   - Slide tray in from rear until mounting tabs align with faceplate bosses`,
        `   - Secure with M3x8mm bolts (4 per tray)`,
        `   - ${config.assembly!.trayFab === '3dp' ? 'Use heat-set inserts in faceplate bosses' : 'Use PEM clinch nuts in faceplate'}`,
        '',
      );
    });

    lines.push(
      '**Alignment:** Alignment pins on faceplate mate with sockets on tray tabs for precise positioning.',
      '',
    );
  } else {
    lines.push(
      '**Mode:** Monolithic (single-body enclosure)',
      '',
      '1. Mount panel in rack using EIA-310 bore pattern',
      '2. Insert devices from rear, pushing forward until flush with faceplate retention flanges',
      '3. Route cables and secure with cable ties to rear panel or strain relief points',
      '',
    );
  }

  return lines.join('\n');
}

/**
 * Generate critical dimensions summary.
 */
function generateCriticalDims(config: ExportConfig): string {
  const mountType = config.panel.mountHoleType ?? '#10-32';
  const boreDia = BORE_HOLES[mountType]?.diameter ?? 4.83;
  const is3dp = config.fabrication.method === '3D Print';
  const wallT = is3dp
    ? (config.fabrication as FabConfig3DP).wallThickness
    : (config.fabrication as FabConfigSM).thickness;

  const lines = [
    '## Critical Dimensions',
    '',
    `| Dimension | Value |`,
    `|-----------|-------|`,
    `| Rack Standard | ${config.panel.standard}" EIA-310-E |`,
    `| U-Height | ${config.panel.uHeight}U |`,
    `| Panel Width | ${config.panel.panelWidth.toFixed(2)}mm |`,
    `| Panel Height | ${config.panel.panelHeight.toFixed(2)}mm |`,
    `| Total Width (with ears) | ${config.panel.totalWidth.toFixed(1)}mm |`,
    `| Ear Width | 15.875mm (0.625") |`,
    `| Enclosure Depth | ${config.enclosure.depth.toFixed(0)}mm |`,
    `| Wall Thickness | ${wallT}mm |`,
    `| Flange Depth | ${config.enclosure.flangeDepth}mm |`,
    `| Mount Hole Type | ${mountType} (\u2300${boreDia}mm) |`,
    `| Tolerance | 0.2mm |`,
    '',
    '### Cutout Schedule',
    '',
    `| # | Element | Type | Size | X | Y | Behind |`,
    `|---|---------|------|------|---|---|--------|`,
  ];

  config.elements.forEach((el, i) => {
    const size = el.cutout === 'round'
      ? `\u2300${((el.radius ?? el.w / 2) * 2).toFixed(1)}mm`
      : `${el.w}\u00d7${el.h}mm`;
    lines.push(`| ${i + 1} | ${el.label} | ${el.cutout} | ${size} | ${el.x.toFixed(1)} | ${el.y.toFixed(1)} | ${el.depthBehind}mm |`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate hardware BOM as markdown.
 */
function generateBomMarkdown(config: ExportConfig): string {
  const bom = computeBom(config);
  if (bom.length === 0) return '';

  const lines = [
    '## Hardware Bill of Materials',
    '',
    `| Qty | Part | Spec | Note |`,
    `|-----|------|------|------|`,
  ];

  bom.forEach(b => {
    lines.push(`| ${b.qty} | ${b.part} | ${b.spec} | ${b.note ?? ''} |`);
  });

  lines.push(
    '',
    `**Total pieces:** ${bom.reduce((s, b) => s + b.qty, 0)}`,
    '',
  );

  return lines.join('\n');
}

/**
 * Generate complete production documentation as markdown.
 */
export function generateProductionDocs(config: ExportConfig): string {
  const sections = [
    `# RackPro Production Notes`,
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Standard:** ${config.panel.standard}" ${config.panel.uHeight}U`,
    `**Fabrication:** ${config.fabrication.method}`,
    '',
    '---',
    '',
    generateCriticalDims(config),
    generateBomMarkdown(config),
    generatePrintSettings(config),
    generateAssemblyNotes(config),
  ];

  // Sheet metal specific
  if (config.fabrication.method === 'Sheet Metal') {
    const sm = config.fabrication as FabConfigSM;
    sections.push(
      '## Sheet Metal Notes',
      '',
      `- **Material:** ${sm.material}`,
      `- **Thickness:** ${sm.thickness}mm`,
      `- **Bend Radius:** ${sm.bendRadius}mm`,
      `- **K-Factor:** ${sm.kFactor}`,
      `- **BA (90\u00b0):** ${sm.ba90.toFixed(3)}mm`,
      `- **Min Flange:** ${(2.5 * sm.thickness + sm.bendRadius).toFixed(2)}mm`,
      '',
      'Upload STEP or DXF to: Protocase, SendCutSend, or PCBWay for instant quoting.',
      '',
    );
  }

  return sections.join('\n');
}
