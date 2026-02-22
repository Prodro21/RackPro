# External Integrations

**Analysis Date:** 2026-02-21

## APIs & External Services

**Fusion 360 CAD (Local HTTP Bridge):**
- Autodesk Fusion 360 desktop app — 3D model generation, STL/STEP/DXF export, viewport screenshots
  - SDK/Client: Custom HTTP client at `src/mcp/fusion-client.ts`
  - Transport: HTTP POST to `http://localhost:9100` (hardcoded constant `BRIDGE_URL`)
  - Add-in: `RackProBridge` Fusion 360 add-in must be running inside Fusion 360
  - Endpoints consumed: `/ping`, `/build`, `/query`, `/export`, `/screenshot`, `/reload` (hot-reload)
  - Auth: None — localhost only
  - Timeout: 5s (ping), 30s (default), 120s (build)
  - Hot-reload: POST to `http://localhost:9100/reload` after editing bridge Python files
  - Error pattern: `ECONNREFUSED` → descriptive "start RackProBridge add-in" message

**MCP (Model Context Protocol):**
- Anthropic MCP SDK — exposes the configurator as AI-callable tools
  - SDK: `@modelcontextprotocol/sdk@1.26.0`
  - Server entry point: `src/mcp/server.ts`
  - Transport: `StdioServerTransport` (stdio — Claude calls it as a subprocess)
  - Run command: `npx tsx src/mcp/server.ts`
  - Exposes 12 tools: `configure_panel`, `set_enclosure`, `add_element`, `remove_element`, `move_element`, `suggest_layout`, `validate`, `get_status`, `export`, `fusion_connect`, `fusion_build`, `fusion_properties`, `fusion_features`, `fusion_export_file`, `fusion_screenshot`
  - Exposes 5 resources: `rackpro://connectors`, `rackpro://devices`, `rackpro://fans`, `rackpro://materials`, `rackpro://config`

## Data Storage

**Databases:**
- None — no database of any kind

**In-Memory State (Browser):**
- Zustand store at `src/store/useConfigStore.ts` — all panel configuration
- Undo/redo via module-level `past: Snapshot[]` / `future: Snapshot[]` arrays (max 50 entries)
- Custom devices persisted to `localStorage` via `src/hooks/useCustomDevices.ts`

**In-Memory State (MCP Server):**
- Plain module-level singleton at `src/mcp/state.ts` (`let state = createDefaultState()`)
- Not persisted — resets on server restart

**File Storage:**
- Local filesystem only — all export outputs are written to disk paths specified by the user
- STL, STEP, DXF via `fusion_export_file` MCP tool (path passed by caller, written by Fusion bridge)
- OpenSCAD `.scad`, DXF flat pattern, JSON config — generated in-memory and returned as strings

**Caching:**
- None (no Redis, no CDN, no service worker)
- Selector memoization via module-level cache objects in `src/store/selectors.ts` (React 19 stability requirement)

## Authentication & Identity

**Auth Provider:**
- None — no login, no user accounts, no authentication

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or similar

**Logs:**
- Browser: `console.error` in MCP client error paths
- MCP server: `console.error` to stderr (`'RackPro MCP server running on stdio'`, fatal errors)
- No structured logging

## CI/CD & Deployment

**Hosting:**
- Static site — `vite build` outputs to `dist/`; no hosting platform configured in repo
- Dev server whitelist: `dannyboi.prodro.pro` (configured in `vite.config.ts`)

**CI Pipeline:**
- None — no GitHub Actions, CircleCI, or similar detected

## Environment Configuration

**Required env vars:**
- None — the application requires no environment variables

**Optional / implicit:**
- Fusion 360 bridge assumes `localhost:9100` is accessible (no env override)

**Secrets location:**
- None — no secrets, API keys, or credentials in use

## Webhooks & Callbacks

**Incoming:**
- None — no webhook receivers

**Outgoing:**
- None — the only "outbound" call is to localhost (Fusion 360 bridge), not an external webhook

## CAD Output Targets (Fabrication Services, Not API Integrations)

These are manual upload workflows, not programmatic integrations:

- **Protocase** — STEP file upload for sheet metal quoting
- **SendCutSend** — DXF/STEP upload for laser cutting + bending
- **PCBWay** — Sheet metal and 3D printing (SLS/MJF) upload
- **JLCPCB** — 3D printing service upload
- **BambuStudio / PrusaSlicer** — Import STL from Fusion 360 bridge export

## Export Format Summary

| Format | Generator | Trigger |
|--------|-----------|---------|
| JSON config | `src/export/configJson.ts` | Browser UI or MCP `export` tool |
| OpenSCAD `.scad` | `src/export/openscadGen.ts` | Browser UI or MCP `export` tool |
| Fusion 360 Python script | `src/export/fusion360Gen.ts` | Browser UI, MCP `export` tool, or live via bridge |
| DXF flat pattern | `src/export/dxfGen.ts` | Browser UI or MCP `export` tool (sheet metal mode only) |
| STL / STEP / DXF (file) | Fusion 360 bridge (`/export`) | MCP `fusion_export_file` tool |
| Production docs markdown | `src/export/productionDocs.ts` | Browser UI ExportTab |

---

*Integration audit: 2026-02-21*
