import { useState, useMemo, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useConfigStore, selectPanelDims, selectPanelHeight, selectBores, selectEnclosureStyle, selectMountHoleDiameter } from '../store';
import { EIA, BASE, HEX } from '../constants/eia310';
import { lookupDevice } from '../constants/deviceLookup';
import { lookupConnector } from '../constants/connectorLookup';
import { FANS } from '../constants/fans';
import { useEnclosure, type TrayGeometry } from '../hooks/useEnclosure';
import { buildCSGFaceplate, csgCacheKey, type CutoutDef } from '../lib/csg';

/** Build an ExtrudeGeometry for a hex-lightweighted tray floor.
 *  Creates a rectangle with hexagonal holes punched through it. */
function buildHexFloorGeo(w: number, d: number, t: number, sc: number): THREE.ExtrudeGeometry {
  const spacing = HEX.SPACING;
  const strut = HEX.STRUT;
  const frame = Math.min(w, d) >= HEX.FRAME_THRESHOLD ? HEX.FRAME_LARGE : HEX.FRAME;

  // Outer rectangle (centered at origin in XZ mapped to XY for Shape)
  const hw = w / 2, hd = d / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw * sc, -hd * sc);
  shape.lineTo(hw * sc, -hd * sc);
  shape.lineTo(hw * sc, hd * sc);
  shape.lineTo(-hw * sc, hd * sc);
  shape.closePath();

  // Hex hole parameters
  const cos30 = Math.cos(Math.PI / 6);
  const r = (spacing - strut) / (2 * cos30);
  if (r <= 0.5) return new THREE.ExtrudeGeometry(shape, { depth: t * sc, bevelEnabled: false });

  const innerW = w - 2 * frame;
  const innerD = d - 2 * frame;
  if (innerW <= spacing || innerD <= spacing)
    return new THREE.ExtrudeGeometry(shape, { depth: t * sc, bevelEnabled: false });

  const rowSpacing = spacing * Math.sin(Math.PI / 3);
  const xMin = -innerW / 2 + spacing / 2;
  const xMax = innerW / 2 - spacing / 2;
  const yMin = -innerD / 2 + spacing / 2;
  const yMax = innerD / 2 - spacing / 2;

  let row = 0;
  let cy = yMin;
  while (cy <= yMax) {
    const xOff = (row % 2 === 1) ? spacing / 2 : 0;
    let cx = xMin + xOff;
    while (cx <= xMax) {
      const hole = new THREE.Path();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const px = (cx + r * Math.cos(a)) * sc;
        const py = (cy + r * Math.sin(a)) * sc;
        if (k === 0) hole.moveTo(px, py);
        else hole.lineTo(px, py);
      }
      hole.closePath();
      shape.holes.push(hole);
      cx += spacing;
    }
    cy += rowSpacing;
    row++;
  }

  return new THREE.ExtrudeGeometry(shape, { depth: t * sc, bevelEnabled: false });
}

const MATERIAL_PANEL = new THREE.MeshStandardMaterial({ color: '#2a2a35', metalness: 0.3, roughness: 0.7 });
const MATERIAL_WALL = new THREE.MeshStandardMaterial({ color: '#1e1e26', metalness: 0.2, roughness: 0.8 });
const MATERIAL_EAR = new THREE.MeshStandardMaterial({ color: '#1a1a22', metalness: 0.4, roughness: 0.6 });
const MATERIAL_TRAY = new THREE.MeshStandardMaterial({ color: '#1a1a22', metalness: 0.2, roughness: 0.8, transparent: true, opacity: 0.5 });
const MATERIAL_HEX_TRAY = new THREE.MeshStandardMaterial({ color: '#2a2a35', metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide });

/** Renders a single device tray — hex-lightweighted floor + U-channel side walls. */
function TrayMesh({ tray, panW, panH, wallT, scale }: {
  tray: TrayGeometry; panW: number; panH: number; wallT: number; scale: number;
}) {
  const trayX = (tray.x - panW / 2) * scale;
  // Floor sits at the bottom of the device cutout (not the panel bottom)
  // tray.y = element center Y from panel top; convert to 3D bottom edge
  const floorY = (panH / 2 - tray.y - tray.h / 2) * scale;
  // Tray extends behind faceplate (negative Z)
  const trayZ = -(tray.d / 2) * scale;
  const isHex = tray.floorStyle === 'hex';

  // Side wall height = BASE.UNIT (15mm), matching OpenSCAD reference
  const sideH = BASE.UNIT;

  const hexGeo = useMemo(() => {
    if (!isHex) return null;
    return buildHexFloorGeo(tray.w, tray.d, tray.wallT, scale);
  }, [isHex, tray.w, tray.d, tray.wallT, scale]);

  // Floor mesh — hex-lightweighted or solid
  const floor = isHex && hexGeo ? (
    <mesh
      geometry={hexGeo}
      material={MATERIAL_HEX_TRAY}
      // ExtrudeGeometry built in XY plane, rotated -90° X to lay flat as floor (XZ)
      // After rotation, Y→-Z, so shape centered at origin spans Z from +d/2 to -d/2
      // Shift by -d/2 so the entire floor is behind the faceplate (negative Z)
      position={[trayX, floorY, trayZ]}
      rotation={[-Math.PI / 2, 0, 0]}
    />
  ) : (
    <mesh position={[trayX, floorY + tray.wallT / 2 * scale, trayZ]} material={MATERIAL_TRAY}>
      <boxGeometry args={[tray.w * scale, tray.wallT * scale, tray.d * scale]} />
    </mesh>
  );

  // Side walls (left + right) forming the U-channel
  const wallHalfW = tray.w / 2;
  const sideWallY = floorY + (sideH / 2) * scale;

  // Wedge stopper dimensions (from OpenSCAD reference)
  const wedgeW = tray.wallT;
  const wedgeH = sideH;
  const wedgeD = BASE.UNIT - tray.wallT; // ~13mm for 2mm walls
  const wedgeZ = -(tray.d - wedgeD / 2) * scale; // at rear edge of tray

  // Stabilizer gussets for tall devices (h > 2 * BASE.UNIT = 30mm)
  const needsStabilizers = tray.h > 2 * BASE.UNIT;
  const stabH = needsStabilizers ? Math.min(tray.h - sideH, tray.d) : 0;
  const stabD = needsStabilizers ? Math.min(stabH, tray.d) : 0;
  const stabY = sideWallY + (sideH / 2 + stabH / 2) * scale;
  // Stabilizer centered in front portion of tray
  const stabZ = -(stabD / 2) * scale;

  return (
    <group>
      {floor}
      {/* Left side wall */}
      <mesh position={[trayX - (wallHalfW - tray.wallT / 2) * scale, sideWallY, trayZ]} material={MATERIAL_WALL}>
        <boxGeometry args={[tray.wallT * scale, sideH * scale, tray.d * scale]} />
      </mesh>
      {/* Right side wall */}
      <mesh position={[trayX + (wallHalfW - tray.wallT / 2) * scale, sideWallY, trayZ]} material={MATERIAL_WALL}>
        <boxGeometry args={[tray.wallT * scale, sideH * scale, tray.d * scale]} />
      </mesh>

      {/* Left wedge stopper */}
      <mesh position={[trayX - (wallHalfW - wedgeW / 2) * scale, sideWallY, wedgeZ]} material={MATERIAL_WALL}>
        <boxGeometry args={[wedgeW * scale, wedgeH * scale, wedgeD * scale]} />
      </mesh>
      {/* Right wedge stopper */}
      <mesh position={[trayX + (wallHalfW - wedgeW / 2) * scale, sideWallY, wedgeZ]} material={MATERIAL_WALL}>
        <boxGeometry args={[wedgeW * scale, wedgeH * scale, wedgeD * scale]} />
      </mesh>

      {/* Stabilizer gussets (tall devices only) */}
      {needsStabilizers && (
        <>
          {/* Left stabilizer */}
          <mesh position={[trayX - (wallHalfW - tray.wallT / 2) * scale, stabY, stabZ]} material={MATERIAL_WALL}>
            <boxGeometry args={[tray.wallT * scale, stabH * scale, stabD * scale]} />
          </mesh>
          {/* Right stabilizer */}
          <mesh position={[trayX + (wallHalfW - tray.wallT / 2) * scale, stabY, stabZ]} material={MATERIAL_WALL}>
            <boxGeometry args={[tray.wallT * scale, stabH * scale, stabD * scale]} />
          </mesh>
        </>
      )}
    </group>
  );
}

