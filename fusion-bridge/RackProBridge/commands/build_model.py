"""
RackPro Bridge — Build Model Command

Takes an ExportConfig JSON dict and builds the complete rack mount enclosure
in Fusion 360. Each feature is wrapped in try/except for error recovery.

The build sequence mirrors src/export/fusion360Gen.ts but executes directly
via the Fusion API instead of generating script text.
"""

import adsk.core
import adsk.fusion
import math
import traceback

from ..lib.constants import (
    mm, cm_to_mm, EPS, EAR_WIDTH, BORE_OFFSETS, BORE_RADIUS,
    UNIT_HEIGHT, PANEL_GAP, TOLERANCE, BASE_UNIT, BASE_STRENGTH,
    HEX_SPACING, HEX_STRUT, HEX_FRAME, HEX_FRAME_LARGE, HEX_FRAME_THRESHOLD,
)
from ..lib.geometry import (
    create_rect_sketch, create_circle, create_cylinder, create_d_shape,
    create_triangle_sketch, create_hex_pattern_sketch, hex_frame_for_size,
    extrude_profile, extrude_blind, extrude_all_small_profiles, move_body,
    find_body_by_name, apply_fillets, apply_chamfers,
    combine_bodies, find_edges_at_position,
)


def build_model(config):
    """Build a rack mount enclosure from an ExportConfig dict.

    Args:
        config: dict matching ExportConfig shape from RackPro MCP

    Returns:
        dict with success, features, bodies, errors, warnings
    """
    assembly = config.get('assembly', {})
    if assembly.get('mode') == 'modular':
        return _build_modular(config)

    fabrication = config.get('fabrication', {})
    if fabrication.get('method') == 'Sheet Metal':
        return _build_sheet_metal(config)

    app = adsk.core.Application.get()
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return {'success': False, 'error': 'No active Fusion design'}

    features_log = []
    errors = []
    warnings = []

    try:
        root = design.rootComponent
        sketches = root.sketches
        xy_plane = root.xYConstructionPlane
        xz_plane = root.xZConstructionPlane
        NEW = adsk.fusion.FeatureOperations.NewBodyFeatureOperation
        JOIN = adsk.fusion.FeatureOperations.JoinFeatureOperation
        CUT = adsk.fusion.FeatureOperations.CutFeatureOperation

        # ─── Extract config ──────────────────────────────────
        panel = config.get('panel', {})
        enclosure = config.get('enclosure', {})
        fabrication = config.get('fabrication', {})
        elements = config.get('elements', [])
        reinforcement = config.get('reinforcement', [])

        pan_w = panel.get('panelWidth', 450.85)
        pan_h = panel.get('panelHeight', 43.66)
        tot_w = panel.get('totalWidth', 482.6)
        u_height = panel.get('uHeight', 1)
        standard = panel.get('standard', '19')

        depth = enclosure.get('depth', 50)
        flange_depth = enclosure.get('flangeDepth', 15)
        enable_flanges = enclosure.get('flanges', True)
        rear_panel = enclosure.get('rearPanel', False)
        vent_slots = enclosure.get('ventSlots', False)
        enable_chamfers = enclosure.get('chamfers', True)

        is_3dp = fabrication.get('method') == '3D Print'
        wall_t = fabrication.get('wallThickness', 3) if is_3dp else fabrication.get('thickness', 1.5)

        rack_h = u_height * UNIT_HEIGHT

        connectors = [e for e in elements if e.get('type') == 'connector']
        devices = [e for e in elements if e.get('type') == 'device']
        fans = [e for e in elements if e.get('type') == 'fan']

        # ─── 1. Set design type to parametric ────────────────
        design.designType = adsk.fusion.DesignTypes.ParametricDesignType

        # ─── 2. User parameters (idempotent) ─────────────────
        _set_params(design, {
            'panelWidth': pan_w,
            'panelHeight': pan_h,
            'totalWidth': tot_w,
            'earWidth': EAR_WIDTH,
            'wallThickness': wall_t,
            'flangeDepth': flange_depth,
            'enclosureDepth': depth,
        })

        # ─── 3. Faceplate ────────────────────────────────────
        face_body = None
        r = _build_faceplate(root, sketches, xy_plane, pan_w, pan_h, wall_t, NEW)
        features_log.append(r)
        if r.get('feature') and r['feature'].bodies.count > 0:
            face_body = r['feature'].bodies.item(0)
            face_body.name = 'Panel'
        if not r['success']:
            errors.append(f"Faceplate: {r.get('error', 'unknown')}")

        # ─── 4. Ears ─────────────────────────────────────────
        r = _build_ears(root, sketches, xy_plane, pan_w, pan_h, wall_t, face_body, JOIN)
        features_log.extend(r)
        for item in r:
            if not item['success']:
                errors.append(f"Ear: {item.get('error', 'unknown')}")

        # ─── 5. Bore pattern ─────────────────────────────────
        r = _build_bores(root, sketches, xy_plane, pan_w, rack_h, u_height,
                         wall_t, face_body, CUT)
        features_log.append(r)
        if not r['success']:
            errors.append(f"Bores: {r.get('error', 'unknown')}")

        # ─── 6. Cutouts — one sketch per cutout ──────────────
        for el in connectors:
            r = _build_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                              wall_t, face_body, CUT)
            features_log.append(r)
            if not r['success']:
                errors.append(f"{el.get('label', 'Cutout')}: {r.get('error', 'unknown')}")

        for el in devices:
            r = _build_device_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                                     wall_t, face_body, CUT)
            features_log.append(r)
            if not r['success']:
                errors.append(f"{el.get('label', 'Device')}: {r.get('error', 'unknown')}")

        # ─── 7. Enclosure walls (box style only) ─────────────
        style = enclosure.get('style', 'tray')
        shell_bodies = []  # collect bodies to combine into the shell
        if style == 'box':
            for wr in _build_enclosure_walls(root, sketches, xz_plane, pan_w, pan_h,
                                             depth, wall_t, NEW):
                features_log.append(wr)
                if wr.get('body'):
                    shell_bodies.append(wr['body'])
                if not wr['success']:
                    errors.append(f"{wr['name']}: {wr.get('error', 'unknown')}")

        # ─── 8. Flanges (retention lips) ──────────────────
        if enable_flanges:
            for fr in _build_flanges(root, sketches, xz_plane, pan_w, pan_h,
                                     flange_depth, wall_t, NEW):
                features_log.append(fr)
                if fr.get('body'):
                    shell_bodies.append(fr['body'])
                if not fr['success']:
                    errors.append(f"{fr['name']}: {fr.get('error', 'unknown')}")

        # ─── 9. Combine enclosure shell ─────────────────────
        # Merge walls + flanges into the panel body for a single solid shell
        if face_body and shell_bodies:
            r = combine_bodies(root, face_body, shell_bodies)
            r['name'] = 'Combine Shell'
            features_log.append(r)
            if r['success']:
                face_body.name = 'Enclosure Shell'
            else:
                warnings.append(f"Combine shell: {r.get('error', 'bodies left separate')}")

        # ─── 10. Device trays (U-channel, separate bodies) ──
        for i, el in enumerate(devices):
            tray_results = _build_device_tray(root, sketches, xz_plane,
                                              el, pan_w, pan_h, wall_t, i, NEW, JOIN, CUT)
            features_log.extend(tray_results)
            for tr in tray_results:
                if not tr['success']:
                    errors.append(f"Tray {i}: {tr.get('error', 'unknown')}")

        # ─── 11. Rear panel (separate body) ──────────────────
        if rear_panel:
            r = _build_rear_panel(root, sketches, xy_plane, pan_w, pan_h,
                                  depth, wall_t, vent_slots, NEW, CUT)
            features_log.extend(r)
            for item in r:
                if not item['success']:
                    errors.append(f"{item['name']}: {item.get('error', 'unknown')}")

        # ─── 12. Fan cutouts ─────────────────────────────────
        for el in fans:
            r = _build_fan_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                                  wall_t, face_body, CUT)
            features_log.append(r)
            if not r['success']:
                errors.append(f"{el.get('label', 'Fan')}: {r.get('error', 'unknown')}")

        # ─── 13. Reinforcement ribs ──────────────────────────
        if reinforcement:
            for i, rib in enumerate(reinforcement):
                r = _build_rib(root, sketches, xz_plane, rib, pan_w, pan_h, wall_t, i, NEW)
                features_log.append(r)
                if not r['success']:
                    warnings.append(f"Rib {i}: {r.get('error', 'unknown')}")

        # ─── 14. Chamfers ────────────────────────────────────
        cham = min(1.0, wall_t * 0.4)
        if enable_chamfers and face_body and cham >= 0.2:
            # Front face edges (visible perimeter + cutout edges)
            r = apply_chamfers(root, face_body, cham, face_z_mm=0)
            features_log.append(r)
            if not r['success']:
                warnings.append(f"Front chamfers: {r.get('error', 'skipped')}")

            # Interior junction chamfers (wall-to-faceplate corners)
            # These edges are at Z=-wall_t (back face where walls meet)
            r2 = apply_chamfers(root, face_body, cham, face_z_mm=-wall_t)
            r2['name'] = 'Junction Chamfers'
            features_log.append(r2)
            if not r2['success']:
                warnings.append(f"Junction chamfers: {r2.get('error', 'skipped')}")

        # ─── 15. Timeline grouping ───────────────────────────
        try:
            timeline = design.timeline
            if timeline.count > 1:
                group = timeline.timelineGroups.add(
                    timeline.item(0), timeline.item(timeline.count - 1)
                )
                group.name = 'RackPro'
        except:
            warnings.append('Could not group timeline features')

        # ─── Fit viewport ────────────────────────────────────
        app.activeViewport.fit()

        # ─── Collect body properties ─────────────────────────
        bodies_info = _collect_body_info(root)

        return {
            'success': len(errors) == 0,
            'features': [
                {
                    'name': f.get('name', ''),
                    'type': f.get('type', 'extrude'),
                    'computed': f.get('success', False),
                    'error': f.get('error'),
                }
                for f in features_log
            ],
            'bodies': bodies_info,
            'errors': errors,
            'warnings': warnings,
        }

    except Exception as e:
        return {
            'success': False,
            'error': traceback.format_exc(),
            'features': [
                {
                    'name': f.get('name', ''),
                    'type': f.get('type', 'extrude'),
                    'computed': f.get('success', False),
                    'error': f.get('error'),
                }
                for f in features_log
            ],
            'errors': errors + [str(e)],
            'warnings': warnings,
        }


