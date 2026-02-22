import type { ExportConfig, ExportElement, FabConfig3DP, FabConfigSM } from '../types';
import { FANS } from '../constants/fans';
import { BORE_HOLES } from '../constants/eia310';
import { MOUNTING } from '../constants/mounting';
import { computeTrayDimensions, computeMountPositions, computeAlignPositions } from '../lib/trayGeometry';
import { computeTrayReinforcement } from '../lib/trayReinforcement';
import { DEVICES } from '../constants/devices';
import { lookupDevice } from '../constants/deviceLookup';

/**
 * Generates a Fusion 360 Python API script from the export config.
 * All geometry is created in the root component as separate bodies.
 */
export function generateFusion360(config: ExportConfig): string {
  if (config.assembly?.mode === 'modular') {
    return emitModularBuild(config);
  }
  return emitMonolithicBuild(config);
}

function emitMonolithicBuild(config: ExportConfig): string {
  const { panelWidth: panW, panelHeight: panH, totalWidth: totW, mountHoleType } = config.panel;
  const { depth, flangeDepth, rearPanel, ventSlots } = config.enclosure;
  const is3dp = config.fabrication.method === '3D Print';
  const wallT = is3dp
    ? (config.fabrication as FabConfig3DP).wallThickness
    : (config.fabrication as FabConfigSM).thickness;
  const earW = 15.875;
  const rackH = config.panel.uHeight * 44.45;
  const boreR = (BORE_HOLES[mountHoleType ?? '#10-32']?.diameter ?? 4.83) / 2;

  const connectors = config.elements.filter(e => e.type === 'connector');
  const devices = config.elements.filter(e => e.type === 'device');

  const lines: string[] = [];
  const L = (s: string) => { lines.push(s); };

  // ── Header ──
  L(`# RackPro — Fusion 360 Parametric Script`);
  L(`# Standard: ${config.panel.standard}" rack, ${config.panel.uHeight}U`);
  L(`# Generated: ${new Date().toISOString()}`);
  L(`# Run via: Fusion 360 → Utilities → Scripts and Add-Ins → Run`);
  L(`#`);
  L(`# All dimensions in cm (Fusion internal unit). mm() helper converts.`);
  L(``);
  L(`import adsk.core, adsk.fusion, traceback, math`);
  L(``);

  L(`def mm(v):`);
  L(`    """Convert mm to cm for Fusion 360 internal units."""`);
  L(`    return v / 10.0`);
  L(``);

  L(`def create_rect_sketch(sketch, cx_mm, cy_mm, w_mm, h_mm):`);
  L(`    """Draw a centered rectangle in a sketch. Returns the sketch."""`);
  L(`    sl = sketch.sketchCurves.sketchLines`);
  L(`    x1, y1 = mm(cx_mm - w_mm/2), mm(cy_mm - h_mm/2)`);
  L(`    x2, y2 = mm(cx_mm + w_mm/2), mm(cy_mm + h_mm/2)`);
  L(`    p0 = adsk.core.Point3D.create(x1, y1, 0)`);
  L(`    p1 = adsk.core.Point3D.create(x2, y1, 0)`);
  L(`    p2 = adsk.core.Point3D.create(x2, y2, 0)`);
  L(`    p3 = adsk.core.Point3D.create(x1, y2, 0)`);
  L(`    sl.addByTwoPoints(p0, p1)`);
  L(`    sl.addByTwoPoints(p1, p2)`);
  L(`    sl.addByTwoPoints(p2, p3)`);
  L(`    sl.addByTwoPoints(p3, p0)`);
  L(`    return sketch`);
  L(``);

  L(`def extrude_profile(comp, sketch, thickness_mm, operation, profile_idx=0):`);
  L(`    """Extrude a profile from a sketch."""`);
  L(`    prof = sketch.profiles.item(profile_idx)`);
  L(`    ext = comp.features.extrudeFeatures`);
  L(`    inp = ext.createInput(prof, operation)`);
  L(`    inp.setDistanceExtent(False, adsk.core.ValueInput.createByReal(mm(thickness_mm)))`);
  L(`    return ext.add(inp)`);
  L(``);

  L(`def move_body(comp, body, dx_mm, dy_mm, dz_mm):`);
  L(`    """Translate a body by (dx, dy, dz) in mm."""`);
  L(`    mf = comp.features.moveFeatures`);
  L(`    col = adsk.core.ObjectCollection.create()`);
  L(`    col.add(body)`);
  L(`    t = adsk.core.Matrix3D.create()`);
  L(`    t.translation = adsk.core.Vector3D.create(mm(dx_mm), mm(dy_mm), mm(dz_mm))`);
  L(`    mf.add(mf.createInput(col, t))`);
  L(``);

  // ── Main ──
  L(`def run(context):`);
  L(`    ui = None`);
  L(`    try:`);
  L(`        app = adsk.core.Application.get()`);
  L(`        ui = app.userInterface`);
  L(`        design = adsk.fusion.Design.cast(app.activeProduct)`);
  L(`        if not design:`);
  L(`            ui.messageBox('No active Fusion design')`);
  L(`            return`);
  L(``);
  L(`        root = design.rootComponent`);
  L(`        sketches = root.sketches`);
  L(`        xyPlane = root.xYConstructionPlane`);
  L(`        xzPlane = root.xZConstructionPlane`);
  L(`        extrudes = root.features.extrudeFeatures`);
  L(`        NEW = adsk.fusion.FeatureOperations.NewBodyFeatureOperation`);
  L(`        JOIN = adsk.fusion.FeatureOperations.JoinFeatureOperation`);
  L(`        CUT = adsk.fusion.FeatureOperations.CutFeatureOperation`);
  L(``);

  // ── User Parameters ──
  L(`        # ═══ User Parameters ═══`);
  L(`        try:`);
  L(`            params = design.userParameters`);
  emitParam(L, 'panelWidth', panW);
  emitParam(L, 'panelHeight', panH);
  emitParam(L, 'totalWidth', totW);
  emitParam(L, 'earWidth', earW);
  emitParam(L, 'wallThickness', wallT);
  emitParam(L, 'flangeDepth', flangeDepth);
  emitParam(L, 'enclosureDepth', depth);
  L(`        except: pass  # Parameters may already exist`);
  L(``);

  // ── Faceplate ──
  L(`        # ═══ Faceplate ═══`);
  L(`        sk = sketches.add(xyPlane)`);
  L(`        sk.name = 'Faceplate'`);
  L(`        create_rect_sketch(sk, 0, 0, ${panW}, ${panH})`);
  L(`        faceExt = extrude_profile(root, sk, ${wallT}, NEW)`);
  L(`        faceExt.name = 'Faceplate'`);
  L(``);

  // ── Ears ──
  L(`        # ═══ Mounting Ears ═══`);
  L(`        skEar = sketches.add(xyPlane)`);
  L(`        skEar.name = 'Ears'`);
  L(`        create_rect_sketch(skEar, ${(-(panW / 2 + earW / 2)).toFixed(4)}, 0, ${earW}, ${panH})`);
  L(`        create_rect_sketch(skEar, ${((panW / 2 + earW / 2)).toFixed(4)}, 0, ${earW}, ${panH})`);
  L(`        for i in range(skEar.profiles.count):`);
  L(`            extrude_profile(root, skEar, ${wallT}, JOIN, i)`);
  L(``);

  // ── Mounting Bores ──
  L(`        # ═══ EIA-310 Mounting Bores ═══`);
  L(`        skBore = sketches.add(xyPlane)`);
  L(`        skBore.name = 'Bores'`);
  L(`        circles = skBore.sketchCurves.sketchCircles`);
  const boreYs: number[] = [];
  for (let u = 0; u < config.panel.uHeight; u++) {
    const base = u * 44.45;
    boreYs.push(base + 6.35, base + 22.225, base + 38.1);
  }
  for (const by of boreYs) {
    const yOff = rackH / 2 - by;
    L(`        circles.addByCenterRadius(adsk.core.Point3D.create(mm(${(-(panW / 2 + earW / 2)).toFixed(4)}), mm(${yOff.toFixed(4)}), 0), mm(${boreR.toFixed(4)}))`);
    L(`        circles.addByCenterRadius(adsk.core.Point3D.create(mm(${((panW / 2 + earW / 2)).toFixed(4)}), mm(${yOff.toFixed(4)}), 0), mm(${boreR.toFixed(4)}))`);
  }
  L(`        # Cut bore holes through ears (${mountHoleType ?? '#10-32'} \u2300${(boreR * 2).toFixed(2)}mm)`);
  L(`        for i in range(skBore.profiles.count):`);
  L(`            prof = skBore.profiles.item(i)`);
  L(`            try:`);
  L(`                area = prof.areaProperties().area`);
  L(`                if area < mm(${boreR.toFixed(4)})**2 * 3.15:`);
  L(`                    inp = extrudes.createInput(prof, CUT)`);
  L(`                    inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)`);
  L(`                    extrudes.add(inp)`);
  L(`            except: pass`);
  L(``);

  // ── Cutouts ──
  if (connectors.length > 0 || devices.length > 0) {
    L(`        # ═══ Cutouts ═══`);
    L(`        skCut = sketches.add(xyPlane)`);
    L(`        skCut.name = 'Cutouts'`);

    for (const el of connectors) {
      emitCutoutSketch(L, el, panW, panH);
    }

    for (const el of devices) {
      const cx = el.x - panW / 2;
      const cy = panH / 2 - el.y;
      L(`        # ${el.label} — device bay ${el.w}x${el.h}mm`);
      L(`        create_rect_sketch(skCut, ${cx.toFixed(4)}, ${cy.toFixed(4)}, ${(el.w + 0.2).toFixed(2)}, ${(el.h + 0.2).toFixed(2)})`);
    }

    L(`        # Cut all cutouts through faceplate`);
    L(`        for i in range(skCut.profiles.count):`);
    L(`            prof = skCut.profiles.item(i)`);
    L(`            try:`);
    L(`                area = prof.areaProperties().area`);
    L(`                if area < mm(${panW}) * mm(${panH}) * 0.9:`);
    L(`                    inp = extrudes.createInput(prof, CUT)`);
    L(`                    inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)`);
    L(`                    extrudes.add(inp)`);
    L(`            except: pass`);
    L(``);
  }

  // ── Enclosure Walls (box style only) ──
  const style = config.enclosure.style ?? 'tray';
  const shellBodies: string[] = [];
  if (style === 'box') {
    L(`        # ═══ Enclosure Walls ═══`);
    L(`        # XZ plane: sketch_Y = -world_Z, positive sketch_Y → behind faceplate`);
    L(`        skTop = sketches.add(xzPlane)`);
    L(`        skTop.name = 'Top Wall'`);
    L(`        create_rect_sketch(skTop, 0, ${(wallT + depth / 2).toFixed(4)}, ${panW}, ${depth})`);
    L(`        topExt = extrude_profile(root, skTop, ${wallT}, NEW)`);
    L(`        topExt.name = 'Top Wall'`);
    L(`        move_body(root, topExt.bodies.item(0), 0, ${(panH / 2 - wallT).toFixed(4)}, 0)`);
    L(``);
    L(`        skBot = sketches.add(xzPlane)`);
    L(`        skBot.name = 'Bottom Wall'`);
    L(`        create_rect_sketch(skBot, 0, ${(wallT + depth / 2).toFixed(4)}, ${panW}, ${depth})`);
    L(`        botExt = extrude_profile(root, skBot, ${wallT}, NEW)`);
    L(`        botExt.name = 'Bottom Wall'`);
    L(`        move_body(root, botExt.bodies.item(0), 0, ${(-(panH / 2)).toFixed(4)}, 0)`);
    L(``);
    shellBodies.push('topExt', 'botExt');
  }

  // ── Flanges (retention lips) ──
  const enableFlanges = config.enclosure.flanges !== false;
  if (enableFlanges) {
    L(`        # ═══ Flanges ═══`);
    L(`        skFlgT = sketches.add(xzPlane)`);
    L(`        skFlgT.name = 'Top Flange'`);
    L(`        create_rect_sketch(skFlgT, 0, ${(wallT + flangeDepth / 2).toFixed(4)}, ${panW}, ${flangeDepth})`);
    L(`        flgTopExt = extrude_profile(root, skFlgT, ${wallT}, NEW)`);
    L(`        flgTopExt.name = 'Top Flange'`);
    L(`        move_body(root, flgTopExt.bodies.item(0), 0, ${(panH / 2 - 2 * wallT).toFixed(4)}, 0)`);
    L(``);
    L(`        skFlgB = sketches.add(xzPlane)`);
    L(`        skFlgB.name = 'Bottom Flange'`);
    L(`        create_rect_sketch(skFlgB, 0, ${(wallT + flangeDepth / 2).toFixed(4)}, ${panW}, ${flangeDepth})`);
    L(`        flgBotExt = extrude_profile(root, skFlgB, ${wallT}, NEW)`);
    L(`        flgBotExt.name = 'Bottom Flange'`);
    L(`        move_body(root, flgBotExt.bodies.item(0), 0, ${(-(panH / 2) + wallT).toFixed(4)}, 0)`);
    L(``);
    shellBodies.push('flgTopExt', 'flgBotExt');
  }

  // ── Device Trays (U-channel on XZ plane) ──
  if (devices.length > 0) {
    L(`        # ═══ Device Trays (U-channel) ═══`);
    devices.forEach((el, i) => {
      const td = el.depthBehind;
      const tw = Math.max(wallT, 2 + Math.max(0, (td - 100) * 0.02));
      const floorT = Math.max(2, tw * 0.8);
      const innerW = el.w + 0.2;
      const totalW = innerW + 2 * tw;
      const sideH = 15;  // BASE_UNIT
      const cx = el.x - panW / 2;
      const cy = panH / 2 - el.y;
      const floorY = cy - el.h / 2 - floorT;

      L(`        # ─── Tray ${i}: ${el.label} ───`);
      // Floor — XZ plane: sketch_Y = -world_Z, offset by wallT for faceplate back face
      L(`        skTF${i} = sketches.add(xzPlane)`);
      L(`        skTF${i}.name = 'Tray Floor ${i}'`);
      L(`        create_rect_sketch(skTF${i}, ${cx.toFixed(4)}, ${(wallT + td / 2).toFixed(4)}, ${totalW.toFixed(2)}, ${td})`);
      L(`        tfExt${i} = extrude_profile(root, skTF${i}, ${floorT.toFixed(2)}, NEW)`);
      L(`        move_body(root, tfExt${i}.bodies.item(0), 0, ${floorY.toFixed(4)}, 0)`);
      L(``);

      // Side walls
      L(`        # Side walls (${sideH}mm tall)`);
      for (const [side, xOff] of [['Left', -(innerW / 2 + tw / 2)], ['Right', innerW / 2 + tw / 2]] as const) {
        L(`        skTW${i}${side[0]} = sketches.add(xzPlane)`);
        L(`        create_rect_sketch(skTW${i}${side[0]}, ${(cx + xOff).toFixed(4)}, ${(wallT + td / 2).toFixed(4)}, ${tw.toFixed(2)}, ${td})`);
        L(`        twExt${i}${side[0]} = extrude_profile(root, skTW${i}${side[0]}, ${sideH}, NEW)`);
        L(`        move_body(root, twExt${i}${side[0]}.bodies.item(0), 0, ${floorY.toFixed(4)}, 0)`);
      }
      L(``);

      // Wedge stoppers at rear corners
      const wedgeD = 15 - tw;
      L(`        # Wedge stoppers`);
      for (const [side, xOff] of [['Left', -(innerW / 2 + tw / 2)], ['Right', innerW / 2 + tw / 2]] as const) {
        L(`        skWd${i}${side[0]} = sketches.add(xzPlane)`);
        L(`        create_rect_sketch(skWd${i}${side[0]}, ${(cx + xOff).toFixed(4)}, ${(wallT + td - wedgeD / 2).toFixed(4)}, ${tw.toFixed(2)}, ${wedgeD.toFixed(2)})`);
        L(`        wdExt${i}${side[0]} = extrude_profile(root, skWd${i}${side[0]}, ${sideH}, NEW)`);
        L(`        move_body(root, wdExt${i}${side[0]}.bodies.item(0), 0, ${floorY.toFixed(4)}, 0)`);
      }
      L(``);

      // Stabilizer gussets (when device height > 30mm)
      if (el.h > 30) {
        const stabH = Math.min(el.h - 15, td);
        const stabD = Math.min(stabH, td);
        L(`        # Stabilizer gussets (device ${el.h}mm > 30mm)`);
        for (const [side, xOff] of [['Left', -(innerW / 2 + tw / 2)], ['Right', innerW / 2 + tw / 2]] as const) {
          L(`        skSt${i}${side[0]} = sketches.add(xzPlane)`);
          L(`        create_rect_sketch(skSt${i}${side[0]}, ${(cx + xOff).toFixed(4)}, ${(wallT + stabD / 2).toFixed(4)}, ${tw.toFixed(2)}, ${stabD.toFixed(2)})`);
          L(`        stExt${i}${side[0]} = extrude_profile(root, skSt${i}${side[0]}, ${stabH.toFixed(2)}, NEW)`);
          L(`        move_body(root, stExt${i}${side[0]}.bodies.item(0), 0, ${(floorY + sideH).toFixed(4)}, 0)`);
        }
        L(``);
      }
    });
  }

  // ── Combine Shell Bodies ──
  if (shellBodies.length > 0) {
    L(`        # ═══ Combine Shell Bodies ═══`);
    L(`        shellCol = adsk.core.ObjectCollection.create()`);
    for (const varName of shellBodies) {
      L(`        try: shellCol.add(${varName}.bodies.item(0))`);
      L(`        except: pass`);
    }
    L(`        if shellCol.count > 0:`);
    L(`            try:`);
    L(`                combineInput = root.features.combineFeatures.createInput(faceExt.bodies.item(0), shellCol)`);
    L(`                combineInput.operation = JOIN`);
    L(`                root.features.combineFeatures.add(combineInput)`);
    L(`                faceExt.bodies.item(0).name = 'Enclosure Shell'`);
    L(`            except: pass  # bodies may already be merged`);
    L(``);
  }

  // ── Rear Panel ──
  if (rearPanel) {
    L(`        # ═══ Rear Panel ═══`);
    L(`        skRear = sketches.add(xyPlane)`);
    L(`        skRear.name = 'Rear Panel'`);
    L(`        create_rect_sketch(skRear, 0, 0, ${panW}, ${panH})`);
    L(`        rearExt = extrude_profile(root, skRear, ${wallT}, NEW)`);
    L(`        rearExt.name = 'Rear Panel'`);
    L(`        rearBody = rearExt.bodies.item(0)`);
    L(`        rearBody.name = 'Rear Panel'`);
    L(`        move_body(root, rearBody, 0, 0, ${(-depth).toFixed(4)})`);
    L(``);

    if (ventSlots) {
      const slotH = panH * 0.6;
      L(`        # Vent slots — cut through rear panel body`);
      L(`        skVent = sketches.add(xyPlane)`);
      L(`        skVent.name = 'Vent Slots'`);
      for (let i = -4; i <= 4; i++) {
        L(`        create_rect_sketch(skVent, ${(i * 15).toFixed(4)}, 0, 8, ${slotH.toFixed(2)})`);
      }
      L(`        for i in range(skVent.profiles.count):`);
      L(`            prof = skVent.profiles.item(i)`);
      L(`            try:`);
      L(`                area = prof.areaProperties().area`);
      L(`                if area < mm(${panW}) * mm(${panH}) * 0.9:`);
      L(`                    inp = extrudes.createInput(prof, CUT)`);
      L(`                    inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)`);
      L(`                    inp.participantBodies = [rearBody]`);
      L(`                    extrudes.add(inp)`);
      L(`            except: pass`);
      L(``);
    }
  }

  // ── Fan Cutouts ──
  const fans = config.elements.filter(e => e.type === 'fan');
  if (fans.length > 0) {
    L(`        # ═══ Fan Cutouts ═══`);
    L(`        skFan = sketches.add(xyPlane)`);
    L(`        skFan.name = 'Fan Cutouts'`);
    fans.forEach((el, i) => {
      const fan = FANS[el.key];
      if (!fan) return;
      const cx = el.x - panW / 2;
      const cy = panH / 2 - el.y;
      const isRear = el.surface === 'rear';
      L(`        # ${el.label} — ${fan.size}mm fan${isRear ? ' (rear)' : ''}`);
      // Center bore
      L(`        skFan.sketchCurves.sketchCircles.addByCenterRadius(`);
      L(`            adsk.core.Point3D.create(mm(${cx.toFixed(4)}), mm(${cy.toFixed(4)}), 0), mm(${(fan.cutoutDiameter / 2).toFixed(4)}))`);
      // 4 bolt holes
      const hs = fan.holeSpacing / 2;
      for (const [dx, dy] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
        L(`        skFan.sketchCurves.sketchCircles.addByCenterRadius(`);
        L(`            adsk.core.Point3D.create(mm(${(cx + dx * hs).toFixed(4)}), mm(${(cy + dy * hs).toFixed(4)}), 0), mm(${(fan.holeDiameter / 2).toFixed(4)}))`);
      }
    });
    L(`        # Cut fan holes`);
    L(`        for i in range(skFan.profiles.count):`);
    L(`            prof = skFan.profiles.item(i)`);
    L(`            try:`);
    L(`                area = prof.areaProperties().area`);
    L(`                if area < mm(150)**2 * 3.15:`);
    L(`                    inp = extrudes.createInput(prof, CUT)`);
    L(`                    inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)`);
    L(`                    extrudes.add(inp)`);
    L(`            except: pass`);
    L(``);
  }

  // ── Reinforcement Ribs ──
  const ribs = config.reinforcement ?? [];
  if (ribs.length > 0) {
    L(`        # ═══ Reinforcement Ribs ═══`);
    ribs.forEach((rib, i) => {
      if (rib.type === 'stiffener-wedge') {
        L(`        # Rib ${i}: ${rib.reason} (wedge — manual placement needed)`);
      } else {
        const cx = rib.x - panW / 2;
        const cy = panH / 2 - rib.y;
        L(`        # Rib ${i}: ${rib.reason}`);
        L(`        skRib${i} = sketches.add(xzPlane)`);
        L(`        skRib${i}.name = 'Rib ${i}'`);
        L(`        create_rect_sketch(skRib${i}, ${cx.toFixed(4)}, ${(wallT + rib.depth / 2).toFixed(4)}, ${rib.w.toFixed(2)}, ${rib.depth.toFixed(2)})`);
        L(`        ribExt${i} = extrude_profile(root, skRib${i}, ${rib.h.toFixed(2)}, NEW)`);
        L(`        ribExt${i}.name = 'Rib ${i}'`);
        L(`        move_body(root, ribExt${i}.bodies.item(0), 0, ${cy.toFixed(4)}, 0)`);
      }
      L(``);
    });
  }

  // ── Sheet Metal mode ──
  if (!is3dp) {
    const sm = config.fabrication as FabConfigSM;
    L(`        # ═══ Sheet Metal Configuration ═══`);
    L(`        # Material: ${sm.material}, Thickness: ${sm.thickness}mm, Bend Radius: ${sm.bendRadius}mm`);
    L(`        # K-Factor: ${sm.kFactor}, BA90: ${sm.ba90}mm`);
    L(`        # Convert faceplate body to sheet metal:`);
    L(`        #   Sheet Metal tab → Convert to Sheet Metal`);
    L(`        #   Set rule: thickness=${sm.thickness}mm, bend radius=${sm.bendRadius}mm, K-factor=${sm.kFactor}`);
    L(`        #   Then add flanges using Sheet Metal → Flange tool`);
    L(``);
  }

  // ── Finalize ──
  L(`        viewport = app.activeViewport`);
  L(`        viewport.fit()`);
  L(`        ui.messageBox('RackPro enclosure created!\\n'`);
  L(`                       f'Panel: ${config.panel.standard}" ${config.panel.uHeight}U\\n'`);
  L(`                       f'Size: ${panW} x ${panH} x ${depth.toFixed(0)}mm\\n'`);
  L(`                       f'Elements: ${config.elements.length}')`);
  L(``);
  L(`    except:`);
  L(`        if ui:`);
  L(`            ui.messageBox('Failed:\\n{}'.format(traceback.format_exc()))`);

  return lines.join('\n');
}

