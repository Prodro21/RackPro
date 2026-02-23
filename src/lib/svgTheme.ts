/**
 * Centralized SVG color palette using CSS custom properties.
 * Values are `var(--svg-*)` references that automatically
 * switch between dark and light themes.
 *
 * All SVG rendering components (FrontView, SideView, SplitView)
 * import from this single source of truth. No hardcoded hex colors
 * should appear in SVG markup.
 */
export const SVG_COLORS = {
  // Panel body
  panelFace: 'var(--svg-panel-face)',
  panelStroke: 'var(--svg-panel-stroke)',
  panelFaceLight: 'var(--svg-panel-face-light)',

  // Mounting ears
  earFill: 'var(--svg-ear-fill)',
  earStroke: 'var(--svg-ear-stroke)',

  // Bores / mounting holes
  boreStroke: 'var(--svg-bore-stroke)',
  boreFill: 'var(--svg-bore-fill)',

  // Canvas
  canvasBg: 'var(--svg-canvas-bg)',
  gridDot: 'var(--svg-grid-dot)',

  // Elements (devices/connectors)
  elementFill: 'var(--svg-element-fill)',
  elementStroke: 'var(--svg-element-stroke)',
  elementText: 'var(--svg-element-text)',
  elementSelected: 'var(--accent)',
  elementSelectedBg: 'var(--accent-subtle)',

  // Device shapes
  deviceFill: 'var(--svg-device-fill)',
  connectorFill: 'var(--svg-connector-fill)',

  // Dimensions / annotations
  dimLine: 'var(--svg-dim-line)',
  dimText: 'var(--svg-dim-text)',

  // Split lines
  splitLine: 'var(--svg-split-line)',
  splitFill: 'var(--svg-split-fill)',

  // Side view specific
  crossSection: 'var(--svg-cross-section)',
  flangesFill: 'var(--svg-flanges-fill)',
  trayFill: 'var(--svg-tray-fill)',
  wallFill: 'var(--svg-wall-fill)',

  // Labels
  labelText: 'var(--svg-label-text)',
  labelIcon: 'var(--svg-label-icon)',

  // Text (general)
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textTertiary: 'var(--text-tertiary)',

  // Accent
  accent: 'var(--accent)',
  accentSubtle: 'var(--accent-subtle)',

  // Semantic
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',

  // Validation indicators (these need to work in both themes)
  overlapStroke: 'var(--danger)',
  oobStroke: 'var(--warning)',
  marginStroke: 'var(--svg-dim-line)',
  validationFill: 'var(--svg-connector-fill)',
  validationStroke: 'var(--danger)',

  // Reinforcement (indigo tint)
  ribFill: 'var(--svg-rib-fill)',
  ribStroke: 'var(--svg-rib-stroke)',

  // Modular / tray indicator (blue)
  modularStroke: 'var(--svg-modular-stroke)',
  modularFill: 'var(--svg-modular-fill)',
} as const;