# ═══ Private Build Helpers ═══════════════════════════════════════


def _set_params(design, params_dict):
    """Set user parameters idempotently."""
    user_params = design.userParameters
    for name, value in params_dict.items():
        try:
            existing = user_params.itemByName(name)
            if existing:
                existing.expression = f'{value:.4f} mm'
            else:
                user_params.add(
                    name,
                    adsk.core.ValueInput.createByString(f'{value:.4f} mm'),
                    'mm', ''
                )
        except:
            pass


def _build_faceplate(root, sketches, xy_plane, pan_w, pan_h, wall_t, NEW):
    """Build the main faceplate body."""
    result = {'name': 'Faceplate', 'type': 'extrude'}
    try:
        sk = sketches.add(xy_plane)
        sk.name = 'Faceplate'
        create_rect_sketch(sk, 0, 0, pan_w, pan_h)
        r = extrude_profile(root, sk, wall_t, NEW, 0, name='Faceplate', flip=True)
        result.update(r)
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    return result


def _build_ears(root, sketches, xy_plane, pan_w, pan_h, wall_t, face_body, JOIN):
    """Build left and right mounting ears."""
    results = []
    ear_cx_left = -(pan_w / 2 + EAR_WIDTH / 2)
    ear_cx_right = pan_w / 2 + EAR_WIDTH / 2

    for side, cx in [('Left Ear', ear_cx_left), ('Right Ear', ear_cx_right)]:
        result = {'name': side, 'type': 'extrude'}
        try:
            sk = sketches.add(xy_plane)
            sk.name = side
            create_rect_sketch(sk, cx, 0, EAR_WIDTH, pan_h)
            bodies = [face_body] if face_body else None
            r = extrude_profile(root, sk, wall_t, JOIN, 0, bodies, side, flip=True)
            result.update(r)
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)
    return results


def _build_bores(root, sketches, xy_plane, pan_w, rack_h, u_height,
                 wall_t, face_body, CUT):
    """Build EIA-310 mounting bore pattern."""
    result = {'name': 'Bore Pattern', 'type': 'cut'}
    try:
        sk = sketches.add(xy_plane)
        sk.name = 'Bores'

        ear_cx_left = -(pan_w / 2 + EAR_WIDTH / 2)
        ear_cx_right = pan_w / 2 + EAR_WIDTH / 2

        for u in range(u_height):
            base = u * UNIT_HEIGHT
            for offset in BORE_OFFSETS:
                y_off = rack_h / 2 - (base + offset)
                create_circle(sk, ear_cx_left, y_off, BORE_RADIUS)
                create_circle(sk, ear_cx_right, y_off, BORE_RADIUS)

        # Cut all small circular profiles (bore holes)
        max_bore_area = math.pi * (BORE_RADIUS + 1) ** 2  # mm²
        bodies = [face_body] if face_body else None
        cut_results = extrude_all_small_profiles(
            root, sk, max_bore_area, wall_t, CUT, bodies,
            direction='negative'
        )

        computed = sum(1 for r in cut_results if r.get('success'))
        expected = u_height * len(BORE_OFFSETS) * 2
        result['success'] = computed > 0
        result['detail'] = f'{computed}/{expected} bores cut'
        if computed < expected:
            result['error'] = f'Only {computed}/{expected} bores computed'
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    return result


def _build_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                  wall_t, face_body, CUT):
    """Build a single connector cutout (one sketch per cutout)."""
    label = el.get('label', 'Cutout')
    cutout_type = el.get('cutout', 'rect')
    result = {'name': label, 'type': 'cut'}

    try:
        cx = el['x'] - pan_w / 2
        cy = pan_h / 2 - el['y']

        sk = sketches.add(xy_plane)
        sk.name = label

        if cutout_type == 'round':
            r = (el.get('radius') or el['w'] / 2) + TOLERANCE / 2
            create_circle(sk, cx, cy, r)
        elif cutout_type == 'd-shape':
            r = (el.get('radius') or el['w'] / 2) + TOLERANCE / 2
            create_d_shape(sk, cx, cy, r)
        elif cutout_type in ('rect', 'd-sub'):
            w = el['w'] + TOLERANCE
            h = el['h'] + TOLERANCE
            create_rect_sketch(sk, cx, cy, w, h)
        else:
            result['error'] = f'Unknown cutout type: {cutout_type}'
            result['success'] = False
            return result

        # Cut through faceplate — use the first small profile
        bodies = [face_body] if face_body else None
        cut_results = extrude_all_small_profiles(
            root, sk, pan_w * pan_h, wall_t, CUT, bodies,
            direction='negative'
        )

        if cut_results:
            result['success'] = any(r.get('success') for r in cut_results)
            if not result['success']:
                result['error'] = cut_results[0].get('error', 'Cut failed')
        else:
            result['success'] = False
            result['error'] = 'No profiles found for cut'
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    return result


def _build_device_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                         wall_t, face_body, CUT):
    """Build a device bay cutout in the faceplate."""
    label = el.get('label', 'Device')
    result = {'name': label, 'type': 'cut'}

    try:
        cx = el['x'] - pan_w / 2
        cy = pan_h / 2 - el['y']
        w = el['w'] + TOLERANCE
        h = el['h'] + TOLERANCE

        sk = sketches.add(xy_plane)
        sk.name = label
        create_rect_sketch(sk, cx, cy, w, h)

        # Find the inner rectangle profile (smaller area)
        bodies = [face_body] if face_body else None
        face_area = pan_w * pan_h
        cut_results = extrude_all_small_profiles(
            root, sk, face_area, wall_t, CUT, bodies,
            direction='negative'
        )

        if cut_results:
            result['success'] = any(r.get('success') for r in cut_results)
            if not result['success']:
                result['error'] = cut_results[0].get('error', 'Cut failed')
        else:
            result['success'] = False
            result['error'] = 'No profiles found for device cut'
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    return result


def _build_enclosure_walls(root, sketches, xz_plane, pan_w, pan_h,
                           depth, wall_t, NEW):
    """Build top and bottom enclosure walls. Returns body refs for combining."""
    results = []

    for side, y_offset in [('Top Wall', pan_h / 2 - wall_t), ('Bottom Wall', -(pan_h / 2))]:
        result = {'name': side, 'type': 'extrude', 'body': None}
        try:
            sk = sketches.add(xz_plane)
            sk.name = side
            # XZ plane: sketch_Y = -world_Z, so positive sketch_Y → negative world Z (behind panel)
            create_rect_sketch(sk, 0, wall_t + depth / 2, pan_w, depth)
            r = extrude_profile(root, sk, wall_t, NEW, 0, name=side)
            result.update(r)

            if r.get('feature') and r['feature'].bodies.count > 0:
                body = r['feature'].bodies.item(0)
                body.name = side
                move_body(root, body, 0, y_offset, 0)
                result['body'] = body
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    return results


def _build_flanges(root, sketches, xz_plane, pan_w, pan_h,
                   flange_depth, wall_t, NEW):
    """Build top and bottom retention flanges. Returns body refs for combining."""
    results = []

    for side, y_offset in [('Top Flange', pan_h / 2 - 2 * wall_t),
                           ('Bottom Flange', -(pan_h / 2) + wall_t)]:
        result = {'name': side, 'type': 'extrude', 'body': None}
        try:
            sk = sketches.add(xz_plane)
            sk.name = side
            # XZ plane: sketch_Y = -world_Z, so positive sketch_Y → negative world Z
            create_rect_sketch(sk, 0, wall_t + flange_depth / 2, pan_w, flange_depth)
            r = extrude_profile(root, sk, wall_t, NEW, 0, name=side)
            result.update(r)

            if r.get('feature') and r['feature'].bodies.count > 0:
                body = r['feature'].bodies.item(0)
                body.name = side
                move_body(root, body, 0, y_offset, 0)
                result['body'] = body
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    return results


def _apply_hex_floor(root, sketches, xz_plane, tray_body, el, cx, td,
                      total_w, floor_t, idx, CUT, face_wall_t=0):
    """Cut hex lightweighting pattern through a tray floor.

    Only applies when el.floorStyle == 'hex'. Sketches hex grid on XZ plane,
    then cuts through the floor body with negative extrusion (toward -Y).

    Args:
        face_wall_t: Faceplate wall thickness for Z offset (tray starts at -face_wall_t)

    Returns result dict or None if not hex.
    """
    if el.get('floorStyle', 'solid') != 'hex':
        return None

    result = {'name': f'Tray {idx} Hex Floor', 'type': 'cut', 'success': False}
    try:
        frame = hex_frame_for_size(total_w, td)
        sk = sketches.add(xz_plane)
        sk.name = f'Hex Floor {idx}'
        # XZ plane: sketch_Y = -world_Z, so positive sketch_Y → negative world Z
        count = create_hex_pattern_sketch(sk, cx, face_wall_t + td / 2, total_w, td,
                                           HEX_SPACING, HEX_STRUT, frame)
        if count == 0:
            result['error'] = 'No hexagons fit in floor area'
            return result

        # Max hex cell area for profile filtering: spacing² * 0.87 (hex area ratio)
        max_hex_area = HEX_SPACING ** 2 * 0.87
        cut_results = extrude_all_small_profiles(
            root, sk, max_hex_area, floor_t + 1, CUT,
            [tray_body] if tray_body else None,
            direction='negative'
        )
        computed = sum(1 for r in cut_results if r.get('success'))
        result['success'] = computed > 0
        result['detail'] = f'{computed}/{count} hex cells cut in floor'
    except Exception as e:
        result['error'] = str(e)
    return result


