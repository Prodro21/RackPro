"""
RackPro Bridge — Geometry Helpers

Sketch and extrude operations with error handling.
Each function returns a result dict: { success, name, error? }
"""

import adsk.core
import adsk.fusion
import math
import traceback

from .constants import (
    mm, EPS,
    HEX_SPACING, HEX_STRUT, HEX_FRAME, HEX_FRAME_LARGE, HEX_FRAME_THRESHOLD,
)


def _is_healthy(feat):
    """Check if a feature computed successfully via healthState."""
    if feat is None:
        return False
    try:
        return feat.healthState == adsk.fusion.FeatureHealthStates.HealthyFeatureHealthState
    except:
        # If healthState isn't available, assume success if the feature exists
        return feat is not None


def create_rect_sketch(sketch, cx_mm, cy_mm, w_mm, h_mm):
    """Draw a centered rectangle in a sketch. Returns the sketch lines."""
    sl = sketch.sketchCurves.sketchLines
    x1, y1 = mm(cx_mm - w_mm / 2), mm(cy_mm - h_mm / 2)
    x2, y2 = mm(cx_mm + w_mm / 2), mm(cy_mm + h_mm / 2)
    p0 = adsk.core.Point3D.create(x1, y1, 0)
    p1 = adsk.core.Point3D.create(x2, y1, 0)
    p2 = adsk.core.Point3D.create(x2, y2, 0)
    p3 = adsk.core.Point3D.create(x1, y2, 0)
    sl.addByTwoPoints(p0, p1)
    sl.addByTwoPoints(p1, p2)
    sl.addByTwoPoints(p2, p3)
    sl.addByTwoPoints(p3, p0)
    return sketch


def create_circle(sketch, cx_mm, cy_mm, r_mm):
    """Draw a circle in a sketch."""
    circles = sketch.sketchCurves.sketchCircles
    center = adsk.core.Point3D.create(mm(cx_mm), mm(cy_mm), 0)
    circles.addByCenterRadius(center, mm(r_mm))
    return sketch


def create_d_shape(sketch, cx_mm, cy_mm, r_mm, flat_mm=None):
    """Draw a D-shape cutout (circle with flat bottom).

    If flat_mm is None, defaults to 90% of diameter (standard Neutrik D flat).
    For simplicity, draws a circle — Fusion can trim the flat manually,
    or we can add the line-trim logic later.
    """
    # For now, approximate as circle — profile selection works the same
    create_circle(sketch, cx_mm, cy_mm, r_mm)
    return sketch


def extrude_profile(comp, sketch, thickness_mm, operation, profile_idx=0,
                    participant_bodies=None, name=None, flip=False):
    """Extrude a profile from a sketch with explicit body targeting.

    Args:
        comp: Component to extrude in
        sketch: Sketch containing profiles
        thickness_mm: Extrusion distance in mm
        operation: FeatureOperations enum value
        profile_idx: Which profile to use (0-based)
        participant_bodies: List of bodies for CUT/JOIN operations
        name: Optional feature name
        flip: If True, extrude in the negative normal direction

    Returns:
        dict with success, name, feature, error fields
    """
    result = {'success': False, 'name': name or f'Extrude_{profile_idx}'}
    try:
        if sketch.profiles.count <= profile_idx:
            result['error'] = f'Profile index {profile_idx} not found (count: {sketch.profiles.count})'
            return result

        prof = sketch.profiles.item(profile_idx)
        ext_feats = comp.features.extrudeFeatures
        inp = ext_feats.createInput(prof, operation)
        dist = adsk.core.ValueInput.createByReal(mm(thickness_mm))
        if flip:
            inp.setOneSideExtent(
                adsk.fusion.DistanceExtentDefinition.create(dist),
                adsk.fusion.ExtentDirections.NegativeExtentDirection,
            )
        else:
            inp.setDistanceExtent(False, dist)

        if participant_bodies and operation != adsk.fusion.FeatureOperations.NewBodyFeatureOperation:
            inp.participantBodies = [b for b in participant_bodies]

        feat = ext_feats.add(inp)

        if name and feat:
            feat.name = name

        result['success'] = _is_healthy(feat)
        result['feature'] = feat
        if feat and not result['success']:
            result['error'] = 'Feature failed to compute'
    except Exception as e:
        result['error'] = str(e)

    return result


