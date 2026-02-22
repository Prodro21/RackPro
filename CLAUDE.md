# Rack Mount Panel Configurator — CLAUDE.md

## Project Overview

Interactive parametric configurator for custom rack mount enclosures supporting **multi-device layouts** with inline connectors (RJ45, SDI/BNC, fiber, SMA, etc.). Outputs configurations for both **3D printing (FDM)** and **sheet metal fabrication**.

The tool produces a JSON configuration that drives:
- Fusion 360 Python scripts for parametric 3D model generation
- OpenSCAD `.scad` file generation
- STL export for FDM slicers (BambuStudio, PrusaSlicer)
- DXF flat patterns for laser cutting / CNC punch (sheet metal)

### Key Differentiator
Unlike the reference OpenSCAD design (single-device), this configurator handles **multiple devices + connectors in a single panel**, with automatic width budgeting, depth calculation, and print-bed-aware splitting.

---

## Reference Design: HomeRacker OpenSCAD (rackmount.scad)

The original `rackmount.scad` (745 lines, BOSL2 library) is a parametric 3D-printable rack mount for a **single device**. Key patterns to preserve or adapt:

### Constants (from OpenSCAD)
```
BASE_UNIT         = 15      mm   (fundamental grid unit)
BASE_STRENGTH     = 2       mm   (wall thickness)
BASE_CHAMFER      = 1       mm   (edge chamfer)
TOLERANCE         = 0.2     mm   (fit clearance)
PRINTING_LAYER_W  = 0.4     mm   (nozzle width)
PRINTING_LAYER_H  = 0.2     mm   (layer height)
```

### Three Variants
1. **Bracket** (`VARIANT_BRACKET = 1`) — Front panel + bracket that clamps over device from above. Side overlap (`bracket_strength_sides`: 0–50mm) and top overlap (`bracket_strength_top`). Includes mount columns with lockpin holes.
2. **Tray** (`VARIANT_TRAY = 2`) — Front panel + hex-panel tray underneath. Tray has floor (hex lightweighted), side walls, and rear wedge stoppers. Wall thickness auto-scales with device depth: `BASE_STRENGTH + max(0, (depth - 100) * 0.02)`.
3. **Bracket-only** (`VARIANT_BRACKET_ONLY = 3`) — Just the bracket, no front panel.

### Split System (Critical for 3D Printing)
The design splits into **3 pieces** for printers smaller than the panel:

**Piece types:** `RACKMOUNT_FULL`, `RACKMOUNT_CENTER`, `RACKMOUNT_SIDE`

**RACKMOUNT_CENTER** — The main panel body containing the device cutout and flange. Has `mountbar` posts (15×15mm, `BASE_UNIT` square) extending from the rear at each split boundary. Each mountbar contains 2 lockpin holes spaced `BASE_UNIT` apart vertically.

**RACKMOUNT_SIDE** (×2, mirrored) — The rack ear pieces. Each contains:
- Rack mounting bores (EIA-310 pattern)
- A **U-shaped connector** that wraps around the center's mountbar:
  - Rear extension: `BASE_STRENGTH + BASE_UNIT + TOLERANCE/2` deep
  - Inner bar: `BASE_UNIT + BASE_STRENGTH*2 + TOLERANCE` wide
  - Outer lip: `BASE_STRENGTH` creating the U-channel
- **Lockpin outer receptacles**: `LOCKPIN_WIDTH_OUTER = BASE_UNIT + BASE_STRENGTH*2 + TOLERANCE*2` (≈19.4mm)
- Stiffener wedges at top and bottom of the panel

**Lockpin Hole Geometry:**
```
LOCKPIN_HOLE_SIDE_LENGTH = 4    mm   (square hole)
LOCKPIN_HOLE_CHAMFER     = 0.8  mm   (entry chamfer)
lock_pin_center_side     = 4 + PRINTING_LAYER_WIDTH*2 = 4.8mm
lock_pin_outer_side      = 4 + LOCKPIN_HOLE_CHAMFER*2 = 5.6mm
```

**Assembly:** Side ears slide onto center mountbars. Lockpins (separate printed pieces) drop through aligned holes creating a friction-fit mechanical interlock. For PLA, add M3×12mm bolts through lockpin holes for positive retention.