def _apply_hex_wall(root, sketches, xz_plane, wall_body, tray_body,
                     cx, x_off, td, side_h, tw, idx, side, CUT, face_wall_t=0):
    """Cut hex lightweighting pattern through a tray side wall.

    Wall sketched on XZ plane: dimensions are (tw × td) but the hex pattern
    covers the (side_h × td) face. Since the wall is thin (tw wide) and
    extruded side_h in Y, the hex pattern is drawn at (side_h × td) and
    cut through the wall thickness.

    Args:
        face_wall_t: Faceplate wall thickness for Z offset (tray starts at -face_wall_t)

    Returns result dict or None if wall too small for hex.
    """
    result = {'name': f'Tray {idx} Hex Wall {side}', 'type': 'cut', 'success': False}
    try:
        frame = hex_frame_for_size(side_h, td)
        # Check if wall is large enough for at least one hex
        inner_h = side_h - 2 * frame
        inner_d = td - 2 * frame
        if inner_h <= HEX_SPACING or inner_d <= HEX_SPACING:
            result['error'] = 'Wall too small for hex pattern'
            return result

        sk = sketches.add(xz_plane)
        sk.name = f'Hex Wall {side} {idx}'
        # The wall occupies a thin strip at cx + x_off.
        # We sketch the hex pattern covering the wall's XZ footprint.
        # XZ plane: sketch_Y = -world_Z
        count = create_hex_pattern_sketch(sk, cx + x_off, face_wall_t + td / 2, tw, td,
                                           HEX_SPACING, HEX_STRUT, frame)
        if count == 0:
            result['error'] = 'No hexagons fit in wall area'
            return result

        max_hex_area = HEX_SPACING ** 2 * 0.87
        target_body = tray_body if tray_body else wall_body
        cut_results = extrude_all_small_profiles(
            root, sk, max_hex_area, side_h + 1, CUT,
            [target_body] if target_body else None,
            direction='negative'
        )
        computed = sum(1 for r in cut_results if r.get('success'))
        result['success'] = computed > 0
        result['detail'] = f'{computed}/{count} hex cells cut in {side} wall'
    except Exception as e:
        result['error'] = str(e)
    return result


def _build_device_tray(root, sketches, xz_plane, el, pan_w, pan_h,
                       wall_t, idx, NEW, JOIN, CUT=None):
    """Build a U-channel tray: floor + side walls + wedge stoppers + stabilizers.

    Sketches on XZ plane (width=X, depth=Z), extruded in Y.
    Matches the OpenSCAD TRAY variant: open-top, 15mm side walls.
    When CUT is provided and el.floorStyle == 'hex', hex lightweighting is applied.

    Coordinate system:
      X: left-right (0 = panel center)
      Y: up-down (+ = up)
      Z: front-back (0 = faceplate front, -wall_t = back face, negative = toward rear)
    """
    results = []
    label = el.get('label', f'Device {idx}')
    td = el.get('depthBehind', 50)
    tw = BASE_STRENGTH + max(0, (td - 100) * 0.02)
    tw = max(wall_t, tw)
    floor_t = max(BASE_STRENGTH, tw * 0.8)
    inner_w = el['w'] + TOLERANCE
    total_w = inner_w + 2 * tw
    side_h = BASE_UNIT  # 15mm — NOT el['h']
    cx = el['x'] - pan_w / 2
    cy = pan_h / 2 - el['y']
    device_h = el['h']

    # Y position: bottom of device bay (below device center)
    floor_y = cy - device_h / 2 - floor_t

    # Z offset: tray starts at faceplate back face (world Z = -wall_t)
    # On XZ plane: sketch_Y = -world_Z, so positive sketch_Y → negative world Z
    z_sketch = wall_t  # maps to world Z = -wall_t (faceplate back face)

    tray_body = None

    # ── Floor: sketch on XZ (width × depth), extrude floor_t in Y ──
    result = {'name': f'Tray {idx} Floor', 'type': 'extrude'}
    try:
        sk = sketches.add(xz_plane)
        sk.name = f'Tray Floor {idx}'
        create_rect_sketch(sk, cx, z_sketch + td / 2, total_w, td)
        r = extrude_profile(root, sk, floor_t, NEW, 0, name=f'Tray {idx} Floor')
        result.update(r)
        if r.get('feature') and r['feature'].bodies.count > 0:
            tray_body = r['feature'].bodies.item(0)
            tray_body.name = f'Tray {idx}: {label}'
            move_body(root, tray_body, 0, floor_y, 0)
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    results.append(result)

    # ── Side walls: sketch on XZ (wallT × depth), extrude side_h in Y ──
    for side, x_off in [('Left', -(inner_w / 2 + tw / 2)),
                         ('Right', inner_w / 2 + tw / 2)]:
        result = {'name': f'Tray {idx} {side} Wall', 'type': 'extrude'}
        try:
            sk = sketches.add(xz_plane)
            sk.name = f'Tray Wall {side} {idx}'
            create_rect_sketch(sk, cx + x_off, z_sketch + td / 2, tw, td)
            r = extrude_profile(root, sk, side_h, NEW, 0,
                                name=f'Tray {idx} {side} Wall')
            result.update(r)
            if r.get('feature') and r['feature'].bodies.count > 0:
                body = r['feature'].bodies.item(0)
                move_body(root, body, 0, floor_y, 0)
                if tray_body and body.isValid:
                    combine_bodies(root, tray_body, [body])
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    # ── Wedge stoppers: rectangular blocks at rear corners ──
    # OpenSCAD dims: wallT wide × BASE_UNIT tall × (BASE_UNIT - wallT) deep
    wedge_depth = BASE_UNIT - tw
    for side, x_off in [('Left', -(inner_w / 2 + tw / 2)),
                         ('Right', inner_w / 2 + tw / 2)]:
        result = {'name': f'Tray {idx} Wedge {side}', 'type': 'extrude'}
        try:
            sk = sketches.add(xz_plane)
            sk.name = f'Wedge {side} {idx}'
            # Position at rear of tray (XZ plane: sketch_Y = -world_Z)
            create_rect_sketch(sk, cx + x_off, z_sketch + td - wedge_depth / 2,
                               tw, wedge_depth)
            r = extrude_profile(root, sk, BASE_UNIT, NEW, 0,
                                name=f'Tray {idx} Wedge {side}')
            result.update(r)
            if r.get('feature') and r['feature'].bodies.count > 0:
                body = r['feature'].bodies.item(0)
                move_body(root, body, 0, floor_y, 0)
                if tray_body and body.isValid:
                    combine_bodies(root, tray_body, [body])
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    # ── Stabilizer gussets: extend above side walls for tall devices ──
    # Triggered when device height > 2 × BASE_UNIT (30mm)
    # Rectangular gussets (wallT × stab_d) extruded stab_h above side walls
    if device_h > BASE_UNIT * 2:
        stab_h = min(device_h - BASE_UNIT, td)
        stab_d = min(stab_h, td)

        for side, x_off in [('Left', -(inner_w / 2 + tw / 2)),
                             ('Right', inner_w / 2 + tw / 2)]:
            result = {'name': f'Tray {idx} Stabilizer {side}', 'type': 'extrude'}
            try:
                sk = sketches.add(xz_plane)
                sk.name = f'Stabilizer {side} {idx}'
                # Gusset at front of tray, extending rearward (XZ: sketch_Y = -world_Z)
                create_rect_sketch(sk, cx + x_off, z_sketch + stab_d / 2, tw, stab_d)
                r = extrude_profile(root, sk, stab_h, NEW, 0,
                                    name=f'Tray {idx} Stabilizer {side}')
                result.update(r)
                if r.get('feature') and r['feature'].bodies.count > 0:
                    body = r['feature'].bodies.item(0)
                    # Position on top of side wall
                    move_body(root, body, 0, floor_y + side_h, 0)
                    if tray_body and body.isValid:
                        combine_bodies(root, tray_body, [body])
            except Exception as e:
                result['success'] = False
                result['error'] = str(e)
            results.append(result)

    # ── Mounting tabs: extend from side walls forward to faceplate ──
    # Tabs sit flush against the back of the faceplate for bolting.
    # Each tab: 10mm wide × wall_t deep, with M3 (1.6mm radius) through-hole.
    tab_w = 10.0
    tab_h = side_h  # same height as side wall
    m3_r = 1.6  # M3 clearance hole radius

    for side, x_off in [('Left', -(inner_w / 2 + tw / 2)),
                         ('Right', inner_w / 2 + tw / 2)]:
        result = {'name': f'Tray {idx} Tab {side}', 'type': 'extrude'}
        try:
            sk = sketches.add(xz_plane)
            sk.name = f'Tab {side} {idx}'
            # Tab at front edge of tray, spanning from faceplate back face forward
            # On XZ plane: sketch_Y = -world_Z
            # Tab sits at Z = -wall_t to Z = 0 (flush with faceplate back face)
            # So sketch_Y center = wall_t / 2
            create_rect_sketch(sk, cx + x_off, wall_t / 2, tab_w, wall_t)
            r = extrude_profile(root, sk, tab_h, NEW, 0,
                                name=f'Tray {idx} Tab {side}')
            result.update(r)
            if r.get('feature') and r['feature'].bodies.count > 0:
                body = r['feature'].bodies.item(0)
                move_body(root, body, 0, floor_y, 0)
                if tray_body and body.isValid:
                    combine_bodies(root, tray_body, [body])
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    # ── M3 holes through mounting tabs ──
    if CUT and tray_body:
        for side, x_off in [('Left', -(inner_w / 2 + tw / 2)),
                             ('Right', inner_w / 2 + tw / 2)]:
            result = {'name': f'Tray {idx} Bolt {side}', 'type': 'cut'}
            try:
                sk = sketches.add(xz_plane)
                sk.name = f'Bolt {side} {idx}'
                create_cylinder(sk, cx + x_off, wall_t / 2, m3_r)
                r = extrude_profile(root, sk, tab_h + 1, CUT, 0,
                                    participant_bodies=[tray_body],
                                    name=f'Bolt {side} {idx}')
                result.update(r)
            except Exception as e:
                result['success'] = False
                result['error'] = str(e)
            results.append(result)

    # ── Hex lightweighting cuts (after all geometry is combined) ──
    if CUT and tray_body and el.get('floorStyle', 'solid') == 'hex':
        hr = _apply_hex_floor(root, sketches, xz_plane, tray_body, el, cx, td,
                               total_w, floor_t, idx, CUT, wall_t)
        if hr:
            results.append(hr)

    return results


