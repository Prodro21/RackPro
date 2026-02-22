#!/usr/bin/env npx tsx
/**
 * generate-outline.ts -- CLI tool to generate dimensioned SVG outlines
 * from product photos using Claude Vision API.
 *
 * Usage:
 *   npx tsx scripts/generate-outline.ts \
 *     --slug usw-lite-16-poe \
 *     --face top \
 *     --image path/to/photo.jpg \
 *     [--output public/catalog/outlines] \
 *     [--tolerance 0.5] \
 *     [--model claude-sonnet-4-5] \
 *     [--dry-run]
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import {
  parseSvgPathBounds,
  scaleSvgPath,
  countPathCommands,
} from './lib/svg-path-utils.js';

// ─── Types ─────────────────────────────────────────────────────

type Face = 'top' | 'front' | 'side';

interface CatalogDevice {
  slug: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  [key: string]: unknown;
}

// ─── Catalog Reader ────────────────────────────────────────────

function loadCatalog(catalogPath: string): CatalogDevice[] {
  if (!fs.existsSync(catalogPath)) {
    console.error(`Error: Catalog file not found at ${catalogPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(catalogPath, 'utf-8');
  return JSON.parse(raw) as CatalogDevice[];
}

function findDevice(
  devices: CatalogDevice[],
  slug: string,
): CatalogDevice | undefined {
  return devices.find((d) => d.slug === slug);
}

// ─── Bounding Box Resolver ─────────────────────────────────────

function resolveBBox(
  device: CatalogDevice,
  face: Face,
): { bboxW: number; bboxH: number } {
  switch (face) {
    case 'top':
      return { bboxW: device.width, bboxH: device.depth };
    case 'front':
      return { bboxW: device.width, bboxH: device.height };
    case 'side':
      return { bboxW: device.depth, bboxH: device.height };
  }
}

// ─── Image Preprocessor ───────────────────────────────────────

async function preprocessImage(
  imagePath: string,
): Promise<{ base64: string; mediaType: 'image/png' | 'image/jpeg' }> {
  if (!fs.existsSync(imagePath)) {
    console.error(`Error: Image file not found: ${imagePath}`);
    process.exit(1);
  }

  // Resize to max 1536px on longest edge, convert to PNG
  const buffer = await sharp(imagePath)
    .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  return {
    base64: buffer.toString('base64'),
    mediaType: 'image/png',
  };
}

// ─── Claude Vision API ────────────────────────────────────────

function buildPrompt(face: Face, bboxW: number, bboxH: number): string {
  return `You are analyzing a ${face} view photo of a network/computing device.
The device bounding box is ${bboxW}mm wide x ${bboxH}mm tall.

Generate an SVG path that traces the OUTER SILHOUETTE of the device body.
Use a coordinate system where (0,0) is top-left and the viewBox is "0 0 ${bboxW} ${bboxH}".

Rules:
- The path MUST be a single closed path (ending with Z)
- Use ABSOLUTE coordinates only (M, L, Q, C, A commands -- no lowercase)
- Include rounded corners where visible (use Q or A commands)
- Simplify: ignore ports, LEDs, labels, ventilation holes -- only the outer body shape
- The path bounding box must be exactly ${bboxW} x ${bboxH}
- Use at most 30 path commands -- this is a simplified outline, not a detail trace

Return ONLY the SVG path d="" attribute value, nothing else. No code fences, no explanation.`;
}

async function callClaudeVision(
  base64: string,
  mediaType: 'image/png' | 'image/jpeg',
  face: Face,
  bboxW: number,
  bboxH: number,
  model: string,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'Error: ANTHROPIC_API_KEY environment variable is not set.',
    );
    console.error(
      'Set it with: export ANTHROPIC_API_KEY="your-api-key-here"',
    );
    console.error(
      'Get your API key from: https://console.anthropic.com/settings/keys',
    );
    process.exit(1);
  }

  const client = new Anthropic();

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: 'text',
            text: buildPrompt(face, bboxW, bboxH),
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    console.error('Error: Unexpected response format from Claude API');
    console.error('Response:', JSON.stringify(response.content, null, 2));
    process.exit(1);
  }

  // Strip any markdown code fences that Claude might wrap the response in
  let pathD = textBlock.text.trim();
  pathD = pathD.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '');
  pathD = pathD.trim();

  // Strip d="" wrapper if present
  const dAttrMatch = pathD.match(/^d="(.+)"$/s);
  if (dAttrMatch) {
    pathD = dAttrMatch[1];
  }

  return pathD;
}

// ─── Validation & Correction ──────────────────────────────────

interface ValidationResult {
  valid: boolean;
  pathD: string;
  actualW: number;
  actualH: number;
  deltaW: number;
  deltaH: number;
  corrected: boolean;
  error?: string;
}

function validateAndCorrect(
  pathD: string,
  expectedW: number,
  expectedH: number,
  tolerance: number,
): ValidationResult {
  const bounds = parseSvgPathBounds(pathD);

  if (bounds.width === 0 || bounds.height === 0) {
    return {
      valid: false,
      pathD,
      actualW: 0,
      actualH: 0,
      deltaW: expectedW,
      deltaH: expectedH,
      corrected: false,
      error: 'No coordinates found in path or path has zero dimensions',
    };
  }

  let deltaW = Math.abs(bounds.width - expectedW);
  let deltaH = Math.abs(bounds.height - expectedH);

  // Check if within tolerance as-is
  if (deltaW <= tolerance && deltaH <= tolerance) {
    return {
      valid: true,
      pathD,
      actualW: bounds.width,
      actualH: bounds.height,
      deltaW,
      deltaH,
      corrected: false,
    };
  }

  // Attempt affine correction
  console.log(
    `  Dimensions outside tolerance (W: ${bounds.width.toFixed(2)} vs ${expectedW}, H: ${bounds.height.toFixed(2)} vs ${expectedH}). Attempting correction...`,
  );

  // First translate to origin if needed
  let correctedPath = pathD;
  if (bounds.minX !== 0 || bounds.minY !== 0) {
    // Scale factors need to be computed relative to the actual content
    const scaleX = expectedW / bounds.width;
    const scaleY = expectedH / bounds.height;
    correctedPath = scaleSvgPath(pathD, scaleX, scaleY);
  } else {
    const scaleX = expectedW / bounds.width;
    const scaleY = expectedH / bounds.height;
    correctedPath = scaleSvgPath(pathD, scaleX, scaleY);
  }

  // Re-validate corrected path
  const correctedBounds = parseSvgPathBounds(correctedPath);
  deltaW = Math.abs(correctedBounds.width - expectedW);
  deltaH = Math.abs(correctedBounds.height - expectedH);

  if (deltaW <= tolerance && deltaH <= tolerance) {
    console.log(
      `  Correction successful: ${correctedBounds.width.toFixed(2)} x ${correctedBounds.height.toFixed(2)}`,
    );
    return {
      valid: true,
      pathD: correctedPath,
      actualW: correctedBounds.width,
      actualH: correctedBounds.height,
      deltaW,
      deltaH,
      corrected: true,
    };
  }

  return {
    valid: false,
    pathD: correctedPath,
    actualW: correctedBounds.width,
    actualH: correctedBounds.height,
    deltaW,
    deltaH,
    corrected: true,
    error: `Dimensional mismatch after correction: got ${correctedBounds.width.toFixed(2)}x${correctedBounds.height.toFixed(2)}, expected ${expectedW}x${expectedH} (delta W=${deltaW.toFixed(3)}, H=${deltaH.toFixed(3)}, tolerance=${tolerance})`,
  };
}

// ─── SVG Writer ───────────────────────────────────────────────

function writeSvg(
  slug: string,
  face: Face,
  pathD: string,
  bboxW: number,
  bboxH: number,
  outputDir: string,
): string {
  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const now = new Date().toISOString().split('T')[0];
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 ${bboxW} ${bboxH}"
     width="${bboxW}mm" height="${bboxH}mm">
  <!-- Generated by RackPro outline generator -->
  <!-- Device: ${slug}, Face: ${face} -->
  <!-- BBox: ${bboxW} x ${bboxH} mm -->
  <!-- Date: ${now} -->
  <path d="${pathD}" fill="none" stroke="black" stroke-width="0.5" />
</svg>
`;

  const filename = `${slug}-${face}.svg`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, svg, 'utf-8');
  return filepath;
}

// ─── CLI ──────────────────────────────────────────────────────

const program = new Command();

program
  .name('generate-outline')
  .description(
    'Generate a dimensioned SVG outline from a product photo using Claude Vision API',
  )
  .requiredOption('--slug <slug>', 'Device slug from catalog (e.g. usw-lite-16-poe)')
  .requiredOption('--face <face>', 'Device face: top, front, or side')
  .requiredOption('--image <path>', 'Path to product photo (JPEG or PNG)')
  .option(
    '--output <dir>',
    'Output directory for SVGs',
    'public/catalog/outlines',
  )
  .option(
    '--tolerance <mm>',
    'Max allowed dimensional deviation in mm',
    '0.5',
  )
  .option('--model <model>', 'Anthropic model to use', 'claude-sonnet-4-5')
  .option('--dry-run', 'Print the prompt and exit without calling the API')
  .action(async (opts) => {
    const {
      slug,
      face: faceStr,
      image: imagePath,
      output: outputDir,
      tolerance: toleranceStr,
      model,
      dryRun,
    } = opts;

    // Validate face
    const validFaces: Face[] = ['top', 'front', 'side'];
    if (!validFaces.includes(faceStr as Face)) {
      console.error(
        `Error: Invalid face "${faceStr}". Must be one of: ${validFaces.join(', ')}`,
      );
      process.exit(1);
    }
    const face = faceStr as Face;

    const tolerance = parseFloat(toleranceStr);
    if (isNaN(tolerance) || tolerance <= 0) {
      console.error(
        `Error: Invalid tolerance "${toleranceStr}". Must be a positive number.`,
      );
      process.exit(1);
    }

    // Load catalog and find device
    const catalogPath = path.resolve(
      process.cwd(),
      'public/catalog/devices.json',
    );
    const devices = loadCatalog(catalogPath);
    const device = findDevice(devices, slug);

    if (!device) {
      console.error(`Error: Device slug "${slug}" not found in catalog.`);
      console.error(
        'Available slugs:',
        devices.map((d) => d.slug).join(', '),
      );
      process.exit(1);
    }

    // Resolve bounding box
    const { bboxW, bboxH } = resolveBBox(device, face);
    console.log(`Device: ${device.name} (${slug})`);
    console.log(`Face: ${face}`);
    console.log(`BBox: ${bboxW} x ${bboxH} mm`);

    // Dry run: print prompt and exit
    if (dryRun) {
      console.log('\n--- DRY RUN: Prompt ---');
      console.log(buildPrompt(face, bboxW, bboxH));
      console.log('--- END ---');
      console.log(`\nImage: ${imagePath}`);
      console.log(`Output: ${outputDir}/${slug}-${face}.svg`);
      console.log(`Model: ${model}`);
      console.log(`Tolerance: ${tolerance}mm`);
      return;
    }

    // Preprocess image
    console.log(`\nPreprocessing image: ${imagePath}`);
    const { base64, mediaType } = await preprocessImage(imagePath);
    console.log(`  Image preprocessed (base64 length: ${base64.length})`);

    // Call Claude Vision API
    console.log(`\nCalling Claude Vision API (model: ${model})...`);
    let pathD: string;
    try {
      pathD = await callClaudeVision(
        base64,
        mediaType,
        face,
        bboxW,
        bboxH,
        model,
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      console.error(`Error: API call failed: ${message}`);
      process.exit(1);
    }

    const cmdCount = countPathCommands(pathD);
    console.log(`  Received path with ${cmdCount} commands`);

    // Validate and correct
    console.log(`\nValidating path dimensions (tolerance: ${tolerance}mm)...`);
    const result = validateAndCorrect(pathD, bboxW, bboxH, tolerance);

    if (!result.valid) {
      console.error(`\nError: ${result.error}`);
      console.error(`  Expected: ${bboxW} x ${bboxH} mm`);
      console.error(
        `  Got: ${result.actualW.toFixed(2)} x ${result.actualH.toFixed(2)} mm`,
      );
      console.error(
        `  Delta: W=${result.deltaW.toFixed(3)}, H=${result.deltaH.toFixed(3)}`,
      );
      process.exit(1);
    }

    // Write SVG
    const filepath = writeSvg(
      slug,
      face,
      result.pathD,
      bboxW,
      bboxH,
      path.resolve(process.cwd(), outputDir),
    );

    // Summary
    console.log('\n--- Summary ---');
    console.log(`  Slug: ${slug}`);
    console.log(`  Face: ${face}`);
    console.log(`  Expected BBox: ${bboxW} x ${bboxH} mm`);
    console.log(
      `  Actual Path BBox: ${result.actualW.toFixed(2)} x ${result.actualH.toFixed(2)} mm`,
    );
    console.log(
      `  Delta: W=${result.deltaW.toFixed(3)} mm, H=${result.deltaH.toFixed(3)} mm`,
    );
    console.log(`  Corrected: ${result.corrected ? 'yes' : 'no'}`);
    console.log(`  Path commands: ${cmdCount}`);
    console.log(`  Output: ${filepath}`);
  });

program.parse();