**Width Calculations:**
```python
panel_width_center = device_width + flange_addition + split_addition + bracket_addition
panel_width_ear    = (total_panel_width - panel_width_center) / 2 - TOLERANCE/2
connector_offset   = (BASE_UNIT + BASE_STRENGTH + TOLERANCE) * 2 + TOLERANCE  # ≈34.4mm
```

### Device Cutouts
The `device_cutouts` module creates the opening in the flange:
- Width: `device_width + TOLERANCE`
- Height: `device_height + TOLERANCE`
- Depth: `flange_depth + epsilon`
- Optional bracket notch for side-clamping bracket variant
- Chamfered edges when enabled

### Tray Construction
The tray module builds from hex panels (BOSL2 `hex_panel`):
- Floor: hex-lightweighted panel, frame = `BASE_UNIT` for large trays, `BASE_STRENGTH` for small
- Side walls: hex panels, height = `BASE_UNIT` (15mm)
- Stabilizer triangles for tall devices (height > 2×BASE_UNIT)
- Rear wedge stoppers prevent device from sliding backward
- Strut: `BASE_STRENGTH` (2mm), Spacing: `BASE_UNIT/2` (7.5mm)

### Mounting System
The `mount` / `mount_pair` modules create the bracket-to-panel connection:
- Mount width: `BASE_UNIT + offset` (aligned to BASE_UNIT grid)
- Mount depth: `BASE_UNIT + BASE_STRENGTH*2 + TOLERANCE` (≈19.4mm)
- Front/back flaps with lockpin holes for HomeRacker rail system
- Bridge cutout with rounded bottom for weight reduction
- 1 or 2 mount columns depending on device depth:
  - Single column: depth < `BASE_UNIT*3 + offset` (≈49mm)
  - Double column: depth ≥ 49mm, spaced to fit

---

## EIA-310-E Rack Standards

### Panel Dimensions
| Standard | Rack Width | Panel Width | Ear Width (each) | Mount Hole C/C |
|----------|-----------|-------------|-------------------|----------------|
| 19"      | 482.6 mm  | 450.85 mm   | 15.875 mm (0.625") | 465.1 mm      |
| 10"      | 254.0 mm  | 222.25 mm   | 15.875 mm (0.625") | —              |