def _build_rear_panel(root, sketches, xy_plane, pan_w, pan_h,
                      depth, wall_t, vent_slots, NEW, CUT):
    """Build rear panel with optional vent slots."""
    results = []

    result = {'name': 'Rear Panel', 'type': 'extrude'}
    try:
        sk = sketches.add(xy_plane)
        sk.name = 'Rear Panel'
        create_rect_sketch(sk, 0, 0, pan_w, pan_h)
        r = extrude_profile(root, sk, wall_t, NEW, 0, name='Rear Panel', flip=True)
        result.update(r)

        rear_body = None
        if r.get('feature') and r['feature'].bodies.count > 0:
            rear_body = r['feature'].bodies.item(0)
            rear_body.name = 'Rear Panel'
            move_body(root, rear_body, 0, 0, -depth)
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    results.append(result)

    if vent_slots and rear_body:
        vent_result = {'name': 'Vent Slots', 'type': 'cut'}
        try:
            sk_vent = sketches.add(xy_plane)
            sk_vent.name = 'Vent Slots'
            slot_h = pan_h * 0.6
            for i in range(-4, 5):
                create_rect_sketch(sk_vent, i * 15, 0, 8, slot_h)

            cut_results = extrude_all_small_profiles(
                root, sk_vent, pan_w * pan_h, wall_t, CUT, [rear_body],
                direction='negative'  # rear panel is at -Z
            )
            computed = sum(1 for r in cut_results if r.get('success'))
            vent_result['success'] = computed > 0
            vent_result['detail'] = f'{computed} vent slots cut'
        except Exception as e:
            vent_result['success'] = False
            vent_result['error'] = str(e)
        results.append(vent_result)

    return results


def _build_fan_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                      wall_t, face_body, CUT):
    """Build fan cutout (center hole + bolt holes)."""
    label = el.get('label', 'Fan')
    result = {'name': label, 'type': 'cut'}

    try:
        cx = el['x'] - pan_w / 2
        cy = pan_h / 2 - el['y']
        cut_r = el.get('radius', el['w'] / 2)

        sk = sketches.add(xy_plane)
        sk.name = label

        # Center bore
        create_circle(sk, cx, cy, cut_r)

        # 4 bolt holes — calculate from element dimensions
        # Fan bolt pattern is typically inscribed in a square
        hole_spacing = el['w'] * 0.8  # approximate
        hole_r = 1.6  # M3 clearance

        hs = hole_spacing / 2
        for dx_sign in [-1, 1]:
            for dy_sign in [-1, 1]:
                create_circle(sk, cx + dx_sign * hs, cy + dy_sign * hs, hole_r)

        # Cut all circular profiles
        max_area = math.pi * (cut_r + 5) ** 2
        bodies = [face_body] if face_body else None
        cut_results = extrude_all_small_profiles(
            root, sk, max_area, wall_t, CUT, bodies,
            direction='negative'
        )

        computed = sum(1 for r in cut_results if r.get('success'))
        result['success'] = computed > 0
        result['detail'] = f'{computed}/5 fan features cut'
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    return result


def _build_rib(root, sketches, xz_plane, rib, pan_w, pan_h, wall_t, idx, NEW):
    """Build a reinforcement rib."""
    label = f"Rib {idx}: {rib.get('reason', '')}"
    result = {'name': label, 'type': 'extrude'}

    rib_type = rib.get('type', 'vertical-rib')
    if rib_type == 'stiffener-wedge':
        result['success'] = False
        result['error'] = 'Stiffener wedges require manual placement'
        return result

    try:
        cx = rib['x'] - pan_w / 2
        cy = pan_h / 2 - rib['y']
        rib_depth = rib.get('depth', 30)

        sk = sketches.add(xz_plane)
        sk.name = f'Rib {idx}'
        # XZ plane: sketch_Y = -world_Z
        create_rect_sketch(sk, cx, wall_t + rib_depth / 2, rib['w'], rib_depth)
        r = extrude_profile(root, sk, rib['h'], NEW, 0, name=label)
        result.update(r)

        if r.get('success') and r.get('feature'):
            body = r['feature'].bodies.item(0)
            body.name = f'Rib {idx}'
            move_body(root, body, 0, cy, 0)
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    return result


# ═══ Sheet Metal Build Path ════════════════════════════════════════


def _create_sm_rule(design, thickness, bend_radius, k_factor):
    """Create a SheetMetalRule from config values.

    Returns:
        dict with success, name, error fields
    """
    result = {'name': 'SM Rule', 'type': 'rule', 'success': False}
    try:
        lib_rules = design.librarySheetMetalRules
        if lib_rules.count == 0:
            result['error'] = 'No library sheet metal rules available'
            return result

        sm_rules = design.designSheetMetalRules
        rule = sm_rules.addByCopy(lib_rules.item(0), 'RackPro')
        rule.thickness.expression = f'{thickness} mm'
        rule.bendRadius.expression = f'{bend_radius} mm'
        rule.kFactor = k_factor

        design.rootComponent.activeSheetMetalRule = rule
        result['success'] = True
        result['detail'] = f't={thickness}mm r={bend_radius}mm k={k_factor}'
    except Exception as e:
        result['error'] = str(e)
    return result


def _build_sm_plate(root, sketches, xy_plane, tot_w, pan_h, wall_t, NEW):
    """Build full-width flat plate (faceplate + ears as one body).

    Single rectangle: totalWidth x panelHeight x thickness on XY plane.
    Ears are integral (not separate bodies like 3DP path).

    Returns:
        dict with success, name, feature, body fields
    """
    result = {'name': 'SM Plate', 'type': 'extrude', 'body': None}
    try:
        sk = sketches.add(xy_plane)
        sk.name = 'SM Plate'
        create_rect_sketch(sk, 0, 0, tot_w, pan_h)
        r = extrude_profile(root, sk, wall_t, NEW, 0, name='SM Plate', flip=True)
        result.update(r)
        if r.get('feature') and r['feature'].bodies.count > 0:
            body = r['feature'].bodies.item(0)
            body.name = 'Panel'
            result['body'] = body
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    return result


def _build_relief_notches(root, sketches, xy_plane, pan_w, pan_h, wall_t,
                          bend_radius, body, CUT):
    """Cut 4 corner relief notches where flange bend lines meet ear boundaries.

    Relief dimensions:
        width  = max(thickness, bend_radius)
        height = bend_radius + thickness

    Positions at the 4 corners where panelWidth meets panelHeight edges.

    Returns:
        dict with success, name, detail, error fields
    """
    result = {'name': 'Relief Notches', 'type': 'cut', 'success': False}
    try:
        relief_w = max(wall_t, bend_radius)
        relief_h = bend_radius + wall_t

        # Notch positions: at left/right panel-width boundaries, top/bottom edges
        # panelWidth boundary is at ±pan_w/2 from center
        notches = [
            ('TL', -(pan_w / 2), +(pan_h / 2 - relief_h / 2)),
            ('TR', +(pan_w / 2), +(pan_h / 2 - relief_h / 2)),
            ('BL', -(pan_w / 2), -(pan_h / 2 - relief_h / 2)),
            ('BR', +(pan_w / 2), -(pan_h / 2 - relief_h / 2)),
        ]

        cut_count = 0
        for label, cx, cy in notches:
            sk = sketches.add(xy_plane)
            sk.name = f'Relief {label}'
            create_rect_sketch(sk, cx, cy, relief_w, relief_h)

            bodies = [body] if body else None
            cut_results = extrude_all_small_profiles(
                root, sk, relief_w * relief_h * 2, wall_t, CUT, bodies,
                direction='negative'
            )
            if any(r.get('success') for r in cut_results):
                cut_count += 1

        result['success'] = cut_count > 0
        result['detail'] = f'{cut_count}/4 relief notches cut'
        if cut_count < 4:
            result['error'] = f'Only {cut_count}/4 notches succeeded'
    except Exception as e:
        result['error'] = str(e)
    return result


