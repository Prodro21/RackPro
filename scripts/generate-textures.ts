/**
 * Procedural PBR texture generator for RackPro 3D preview.
 * Generates tileable normal maps and roughness maps at 1024x1024.
 *
 * Normal map convention: R=X, G=Y, B=Z (OpenGL style, Z up = 128,128,255 base)
 *
 * Run: npx tsx scripts/generate-textures.ts
 */
import sharp from 'sharp';
import path from 'node:path';

const SIZE = 1024;
const OUT = path.resolve(import.meta.dirname ?? '.', '..', 'public', 'textures');

/** Clamp to 0-255 */
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Brushed metal normal map — horizontal directional grain lines.
 * Simulates fine brush strokes along X axis.
 */
async function generateBrushedMetalNormal(): Promise<void> {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  // Seed a repeatable pseudo-random sequence
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let y = 0; y < SIZE; y++) {
    // Each row has a consistent grain direction with slight variation
    const rowBias = (rand() - 0.5) * 30; // Y-axis bias per row
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 3;
      // High-frequency X variation simulating brush strokes
      const xNoise = (rand() - 0.5) * 40;
      // Subtle Y perturbation from row-to-row (directional grain)
      const yNoise = rowBias + (rand() - 0.5) * 8;
      buf[idx + 0] = clamp(128 + xNoise);  // R = X
      buf[idx + 1] = clamp(128 + yNoise);  // G = Y
      buf[idx + 2] = clamp(255 - Math.abs(xNoise) * 0.5); // B = Z (slightly less when displaced)
    }
  }

  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 90 })
    .toFile(path.join(OUT, 'brushed-metal-normal.jpg'));
  console.log('  brushed-metal-normal.jpg');
}

/**
 * Brushed metal roughness map — horizontal streaks of varying roughness.
 * Lighter = rougher, darker = smoother.
 */
async function generateBrushedMetalRoughness(): Promise<void> {
  const buf = Buffer.alloc(SIZE * SIZE);
  let seed = 137;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let y = 0; y < SIZE; y++) {
    // Each row gets a base roughness level (brush direction)
    const rowBase = 100 + rand() * 80; // 100-180 range
    for (let x = 0; x < SIZE; x++) {
      const idx = y * SIZE + x;
      // Fine variation along the brush direction
      const noise = (rand() - 0.5) * 50;
      buf[idx] = clamp(rowBase + noise);
    }
  }

  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .jpeg({ quality: 90 })
    .toFile(path.join(OUT, 'brushed-metal-roughness.jpg'));
  console.log('  brushed-metal-roughness.jpg');
}

/**
 * Carbon fiber normal map — 2x2 twill weave pattern.
 * Creates a repeating woven fiber texture.
 */
async function generateCarbonFiberNormal(): Promise<void> {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  // Weave repeat unit: ~32px at 1024 resolution (roughly 4mm at panel scale)
  const weaveSize = 32;
  const halfWeave = weaveSize / 2;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 3;
      const wx = x % weaveSize;
      const wy = y % weaveSize;

      // 2x2 twill pattern: alternating over/under
      const inWarpOver = (wx < halfWeave && wy < halfWeave) || (wx >= halfWeave && wy >= halfWeave);

      // Fiber direction: warp = vertical, weft = horizontal
      let nx = 0, ny = 0;

      if (inWarpOver) {
        // Warp fiber (runs vertically) — slight curvature at edges
        const localX = wx < halfWeave ? wx : wx - halfWeave;
        const edge = Math.abs(localX - halfWeave / 2) / (halfWeave / 2);
        nx = (localX < halfWeave / 2 ? -1 : 1) * edge * 25;
        ny = 0;
      } else {
        // Weft fiber (runs horizontally) — slight curvature at edges
        const localY = wy < halfWeave ? wy : wy - halfWeave;
        const edge = Math.abs(localY - halfWeave / 2) / (halfWeave / 2);
        nx = 0;
        ny = (localY < halfWeave / 2 ? -1 : 1) * edge * 25;
      }

      // Boundary emphasis — bump at transition
      const atBoundaryX = wx === 0 || wx === halfWeave;
      const atBoundaryY = wy === 0 || wy === halfWeave;
      if (atBoundaryX) nx += 15;
      if (atBoundaryY) ny += 15;

      buf[idx + 0] = clamp(128 + nx);
      buf[idx + 1] = clamp(128 + ny);
      buf[idx + 2] = clamp(250 - Math.abs(nx) * 0.3 - Math.abs(ny) * 0.3);
    }
  }

  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 90 })
    .toFile(path.join(OUT, 'carbon-fiber-normal.jpg'));
  console.log('  carbon-fiber-normal.jpg');
}

/**
 * Plastic layer-line normal map — horizontal parallel lines at FDM layer height.
 * Simulates 0.2mm layer lines. At 1024px covering ~100mm of panel surface,
 * each pixel is ~0.1mm, so a layer line repeats every ~2px.
 */
async function generatePlasticLayerlineNormal(): Promise<void> {
  const buf = Buffer.alloc(SIZE * SIZE * 3);
  // Layer line period in pixels (represents ~0.2mm layer height)
  const period = 3; // ~3px per layer line for visible effect at this resolution

  let seed = 73;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let y = 0; y < SIZE; y++) {
    // Sinusoidal bump per layer line (affects Y normal)
    const phase = (y % period) / period;
    const nyBase = Math.sin(phase * Math.PI * 2) * 12; // subtle +-12

    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 3;
      // Slight per-pixel noise for organic feel
      const nxNoise = (rand() - 0.5) * 4;
      const nyNoise = (rand() - 0.5) * 3;

      buf[idx + 0] = clamp(128 + nxNoise);
      buf[idx + 1] = clamp(128 + nyBase + nyNoise);
      buf[idx + 2] = clamp(252 - Math.abs(nyBase) * 0.2);
    }
  }

  await sharp(buf, { raw: { width: SIZE, height: SIZE, channels: 3 } })
    .jpeg({ quality: 90 })
    .toFile(path.join(OUT, 'plastic-layerline-normal.jpg'));
  console.log('  plastic-layerline-normal.jpg');
}

async function main() {
  console.log('Generating PBR textures to public/textures/...');
  await generateBrushedMetalNormal();
  await generateBrushedMetalRoughness();
  await generateCarbonFiberNormal();
  await generatePlasticLayerlineNormal();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
