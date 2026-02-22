/**
 * SVG path parsing and manipulation utilities for outline generation.
 *
 * Handles absolute SVG path commands: M, L, H, V, Q, C, A, Z.
 * Does NOT handle relative (lowercase) commands -- the outline generator
 * requests absolute coordinates only from Claude Vision.
 */

export interface PathBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

interface PathCommand {
  type: string;
  values: number[];
}

/**
 * Parse an SVG path `d` attribute string into an array of commands.
 * Handles M, L, H, V, Q, C, A, Z (absolute only).
 */
function parsePathCommands(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  // Match a command letter followed by its numeric arguments
  const cmdRegex = /([MLHVCSQTAZ])\s*([\d.\s,e+-]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = cmdRegex.exec(d)) !== null) {
    const type = match[1].toUpperCase();
    const raw = match[2].trim();
    const values =
      raw.length > 0
        ? raw
            .split(/[\s,]+/)
            .map(Number)
            .filter((n) => !isNaN(n))
        : [];
    commands.push({ type, values });
  }

  return commands;
}

/**
 * Compute the bounding box of an SVG path by extracting all coordinate
 * points from absolute path commands.
 *
 * Handles: M, L, H, V, Q, C, A (absolute). Skips Z.
 * For Bezier curves (Q, C), includes control points in the bounding box
 * calculation (conservative estimate -- the true bbox may be smaller
 * but never larger).
 *
 * @param d - SVG path `d` attribute string
 * @returns Bounding box with min/max coordinates and width/height
 */