def _build_sm_flanges(root, sketches, xz_plane, pan_w, pan_h, flange_depth,
                      wall_t, body, NEW):
    """Build top and bottom return flanges as solid extrusions.

    Flanges span panelWidth (NOT totalWidth — ears don't get flanges).
    Sketched on XZ plane, extruded thickness in Y, then moved to position
    and combined into the plate body.

    The flanges extend from the back face of the plate (Z=-wall_t) rearward (-Z).

    Returns:
        list of result dicts (one per flange)
    """
    results = []

    # Top flange: inner face flush with plate back face
    #   y_base = panH/2 - thickness (so flange top aligns with plate top)
    # Bottom flange: inner face flush with plate back face
    #   y_base = -(panH/2) (so flange bottom aligns with plate bottom)
    flanges = [
        ('Top SM Flange',    pan_h / 2 - wall_t),
        ('Bottom SM Flange', -(pan_h / 2)),
    ]

    for name, y_offset in flanges:
        result = {'name': name, 'type': 'extrude', 'body': None}
        try:
            sk = sketches.add(xz_plane)
            sk.name = name
            # Flange on XZ plane: width=pan_w, depth=flange_depth
            # XZ plane: sketch_Y = -world_Z → positive sketch_Y for behind-panel
            create_rect_sketch(sk, 0, wall_t + flange_depth / 2, pan_w, flange_depth)
            r = extrude_profile(root, sk, wall_t, NEW, 0, name=name)
            result.update(r)

            if r.get('feature') and r['feature'].bodies.count > 0:
                flange_body = r['feature'].bodies.item(0)
                flange_body.name = name
                move_body(root, flange_body, 0, y_offset, 0)
                result['body'] = flange_body

                # Combine into plate body
                if body and flange_body.isValid:
                    cr = combine_bodies(root, body, [flange_body])
                    if not cr['success']:
                        result['error'] = f'Combine failed: {cr.get("error", "unknown")}'
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    return results


def _fillet_bend_edges(root, body, bend_radius, pan_w, pan_h, wall_t):
    """Fillet the 2 junction edges where flanges meet the back face of the plate.

    These edges are at Z≈-wall_t (back face), Y≈±(panH/2 - thickness), spanning panW.

    Returns:
        dict with success, name, detail, error fields
    """
    result = {'name': 'Bend Fillets', 'type': 'fillet', 'success': False}
    try:
        # Top bend edge: Z=-wall_t (back face), Y = panH/2 - wall_t
        top_y = pan_h / 2 - wall_t
        top_edges = find_edges_at_position(body, z_mm=-wall_t, y_mm=top_y,
                                           min_length_mm=pan_w * 0.5)

        # Bottom bend edge: Z=-wall_t (back face), Y = -(panH/2) + wall_t
        bot_y = -(pan_h / 2) + wall_t
        bot_edges = find_edges_at_position(body, z_mm=-wall_t, y_mm=bot_y,
                                           min_length_mm=pan_w * 0.5)

        # Merge into a single collection
        all_edges = adsk.core.ObjectCollection.create()
        for i in range(top_edges.count):
            all_edges.add(top_edges.item(i))
        for i in range(bot_edges.count):
            all_edges.add(bot_edges.item(i))

        if all_edges.count == 0:
            # Fallback: try broader search with smaller min_length
            top_edges = find_edges_at_position(body, z_mm=-wall_t, y_mm=top_y,
                                               min_length_mm=pan_w * 0.2, tol_mm=1.0)
            bot_edges = find_edges_at_position(body, z_mm=-wall_t, y_mm=bot_y,
                                               min_length_mm=pan_w * 0.2, tol_mm=1.0)
            for i in range(top_edges.count):
                all_edges.add(top_edges.item(i))
            for i in range(bot_edges.count):
                all_edges.add(bot_edges.item(i))

        if all_edges.count == 0:
            result['error'] = 'No bend edges found at expected positions'
            return result

        fillets = root.features.filletFeatures
        inp = fillets.createInput()
        inp.addConstantRadiusEdgeSet(
            all_edges,
            adsk.core.ValueInput.createByReal(mm(bend_radius)),
            False  # No tangent chain — we selected explicit edges
        )
        feat = fillets.add(inp)

        result['success'] = (feat is not None and
                             feat.healthState == adsk.fusion.FeatureHealthStates.HealthyFeatureHealthState)
        result['feature'] = feat
        result['detail'] = f'{all_edges.count} bend edges filleted at r={bend_radius}mm'
        if not result['success']:
            result['error'] = 'Fillet feature failed to compute'
    except Exception as e:
        result['error'] = str(e)
    return result


def _find_front_face(body, wall_t):
    """Find the front planar face of the panel body for flat pattern creation.

    The front face is at Z = 0 (front of faceplate), and is the largest
    planar face at that Z position.

    Returns:
        BRepFace or None
    """
    target_z = 0
    best_face = None
    best_area = 0

    for i in range(body.faces.count):
        face = body.faces.item(i)
        try:
            geo = face.geometry
            if not isinstance(geo, adsk.core.Plane):
                continue
            # Check if face normal is along Z and at the right position
            origin = geo.origin
            normal = geo.normal
            if abs(normal.z) > 0.9 and abs(origin.z - target_z) < 0.005:
                area = face.area
                if area > best_area:
                    best_area = area
                    best_face = face
        except:
            continue

    return best_face


def _convert_to_sheet_metal(body, wall_t):
    """Convert a solid body to sheet metal using the ConvertToSheetMetalCmd
    text command.  This is the only way to do it via the API — the Sheet Metal
    Flange API is read-only and Convert to Sheet Metal has no first-class
    API method.

    Selects the front face, executes the command, and commits.
    Best-effort — returns success: False with error detail on failure.
    """
    result = {'name': 'Convert to SM', 'type': 'convert', 'success': False}
    try:
        if body.isSheetMetal:
            result['success'] = True
            result['detail'] = 'Body already sheet metal'
            return result

        front_face = _find_front_face(body, wall_t)
        if not front_face:
            result['error'] = 'Could not find front face for conversion'
            return result

        app = adsk.core.Application.get()
        sels = app.userInterface.activeSelections
        sels.clear()
        sels.add(front_face)

        app.executeTextCommand(u'Commands.Start ConvertToSheetMetalCmd')
        app.executeTextCommand(u'NuCommands.CommitCmd')

        sels.clear()

        # After conversion the body object may still be valid but now
        # reports isSheetMetal = True.  If it was replaced, the caller
        # will re-acquire by name.
        if body.isValid and body.isSheetMetal:
            result['success'] = True
            result['detail'] = 'Converted via ConvertToSheetMetalCmd'
        elif body.isValid:
            result['error'] = 'Command ran but body is still solid'
        else:
            # Body reference invalidated — caller should re-acquire
            result['success'] = True
            result['detail'] = 'Converted (body reference invalidated)'
    except Exception as e:
        result['error'] = str(e)
    return result