// ═══ Modular Build ═══

function emitModularBuild(config: ExportConfig): string {
  const { panelWidth: panW, panelHeight: panH, totalWidth: totW, mountHoleType } = config.panel;
  const { depth, flangeDepth, rearPanel, ventSlots } = config.enclosure;
  const assembly = config.assembly!;
  const is3dp = config.fabrication.method === '3D Print';
  const wallT = is3dp
    ? (config.fabrication as FabConfig3DP).wallThickness
    : (config.fabrication as FabConfigSM).thickness;
  const earW = 15.875;
  const rackH = config.panel.uHeight * 44.45;
  const boreR = (BORE_HOLES[mountHoleType ?? '#10-32']?.diameter ?? 4.83) / 2;

  const connectors = config.elements.filter(e => e.type === 'connector');
  const devices = config.elements.filter(e => e.type === 'device');

  const lines: string[] = [];
  const L = (s: string) => { lines.push(s); };

  // ── Header ──
  L(`# RackPro — Fusion 360 Modular Assembly Script`);
  L(`# Standard: ${config.panel.standard}" rack, ${config.panel.uHeight}U`);
  L(`# Assembly: Modular (faceplate=${assembly.faceFab}, trays=${assembly.trayFab})`);
  L(`# Generated: ${new Date().toISOString()}`);
  L(``);
  L(`import adsk.core, adsk.fusion, traceback, math`);
  L(``);
  L(`def mm(v):`);
  L(`    return v / 10.0`);
  L(``);
  L(`def create_rect_sketch(sketch, cx_mm, cy_mm, w_mm, h_mm):`);
  L(`    sl = sketch.sketchCurves.sketchLines`);
  L(`    x1, y1 = mm(cx_mm - w_mm/2), mm(cy_mm - h_mm/2)`);
  L(`    x2, y2 = mm(cx_mm + w_mm/2), mm(cy_mm + h_mm/2)`);
  L(`    p0 = adsk.core.Point3D.create(x1, y1, 0)`);
  L(`    p1 = adsk.core.Point3D.create(x2, y1, 0)`);
  L(`    p2 = adsk.core.Point3D.create(x2, y2, 0)`);
  L(`    p3 = adsk.core.Point3D.create(x1, y2, 0)`);
  L(`    sl.addByTwoPoints(p0, p1)`);
  L(`    sl.addByTwoPoints(p1, p2)`);
  L(`    sl.addByTwoPoints(p2, p3)`);
  L(`    sl.addByTwoPoints(p3, p0)`);
  L(`    return sketch`);
  L(``);
  L(`def extrude_profile(comp, sketch, thickness_mm, operation, profile_idx=0):`);
  L(`    prof = sketch.profiles.item(profile_idx)`);
  L(`    ext = comp.features.extrudeFeatures`);
  L(`    inp = ext.createInput(prof, operation)`);
  L(`    inp.setDistanceExtent(False, adsk.core.ValueInput.createByReal(mm(thickness_mm)))`);
  L(`    return ext.add(inp)`);
  L(``);
  L(`def move_body(comp, body, dx_mm, dy_mm, dz_mm):`);
  L(`    mf = comp.features.moveFeatures`);
  L(`    col = adsk.core.ObjectCollection.create()`);
  L(`    col.add(body)`);
  L(`    t = adsk.core.Matrix3D.create()`);
  L(`    t.translation = adsk.core.Vector3D.create(mm(dx_mm), mm(dy_mm), mm(dz_mm))`);
  L(`    mf.add(mf.createInput(col, t))`);
  L(``);
  L(`def create_cylinder(sketch, cx_mm, cy_mm, r_mm):`);
  L(`    sketch.sketchCurves.sketchCircles.addByCenterRadius(`);
  L(`        adsk.core.Point3D.create(mm(cx_mm), mm(cy_mm), 0), mm(r_mm))`);
  L(`    return sketch`);
  L(``);

  // ── Main ──
  L(`def run(context):`);
  L(`    ui = None`);
  L(`    try:`);
  L(`        app = adsk.core.Application.get()`);
  L(`        ui = app.userInterface`);
  L(`        design = adsk.fusion.Design.cast(app.activeProduct)`);
  L(`        if not design:`);
  L(`            ui.messageBox('No active Fusion design')`);
  L(`            return`);
  L(``);
  L(`        root = design.rootComponent`);
  L(`        sketches = root.sketches`);
  L(`        xyPlane = root.xYConstructionPlane`);
  L(`        xzPlane = root.xZConstructionPlane`);
  L(`        extrudes = root.features.extrudeFeatures`);
  L(`        NEW = adsk.fusion.FeatureOperations.NewBodyFeatureOperation`);
  L(`        JOIN = adsk.fusion.FeatureOperations.JoinFeatureOperation`);
  L(`        CUT = adsk.fusion.FeatureOperations.CutFeatureOperation`);
  L(``);

  // ── 1. Faceplate ──
  L(`        # ═══ Step 1: Faceplate ═══`);
  L(`        sk = sketches.add(xyPlane)`);
  L(`        sk.name = 'Faceplate'`);
  L(`        create_rect_sketch(sk, 0, 0, ${panW}, ${panH})`);
  L(`        faceExt = extrude_profile(root, sk, ${wallT}, NEW)`);
  L(`        faceExt.name = 'Faceplate'`);
  L(``);

  // ── 2. Ears ──
  L(`        # ═══ Step 2: Mounting Ears ═══`);
  L(`        skEar = sketches.add(xyPlane)`);
  L(`        skEar.name = 'Ears'`);
  L(`        create_rect_sketch(skEar, ${(-(panW / 2 + earW / 2)).toFixed(4)}, 0, ${earW}, ${panH})`);
  L(`        create_rect_sketch(skEar, ${((panW / 2 + earW / 2)).toFixed(4)}, 0, ${earW}, ${panH})`);
  L(`        for i in range(skEar.profiles.count):`);
  L(`            extrude_profile(root, skEar, ${wallT}, JOIN, i)`);
  L(``);

  // ── 3. Bores ──
  L(`        # ═══ Step 3: EIA-310 Bores ═══`);
  L(`        skBore = sketches.add(xyPlane)`);
  L(`        skBore.name = 'Bores'`);
  L(`        circles = skBore.sketchCurves.sketchCircles`);
  const boreYs: number[] = [];
  for (let u = 0; u < config.panel.uHeight; u++) {
    const base = u * 44.45;
    boreYs.push(base + 6.35, base + 22.225, base + 38.1);
  }
  for (const by of boreYs) {
    const yOff = rackH / 2 - by;
    L(`        circles.addByCenterRadius(adsk.core.Point3D.create(mm(${(-(panW / 2 + earW / 2)).toFixed(4)}), mm(${yOff.toFixed(4)}), 0), mm(${boreR.toFixed(4)}))`);
    L(`        circles.addByCenterRadius(adsk.core.Point3D.create(mm(${((panW / 2 + earW / 2)).toFixed(4)}), mm(${yOff.toFixed(4)}), 0), mm(${boreR.toFixed(4)}))`);
  }
  L(`        for i in range(skBore.profiles.count):`);
  L(`            prof = skBore.profiles.item(i)`);
  L(`            try:`);
  L(`                area = prof.areaProperties().area`);
  L(`                if area < mm(${boreR.toFixed(4)})**2 * 3.15:`);
  L(`                    inp = extrudes.createInput(prof, CUT)`);
  L(`                    inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)`);
  L(`                    extrudes.add(inp)`);
  L(`            except: pass`);
  L(``);

  // ── 4. Cutouts ──
  if (connectors.length > 0 || devices.length > 0) {
    L(`        # ═══ Step 4: Cutouts ═══`);
    L(`        skCut = sketches.add(xyPlane)`);
    L(`        skCut.name = 'Cutouts'`);
    for (const el of connectors) emitCutoutSketch(L, el, panW, panH);
    for (const el of devices) {
      const cx = el.x - panW / 2;
      const cy = panH / 2 - el.y;
      L(`        create_rect_sketch(skCut, ${cx.toFixed(4)}, ${cy.toFixed(4)}, ${(el.w + 0.2).toFixed(2)}, ${(el.h + 0.2).toFixed(2)})`);
    }
    L(`        for i in range(skCut.profiles.count):`);
    L(`            prof = skCut.profiles.item(i)`);
    L(`            try:`);
    L(`                area = prof.areaProperties().area`);
    L(`                if area < mm(${panW}) * mm(${panH}) * 0.9:`);
    L(`                    inp = extrudes.createInput(prof, CUT)`);
    L(`                    inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)`);
    L(`                    extrudes.add(inp)`);
    L(`            except: pass`);
    L(``);
  }

  // ── 5. Enclosure Walls (box style only) ──
  const modularStyle = config.enclosure.style ?? 'tray';
  const modShellBodies: string[] = [];
  if (modularStyle === 'box') {
    L(`        # ═══ Step 5: Enclosure Walls ═══`);
    L(`        # XZ plane: sketch_Y = -world_Z, positive sketch_Y → behind faceplate`);
    L(`        skTop = sketches.add(xzPlane)`);
    L(`        skTop.name = 'Top Wall'`);
    L(`        create_rect_sketch(skTop, 0, ${(wallT + depth / 2).toFixed(4)}, ${panW}, ${depth})`);
    L(`        topExt = extrude_profile(root, skTop, ${wallT}, NEW)`);
    L(`        topExt.name = 'Top Wall'`);
    L(`        move_body(root, topExt.bodies.item(0), 0, ${(panH / 2 - wallT).toFixed(4)}, 0)`);
    L(``);
    L(`        skBot = sketches.add(xzPlane)`);
    L(`        skBot.name = 'Bottom Wall'`);
    L(`        create_rect_sketch(skBot, 0, ${(wallT + depth / 2).toFixed(4)}, ${panW}, ${depth})`);
    L(`        botExt = extrude_profile(root, skBot, ${wallT}, NEW)`);
    L(`        botExt.name = 'Bottom Wall'`);
    L(`        move_body(root, botExt.bodies.item(0), 0, ${(-(panH / 2)).toFixed(4)}, 0)`);
    L(``);
    modShellBodies.push('topExt', 'botExt');
  }

  // ── 6. Flanges ──
  const modularFlanges = config.enclosure.flanges !== false;
  if (modularFlanges) {
    L(`        # ═══ Step 6: Flanges ═══`);
    L(`        skFlgT = sketches.add(xzPlane)`);
    L(`        create_rect_sketch(skFlgT, 0, ${(wallT + flangeDepth / 2).toFixed(4)}, ${panW}, ${flangeDepth})`);
    L(`        flgTopExt = extrude_profile(root, skFlgT, ${wallT}, NEW)`);
    L(`        move_body(root, flgTopExt.bodies.item(0), 0, ${(panH / 2 - 2 * wallT).toFixed(4)}, 0)`);
    L(``);
    L(`        skFlgB = sketches.add(xzPlane)`);
    L(`        create_rect_sketch(skFlgB, 0, ${(wallT + flangeDepth / 2).toFixed(4)}, ${panW}, ${flangeDepth})`);
    L(`        flgBotExt = extrude_profile(root, skFlgB, ${wallT}, NEW)`);
    L(`        move_body(root, flgBotExt.bodies.item(0), 0, ${(-(panH / 2) + wallT).toFixed(4)}, 0)`);
    L(``);
    modShellBodies.push('flgTopExt', 'flgBotExt');
  }

  // ── 7. Mounting Bosses ──
  if (devices.length > 0) {
    L(`        # ═══ Step 7: Mounting Bosses ═══`);
    L(`        skBoss = sketches.add(xyPlane)`);
    L(`        skBoss.name = 'Mounting Bosses'`);
    const bossR = MOUNTING.BOSS_DIA / 2;
    const pilotR = assembly.faceFab === 'sm' ? MOUNTING.PEM_HOLE / 2 : MOUNTING.PILOT_HOLE / 2;

    for (const el of devices) {
      const mounts = computeMountPositions(el, wallT);
      for (const mp of mounts) {
        const cx = mp.x - panW / 2;
        const cy = panH / 2 - mp.y;
        L(`        # Boss at ${mp.side}`);
        L(`        create_cylinder(skBoss, ${cx.toFixed(4)}, ${cy.toFixed(4)}, ${bossR})`);
      }
    }
    L(`        # Extrude bosses on rear face`);
    L(`        for i in range(skBoss.profiles.count):`);
    L(`            prof = skBoss.profiles.item(i)`);
    L(`            try:`);
    L(`                area = prof.areaProperties().area`);
    L(`                if area < mm(${bossR + 2})**2 * 3.15:`);
    L(`                    inp = extrudes.createInput(prof, NEW)`);
    L(`                    inp.setDistanceExtent(False, adsk.core.ValueInput.createByReal(mm(${MOUNTING.BOSS_HEIGHT})))`);
    L(`                    feat = extrudes.add(inp)`);
    L(`                    move_body(root, feat.bodies.item(0), 0, 0, ${(-MOUNTING.BOSS_HEIGHT).toFixed(4)})`);
    L(`            except: pass`);
    L(``);

    // ── 8. Boss pilot holes ──
    L(`        # ═══ Step 8: Boss Pilot Holes ═══`);
    L(`        skPilot = sketches.add(xyPlane)`);
    L(`        skPilot.name = 'Pilot Holes'`);
    for (const el of devices) {
      const mounts = computeMountPositions(el, wallT);
      for (const mp of mounts) {
        const cx = mp.x - panW / 2;
        const cy = panH / 2 - mp.y;
        L(`        create_cylinder(skPilot, ${cx.toFixed(4)}, ${cy.toFixed(4)}, ${pilotR})`);
      }
    }
    L(`        for i in range(skPilot.profiles.count):`);
    L(`            prof = skPilot.profiles.item(i)`);
    L(`            try:`);
    L(`                area = prof.areaProperties().area`);
    L(`                if area < mm(${pilotR + 1})**2 * 3.15:`);
    L(`                    inp = extrudes.createInput(prof, CUT)`);
    L(`                    inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)`);
    L(`                    extrudes.add(inp)`);
    L(`            except: pass`);
    L(``);

    // ── 9. Alignment Pins ──
    L(`        # ═══ Step 9: Alignment Pins ═══`);
    L(`        skAlign = sketches.add(xyPlane)`);
    L(`        skAlign.name = 'Alignment Pins'`);
    const alignR = MOUNTING.ALIGN_PIN_DIA / 2;
    for (const el of devices) {
      const aligns = computeAlignPositions(el, wallT);
      for (const ap of aligns) {
        const cx = ap.x - panW / 2;
        const cy = panH / 2 - ap.y;
        L(`        create_cylinder(skAlign, ${cx.toFixed(4)}, ${cy.toFixed(4)}, ${alignR})`);
      }
    }
    L(`        for i in range(skAlign.profiles.count):`);
    L(`            prof = skAlign.profiles.item(i)`);
    L(`            try:`);
    L(`                area = prof.areaProperties().area`);
    L(`                if area < mm(${alignR + 1})**2 * 3.15:`);
    L(`                    inp = extrudes.createInput(prof, NEW)`);
    L(`                    inp.setDistanceExtent(False, adsk.core.ValueInput.createByReal(mm(${MOUNTING.ALIGN_PIN_DEPTH})))`);
    L(`                    feat = extrudes.add(inp)`);
    L(`                    move_body(root, feat.bodies.item(0), 0, 0, ${(-MOUNTING.ALIGN_PIN_DEPTH).toFixed(4)})`);
    L(`            except: pass`);
    L(``);
  }

  // ── 10. Faceplate Chamfers ──
  L(`        # ═══ Step 10: Faceplate Chamfers ═══`);
  L(`        # (apply manually in Fusion — auto chamfers require body selection)`);
  L(``);

  // ── 11. Per-device Trays ──
  if (devices.length > 0) {
    L(`        # ═══ Step 11: Per-Device Trays ═══`);
    devices.forEach((el, i) => {
      const dev = lookupDevice(el.key);
      const devWt = dev?.wt ?? 1;
      const devH = dev?.h ?? el.h;
      const dims = computeTrayDimensions(el, wallT, assembly.trayFab);
      const mounts = computeMountPositions(el, wallT);
      const aligns = computeAlignPositions(el, wallT);
      const reinf = computeTrayReinforcement(
        { el, weight: devWt, deviceH: devH },
        dims.innerW, dims.innerD, dims.floorT, dims.wallT, assembly.trayFab,
      );

      const cx = el.x - panW / 2;
      const cy = panH / 2 - el.y;
      const slideClr = MOUNTING.SLIDE_CLEARANCE;

      const floorY = cy - el.h / 2 - dims.floorT;

      L(`        # ─── Tray ${i}: ${el.label} ───`);
      // Floor on XZ plane — sketch_Y offset by wallT for faceplate back face
      L(`        skTF${i} = sketches.add(xzPlane)`);
      L(`        skTF${i}.name = 'Tray Floor ${i}'`);
      L(`        create_rect_sketch(skTF${i}, ${cx.toFixed(4)}, ${(wallT + dims.totalD / 2).toFixed(4)}, ${dims.totalW.toFixed(2)}, ${dims.totalD.toFixed(2)})`);
      L(`        tfExt${i} = extrude_profile(root, skTF${i}, ${dims.floorT.toFixed(2)}, NEW)`);
      L(`        tfExt${i}.name = 'Tray ${i} Floor'`);
      L(`        move_body(root, tfExt${i}.bodies.item(0), 0, ${floorY.toFixed(4)}, 0)`);
      L(``);

      // Side walls on XZ plane (15mm tall)
      L(`        # Side walls (${dims.sideH}mm)`);
      for (const [side, xOff] of [['Left', -(dims.innerW / 2 + dims.wallT / 2)], ['Right', dims.innerW / 2 + dims.wallT / 2]] as const) {
        L(`        skTW${i}${side[0]} = sketches.add(xzPlane)`);
        L(`        create_rect_sketch(skTW${i}${side[0]}, ${(cx + xOff).toFixed(4)}, ${(wallT + dims.totalD / 2).toFixed(4)}, ${dims.wallT.toFixed(2)}, ${dims.totalD.toFixed(2)})`);
        L(`        twExt${i}${side[0]} = extrude_profile(root, skTW${i}${side[0]}, ${dims.sideH}, NEW)`);
        L(`        move_body(root, twExt${i}${side[0]}.bodies.item(0), 0, ${floorY.toFixed(4)}, 0)`);
      }
      L(``);

      // Wedge stoppers at rear corners
      {
        const wedgeD = 15 - dims.wallT;
        L(`        # Wedge stoppers`);
        for (const [side, xOff] of [['Left', -(dims.innerW / 2 + dims.wallT / 2)], ['Right', dims.innerW / 2 + dims.wallT / 2]] as const) {
          L(`        skWd${i}${side[0]} = sketches.add(xzPlane)`);
          L(`        create_rect_sketch(skWd${i}${side[0]}, ${(cx + xOff).toFixed(4)}, ${(wallT + dims.totalD - wedgeD / 2).toFixed(4)}, ${dims.wallT.toFixed(2)}, ${wedgeD.toFixed(2)})`);
          L(`        wdExt${i}${side[0]} = extrude_profile(root, skWd${i}${side[0]}, 15, NEW)`);
          L(`        move_body(root, wdExt${i}${side[0]}.bodies.item(0), 0, ${floorY.toFixed(4)}, 0)`);
        }
        L(``);
      }

      // Stabilizer gussets
      if (dims.hasStabilizers) {
        L(`        # Stabilizer gussets (h=${dims.stabilizerH.toFixed(1)}mm, d=${dims.stabilizerD.toFixed(1)}mm)`);
        for (const [side, xOff] of [['Left', -(dims.innerW / 2 + dims.wallT / 2)], ['Right', dims.innerW / 2 + dims.wallT / 2]] as const) {
          L(`        skSt${i}${side[0]} = sketches.add(xzPlane)`);
          L(`        create_rect_sketch(skSt${i}${side[0]}, ${(cx + xOff).toFixed(4)}, ${(wallT + dims.stabilizerD / 2).toFixed(4)}, ${dims.wallT.toFixed(2)}, ${dims.stabilizerD.toFixed(2)})`);
          L(`        stExt${i}${side[0]} = extrude_profile(root, skSt${i}${side[0]}, ${dims.stabilizerH.toFixed(2)}, NEW)`);
          L(`        move_body(root, stExt${i}${side[0]}.bodies.item(0), 0, ${(floorY + dims.sideH).toFixed(4)}, 0)`);
        }
        L(``);
      }

      // Mounting tabs (extending forward from tray side wall tops)
      L(`        # Mounting tabs`);
      L(`        skTab${i} = sketches.add(xyPlane)`);
      L(`        skTab${i}.name = 'Tray Tabs ${i}'`);
      for (const mp of mounts) {
        const tabCx = mp.x - panW / 2;
        const tabCy = panH / 2 - mp.y;
        L(`        create_rect_sketch(skTab${i}, ${tabCx.toFixed(4)}, ${tabCy.toFixed(4)}, ${MOUNTING.TAB_WIDTH}, ${MOUNTING.TAB_DEPTH})`);
      }
      L(`        for pi in range(skTab${i}.profiles.count):`);
      L(`            try: extrude_profile(root, skTab${i}, ${dims.wallT.toFixed(2)}, NEW, pi)`);
      L(`            except: pass`);
      L(``);

      // Tab clearance holes
      L(`        # Tab clearance holes`);
      L(`        skTH${i} = sketches.add(xyPlane)`);
      L(`        skTH${i}.name = 'Tab Holes ${i}'`);
      for (const mp of mounts) {
        const cx2 = mp.x - panW / 2;
        const cy2 = panH / 2 - mp.y;
        L(`        create_cylinder(skTH${i}, ${cx2.toFixed(4)}, ${cy2.toFixed(4)}, ${MOUNTING.CLEARANCE_HOLE / 2})`);
      }
      L(`        for pi in range(skTH${i}.profiles.count):`);
      L(`            prof = skTH${i}.profiles.item(pi)`);
      L(`            try:`);
      L(`                area = prof.areaProperties().area`);
      L(`                if area < mm(3)**2 * 3.15:`);
      L(`                    inp = extrudes.createInput(prof, CUT)`);
      L(`                    inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)`);
      L(`                    extrudes.add(inp)`);
      L(`            except: pass`);
      L(``);

      // Alignment sockets
      L(`        # Alignment sockets`);
      L(`        skAS${i} = sketches.add(xyPlane)`);
      L(`        skAS${i}.name = 'Align Sockets ${i}'`);
      const socketR = MOUNTING.ALIGN_SOCKET_DIA / 2;
      for (const ap of aligns) {
        const ax = ap.x - panW / 2;
        const ay = panH / 2 - ap.y;
        L(`        create_cylinder(skAS${i}, ${ax.toFixed(4)}, ${ay.toFixed(4)}, ${socketR})`);
      }
      L(`        for pi in range(skAS${i}.profiles.count):`);
      L(`            prof = skAS${i}.profiles.item(pi)`);
      L(`            try:`);
      L(`                area = prof.areaProperties().area`);
      L(`                if area < mm(3)**2 * 3.15:`);
      L(`                    inp = extrudes.createInput(prof, CUT)`);
      L(`                    inp.setDistanceExtent(False, adsk.core.ValueInput.createByReal(mm(${MOUNTING.ALIGN_PIN_DEPTH})))`);
      L(`                    extrudes.add(inp)`);
      L(`            except: pass`);
      L(``);

      // Floor ribs
      if (reinf.floorRibs.length > 0) {
        L(`        # Floor ribs (${reinf.floorRibs.length})`);
        reinf.floorRibs.forEach((rib, ri) => {
          L(`        skFR${i}_${ri} = sketches.add(xzPlane)`);
          L(`        create_rect_sketch(skFR${i}_${ri}, ${(cx + rib.x).toFixed(4)}, ${(wallT + dims.totalD / 2).toFixed(4)}, ${rib.w.toFixed(2)}, ${rib.d.toFixed(2)})`);
          L(`        frExt = extrude_profile(root, skFR${i}_${ri}, ${rib.h.toFixed(2)}, NEW)`);
          L(`        move_body(root, frExt.bodies.item(0), 0, ${(cy - el.h / 2 - dims.floorT - rib.h / 2).toFixed(4)}, 0)`);
        });
        L(``);
      }

      // Gussets (now built as part of tray above — reinf gussets are informational)
      if (reinf.gussets.length > 0) {
        L(`        # (Stabilizer gussets built above as part of tray U-channel)`);
        L(``);
      }

      // Rear stoppers
      if (reinf.rearStoppers.length > 0) {
        L(`        # Rear stoppers (${reinf.rearStoppers.length})`);
        reinf.rearStoppers.forEach((rs, ri) => {
          L(`        skRS${i}_${ri} = sketches.add(xyPlane)`);
          L(`        create_rect_sketch(skRS${i}_${ri}, ${(cx + rs.x).toFixed(4)}, ${cy.toFixed(4)}, ${rs.w.toFixed(2)}, ${rs.d.toFixed(2)})`);
          L(`        rsExt = extrude_profile(root, skRS${i}_${ri}, ${rs.h.toFixed(2)}, NEW)`);
          L(`        move_body(root, rsExt.bodies.item(0), 0, 0, ${(-dims.totalD + rs.d / 2).toFixed(4)})`);
        });
        L(``);
      }

      // Cross ribs
      if (reinf.crossRibs.length > 0) {
        L(`        # Cross-rib at midpoint`);
        const cr = reinf.crossRibs[0];
        L(`        skCR${i} = sketches.add(xzPlane)`);
        L(`        create_rect_sketch(skCR${i}, ${cx.toFixed(4)}, ${(wallT + dims.totalD / 2).toFixed(4)}, ${cr.w.toFixed(2)}, ${cr.d.toFixed(2)})`);
        L(`        crExt = extrude_profile(root, skCR${i}, ${cr.h.toFixed(2)}, NEW)`);
        L(`        move_body(root, crExt.bodies.item(0), 0, ${(cy - el.h / 2 - dims.floorT - cr.h / 2).toFixed(4)}, 0)`);
        L(``);
      }
    });
  }

  // ── Combine Shell Bodies ──
  if (modShellBodies.length > 0) {
    L(`        # ═══ Combine Shell Bodies ═══`);
    L(`        shellCol = adsk.core.ObjectCollection.create()`);
    for (const varName of modShellBodies) {
      L(`        try: shellCol.add(${varName}.bodies.item(0))`);
      L(`        except: pass`);
    }
    L(`        if shellCol.count > 0:`);
    L(`            try:`);
    L(`                combineInput = root.features.combineFeatures.createInput(faceExt.bodies.item(0), shellCol)`);
    L(`                combineInput.operation = JOIN`);
    L(`                root.features.combineFeatures.add(combineInput)`);
    L(`                faceExt.bodies.item(0).name = 'Enclosure Shell'`);
    L(`            except: pass`);
    L(``);
  }

  // ── 12. Rear Panel ──
  if (rearPanel) {
    L(`        # ═══ Step 12: Rear Panel ═══`);
    L(`        skRear = sketches.add(xyPlane)`);
    L(`        create_rect_sketch(skRear, 0, 0, ${panW}, ${panH})`);
    L(`        rearExt = extrude_profile(root, skRear, ${wallT}, NEW)`);
    L(`        rearExt.name = 'Rear Panel'`);
    L(`        rearBody = rearExt.bodies.item(0)`);
    L(`        rearBody.name = 'Rear Panel'`);
    L(`        move_body(root, rearBody, 0, 0, ${(-depth).toFixed(4)})`);
    L(``);
  }

  // ── Finalize ──
  L(`        viewport = app.activeViewport`);
  L(`        viewport.fit()`);
  L(`        ui.messageBox('RackPro modular assembly created!\\n'`);
  L(`                       f'Panel: ${config.panel.standard}" ${config.panel.uHeight}U\\n'`);
  L(`                       f'Faceplate: ${assembly.faceFab}\\n'`);
  L(`                       f'Trays: ${devices.length} (${assembly.trayFab})\\n'`);
  L(`                       f'Size: ${panW} x ${panH} x ${depth.toFixed(0)}mm')`);
  L(``);
  L(`    except:`);
  L(`        if ui:`);
  L(`            ui.messageBox('Failed:\\n{}'.format(traceback.format_exc()))`);

  return lines.join('\n');
}

