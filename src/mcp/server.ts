#!/usr/bin/env node
/**
 * RackPro MCP Server
 *
 * Exposes rack mount panel design capabilities as MCP tools.
 * Run: npx tsx src/mcp/server.ts
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { getState, getStatus } from './state';
import { configurePanelSchema, configurePanel, setEnclosureSchema, setEnclosure } from './tools/configure';
import { addElementSchema, handleAddElement, removeElementSchema, handleRemoveElement, moveElementSchema, handleMoveElement } from './tools/elements';
import { suggestLayoutSchema, handleSuggestLayout } from './tools/layout';
import { handleValidate } from './tools/validate';
import { exportSchema, handleExport } from './tools/export';
import {
  fusionConnectSchema, handleFusionConnect,
  fusionBuildSchema, handleFusionBuild,
  fusionPropertiesSchema, handleFusionProperties,
  fusionFeaturesSchema, handleFusionFeatures,
  fusionExportFileSchema, handleFusionExportFile,
  fusionScreenshotSchema, handleFusionScreenshot,
} from './tools/fusion-bridge';
import { getConnectorCatalog, getDeviceCatalog, getFanCatalog, getMaterialCatalog } from './resources/catalogs';

const server = new McpServer({
  name: 'rackpro',
  version: '1.0.0',
});

// ═══ Tools ═══════════════════════════════════════════════════

server.tool(
  'configure_panel',
  'Set panel standard, U-height, fabrication method, material, printer, wall thickness',
  configurePanelSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(configurePanel(args), null, 2) }],
  }),
);

server.tool(
  'set_enclosure',
  'Configure enclosure: flange depth, rear panel, vent slots, auto-reinforcement',
  setEnclosureSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(setEnclosure(args), null, 2) }],
  }),
);

server.tool(
  'add_element',
  'Place a connector, device, or fan on the panel. Auto-positions if x/y omitted.',
  addElementSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(handleAddElement(args), null, 2) }],
  }),
);

server.tool(
  'remove_element',
  'Remove an element by ID or label',
  removeElementSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(handleRemoveElement(args), null, 2) }],
  }),
);

server.tool(
  'move_element',
  'Reposition an element to new x/y coordinates',
  moveElementSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(handleMoveElement(args), null, 2) }],
  }),
);

server.tool(
  'suggest_layout',
  'Auto-arrange elements on the panel (greedy left-to-right). Replaces current elements.',
  suggestLayoutSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(handleSuggestLayout(args), null, 2) }],
  }),
);

server.tool(
  'validate',
  'Check for overlaps, margin violations, out-of-bounds, and structural issues',
  {},
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(handleValidate(), null, 2) }],
  }),
);

server.tool(
  'get_status',
  'Get the current panel configuration summary',
  {},
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(getStatus(), null, 2) }],
  }),
);

server.tool(
  'export',
  'Generate output file in the specified format (openscad, fusion360, fusion360-live, dxf, json)',
  exportSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(await handleExport(args), null, 2) }],
  }),
);

// ═══ Fusion 360 Bridge Tools ═══════════════════════════════════

server.tool(
  'fusion_connect',
  'Test connection to Fusion 360 bridge. Returns Fusion version and active document.',
  fusionConnectSchema.shape,
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(await handleFusionConnect(), null, 2) }],
  }),
);

server.tool(
  'fusion_build',
  'Push current panel design to Fusion 360 and build the 3D model. Returns per-feature success/failure and physical properties.',
  fusionBuildSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(await handleFusionBuild(args), null, 2) }],
  }),
);

server.tool(
  'fusion_properties',
  'Get physical properties (mass, volume, bounding box, center of gravity) of all bodies in the current Fusion 360 model.',
  fusionPropertiesSchema.shape,
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(await handleFusionProperties(), null, 2) }],
  }),
);

server.tool(
  'fusion_features',
  'Get timeline feature list with computed/failed status from the current Fusion 360 model.',
  fusionFeaturesSchema.shape,
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(await handleFusionFeatures(), null, 2) }],
  }),
);

server.tool(
  'fusion_export_file',
  'Export the current Fusion 360 model to STL, STEP, or DXF file.',
  fusionExportFileSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(await handleFusionExportFile(args), null, 2) }],
  }),
);

server.tool(
  'fusion_screenshot',
  'Capture a screenshot of the Fusion 360 viewport.',
  fusionScreenshotSchema.shape,
  async (args) => ({
    content: [{ type: 'text', text: JSON.stringify(await handleFusionScreenshot(args), null, 2) }],
  }),
);

// ═══ Resources ═══════════════════════════════════════════════

server.resource(
  'connectors',
  'rackpro://connectors',
  async () => ({
    contents: [{
      uri: 'rackpro://connectors',
      mimeType: 'application/json',
      text: JSON.stringify(getConnectorCatalog(), null, 2),
    }],
  }),
);

server.resource(
  'devices',
  'rackpro://devices',
  async () => ({
    contents: [{
      uri: 'rackpro://devices',
      mimeType: 'application/json',
      text: JSON.stringify(getDeviceCatalog(), null, 2),
    }],
  }),
);

server.resource(
  'fans',
  'rackpro://fans',
  async () => ({
    contents: [{
      uri: 'rackpro://fans',
      mimeType: 'application/json',
      text: JSON.stringify(getFanCatalog(), null, 2),
    }],
  }),
);

server.resource(
  'materials',
  'rackpro://materials',
  async () => ({
    contents: [{
      uri: 'rackpro://materials',
      mimeType: 'application/json',
      text: JSON.stringify(getMaterialCatalog(), null, 2),
    }],
  }),
);

server.resource(
  'config',
  'rackpro://config',
  async () => ({
    contents: [{
      uri: 'rackpro://config',
      mimeType: 'application/json',
      text: JSON.stringify(getStatus(), null, 2),
    }],
  }),
);

// ═══ Start ═══════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('RackPro MCP server running on stdio');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