def _build_sheet_metal(config):
    """Top-level orchestrator for sheet metal builds.

    Builds correct folded 3D geometry as solid bodies:
    faceplate + return flanges with filleted bend edges + relief notches.
    Sets SM rule and attempts flat pattern creation.

    Called when fabrication.method == 'Sheet Metal'.
    """
    app = adsk.core.Application.get()
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return {'success': False, 'error': 'No active Fusion design'}

    features_log = []
    errors = []
    warnings = []

    try:
        root = design.rootComponent
        sketches = root.sketches
        xy_plane = root.xYConstructionPlane
        xz_plane = root.xZConstructionPlane
        NEW = adsk.fusion.FeatureOperations.NewBodyFeatureOperation
        CUT = adsk.fusion.FeatureOperations.CutFeatureOperation

        # ─── Extract config ──────────────────────────────────
        panel = config.get('panel', {})
        enclosure = config.get('enclosure', {})
        fabrication = config.get('fabrication', {})
        elements = config.get('elements', [])

        pan_w = panel.get('panelWidth', 450.85)
        pan_h = panel.get('panelHeight', 43.66)
        tot_w = panel.get('totalWidth', 482.6)
        u_height = panel.get('uHeight', 1)

        flange_depth = enclosure.get('flangeDepth', 15)
        enable_flanges = enclosure.get('flanges', True)
        enable_chamfers = enclosure.get('chamfers', True)

        wall_t = fabrication.get('thickness', 1.5)
        bend_radius = fabrication.get('bendRadius', 1.5)
        k_factor = fabrication.get('kFactor', 0.4)

        rack_h = u_height * UNIT_HEIGHT

        connectors = [e for e in elements if e.get('type') == 'connector']
        devices = [e for e in elements if e.get('type') == 'device']
        fans = [e for e in elements if e.get('type') == 'fan']

        # ─── 1. Set design type ─────────────────────────────
        design.designType = adsk.fusion.DesignTypes.ParametricDesignType

        # ─── 2. User parameters ─────────────────────────────
        _set_params(design, {
            'panelWidth': pan_w,
            'panelHeight': pan_h,
            'totalWidth': tot_w,
            'earWidth': EAR_WIDTH,
            'wallThickness': wall_t,
            'flangeDepth': flange_depth,
            'bendRadius': bend_radius,
        })

        # ─── Step 1: Sheet Metal Rule ───────────────────────
        r = _create_sm_rule(design, wall_t, bend_radius, k_factor)
        features_log.append(r)
        if not r['success']:
            warnings.append(f"SM Rule: {r.get('error', 'unknown')} — building geometry without rule")

        # ─── Step 2: Full-Width Flat Plate ──────────────────
        face_body = None
        r = _build_sm_plate(root, sketches, xy_plane, tot_w, pan_h, wall_t, NEW)
        features_log.append(r)
        if r.get('body'):
            face_body = r['body']
        if not r['success']:
            errors.append(f"SM Plate: {r.get('error', 'unknown')}")

        # ─── Step 3-5: Skipped ───────────────────────────────
        # Solid flanges + relief notches are NOT built here.
        # Instead, after cutouts, we Convert to Sheet Metal (Step 7a)
        # and add proper SM flanges via the FlangeCmd text command (7b).
        # This produces a valid SM body that supports flat pattern creation.

        # ─── Step 6: Cutouts (reuse existing functions) ─────
        # Bore pattern
        r = _build_bores(root, sketches, xy_plane, pan_w, rack_h, u_height,
                         wall_t, face_body, CUT)
        features_log.append(r)
        if not r['success']:
            errors.append(f"Bores: {r.get('error', 'unknown')}")

        # Connector cutouts
        for el in connectors:
            r = _build_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                              wall_t, face_body, CUT)
            features_log.append(r)
            if not r['success']:
                errors.append(f"{el.get('label', 'Cutout')}: {r.get('error', 'unknown')}")

        # Device cutouts
        for el in devices:
            r = _build_device_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                                     wall_t, face_body, CUT)
            features_log.append(r)
            if not r['success']:
                errors.append(f"{el.get('label', 'Device')}: {r.get('error', 'unknown')}")

        # Fan cutouts
        for el in fans:
            r = _build_fan_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                                  wall_t, face_body, CUT)
            features_log.append(r)
            if not r['success']:
                errors.append(f"{el.get('label', 'Fan')}: {r.get('error', 'unknown')}")

        # ─── Step 6b: Mounting holes for tray attachment ───
        # M3 clearance holes (3.2mm dia) in faceplate, matching tray tab positions
        m3_r = 1.6  # M3 clearance radius
        if face_body:
            for i, el in enumerate(devices):
                inner_w = el['w'] + TOLERANCE
                tw_dev = BASE_STRENGTH + max(0, (el.get('depthBehind', 50) - 100) * 0.02)
                tw_dev = max(wall_t, tw_dev)
                cx = el['x'] - pan_w / 2
                cy = pan_h / 2 - el['y']
                device_h = el['h']
                floor_y = cy - device_h / 2
                side_h = BASE_UNIT  # 15mm
                for side, x_off in [('L', -(inner_w / 2 + tw_dev / 2)),
                                     ('R', inner_w / 2 + tw_dev / 2)]:
                    result = {'name': f'Mount Hole {i}{side}', 'type': 'cut'}
                    try:
                        sk = sketches.add(xy_plane)
                        hole_y = floor_y + side_h / 2
                        create_cylinder(sk, cx + x_off, hole_y, m3_r)
                        r = extrude_profile(root, sk, wall_t + 1, CUT, 0,
                                            participant_bodies=[face_body],
                                            name=f'Mount Hole {i}{side}',
                                            flip=True)
                        result.update(r)
                    except Exception as e:
                        result['success'] = False
                        result['error'] = str(e)
                    features_log.append(result)

        # ─── Step 7: Convert to SM → Add Flanges → Flat Pattern ──
        if face_body:
            # 7a — Convert solid body to sheet metal
            conv_result = _convert_to_sheet_metal(face_body, wall_t)
            features_log.append(conv_result)
            if not conv_result['success']:
                warnings.append(f"Convert to SM: {conv_result.get('error', 'failed')}")

            # Re-acquire body reference (may be invalidated by conversion)
            if not face_body.isValid:
                face_body = find_body_by_name(root, 'SM Panel')

            # 7b — SM flanges cannot be added via API (Flange command doesn't
            #       accept edge selections from executeTextCommand context).
            #       User must add flanges manually in Fusion:
            #       Sheet Metal → Flange → select top/bottom edges → use
            #       flangeDepth parameter for distance.
            if face_body and face_body.isSheetMetal:
                features_log.append({
                    'name': 'SM Flanges',
                    'type': 'info',
                    'success': False,
                    'error': (f'Add flanges manually: Sheet Metal > Flange > '
                              f'select top & bottom edges > {flange_depth}mm depth')
                })

            # 7c — Create flat pattern (requires sheet metal body)
            fp_result = {'name': 'Flat Pattern', 'type': 'flat_pattern', 'success': False}
            try:
                if face_body and face_body.isValid and face_body.isSheetMetal:
                    # Find the largest planar face — should be the front panel
                    best_face = None
                    best_area = 0
                    for fi in range(face_body.faces.count):
                        f = face_body.faces.item(fi)
                        try:
                            geo = f.geometry
                            if isinstance(geo, adsk.core.Plane):
                                a = f.area
                                if a > best_area:
                                    best_area = a
                                    best_face = f
                        except:
                            continue
                    if best_face:
                        root.createFlatPattern(best_face)
                        fp_result['success'] = True
                        fp_result['detail'] = f'Flat pattern created (face area={best_area:.1f}cm²)'
                    else:
                        fp_result['error'] = 'No planar face found for flat pattern'
                        warnings.append('Flat pattern: no planar face found')
                else:
                    fp_result['error'] = 'Body not sheet metal — conversion may have failed'
            except Exception as e:
                fp_result['error'] = str(e)
                warnings.append(f'Flat pattern: {e}')
            features_log.append(fp_result)

        # ─── Step 8: Device Trays (3DP, separate bodies) ────
        for i, el in enumerate(devices):
            tray_results = _build_device_tray(root, sketches, xz_plane,
                                              el, pan_w, pan_h, wall_t, i, NEW,
                                              adsk.fusion.FeatureOperations.JoinFeatureOperation,
                                              CUT)
            features_log.extend(tray_results)
            for tr in tray_results:
                if not tr['success']:
                    errors.append(f"Tray {i}: {tr.get('error', 'unknown')}")

        # ─── Step 9: Skip Chamfers ──────────────────────────
        # Sheet metal panels are deburred in fabrication — no chamfers needed.

        # Name the main body
        if face_body and face_body.isValid:
            face_body.name = 'SM Panel'

        # ─── Timeline grouping ──────────────────────────────
        try:
            timeline = design.timeline
            if timeline.count > 1:
                group = timeline.timelineGroups.add(
                    timeline.item(0), timeline.item(timeline.count - 1)
                )
                group.name = 'RackPro SM'
        except:
            warnings.append('Could not group timeline features')

        # ─── Fit viewport ──────────────────────────────────
        app.activeViewport.fit()

        # ─── Collect body properties ────────────────────────
        bodies_info = _collect_body_info(root)

        return {
            'success': len(errors) == 0,
            'features': [
                {
                    'name': f.get('name', ''),
                    'type': f.get('type', 'extrude'),
                    'computed': f.get('success', False),
                    'error': f.get('error'),
                }
                for f in features_log
            ],
            'bodies': bodies_info,
            'errors': errors,
            'warnings': warnings,
        }

    except Exception as e:
        return {
            'success': False,
            'error': traceback.format_exc(),
            'features': [
                {
                    'name': f.get('name', ''),
                    'type': f.get('type', 'extrude'),
                    'computed': f.get('success', False),
                    'error': f.get('error'),
                }
                for f in features_log
            ],
            'errors': errors + [str(e)],
            'warnings': warnings,
        }


# ═══ Modular Build Path ═══════════════════════════════════════════

# Mounting interface constants (must match src/constants/mounting.ts)
_MOUNT = {
    'TAB_WIDTH': 12,
    'TAB_DEPTH': 8,
    'BOSS_DIA': 8,
    'BOSS_HEIGHT': 6,
    'CLEARANCE_HOLE': 3.4,
    'PILOT_HOLE': 2.5,
    'PEM_HOLE': 3.2,
    'ALIGN_PIN_DIA': 3.0,
    'ALIGN_SOCKET_DIA': 3.2,
    'ALIGN_PIN_DEPTH': 2.0,
    'SLIDE_CLEARANCE': 0.3,
    'MOUNT_INSET': 3,
    'DEEP_TRAY_THRESHOLD': 150,
}


def _compute_mount_positions(el, wall_t):
    """Compute mounting boss positions for a device element."""
    inset = _MOUNT['MOUNT_INSET'] + wall_t
    positions = [
        {'x': el['x'] - el['w'] / 2 - inset, 'y': el['y'] - el['h'] / 2 - inset, 'side': 'top-left'},
        {'x': el['x'] + el['w'] / 2 + inset, 'y': el['y'] - el['h'] / 2 - inset, 'side': 'top-right'},
    ]
    if el.get('depthBehind', 0) > _MOUNT['DEEP_TRAY_THRESHOLD']:
        positions.extend([
            {'x': el['x'] - el['w'] / 2 - inset, 'y': el['y'] + el['h'] / 2 + inset, 'side': 'bottom-left'},
            {'x': el['x'] + el['w'] / 2 + inset, 'y': el['y'] + el['h'] / 2 + inset, 'side': 'bottom-right'},
        ])
    return positions


def _compute_align_positions(el, wall_t):
    """Compute alignment pin positions."""
    inset = _MOUNT['MOUNT_INSET'] + wall_t
    return [
        {'x': el['x'] - el['w'] / 2 - inset, 'y': el['y'] + el['h'] / 2 + inset / 2, 'side': 'bottom-left'},
        {'x': el['x'] + el['w'] / 2 + inset, 'y': el['y'] + el['h'] / 2 + inset / 2, 'side': 'bottom-right'},
    ]