def extrude_by_area(comp, sketch, target_area_mm2, thickness_mm, operation,
                    participant_bodies=None, name=None, tol=0.05):
    """Find and extrude the profile closest to target_area.

    Args:
        target_area_mm2: Target area in mm² (will be converted to cm²)
        tol: Relative tolerance for area matching (0.05 = 5%)

    Returns:
        dict with success, name, feature, error fields
    """
    result = {'success': False, 'name': name or 'Extrude_by_area'}
    target_cm2 = target_area_mm2 / 100.0  # mm² → cm²

    try:
        best_idx = -1
        best_diff = float('inf')

        for i in range(sketch.profiles.count):
            prof = sketch.profiles.item(i)
            try:
                area = prof.areaProperties().area
                diff = abs(area - target_cm2)
                if diff < best_diff:
                    best_diff = diff
                    best_idx = i
            except:
                continue

        if best_idx < 0:
            result['error'] = 'No profiles found in sketch'
            return result

        rel_diff = best_diff / target_cm2 if target_cm2 > 0 else float('inf')
        if rel_diff > tol:
            result['error'] = f'Best profile area diff {rel_diff:.1%} exceeds tolerance {tol:.0%}'
            return result

        return extrude_profile(comp, sketch, thickness_mm, operation,
                               best_idx, participant_bodies, name)
    except Exception as e:
        result['error'] = str(e)
        return result


def extrude_all_small_profiles(comp, sketch, max_area_mm2, thickness_mm,
                               operation, participant_bodies=None,
                               direction='positive'):
    """Cut/extrude all profiles below a certain area.

    Useful for bore holes, vent slots, etc.
    direction: 'positive' (default, +Z from XY plane) or 'negative'
    Returns list of result dicts.
    """
    max_area_cm2 = max_area_mm2 / 100.0
    results = []

    for i in range(sketch.profiles.count):
        prof = sketch.profiles.item(i)
        try:
            area = prof.areaProperties().area
            if area >= max_area_cm2:
                continue
        except:
            continue

        r = {'success': False, 'name': f'SmallProfile_{i}'}
        try:
            ext_feats = comp.features.extrudeFeatures
            inp = ext_feats.createInput(prof, operation)

            if direction == 'negative':
                inp.setAllExtent(adsk.fusion.ExtentDirections.NegativeExtentDirection)
            else:
                inp.setAllExtent(adsk.fusion.ExtentDirections.PositiveExtentDirection)

            if participant_bodies and operation != adsk.fusion.FeatureOperations.NewBodyFeatureOperation:
                inp.participantBodies = [b for b in participant_bodies]

            feat = ext_feats.add(inp)
            r['success'] = _is_healthy(feat)
            r['feature'] = feat
            if feat and not r['success']:
                r['error'] = 'Feature failed to compute'
        except Exception as e:
            r['error'] = str(e)

        results.append(r)

    return results


def combine_bodies(comp, target_body, tool_bodies, operation=None):
    """Combine multiple bodies into one using Fusion's Combine feature.

    Args:
        comp: Component
        target_body: The body to keep (others merge into this)
        tool_bodies: List of bodies to merge into target
        operation: FeatureOperations enum (default: JoinFeatureOperation)

    Returns:
        dict with success, name, feature, error fields
    """
    if operation is None:
        operation = adsk.fusion.FeatureOperations.JoinFeatureOperation

    result = {'name': 'Combine Bodies', 'type': 'combine', 'success': False}
    try:
        if not tool_bodies:
            result['error'] = 'No tool bodies provided'
            return result

        tools = adsk.core.ObjectCollection.create()
        for b in tool_bodies:
            if b and b.isValid:
                tools.add(b)

        if tools.count == 0:
            result['error'] = 'No valid tool bodies'
            return result

        combine_feats = comp.features.combineFeatures
        inp = combine_feats.createInput(target_body, tools)
        inp.operation = operation
        inp.isKeepToolBodies = False
        feat = combine_feats.add(inp)

        result['success'] = _is_healthy(feat)
        result['feature'] = feat
        result['detail'] = f'Combined {tools.count} bodies into {target_body.name}'
        if not result['success']:
            result['error'] = 'Combine feature failed to compute'
    except Exception as e:
        result['error'] = str(e)

    return result


