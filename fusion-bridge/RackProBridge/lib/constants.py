"""
RackPro Bridge — Constants

Fusion 360 uses centimeters internally. The mm() helper converts.
All EIA-310 dimensions in mm for readability, converted at call site.
"""

import math


def mm(v):
    """Convert millimeters to centimeters (Fusion 360 internal unit)."""
    return v / 10.0


def cm_to_mm(v):
    """Convert centimeters back to millimeters for reporting."""
    return v * 10.0


# Small epsilon for boolean ops to avoid zero-thickness cuts
EPS = 0.001

# ─── EIA-310 Rack Standards ──────────────────────────────────

EAR_WIDTH = 15.875           # Mounting ear width (mm)
PANEL_19_WIDTH = 450.85      # 19" panel width between ears (mm)
PANEL_10_WIDTH = 222.25      # 10" panel width between ears (mm)
TOTAL_19_WIDTH = 482.6       # 19" total width including ears (mm)
TOTAL_10_WIDTH = 254.0       # 10" total width including ears (mm)
UNIT_HEIGHT = 44.45          # 1U height (mm)
PANEL_GAP = 0.79             # Gap subtracted from panel height (mm)

# Bore pattern: positions from top of each U
BORE_OFFSETS = [6.35, 22.225, 38.1]  # mm from top of U
BORE_RADIUS = 2.5            # M5 bore radius (mm)

# ─── Fabrication ─────────────────────────────────────────────

TOLERANCE = 0.2              # Fit clearance (mm)
BASE_STRENGTH = 2.0          # Minimum wall thickness (mm)
BASE_UNIT = 15.0             # Fundamental grid unit (mm)

# ─── Hex Panel Lightweighting ───────────────────────────────

HEX_SPACING = BASE_UNIT / 2         # 7.5mm — hex cell center-to-center
HEX_STRUT = BASE_STRENGTH           # 2mm — wall between hexagons
HEX_FRAME = BASE_STRENGTH           # 2mm — solid border (small trays)
HEX_FRAME_LARGE = BASE_UNIT         # 15mm — solid border (large trays)
HEX_FRAME_THRESHOLD = BASE_UNIT * 3 # 45mm — switch point for frame size
