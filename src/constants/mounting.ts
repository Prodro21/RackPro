/**
 * Mounting interface constants for modular faceplate-to-tray assembly.
 * All dimensions in mm.
 */
export const MOUNTING = {
  TAB_WIDTH: 12,
  TAB_DEPTH: 8,
  BOSS_DIA: 8,
  BOSS_HEIGHT: 6,
  CLEARANCE_HOLE: 3.4,    // M3 clearance in tab
  PILOT_HOLE: 2.5,        // for heat-set insert (3DP)
  PEM_HOLE: 3.2,          // for PEM clinch nut (SM)
  ALIGN_PIN_DIA: 3.0,
  ALIGN_SOCKET_DIA: 3.2,
  ALIGN_PIN_DEPTH: 2.0,
  SLIDE_CLEARANCE: 0.3,
  MOUNT_INSET: 3,         // mm from cutout edge to boss center
  DEEP_TRAY_THRESHOLD: 150,
} as const;