def move_body(comp, body, dx_mm, dy_mm, dz_mm):
    """Translate a body by (dx, dy, dz) in mm.

    Returns dict with success and error fields.
    """
    result = {'success': False, 'name': f'Move_{body.name}'}
    try:
        mf = comp.features.moveFeatures
        col = adsk.core.ObjectCollection.create()
        col.add(body)
        t = adsk.core.Matrix3D.create()
        t.translation = adsk.core.Vector3D.create(mm(dx_mm), mm(dy_mm), mm(dz_mm))
        feat = mf.add(mf.createInput(col, t))
        result['success'] = True
        result['feature'] = feat
    except Exception as e:
        result['error'] = str(e)
    return result


def create_cylinder(sketch, cx_mm, cy_mm, r_mm):
    """Draw a circle in a sketch (for bosses and alignment pins)."""
    circles = sketch.sketchCurves.sketchCircles
    center = adsk.core.Point3D.create(mm(cx_mm), mm(cy_mm), 0)
    circles.addByCenterRadius(center, mm(r_mm))
    return sketch


def create_triangle_sketch(sketch, x1, y1, x2, y2, x3, y3):
    """Draw a closed triangle in a sketch (coords in mm).

    Used for wedge stoppers and stabilizer triangles.
    Each triangle should use its own sketch to avoid profile ambiguity.
    """
    sl = sketch.sketchCurves.sketchLines
    p0 = adsk.core.Point3D.create(mm(x1), mm(y1), 0)
    p1 = adsk.core.Point3D.create(mm(x2), mm(y2), 0)
    p2 = adsk.core.Point3D.create(mm(x3), mm(y3), 0)
    sl.addByTwoPoints(p0, p1)
    sl.addByTwoPoints(p1, p2)
    sl.addByTwoPoints(p2, p0)
    return sketch


def extrude_blind(comp, sketch, depth_mm, operation, profile_idx=0,
                  participant_bodies=None, name=None, direction='positive'):
    """Extrude a profile to a specific depth (blind hole or boss).

    Args:
        direction: 'positive' (+Z) or 'negative' (-Z)
    """
    result = {'success': False, 'name': name or f'BlindExtrude_{profile_idx}'}
    try:
        if sketch.profiles.count <= profile_idx:
            result['error'] = f'Profile index {profile_idx} not found'
            return result

        prof = sketch.profiles.item(profile_idx)
        ext_feats = comp.features.extrudeFeatures
        inp = ext_feats.createInput(prof, operation)

        if direction == 'negative':
            inp.setDistanceExtent(
                False,
                adsk.core.ValueInput.createByReal(mm(depth_mm))
            )
            inp.setDirectionFlip(True)
        else:
            inp.setDistanceExtent(
                False,
                adsk.core.ValueInput.createByReal(mm(depth_mm))
            )

        if participant_bodies and operation != adsk.fusion.FeatureOperations.NewBodyFeatureOperation:
            inp.participantBodies = [b for b in participant_bodies]

        feat = ext_feats.add(inp)

        if name and feat:
            feat.name = name

        result['success'] = _is_healthy(feat)
        result['feature'] = feat
        if feat and not result['success']:
            result['error'] = 'Feature failed to compute'
    except Exception as e:
        result['error'] = str(e)
    return result


def find_body_by_name(comp, name):
    """Find a body by name in the component. Returns body or None."""
    for i in range(comp.bRepBodies.count):
        body = comp.bRepBodies.item(i)
        if body.name == name:
            return body
    return None


def find_small_profiles(sketch, max_area_mm2):
    """Return indices of all profiles below max_area in mm²."""
    max_area_cm2 = max_area_mm2 / 100.0
    indices = []
    for i in range(sketch.profiles.count):
        try:
            area = sketch.profiles.item(i).areaProperties().area
            if area < max_area_cm2:
                indices.append(i)
        except:
            continue
    return indices


