"""
RackPro Bridge — Query Commands

Inspect the current Fusion 360 model: physical properties, feature status,
and body interference detection.
"""

import adsk.core
import adsk.fusion
import traceback

from ..lib.constants import cm_to_mm


def query_properties(comp):
    """Get physical properties for all bodies in the component.

    Returns list of body info dicts with mass, volume, bbox, CoG.
    """
    bodies = []
    for i in range(comp.bRepBodies.count):
        body = comp.bRepBodies.item(i)
        info = {
            'name': body.name,
            'visible': body.isVisible,
        }
        try:
            props = body.physicalProperties
            info['volume_cm3'] = round(props.volume, 4)
            info['mass_g'] = round(props.mass * 1000, 2)  # kg → g
            cog = props.centerOfMass
            info['cog'] = [
                round(cm_to_mm(cog.x), 3),
                round(cm_to_mm(cog.y), 3),
                round(cm_to_mm(cog.z), 3),
            ]
        except:
            info['volume_cm3'] = None
            info['mass_g'] = None

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
            info['bbox'] = None

        bodies.append(info)

    return {'success': True, 'bodies': bodies, 'count': len(bodies)}


def query_features(design):
    """Walk the timeline and return feature status.

    Returns list of feature info dicts with name, type, computed status.
    """
    features = []
    timeline = design.timeline
    for i in range(timeline.count):
        item = timeline.item(i)
        info = {
            'index': i,
            'name': '',
            'type': '',
            'computed': False,
            'suppressed': False,
            'rolled_back': False,
        }

        try:
            entity = item.entity
            info['name'] = entity.name if hasattr(entity, 'name') else f'Feature_{i}'

            # Get feature type from class name
            type_name = type(entity).__name__
            # Strip 'Feature' suffix for readability
            if type_name.endswith('Feature'):
                type_name = type_name[:-7]
            info['type'] = type_name

            try:
                info['computed'] = entity.healthState == adsk.fusion.FeatureHealthStates.HealthyFeatureHealthState
            except:
                info['computed'] = True
            info['suppressed'] = entity.isSuppressed if hasattr(entity, 'isSuppressed') else False
        except:
            info['name'] = f'Feature_{i}'
            info['type'] = 'Unknown'

        info['rolled_back'] = item.isRolledBack if hasattr(item, 'isRolledBack') else False

        features.append(info)

    return {'success': True, 'features': features, 'count': len(features)}


def query_interference(comp):
    """Check body-to-body interference in the component.

    Returns list of interfering body pairs.
    """
    bodies = comp.bRepBodies
    if bodies.count < 2:
        return {'success': True, 'interferences': [], 'count': 0}

    interferences = []
    try:
        input_bodies = adsk.core.ObjectCollection.create()
        for i in range(bodies.count):
            input_bodies.add(bodies.item(i))

        interference_input = comp.interferenceInput(input_bodies)
        results = comp.analyzeInterference(interference_input)

        for i in range(results.count):
            result = results.item(i)
            interferences.append({
                'body1': result.entityOne.name if hasattr(result.entityOne, 'name') else 'Unknown',
                'body2': result.entityTwo.name if hasattr(result.entityTwo, 'name') else 'Unknown',
                'volume_cm3': round(result.interferenceBody.volume, 6) if result.interferenceBody else 0,
            })
            # Clean up interference bodies
            if result.interferenceBody:
                result.interferenceBody.deleteMe()
    except Exception as e:
        return {'success': False, 'error': str(e), 'interferences': interferences}

    return {'success': True, 'interferences': interferences, 'count': len(interferences)}
