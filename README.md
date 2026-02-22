# Rack Mount Panel Configurator

Interactive parametric configurator for custom rack mount enclosures with multi-device layouts and inline connectors.

## Features

- **EIA-310 compliant** — 10" and 19" rack standards with correct bore patterns
- **Dual fabrication** — 3D printing (FDM) and sheet metal modes
- **Multi-device layout** — Place multiple Ubiquiti devices + connectors on a single panel
- **Auto-split for 3D printing** — Handles panels larger than print bed with lockpin joints (adapted from HomeRacker OpenSCAD design)
- **Full enclosure** — Not just a faceplate: generates side walls, trays, flanges, rear panel
- **Side profile view** — Cross-section showing device depth, tray structure, wall thickness
- **Export** — JSON config for Fusion 360 scripts, OpenSCAD generation, STL/DXF workflow

## Supported Devices

- USW-Lite-16-PoE (192×185×43.7mm)
- UniFi Express 7 / UX7 (117×117×42.5mm)
- USW-Lite-8-PoE (200×119×30.3mm)
- USW-Pro-Max-16-PoE (325.1×160×43.7mm)
- USW-Pro-24-PoE (442×285×44mm)
- Custom devices (user-defined dimensions)

## Supported Connectors

Neutrik D-Type (universal), BNC bulkhead, RJ45 keystone, SMA, LC/SC fiber, USB-A, HDMI, DB-9, PowerCON

## Getting Started

```bash
npm install
npm run dev
```

## Reference

Based on the [HomeRacker](https://github.com/...) parametric OpenSCAD design, extended for multi-device layouts and sheet metal fabrication.

See `CLAUDE.md` for comprehensive domain knowledge and design specifications.