def apply_fillets(comp, body, radius_mm, face_z_mm=None):
    """Apply fillets to edges of a body.

    Args:
        comp: Component
        body: BRepBody to fillet
        radius_mm: Fillet radius in mm
        face_z_mm: If set, only fillet edges lying on this Z plane (front face).
                   If None, fillet all edges.

    Returns:
        dict with success, name, detail, error fields
    """
    result = {'name': f'Fillets ({body.name})', 'type': 'fillet', 'success': False}
    try:
        target_z = mm(face_z_mm) if face_z_mm is not None else None
        radius_cm = mm(radius_mm)

        edges = adsk.core.ObjectCollection.create()
        skipped = 0

        for i in range(body.edges.count):
            edge = body.edges.item(i)
            if target_z is not None:
                bbox = edge.boundingBox
                # Edge lies on the target Z plane if both extents match
                if (abs(bbox.minPoint.z - target_z) < 0.005 and
                        abs(bbox.maxPoint.z - target_z) < 0.005):
                    # Skip very short edges that might fail to fillet
                    if edge.length > radius_cm * 1.5:
                        edges.add(edge)
                    else:
                        skipped += 1
            else:
                if edge.length > radius_cm * 1.5:
                    edges.add(edge)
                else:
                    skipped += 1

        if edges.count == 0:
            result['error'] = f'No suitable edges found (skipped {skipped} too-short edges)'
            return result

        fillets = comp.features.filletFeatures
        inp = fillets.createInput()
        inp.addConstantRadiusEdgeSet(
            edges,
            adsk.core.ValueInput.createByReal(radius_cm),
            True  # isTangentChain
        )
        feat = fillets.add(inp)

        result['success'] = _is_healthy(feat)
        result['feature'] = feat
        result['detail'] = f'{edges.count} edges filleted at r={radius_mm}mm (skipped {skipped})'
        if not result['success']:
            result['error'] = 'Fillet feature failed to compute'
    except Exception as e:
        result['error'] = str(e)

    return result


def find_edges_at_position(body, z_mm, y_mm, min_length_mm, tol_mm=0.5):
    """Find BRepEdges at a specific (Z, Y) position with minimum length.

    Used for selecting bend-line edges on sheet metal bodies where flanges
    meet the plate. Edges are matched by bounding-box midpoint.

    Args:
        body: BRepBody to search
        z_mm: Target Z position in mm (converted to cm internally)
        y_mm: Target Y position in mm
        min_length_mm: Minimum edge length in mm
        tol_mm: Position tolerance in mm (default 0.5)

    Returns:
        ObjectCollection of matching edges (may be empty)
    """
    target_z = mm(z_mm)
    target_y = mm(y_mm)
    tol = mm(tol_mm)
    min_len = mm(min_length_mm)

    edges = adsk.core.ObjectCollection.create()
    for i in range(body.edges.count):
        edge = body.edges.item(i)
        if edge.length < min_len:
            continue
        bbox = edge.boundingBox
        mid_z = (bbox.minPoint.z + bbox.maxPoint.z) / 2
        mid_y = (bbox.minPoint.y + bbox.maxPoint.y) / 2
        if abs(mid_z - target_z) < tol and abs(mid_y - target_y) < tol:
            edges.add(edge)
    return edges


def apply_chamfers(comp, body, distance_mm, face_z_mm=None):
    """Apply chamfers to edges of a body.

    Args:
        comp: Component
        body: BRepBody to chamfer
        distance_mm: Chamfer distance in mm
        face_z_mm: If set, only chamfer edges lying on this Z plane.
                   If None, chamfer all edges.

    Returns:
        dict with success, name, detail, error fields
    """
    result = {'name': f'Chamfers ({body.name})', 'type': 'chamfer', 'success': False}
    try:
        target_z = mm(face_z_mm) if face_z_mm is not None else None
        dist_cm = mm(distance_mm)

        edges = adsk.core.ObjectCollection.create()
        skipped = 0

        for i in range(body.edges.count):
            edge = body.edges.item(i)
            if target_z is not None:
                bbox = edge.boundingBox
                if (abs(bbox.minPoint.z - target_z) < 0.005 and
                        abs(bbox.maxPoint.z - target_z) < 0.005):
                    if edge.length > dist_cm * 2:
                        edges.add(edge)
                    else:
                        skipped += 1
            else:
                if edge.length > dist_cm * 2:
                    edges.add(edge)
                else:
                    skipped += 1

        if edges.count == 0:
            result['error'] = f'No suitable edges found (skipped {skipped} too-short edges)'
            return result

        chamfers = comp.features.chamferFeatures
        inp = chamfers.createInput2()
        inp.chamferEdgeSets.addEqualDistanceChamferEdgeSet(
            edges,
            adsk.core.ValueInput.createByReal(dist_cm),
            True  # isTangentChain
        )
        feat = chamfers.add(inp)

        result['success'] = _is_healthy(feat)
        result['feature'] = feat
        result['detail'] = f'{edges.count} edges chamfered at {distance_mm}mm (skipped {skipped})'
        if not result['success']:
            result['error'] = 'Chamfer feature failed to compute'
    except Exception as e:
        result['error'] = str(e)

    return result