function EnclosureMesh() {
  const enclosure = useEnclosure();
  const elements = useConfigStore(s => s.elements);
  const fabMethod = useConfigStore(s => s.fabMethod);
  const flangeDepth = useConfigStore(s => s.flangeDepth);
  const enclosureStyle = useConfigStore(selectEnclosureStyle);
  const panDims = useConfigStore(selectPanelDims);
  const panH = useConfigStore(selectPanelHeight);
  const bores = useConfigStore(selectBores);
  const boreDia = useConfigStore(selectMountHoleDiameter);

  const { panelWidth: panW, totalWidth: totW } = panDims;
  const { depth, faceplate, rearPanel } = enclosure;
  const wallT = faceplate.t;

  // Convert mm to scene units (1 unit = 1mm, but we'll scale the scene)
  const scale = 0.01; // 100mm = 1 scene unit

  // Collect cutout definitions from all placed elements
  const cutouts = useMemo<CutoutDef[]>(() => {
    const defs: CutoutDef[] = [];
    for (const el of elements) {
      if (el.type === 'connector') {
        const con = lookupConnector(el.key);
        if (!con) continue;
        const cutType = (con.cut === 'round' || con.cut === 'd-shape') ? con.cut : 'rect' as const;
        defs.push({
          x: el.x, y: el.y,
          w: con.cut === 'd-sub' ? con.w : el.w,
          h: con.cut === 'd-sub' ? con.h : el.h,
          r: con.r,
          type: cutType === 'round' || cutType === 'd-shape' ? cutType : (con.cut === 'd-sub' ? 'd-sub' : 'rect'),
        });
      } else if (el.type === 'fan') {
        const fan = FANS[el.key];
        if (!fan) continue;
        // Fan cutout is a circle (cutoutDiameter)
        defs.push({
          x: el.x, y: el.y,
          w: fan.size, h: fan.size,
          r: fan.cutoutDiameter / 2,
          type: 'round',
        });
      } else {
        // Device: rectangular cutout
        const dev = lookupDevice(el.key);
        if (!dev) continue;
        defs.push({
          x: el.x, y: el.y,
          w: el.w, h: el.h,
          type: 'rect',
        });
      }
    }
    return defs;
  }, [elements]);

  // Build CSG faceplate with cutout holes, cached on cutout positions
  const cacheKey = csgCacheKey(cutouts);
  const faceplateGeo = useMemo(() => {
    try {
      return buildCSGFaceplate(panW, panH, wallT, cutouts, scale);
    } catch (err) {
      console.warn('[Preview3D] CSG computation failed, falling back to solid faceplate:', err);
      return new THREE.BoxGeometry(panW * scale, panH * scale, wallT * scale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, panW, panH, wallT]);

  return (
    <group>
      {/* Faceplate with CSG-subtracted cutout holes */}
      <mesh geometry={faceplateGeo} material={MATERIAL_PANEL} position={[0, 0, 0]} />

      {/* Ears */}
      {[0, 1].map(s => {
        const earX = s === 0
          ? -(panW / 2 + EIA.EAR_WIDTH / 2) * scale
          : (panW / 2 + EIA.EAR_WIDTH / 2) * scale;
        return (
          <mesh key={`ear${s}`} position={[earX, 0, 0]} material={MATERIAL_EAR}>
            <boxGeometry args={[EIA.EAR_WIDTH * scale, panH * scale, wallT * scale]} />
          </mesh>
        );
      })}

      {/* Bore holes on ears */}
      {bores.map((by, i) => [0, 1].map(s => {
        const earX = s === 0
          ? -(panW / 2 + EIA.EAR_WIDTH / 2) * scale
          : (panW / 2 + EIA.EAR_WIDTH / 2) * scale;
        const boreY = (panH / 2 - by) * scale;
        return (
          <mesh key={`bore${i}${s}`} position={[earX, boreY, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[boreDia / 2 * scale, boreDia / 2 * scale, wallT * scale + 0.002, 16]} />
            <meshStandardMaterial color="#0e0e12" />
          </mesh>
        );
      }))}

      {/* Top wall (box style only) */}
      {enclosureStyle === 'box' && (
        <mesh position={[0, panH / 2 * scale - wallT / 2 * scale, -depth / 2 * scale]} material={MATERIAL_WALL}>
          <boxGeometry args={[panW * scale, wallT * scale, depth * scale]} />
        </mesh>
      )}

      {/* Bottom wall (box style only) */}
      {enclosureStyle === 'box' && (
        <mesh position={[0, -panH / 2 * scale + wallT / 2 * scale, -depth / 2 * scale]} material={MATERIAL_WALL}>
          <boxGeometry args={[panW * scale, wallT * scale, depth * scale]} />
        </mesh>
      )}

      {/* Per-device retention lips — 4 bars framing each device cutout on faceplate interior */}
      {elements.filter(e => e.type === 'device').map(el => {
        if (!lookupDevice(el.key)) return null;
        const lipW = (el.w + BASE.TOLERANCE) * scale;
        const lipH = (el.h + BASE.TOLERANCE) * scale;
        const lipD = flangeDepth * scale;
        const lipX = (el.x - panW / 2) * scale;
        const lipY = (panH / 2 - el.y) * scale;
        const lipZ = -lipD / 2;
        const barT = wallT * scale;
        return (
          <group key={`lip-${el.id}`}>
            {/* Top lip bar */}
            <mesh position={[lipX, lipY + lipH / 2 - barT / 2, lipZ]} material={MATERIAL_WALL}>
              <boxGeometry args={[lipW, barT, lipD]} />
            </mesh>
            {/* Bottom lip bar */}
            <mesh position={[lipX, lipY - lipH / 2 + barT / 2, lipZ]} material={MATERIAL_WALL}>
              <boxGeometry args={[lipW, barT, lipD]} />
            </mesh>
            {/* Left lip bar */}
            <mesh position={[lipX - lipW / 2 + barT / 2, lipY, lipZ]} material={MATERIAL_WALL}>
              <boxGeometry args={[barT, lipH - barT * 2, lipD]} />
            </mesh>
            {/* Right lip bar */}
            <mesh position={[lipX + lipW / 2 - barT / 2, lipY, lipZ]} material={MATERIAL_WALL}>
              <boxGeometry args={[barT, lipH - barT * 2, lipD]} />
            </mesh>
          </group>
        );
      })}

      {/* Rear panel */}
      {rearPanel && (
        <mesh position={[0, 0, -depth * scale]} material={MATERIAL_PANEL}>
          <boxGeometry args={[rearPanel.w * scale, rearPanel.h * scale, rearPanel.t * scale]} />
        </mesh>
      )}

      {/* Device trays */}
      {enclosure.trays.map(tray => (
        <TrayMesh key={tray.elementId} tray={tray} panW={panW} panH={panH} wallT={wallT} scale={scale} />
      ))}
    </group>
  );
}

export function Preview3D({ frameloop = 'always' }: { frameloop?: 'always' | 'never' | 'demand' }) {
  const [wireframe, setWireframe] = useState(false);

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Toolbar */}
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <button
          onClick={() => setWireframe(!wireframe)}
          className="px-2 py-1 text-[9px] font-bold rounded border border-border font-mono"
          style={{ background: wireframe ? '#f7b600' : '#1a1a22', color: wireframe ? '#111' : '#888' }}
        >
          {wireframe ? 'SOLID' : 'WIRE'}
        </button>
      </div>

      <Canvas
        frameloop={frameloop}
        camera={{ position: [3, 2, 4], fov: 50 }}
        className="flex-1"
        style={{ background: '#0e0e12' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-3, 2, -2]} intensity={0.3} />
        <Suspense fallback={null}>
          <Environment preset="studio" />
          <EnclosureMesh />
        </Suspense>
        <OrbitControls makeDefault />
        <Grid
          args={[10, 10]}
          position={[0, -0.5, 0]}
          cellSize={0.1}
          cellColor="#1a1a22"
          sectionSize={1}
          sectionColor="#252530"
          fadeDistance={10}
        />
      </Canvas>
    </div>
  );
}