### U-Height
- 1U = 44.45 mm (1.75")
- Panel height per U = 43.66 mm (includes 0.79mm gap to prevent binding)
- `panel_height = U × 44.45 - 0.79`

### Vertical Bore Pattern (per U)
Three mounting holes per U, measured from top of U:
```
Hole 1:  6.35 mm   (1/4")    — center of first hole
Hole 2: 22.225 mm  (7/8")    — 15.875mm below hole 1
Hole 3: 38.1 mm    (1-1/2")  — 15.875mm below hole 2
Pattern: 15.875 - 15.875 - 12.7mm spacing (12.7mm gap at U boundary)
```

### Mounting Hole Standards
- **#10-32**: 4.83mm — Most common in AV/broadcast
- **#12-24**: 5.49mm — Telecom
- **M5**: 5.0mm — European
- **M6**: 6.0mm — Heavy-duty

Use square/cage nuts or clip nuts for rack mounting.

---

## Connector Cutout Specifications

### Neutrik D-Type (D-Series)
- **Cutout**: 24mm (23.8mm precise) round with flat (D-shape)
- **Mounting**: Two #4-40 (M3) screw holes
- **Universal system**: Same cutout accepts XLR, BNC, HDMI, EtherCon (RJ45), USB, fiber (OpticalCON), SpeakON, PowerCON
- **Compatible**: Switchcraft EH series (173+ combinations), Amphenol AC series
- **Depth behind panel**: ~30mm typical

### BNC Bulkhead
- **Cutout**: 9.5 ± 0.2mm round hole
- **Standard**: SDI video (75Ω), RF (50Ω)
- **Mount**: Jam nut, no screw holes
- **Flange models** (BNC-KFB2): four 2.8mm holes on 12.7mm square
- **Depth behind panel**: ~22mm

### Keystone Jack
- **Cutout**: 14.9 × 19.2mm rectangular
- **Panel thickness**: ≤ 2mm (critical for snap-in retention)
- **Modules**: RJ45 (Cat5e/6/6a), fiber LC/SC, HDMI, USB, coax F-type
- **Mount**: Snap-in, no screws
- **Depth behind panel**: ~28mm

### Fiber Optic
- **LC Duplex**: ~26 × 18mm with 2 mount holes, ~32mm behind
- **SC Simplex**: ~16 × 20mm with 2 mount holes, ~35mm behind
- **OpticalCON (Neutrik)**: Uses D-type 24mm cutout
- **LGX format**: 130 × 40mm adapter plate (holds multiple LC/SC)

### SMA Bulkhead
- **Cutout**: 6.35mm (1/4") round
- **Application**: RF antenna feedthrough to 18 GHz
- **Mount**: Jam nut
- **Depth behind panel**: ~15mm

### D-Sub Connectors
| Type | Cutout | Mount Holes |
|------|--------|------------|
| DE-9 (DB9) | 17.5 × 9.4mm | 2 (#4-40) |
| DA-15 (DB15) | 24.0 × 9.4mm | 2 |
| DB-25 | 40.0 × 9.4mm | 2 |

### Other
- **USB-A**: 13.1 × 5.6mm, ~25mm behind
- **HDMI**: 21.0 × 9.5mm, ~30mm behind
- **IEC C14 power inlet**: 27.5 × 20.0mm

---

## Ubiquiti Device Specifications

### USW-Lite-16-PoE
- **Dimensions**: 192 × 185 × 43.7mm (W×D×H)
- **Weight**: 1.2 kg
- **Ports**: 16× GbE RJ45 (8 PoE+, 802.3af/at)
- **PoE Budget**: 45W (30W max per port)
- **Power**: Internal 60W AC/DC PSU, 100–240VAC
- **Form Factor**: Desktop / wall-mount, NOT rack-width
- **Enclosure**: Plastic
- **Cooling**: Fanless
- **Note**: Compact square format — fits ~2 side-by-side in 19" panel

### UniFi Express 7 (UX7)
- **Dimensions**: 117 × 117 × 42.5mm (W×D×H)
- **Weight**: 422g
- **Ports**: 1× 10GbE RJ45 (WAN), 1× 2.5GbE RJ45 (LAN)
- **WiFi**: Tri-band WiFi 7 (802.11be) — 6GHz: 5.7Gbps, 5GHz: 4.3Gbps, 2.4GHz: 688Mbps
- **IDS/IPS**: 2.3 Gbps throughput
- **Power**: USB-C 5V/5A (22W max, adapter included)
- **Features**: Full UniFi Network gateway, 30+ managed devices, 300+ simultaneous users
- **Enclosure**: Polycarbonate
- **Display**: 0.96" LCM status display
- **Note**: Very compact — 3+ can fit across a 19" panel

### USW-Lite-8-PoE
- **Dimensions**: 200 × 119 × 30.3mm
- **Weight**: 0.8 kg
- **Ports**: 8× GbE (4 PoE+)
- **PoE**: 52W budget

### USW-Pro-Max-16-PoE
- **Dimensions**: 325.1 × 160 × 43.7mm
- **Weight**: 2.8 kg
- **Ports**: 12×GbE + 4×2.5GbE + 2×SFP+
- **PoE**: 180W budget

### USW-Pro-24-PoE
- **Dimensions**: 442 × 285 × 44mm
- **Weight**: 5.1 kg
- **Ports**: 24×GbE + 2×SFP+
- **PoE**: 400W budget
- **Note**: Nearly full rack width — may not need custom panel

---

## Sheet Metal Fabrication Rules

### Materials
| Material | Gauge | Thickness | Min Bend Radius | Density |
|----------|-------|-----------|-----------------|---------|
| CRS (Cold Rolled Steel) | 16ga | 1.52mm | 1.52mm (1×T) | 7.85 g/cm³ |
| CRS | 18ga | 1.22mm | 1.22mm (1×T) | 7.85 g/cm³ |
| Al 5052-H32 | 14ga | 1.63mm | 2.45mm (1.5×T) | 2.68 g/cm³ |
| Al 5052-H32 | 16ga | 1.29mm | 1.29mm (1×T) | 2.68 g/cm³ |

### Bend Calculations
```
Bend Allowance (BA) = π × (Ri + K × T) × (A / 180)
For 90° bend: BA = 1.5708 × (Ri + K × T)

K-factor: 0.33–0.45 (air bending), 0.42–0.44 (bottom bending)
Default K = 0.40 for general use
```

### Design Rules
- **Min flange length**: 2.5T + Ri
- **Hole-to-edge**: ≥ 2T + hole_radius
- **Hole-to-bend**: ≥ 2T + Ri + hole_radius
- **Min bend radius**: T (soft material) to 2T (hard material)
- **No split needed** — panel is a single flat pattern that is cut and bent

### Flat Pattern Estimation
```
flat_width  = panel_width  + 2 × (flange_depth + BA_90)
flat_height = panel_height + 2 × (flange_depth + BA_90)
```

### Fabrication Services
- **Protocase**: Upload STEP, instant sheet metal quoting
- **SendCutSend**: Upload DXF/STEP, laser cutting + bending
- **PCBWay**: Sheet metal and 3D printing (SLS/MJF)
- **JLCPCB**: 3D printing service

---

## 3D Print Fabrication Rules

### Printer: BambuLab P2S
- **Build volume**: 256 × 256 × 256mm
- **Key constraint**: 19" rack total width (482.6mm) exceeds bed by 226.6mm
- **10" rack**: 254mm — fits with 2mm margin

### Split Decision Matrix
| Panel | Width | Fits P2S? | Strategy |
|-------|-------|-----------|----------|
| 10" 1U | 254mm | ✓ (barely) | Single piece |
| 10" 2U | 254mm × 88mm | ✓ | Single piece |
| 19" 1U | 482.6mm | ✗ | 2 or 3 piece split |
| 19" 2U | 482.6mm × 88mm | ✗ | 2 or 3 piece split |

### Split Strategies

**3-piece (OpenSCAD style):**
- Center panel + 2 side ears with lockpin/mountbar joints
- Best when center piece ≤ 256mm (works for smaller devices)
- Each ear: ~40mm wide (always fits)
- Joint: lockpin mechanical interlock

**2-piece (center split):**
- Left half + right half, split at midline (241.3mm each)
- Each half fits on 256mm bed
- Joint: interlocking dovetail + M3 alignment pins + M3 bolts
- The rear tray/bracket spans the split line for structural bridging

### Print Orientation
- **Face-down on bed**: Best surface finish for front panel
- **Standing (face forward)**: Better for deep enclosures, may need supports

### Recommended Settings
```
Layer height:  0.2mm (standard), 0.16mm (fine detail)
Infill:        25–40% gyroid or cubic
Wall loops:    ceil(wall_thickness / 0.4)  — e.g., 8 loops for 3mm wall
Supports:      Only for rear flanges if overhang > 45°
```

### Material Selection for Rack Mounts
| Filament | Strength | Heat Resistance | Notes |
|----------|----------|-----------------|-------|
| PLA | Medium | 55°C | Cheapest, but softens in warm racks. Add M3 bolts to lockpin joints. |
| PETG | Good | 75°C | Recommended default. Good layer adhesion, slight flex. |
| ABS | Good | 90°C | Better heat resistance, warping risk. Needs enclosure. |
| ASA | Good | 95°C | UV-resistant ABS alternative. |
| PA-CF / PET-CF | Excellent | 150°C+ | Carbon fiber reinforced. Strongest option. Expensive. |

### Wall Thickness Guidelines
- **2mm**: Minimum viable. Connector panels only, no device weight.
- **3mm**: Default. Good for light devices (< 1kg per bay).
- **4mm**: Recommended for heavier devices or structural split joints.
- **5–6mm**: Heavy-duty. Devices > 2kg, or long-span trays.

---

## Enclosure Architecture

### Components
1. **Front Panel (Faceplate)** — Connector cutouts + device bay openings + EIA-310 mounting ears + bore pattern
2. **Side Walls** — Top and bottom walls extending from faceplate to rear. Provide structural rigidity.
3. **Flange / Retention Lip** — 90° feature behind faceplate that captures device edges. Depth: 10–40mm configurable.
4. **Device Trays** — Floor sections under each device bay. Can be solid, hex-lightweighted (OpenSCAD style), or slatted.
5. **Internal Dividers** — Vertical walls separating device bays from connector zones.
6. **Rear Panel** — Optional. Solid or ventilated. Provides cable strain relief mounting points.
7. **Mounting Ears** — Integral to faceplate. 15.875mm wide with EIA-310 bore pattern.

### Depth Calculation
```
enclosure_depth = max(50, max_device_depth + wall_thickness × 2 + 10mm_clearance)
```
Where `max_device_depth` is the deepest element (device depth or connector behind-panel depth).

### Multi-Device Layout
The panel is treated as a 2D canvas (width × height). Elements are placed freely and constrained to panel bounds. The **width budget** tracks total element width vs available panel width.

For each device bay, the system generates:
- A front cutout (device width × device height + tolerance)
- A flange behind the cutout
- A tray floor at the appropriate depth
- Optional side brackets (from OpenSCAD bracket variant)

For inline connectors between devices:
- Front cutout per connector spec
- Sufficient depth behind panel for connector body + cable bend radius
- No tray needed (connectors are self-supporting via panel mount)

---

## Project Tech Stack

- **Framework**: React + TypeScript + Vite
- **Styling**: Tailwind CSS (utility classes only, no compiler needed in artifacts)
- **SVG Rendering**: Inline SVG for panel front view, side profile, split diagram
- **State**: React hooks (useState, useCallback, useMemo)
- **Export**: JSON configuration → clipboard. Future: direct STL generation via three.js or OpenSCAD WASM.
- **Target printers**: BambuLab P2S (primary), BambuLab A1/X1C, Prusa MK4S, custom
- **CAD integration**: Fusion 360 Python API script, OpenSCAD `.scad` generator

---

## File Structure
```
rack-configurator/
├── CLAUDE.md                    # This file
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── src/
│   ├── main.tsx
│   ├── App.tsx                  # Main layout + tab routing
│   ├── types.ts                 # TypeScript interfaces
│   ├── constants/
│   │   ├── eia310.ts            # Rack standards
│   │   ├── connectors.ts       # Connector cutout library
│   │   ├── devices.ts          # Ubiquiti + custom device specs
│   │   ├── materials.ts        # Sheet metal gauges + filaments
│   │   └── printers.ts         # Printer bed definitions
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx          # Panel config + element palette + placed list
│   │   ├── FrontView.tsx        # SVG front panel canvas with drag
│   │   ├── SideView.tsx         # SVG cross-section profile
│   │   ├── SplitView.tsx        # Split strategy + joint diagrams
│   │   ├── SpecsTab.tsx         # Calculations, cutout schedule, reference
│   │   └── ExportTab.tsx        # JSON, STL, DXF export options
│   ├── hooks/
│   │   ├── useDrag.ts           # SVG element drag logic
│   │   ├── useSplitCalc.ts      # Split strategy computation
│   │   └── useEnclosure.ts      # Depth + tray + wall calculations
│   └── export/
│       ├── configJson.ts        # JSON config generator
│       ├── openscadGen.ts       # .scad file generator
│       └── fusion360Script.py   # Fusion 360 Python API script
├── reference/
│   └── rackmount.scad           # Original HomeRacker OpenSCAD (read-only reference)
└── README.md
```

---

## Development Notes

### When modifying connector library
- Always include `depthBehind` (mm behind panel face) — this drives enclosure depth
- Cutout types: `round`, `d-shape`, `rect`, `d-sub`
- For round/d-shape, specify `r` (radius). For rect/d-sub, specify `w` × `h`.

### When adding new devices
- Get exact dimensions from techspecs.ui.com (Ubiquiti) or manufacturer datasheet
- Dimensions are W × D × H in mm
- Include weight for load calculations (ear-mount safe < 7kg total)

### When changing split logic
- The OpenSCAD 3-piece split works when center piece ≤ printer bed width
- For 19" on P2S (256mm bed), the center piece is ~400mm — too wide
- Fallback to 2-piece center split with dovetail + M3 bolts
- The rear tray/bracket **must span the split line** for structural integrity

### When changing materials
- Sheet metal: thickness affects bend allowance, minimum flange, hole clearances
- 3D print: wall thickness affects wall loops, structural capacity, weight
- Keystone jacks require panel ≤ 2mm at the cutout — may need local thinning for 3D prints

### Design Rules to Always Enforce
1. Elements must not overlap
2. Elements must stay within panel bounds (ear-to-ear)
3. Width budget must not be exceeded (warn, don't block)
4. Enclosure depth auto-updates from deepest element
5. Split lines must not cross through element cutouts
6. Bores are always generated per EIA-310 pattern
7. Tolerance (0.2mm) is applied to all device dimensions