def _build_modular(config):
    """Build modular assembly: separate faceplate + per-device trays."""
    app = adsk.core.Application.get()
    design = adsk.fusion.Design.cast(app.activeProduct)
    if not design:
        return {'success': False, 'error': 'No active Fusion design'}

    features_log = []
    errors = []
    warnings = []

    try:
        root = design.rootComponent
        sketches = root.sketches
        xy_plane = root.xYConstructionPlane
        xz_plane = root.xZConstructionPlane
        NEW = adsk.fusion.FeatureOperations.NewBodyFeatureOperation
        JOIN = adsk.fusion.FeatureOperations.JoinFeatureOperation
        CUT = adsk.fusion.FeatureOperations.CutFeatureOperation

        panel = config.get('panel', {})
        enclosure = config.get('enclosure', {})
        fabrication = config.get('fabrication', {})
        elements = config.get('elements', [])
        assembly = config.get('assembly', {})

        pan_w = panel.get('panelWidth', 450.85)
        pan_h = panel.get('panelHeight', 43.66)
        tot_w = panel.get('totalWidth', 482.6)
        u_height = panel.get('uHeight', 1)
        depth = enclosure.get('depth', 50)
        flange_depth = enclosure.get('flangeDepth', 15)
        enable_flanges = enclosure.get('flanges', True)
        rear_panel = enclosure.get('rearPanel', False)
        enable_chamfers = enclosure.get('chamfers', True)
        is_3dp = fabrication.get('method') == '3D Print'
        wall_t = fabrication.get('wallThickness', 3) if is_3dp else fabrication.get('thickness', 1.5)
        rack_h = u_height * UNIT_HEIGHT
        face_fab = assembly.get('faceFab', '3dp')

        connectors = [e for e in elements if e.get('type') == 'connector']
        devices = [e for e in elements if e.get('type') == 'device']

        design.designType = adsk.fusion.DesignTypes.ParametricDesignType

        # ─── 1-2. Faceplate construction (SM vs 3DP) ─────────
        face_body = None
        bend_radius = 0  # set by SM path if needed

        if face_fab == 'sm':
            # SM: integral plate (faceplate + ears as one body)
            sm_fab = config.get('fabrication', {})
            bend_radius = sm_fab.get('bendRadius', 1.5)
            k_factor = sm_fab.get('kFactor', 0.4)

            r = _create_sm_rule(design, wall_t, bend_radius, k_factor)
            features_log.append(r)
            if not r['success']:
                warnings.append(f"SM Rule: {r.get('error', 'unknown')} — building geometry without rule")

            r = _build_sm_plate(root, sketches, xy_plane, tot_w, pan_h, wall_t, NEW)
            features_log.append(r)
            if r.get('body'):
                face_body = r['body']
            if not r['success']:
                errors.append(f"SM Plate: {r.get('error', 'unknown')}")
        else:
            # 3DP: separate faceplate + ears
            r = _build_faceplate(root, sketches, xy_plane, pan_w, pan_h, wall_t, NEW)
            features_log.append(r)
            if r.get('feature') and r['feature'].bodies.count > 0:
                face_body = r['feature'].bodies.item(0)
                face_body.name = 'Faceplate'
            if not r['success']:
                errors.append(f"Faceplate: {r.get('error', 'unknown')}")

            r_ears = _build_ears(root, sketches, xy_plane, pan_w, pan_h, wall_t, face_body, JOIN)
            features_log.extend(r_ears)

        # ─── 3-5. Bores + cutouts (shared) ───────────────────
        r_bores = _build_bores(root, sketches, xy_plane, pan_w, rack_h, u_height,
                               wall_t, face_body, CUT)
        features_log.append(r_bores)

        for el in connectors:
            r = _build_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                              wall_t, face_body, CUT)
            features_log.append(r)

        for el in devices:
            r = _build_device_cutout(root, sketches, xy_plane, el, pan_w, pan_h,
                                     wall_t, face_body, CUT)
            features_log.append(r)

        # ─── 6. Flanges / enclosure shell ─────────────────────
        if face_fab == 'sm':
            # SM flanges are always built — they're integral bends in the same sheet.
            # The 'flanges' toggle only applies to 3DP mode.
            if face_body:
                r = _build_relief_notches(root, sketches, xy_plane, pan_w, pan_h,
                                          wall_t, bend_radius, face_body, CUT)
                features_log.append(r)
                if not r['success']:
                    warnings.append(f"Relief notches: {r.get('error', 'skipped')}")

                for fr in _build_sm_flanges(root, sketches, xz_plane, pan_w, pan_h,
                                            flange_depth, wall_t, face_body, NEW):
                    features_log.append(fr)
                    if not fr['success']:
                        errors.append(f"{fr['name']}: {fr.get('error', 'unknown')}")

                r = _fillet_bend_edges(root, face_body, bend_radius, pan_w, pan_h, wall_t)
                features_log.append(r)
                if not r['success']:
                    warnings.append(f"Bend fillets: {r.get('error', 'sharp bends')}")

                face_body.name = 'SM Panel'
        else:
            # 3DP: enclosure walls + retention flanges + combine
            style = enclosure.get('style', 'tray')
            shell_bodies = []
            if style == 'box':
                for wr in _build_enclosure_walls(root, sketches, xz_plane, pan_w, pan_h,
                                                 depth, wall_t, NEW):
                    features_log.append(wr)
                    if wr.get('body'):
                        shell_bodies.append(wr['body'])

            if enable_flanges:
                for fr in _build_flanges(root, sketches, xz_plane, pan_w, pan_h,
                                         flange_depth, wall_t, NEW):
                    features_log.append(fr)
                    if fr.get('body'):
                        shell_bodies.append(fr['body'])

            if face_body and shell_bodies:
                r = combine_bodies(root, face_body, shell_bodies)
                features_log.append(r)
                if r['success']:
                    face_body.name = 'Faceplate Assembly'

        # ─── 7. Mounting bosses (3DP only — SM uses PEM nuts) ──
        pilot_r = _MOUNT['PEM_HOLE'] / 2 if face_fab == 'sm' else _MOUNT['PILOT_HOLE'] / 2

        if face_fab != 'sm':
            boss_r = _MOUNT['BOSS_DIA'] / 2
            for el in devices:
                mounts = _compute_mount_positions(el, wall_t)
                for mp in mounts:
                    result = {'name': f"Boss {mp['side']}", 'type': 'extrude'}
                    try:
                        sk = sketches.add(xy_plane)
                        create_cylinder(sk, mp['x'] - pan_w / 2, pan_h / 2 - mp['y'], boss_r)
                        r = extrude_profile(root, sk, _MOUNT['BOSS_HEIGHT'], NEW, 0,
                                            name=f"Boss {mp['side']}", flip=True)
                        result.update(r)
                        if r.get('feature') and r['feature'].bodies.count > 0:
                            body = r['feature'].bodies.item(0)
                            move_body(root, body, 0, 0, -wall_t)
                            # Combine boss into faceplate
                            if face_body and body.isValid:
                                combine_bodies(root, face_body, [body])
                    except Exception as e:
                        result['success'] = False
                        result['error'] = str(e)
                    features_log.append(result)

        # ─── 8. Pilot / PEM holes (always — size switches on face_fab) ─
        hole_depth = wall_t if face_fab == 'sm' else wall_t + _MOUNT['BOSS_HEIGHT']
        for el in devices:
            mounts = _compute_mount_positions(el, wall_t)
            for mp in mounts:
                result = {'name': f"Pilot {mp['side']}", 'type': 'cut'}
                try:
                    sk = sketches.add(xy_plane)
                    create_cylinder(sk, mp['x'] - pan_w / 2, pan_h / 2 - mp['y'], pilot_r)
                    max_area = math.pi * (pilot_r + 1) ** 2
                    cut_results = extrude_all_small_profiles(
                        root, sk, max_area, hole_depth,
                        CUT, [face_body] if face_body else None,
                        direction='negative'
                    )
                    result['success'] = any(r.get('success') for r in cut_results)
                except Exception as e:
                    result['success'] = False
                    result['error'] = str(e)
                features_log.append(result)

        # ─── 9. Alignment pins (3DP only — SM has no protrusions) ─
        if face_fab != 'sm':
            align_r = _MOUNT['ALIGN_PIN_DIA'] / 2
            for el in devices:
                aligns = _compute_align_positions(el, wall_t)
                for ap in aligns:
                    result = {'name': f"AlignPin {ap['side']}", 'type': 'extrude'}
                    try:
                        sk = sketches.add(xy_plane)
                        create_cylinder(sk, ap['x'] - pan_w / 2, pan_h / 2 - ap['y'], align_r)
                        r = extrude_profile(root, sk, _MOUNT['ALIGN_PIN_DEPTH'], NEW, 0,
                                            name=f"AlignPin {ap['side']}", flip=True)
                        result.update(r)
                        if r.get('feature') and r['feature'].bodies.count > 0:
                            body = r['feature'].bodies.item(0)
                            move_body(root, body, 0, 0, -wall_t)
                            if face_body and body.isValid:
                                combine_bodies(root, face_body, [body])
                    except Exception as e:
                        result['success'] = False
                        result['error'] = str(e)
                    features_log.append(result)

        # ─── 10. Faceplate chamfers (3DP only — SM deburred in fab) ─
        if enable_chamfers and face_fab != 'sm':
            cham = min(1.0, wall_t * 0.4)
            if face_body and cham >= 0.2:
                r = apply_chamfers(root, face_body, cham, face_z_mm=0)
                features_log.append(r)

        # ─── 11. Per-device trays ───────────────────────────────
        for i, el in enumerate(devices):
            r = _build_tray_module(root, sketches, xy_plane, xz_plane,
                                   el, pan_w, pan_h, wall_t, i, NEW, CUT)
            features_log.extend(r)

        # ─── 12. Rear panel ────────────────────────────────────
        if rear_panel:
            vent_slots = enclosure.get('ventSlots', False)
            r = _build_rear_panel(root, sketches, xy_plane, pan_w, pan_h,
                                  depth, wall_t, vent_slots, NEW, CUT)
            features_log.extend(r)

        # Fit viewport
        app.activeViewport.fit()

        bodies_info = _collect_body_info(root)

        return {
            'success': len(errors) == 0,
            'features': [
                {
                    'name': f.get('name', ''),
                    'type': f.get('type', 'extrude'),
                    'computed': f.get('success', False),
                    'error': f.get('error'),
                }
                for f in features_log
            ],
            'bodies': bodies_info,
            'errors': errors,
            'warnings': warnings,
        }
    except Exception as e:
        return {
            'success': False,
            'error': traceback.format_exc(),
            'features': [
                {
                    'name': f.get('name', ''),
                    'type': f.get('type', 'extrude'),
                    'computed': f.get('success', False),
                    'error': f.get('error'),
                }
                for f in features_log
            ],
            'errors': errors + [str(e)],
            'warnings': warnings,
        }