def hex_frame_for_size(w_mm, h_mm):
    """Return the appropriate hex frame width based on tray dimensions."""
    if min(w_mm, h_mm) >= HEX_FRAME_THRESHOLD:
        return HEX_FRAME_LARGE
    return HEX_FRAME


def create_hex_pattern_sketch(sketch, cx_mm, cy_mm, w_mm, h_mm,
                               spacing_mm=None, strut_mm=None, frame_mm=None):
    """Draw a grid of flat-top regular hexagons within a rectangular region.

    Hexagons are oriented flat-top (flat edges on top/bottom).
    The pattern fills the region (cx ± w/2, cy ± h/2) minus the frame border.

    Args:
        sketch: Fusion sketch to draw into
        cx_mm, cy_mm: Center of the region in mm
        w_mm, h_mm: Region width and height in mm
        spacing_mm: Hex cell center-to-center spacing (default HEX_SPACING)
        strut_mm: Wall thickness between hexagons (default HEX_STRUT)
        frame_mm: Solid border width (default: adaptive based on dimensions)

    Returns:
        int: Number of hexagons drawn
    """
    if spacing_mm is None:
        spacing_mm = HEX_SPACING
    if strut_mm is None:
        strut_mm = HEX_STRUT
    if frame_mm is None:
        frame_mm = hex_frame_for_size(w_mm, h_mm)

    # Circumradius of each hexagon: from cell spacing minus strut
    # For flat-top hex: spacing = 2 * r * cos(30°) + strut
    # So r = (spacing - strut) / (2 * cos(30°))
    cos30 = math.cos(math.radians(30))
    r = (spacing_mm - strut_mm) / (2 * cos30)
    if r <= 0.5:
        return 0  # Too small to draw

    # Inner region after removing frame
    inner_w = w_mm - 2 * frame_mm
    inner_h = h_mm - 2 * frame_mm
    if inner_w <= spacing_mm or inner_h <= spacing_mm:
        return 0  # No room for hexagons

    # Row spacing: vertical distance between hex centers (flat-top orientation)
    row_spacing = spacing_mm * math.sin(math.radians(60))  # spacing * √3/2

    # Bounds for hex centers
    x_min = cx_mm - inner_w / 2 + spacing_mm / 2
    x_max = cx_mm + inner_w / 2 - spacing_mm / 2
    y_min = cy_mm - inner_h / 2 + spacing_mm / 2
    y_max = cy_mm + inner_h / 2 - spacing_mm / 2

    sl = sketch.sketchCurves.sketchLines
    count = 0
    row = 0
    y = y_min

    while y <= y_max:
        x_offset = (spacing_mm / 2) if (row % 2 == 1) else 0
        x = x_min + x_offset

        while x <= x_max:
            # Draw a flat-top hexagon: vertices at 0°, 60°, 120°, 180°, 240°, 300°
            pts = []
            for k in range(6):
                angle = math.radians(k * 60)
                px = x + r * math.cos(angle)
                py = y + r * math.sin(angle)
                pts.append(adsk.core.Point3D.create(mm(px), mm(py), 0))

            # Close the hexagon with 6 line segments
            for k in range(6):
                sl.addByTwoPoints(pts[k], pts[(k + 1) % 6])
            count += 1

            x += spacing_mm

        y += row_spacing
        row += 1

    return count
