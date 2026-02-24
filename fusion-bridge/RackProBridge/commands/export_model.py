"""
RackPro Bridge — Export Commands

Export the current Fusion 360 model to STL, STEP, DXF, or capture screenshots.
"""

import adsk.core
import adsk.fusion
import os
import traceback


def export_stl(design, comp, path, body_name=None):
    """Export model or specific body to STL.

    Args:
        design: Fusion Design object
        comp: Root component
        path: Output file path (must end in .stl)
        body_name: Optional body name to export (None = all)

    Returns:
        dict with success, path, size_bytes, error
    """
    result = {'success': False, 'path': path}
    try:
        path = os.path.expanduser(path)
        export_mgr = design.exportManager

        stl_opts = export_mgr.createSTLExportOptions(comp, path)
        stl_opts.meshRefinement = adsk.fusion.MeshRefinementSettings.MeshRefinementMedium

        if body_name:
            body = None
            for i in range(comp.bRepBodies.count):
                b = comp.bRepBodies.item(i)
                if b.name == body_name:
                    body = b
                    break
            if not body:
                result['error'] = f'Body "{body_name}" not found'
                return result
            stl_opts = export_mgr.createSTLExportOptions(body, path)
            stl_opts.meshRefinement = adsk.fusion.MeshRefinementSettings.MeshRefinementMedium

        export_mgr.execute(stl_opts)

        if os.path.exists(path):
            result['success'] = True
            result['size_bytes'] = os.path.getsize(path)
        else:
            result['error'] = 'Export completed but file not found'
    except Exception as e:
        result['error'] = str(e)

    return result


def export_step(design, comp, path):
    """Export model to STEP format.

    Args:
        design: Fusion Design object
        comp: Root component
        path: Output file path (must end in .step or .stp)

    Returns:
        dict with success, path, size_bytes, error
    """
    result = {'success': False, 'path': path}
    try:
        path = os.path.expanduser(path)
        export_mgr = design.exportManager
        step_opts = export_mgr.createSTEPExportOptions(path, comp)
        export_mgr.execute(step_opts)

        if os.path.exists(path):
            result['success'] = True
            result['size_bytes'] = os.path.getsize(path)
        else:
            result['error'] = 'Export completed but file not found'
    except Exception as e:
        result['error'] = str(e)

    return result


def export_dxf(design, comp, path):
    """Export flat pattern DXF (sheet metal bodies only).

    Args:
        design: Fusion Design object
        comp: Root component
        path: Output file path (must end in .dxf)

    Returns:
        dict with success, path, size_bytes, error
    """
    result = {'success': False, 'path': path}
    try:
        path = os.path.expanduser(path)

        # Find sheet metal body
        sm_body = None
        for i in range(comp.bRepBodies.count):
            body = comp.bRepBodies.item(i)
            if hasattr(body, 'isSheetMetal') and body.isSheetMetal:
                sm_body = body
                break

        if not sm_body:
            result['error'] = 'No sheet metal body found. Convert a body to sheet metal first.'
            return result

        export_mgr = design.exportManager
        dxf_opts = export_mgr.createDXFFlatPatternExportOptions(path, sm_body)
        export_mgr.execute(dxf_opts)

        if os.path.exists(path):
            result['success'] = True
            result['size_bytes'] = os.path.getsize(path)
        else:
            result['error'] = 'Export completed but file not found'
    except Exception as e:
        result['error'] = str(e)

    return result


def take_screenshot(app, path, width=1920, height=1080):
    """Capture the active viewport to an image file.

    Args:
        app: Fusion Application object
        path: Output file path (.png or .jpg)
        width: Image width in pixels
        height: Image height in pixels

    Returns:
        dict with success, path, size_bytes, error
    """
    result = {'success': False, 'path': path}
    try:
        path = os.path.expanduser(path)
        viewport = app.activeViewport
        ok = viewport.saveAsImageFile(path, width, height)

        if ok and os.path.exists(path):
            result['success'] = True
            result['size_bytes'] = os.path.getsize(path)
        else:
            result['error'] = 'Screenshot capture failed'
    except Exception as e:
        result['error'] = str(e)

    return result