def _build_tray_module(root, sketches, xy_plane, xz_plane,
                       el, pan_w, pan_h, wall_t, idx, NEW, CUT):
    """Build a complete tray module: floor + walls + wedges + stabilizers + tabs.

    Floor and walls are sketched on XZ plane (correct orientation).
    Tabs are sketched on XY plane (they extend from faceplate rear face).
    """
    results = []
    label = el.get('label', f'Device {idx}')
    td = el.get('depthBehind', 50)
    tw = BASE_STRENGTH + max(0, (td - 100) * 0.02)
    tw = max(wall_t, tw)
    floor_t = max(BASE_STRENGTH, tw * 0.8)
    inner_w = el['w'] + TOLERANCE
    total_w = inner_w + 2 * tw
    side_h = BASE_UNIT  # 15mm — open-top U-channel
    cx = el['x'] - pan_w / 2
    cy = pan_h / 2 - el['y']
    device_h = el['h']
    floor_y = cy - device_h / 2 - floor_t

    # Z offset: tray starts at faceplate back face (world Z = -wall_t)
    # On XZ plane: sketch_Y = -world_Z, so positive sketch_Y → negative world Z
    z_sketch = wall_t  # maps to world Z = -wall_t (faceplate back face)

    tray_body = None

    # ── Floor: sketch on XZ (width × depth), extrude floor_t in Y ──
    result = {'name': f'Tray {idx} Floor', 'type': 'extrude'}
    try:
        sk = sketches.add(xz_plane)
        sk.name = f'Tray Floor {idx}'
        create_rect_sketch(sk, cx, z_sketch + td / 2, total_w, td)
        r = extrude_profile(root, sk, floor_t, NEW, 0, name=f'Tray {idx} Floor')
        result.update(r)
        if r.get('feature') and r['feature'].bodies.count > 0:
            tray_body = r['feature'].bodies.item(0)
            tray_body.name = f'Tray {idx}: {label}'
            move_body(root, tray_body, 0, floor_y, 0)
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
    results.append(result)

    # ── Side walls: sketch on XZ (wallT × depth), extrude side_h in Y ──
    for side, x_off in [('Left', -(inner_w / 2 + tw / 2)),
                         ('Right', inner_w / 2 + tw / 2)]:
        result = {'name': f'Tray {idx} {side} Wall', 'type': 'extrude'}
        try:
            sk = sketches.add(xz_plane)
            sk.name = f'Tray Wall {side} {idx}'
            create_rect_sketch(sk, cx + x_off, z_sketch + td / 2, tw, td)
            r = extrude_profile(root, sk, side_h, NEW, 0,
                                name=f'Tray {idx} {side} Wall')
            result.update(r)
            if r.get('feature') and r['feature'].bodies.count > 0:
                body = r['feature'].bodies.item(0)
                move_body(root, body, 0, floor_y, 0)
                if tray_body and body.isValid:
                    combine_bodies(root, tray_body, [body])
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    # ── Wedge stoppers at rear corners ──
    wedge_depth = BASE_UNIT - tw
    for side, x_off in [('Left', -(inner_w / 2 + tw / 2)),
                         ('Right', inner_w / 2 + tw / 2)]:
        result = {'name': f'Tray {idx} Wedge {side}', 'type': 'extrude'}
        try:
            sk = sketches.add(xz_plane)
            sk.name = f'Wedge {side} {idx}'
            # Position at rear of tray (XZ plane: sketch_Y = -world_Z)
            create_rect_sketch(sk, cx + x_off, z_sketch + td - wedge_depth / 2,
                               tw, wedge_depth)
            r = extrude_profile(root, sk, BASE_UNIT, NEW, 0,
                                name=f'Tray {idx} Wedge {side}')
            result.update(r)
            if r.get('feature') and r['feature'].bodies.count > 0:
                body = r['feature'].bodies.item(0)
                move_body(root, body, 0, floor_y, 0)
                if tray_body and body.isValid:
                    combine_bodies(root, tray_body, [body])
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    # ── Stabilizer gussets above side walls ──
    if device_h > BASE_UNIT * 2:
        stab_h = min(device_h - BASE_UNIT, td)
        stab_d = min(stab_h, td)
        for side, x_off in [('Left', -(inner_w / 2 + tw / 2)),
                             ('Right', inner_w / 2 + tw / 2)]:
            result = {'name': f'Tray {idx} Stabilizer {side}', 'type': 'extrude'}
            try:
                sk = sketches.add(xz_plane)
                sk.name = f'Stabilizer {side} {idx}'
                # XZ plane: sketch_Y = -world_Z
                create_rect_sketch(sk, cx + x_off, z_sketch + stab_d / 2, tw, stab_d)
                r = extrude_profile(root, sk, stab_h, NEW, 0,
                                    name=f'Tray {idx} Stabilizer {side}')
                result.update(r)
                if r.get('feature') and r['feature'].bodies.count > 0:
                    body = r['feature'].bodies.item(0)
                    move_body(root, body, 0, floor_y + side_h, 0)
                    if tray_body and body.isValid:
                        combine_bodies(root, tray_body, [body])
            except Exception as e:
                result['success'] = False
                result['error'] = str(e)
            results.append(result)

    # ── Hex lightweighting cuts (after all geometry is combined) ──
    if tray_body and el.get('floorStyle', 'solid') == 'hex':
        hr = _apply_hex_floor(root, sketches, xz_plane, tray_body, el, cx, td,
                               total_w, floor_t, idx, CUT, wall_t)
        if hr:
            results.append(hr)

    # ── Mounting tabs (on XY plane — extend from faceplate rear) ──
    mounts = _compute_mount_positions(el, wall_t)
    for mp in mounts:
        result = {'name': f'Tray {idx} Tab {mp["side"]}', 'type': 'extrude'}
        try:
            sk = sketches.add(xy_plane)
            create_rect_sketch(sk, mp['x'] - pan_w / 2, pan_h / 2 - mp['y'],
                               _MOUNT['TAB_WIDTH'], _MOUNT['TAB_DEPTH'])
            r = extrude_profile(root, sk, tw, NEW, 0,
                                name=f'Tray {idx} Tab', flip=True)
            result.update(r)
            if r.get('feature') and r['feature'].bodies.count > 0:
                body = r['feature'].bodies.item(0)
                if tray_body and body.isValid:
                    combine_bodies(root, tray_body, [body])
        except Exception as e:
            result['success'] = False
            result['error'] = str(e)
        results.append(result)

    # ── Tab clearance holes ──
    if tray_body:
        for mp in mounts:
            result = {'name': f'Tray {idx} TabHole {mp["side"]}', 'type': 'cut'}
            try:
                sk = sketches.add(xy_plane)
                create_cylinder(sk, mp['x'] - pan_w / 2, pan_h / 2 - mp['y'],
                                _MOUNT['CLEARANCE_HOLE'] / 2)
                max_area = math.pi * (_MOUNT['CLEARANCE_HOLE'] / 2 + 1) ** 2
                cut_results = extrude_all_small_profiles(
                    root, sk, max_area, tw + 1, CUT, [tray_body],
                    direction='negative'
                )
                result['success'] = any(r.get('success') for r in cut_results)
            except Exception as e:
                result['success'] = False
                result['error'] = str(e)
            results.append(result)

    return results


def _collect_body_info(comp):
    """Collect physical properties for all bodies."""
    bodies = []
    for i in range(comp.bRepBodies.count):
        body = comp.bRepBodies.item(i)
        info = {'name': body.name}
        try:
            props = body.physicalProperties
            info['volume_cm3'] = round(props.volume, 4)
            info['mass_g'] = round(props.mass * 1000, 2)
            cog = props.centerOfMass
            info['cog'] = [
                round(cm_to_mm(cog.x), 3),
                round(cm_to_mm(cog.y), 3),
                round(cm_to_mm(cog.z), 3),
            ]
        except:
            pass

        try:
            bbox = body.boundingBox
            info['bbox'] = {
                'min': [
                    round(cm_to_mm(bbox.minPoint.x), 3),
                    round(cm_to_mm(bbox.minPoint.y), 3),
                    round(cm_to_mm(bbox.minPoint.z), 3),
                ],
                'max': [
                    round(cm_to_mm(bbox.maxPoint.x), 3),
                    round(cm_to_mm(bbox.maxPoint.y), 3),
                    round(cm_to_mm(bbox.maxPoint.z), 3),
                ],
            }
        except:
            pass

        bodies.append(info)
    return bodies