export function parseSvgPathBounds(d: string): PathBounds {
  const commands = parsePathCommands(d);
  const xs: number[] = [];
  const ys: number[] = [];
  let cx = 0;
  let cy = 0;

  for (const cmd of commands) {
    const { type, values } = cmd;
    switch (type) {
      case 'M':
      case 'L':
        for (let i = 0; i < values.length - 1; i += 2) {
          cx = values[i];
          cy = values[i + 1];
          xs.push(cx);
          ys.push(cy);
        }
        break;

      case 'H':
        if (values.length > 0) {
          cx = values[0];
          xs.push(cx);
          ys.push(cy);
        }
        break;

      case 'V':
        if (values.length > 0) {
          cy = values[0];
          xs.push(cx);
          ys.push(cy);
        }
        break;

      case 'Q':
        // Quadratic Bezier: control point (x1,y1) + endpoint (x,y)
        for (let i = 0; i < values.length - 3; i += 4) {
          // Control point
          xs.push(values[i]);
          ys.push(values[i + 1]);
          // Endpoint
          cx = values[i + 2];
          cy = values[i + 3];
          xs.push(cx);
          ys.push(cy);
        }
        break;

      case 'C':
        // Cubic Bezier: cp1 (x1,y1) + cp2 (x2,y2) + endpoint (x,y)
        for (let i = 0; i < values.length - 5; i += 6) {
          // Control point 1
          xs.push(values[i]);
          ys.push(values[i + 1]);
          // Control point 2
          xs.push(values[i + 2]);
          ys.push(values[i + 3]);
          // Endpoint
          cx = values[i + 4];
          cy = values[i + 5];
          xs.push(cx);
          ys.push(cy);
        }
        break;

      case 'T':
        // Smooth quadratic: endpoint only (x, y)
        for (let i = 0; i < values.length - 1; i += 2) {
          cx = values[i];
          cy = values[i + 1];
          xs.push(cx);
          ys.push(cy);
        }
        break;

      case 'S':
        // Smooth cubic: cp2 (x2,y2) + endpoint (x,y)
        for (let i = 0; i < values.length - 3; i += 4) {
          xs.push(values[i]);
          ys.push(values[i + 1]);
          cx = values[i + 2];
          cy = values[i + 3];
          xs.push(cx);
          ys.push(cy);
        }
        break;

      case 'A':
        // Arc: rx ry x-rotation large-arc-flag sweep-flag x y
        for (let i = 0; i < values.length - 6; i += 7) {
          // Include the arc radii in bounds (conservative)
          const rx = values[i];
          const ry = values[i + 1];
          cx = values[i + 5];
          cy = values[i + 6];
          xs.push(cx);
          ys.push(cy);
          // Conservative: extend bounds by rx/ry from endpoint
          xs.push(cx - rx, cx + rx);
          ys.push(cy - ry, cy + ry);
        }
        break;

      case 'Z':
        // Close path -- no coordinates
        break;
    }
  }

  if (xs.length === 0 || ys.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Scale all coordinates in an SVG path by the given factors.
 *
 * @param d - SVG path `d` attribute string
 * @param scaleX - X scale factor
 * @param scaleY - Y scale factor
 * @returns Scaled path `d` string
 */
export function scaleSvgPath(
  d: string,
  scaleX: number,
  scaleY: number,
): string {
  const commands = parsePathCommands(d);
  const parts: string[] = [];

  for (const cmd of commands) {
    const { type, values } = cmd;
    switch (type) {
      case 'M':
      case 'L':
      case 'T': {
        const scaled: number[] = [];
        for (let i = 0; i < values.length - 1; i += 2) {
          scaled.push(round(values[i] * scaleX));
          scaled.push(round(values[i + 1] * scaleY));
        }
        parts.push(`${type} ${scaled.join(' ')}`);
        break;
      }

      case 'H': {
        parts.push(`H ${round(values[0] * scaleX)}`);
        break;
      }

      case 'V': {
        parts.push(`V ${round(values[0] * scaleY)}`);
        break;
      }

      case 'Q': {
        const scaled: number[] = [];
        for (let i = 0; i < values.length - 3; i += 4) {
          scaled.push(round(values[i] * scaleX));
          scaled.push(round(values[i + 1] * scaleY));
          scaled.push(round(values[i + 2] * scaleX));
          scaled.push(round(values[i + 3] * scaleY));
        }
        parts.push(`Q ${scaled.join(' ')}`);
        break;
      }

      case 'C': {
        const scaled: number[] = [];
        for (let i = 0; i < values.length - 5; i += 6) {
          scaled.push(round(values[i] * scaleX));
          scaled.push(round(values[i + 1] * scaleY));
          scaled.push(round(values[i + 2] * scaleX));
          scaled.push(round(values[i + 3] * scaleY));
          scaled.push(round(values[i + 4] * scaleX));
          scaled.push(round(values[i + 5] * scaleY));
        }
        parts.push(`C ${scaled.join(' ')}`);
        break;
      }

      case 'S': {
        const scaled: number[] = [];
        for (let i = 0; i < values.length - 3; i += 4) {
          scaled.push(round(values[i] * scaleX));
          scaled.push(round(values[i + 1] * scaleY));
          scaled.push(round(values[i + 2] * scaleX));
          scaled.push(round(values[i + 3] * scaleY));
        }
        parts.push(`S ${scaled.join(' ')}`);
        break;
      }

      case 'A': {
        const scaled: number[] = [];
        for (let i = 0; i < values.length - 6; i += 7) {
          scaled.push(round(values[i] * scaleX)); // rx
          scaled.push(round(values[i + 1] * scaleY)); // ry
          scaled.push(values[i + 2]); // x-rotation (angle, not scaled)
          scaled.push(values[i + 3]); // large-arc-flag
          scaled.push(values[i + 4]); // sweep-flag
          scaled.push(round(values[i + 5] * scaleX)); // x
          scaled.push(round(values[i + 6] * scaleY)); // y
        }
        parts.push(`A ${scaled.join(' ')}`);
        break;
      }

      case 'Z':
        parts.push('Z');
        break;
    }
  }

  return parts.join(' ');
}

/**
 * Count the number of drawing commands in a path (excluding Z).
 */
export function countPathCommands(d: string): number {
  const commands = parsePathCommands(d);
  return commands.filter((c) => c.type !== 'Z').length;
}

/**
 * Check if a path is closed (contains Z command).
 */
export function isPathClosed(d: string): boolean {
  return /[Zz]/.test(d);
}

/**
 * Extract all (x, y) coordinate pairs from a path for area calculation.
 * Returns the vertices in order (for shoelace formula).
 */
export function extractPathVertices(d: string): { x: number; y: number }[] {
  const commands = parsePathCommands(d);
  const vertices: { x: number; y: number }[] = [];
  let cx = 0;
  let cy = 0;

  for (const cmd of commands) {
    const { type, values } = cmd;
    switch (type) {
      case 'M':
      case 'L':
        for (let i = 0; i < values.length - 1; i += 2) {
          cx = values[i];
          cy = values[i + 1];
          vertices.push({ x: cx, y: cy });
        }
        break;
      case 'H':
        cx = values[0];
        vertices.push({ x: cx, y: cy });
        break;
      case 'V':
        cy = values[0];
        vertices.push({ x: cx, y: cy });
        break;
      case 'Q':
        for (let i = 0; i < values.length - 3; i += 4) {
          cx = values[i + 2];
          cy = values[i + 3];
          vertices.push({ x: cx, y: cy });
        }
        break;
      case 'C':
        for (let i = 0; i < values.length - 5; i += 6) {
          cx = values[i + 4];
          cy = values[i + 5];
          vertices.push({ x: cx, y: cy });
        }
        break;
      case 'A':
        for (let i = 0; i < values.length - 6; i += 7) {
          cx = values[i + 5];
          cy = values[i + 6];
          vertices.push({ x: cx, y: cy });
        }
        break;
    }
  }

  return vertices;
}

/**
 * Approximate polygon area using the shoelace formula.
 * Works well for mostly-linear outlines. Curves are approximated
 * by their endpoints.
 */
export function computePolygonArea(
  vertices: { x: number; y: number }[],
): number {
  if (vertices.length < 3) return 0;
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

/** Round to 4 decimal places to avoid floating-point noise. */
function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