// ── Helpers ──

function emitParam(L: (s: string) => void, name: string, value: number) {
  L(`            params.add('${name}', adsk.core.ValueInput.createByString('${value.toFixed(4)} mm'), 'mm', '')`);
}

function emitCutoutSketch(L: (s: string) => void, el: ExportElement, panW: number, panH: number) {
  const cx = el.x - panW / 2;
  const cy = panH / 2 - el.y;
  const tol = 0.2;

  switch (el.cutout) {
    case 'round': {
      const r = (el.radius ?? el.w / 2) + tol / 2;
      L(`        # ${el.label} — round ⌀${(r * 2).toFixed(1)}mm`);
      L(`        skCut.sketchCurves.sketchCircles.addByCenterRadius(`);
      L(`            adsk.core.Point3D.create(mm(${cx.toFixed(4)}), mm(${cy.toFixed(4)}), 0), mm(${r.toFixed(4)}))`);
      break;
    }
    case 'd-shape': {
      const r = (el.radius ?? el.w / 2) + tol / 2;
      L(`        # ${el.label} — D-shape ⌀${(r * 2).toFixed(1)}mm (circle approx; trim flat manually)`);
      L(`        skCut.sketchCurves.sketchCircles.addByCenterRadius(`);
      L(`            adsk.core.Point3D.create(mm(${cx.toFixed(4)}), mm(${cy.toFixed(4)}), 0), mm(${r.toFixed(4)}))`);
      break;
    }
    case 'rect': {
      L(`        # ${el.label} — rect ${el.w}x${el.h}mm`);
      L(`        create_rect_sketch(skCut, ${cx.toFixed(4)}, ${cy.toFixed(4)}, ${(el.w + tol).toFixed(2)}, ${(el.h + tol).toFixed(2)})`);
      break;
    }
    case 'd-sub': {
      L(`        # ${el.label} — D-sub ${el.w}x${el.h}mm (rect approx; add taper manually)`);
      L(`        create_rect_sketch(skCut, ${cx.toFixed(4)}, ${cy.toFixed(4)}, ${(el.w + tol).toFixed(2)}, ${(el.h + tol).toFixed(2)})`);
      break;
    }
  }
}
