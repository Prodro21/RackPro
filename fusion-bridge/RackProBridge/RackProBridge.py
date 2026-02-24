"""
RackPro Bridge — Fusion 360 Add-In

HTTP server (localhost:9100) that accepts JSON commands from the RackPro MCP
server and executes them on the Fusion 360 main thread via CustomEvent.

Architecture:
    HTTP request (background thread)
      → store in _pending dict with UUID
      → fire CustomEvent
      → wait on threading.Event (60s timeout)

    CustomEvent handler (main thread)
      → dispatch to command module
      → store result
      → signal threading.Event

    HTTP response ← result from _pending dict
"""

import adsk.core
import adsk.fusion
import json
import threading
import traceback
import uuid
from http.server import HTTPServer, BaseHTTPRequestHandler

# These are imported lazily in the event handler to avoid import
# errors during add-in load (Fusion's Python path setup).
_commands_loaded = False
_build_model = None
_query_properties = None
_query_features = None
_query_interference = None
_export_stl = None
_export_step = None
_export_dxf = None
_take_screenshot = None

HOST = 'localhost'
PORT = 9100
TIMEOUT = 60  # seconds

# ─── Thread-Safe Shared State ─────────────────────────────────

_pending = {}           # id -> { endpoint, body, event, result }
_lock = threading.Lock()
_server = None          # HTTPServer instance
_server_thread = None
_custom_event = None    # Fusion CustomEvent
_handler = None         # CustomEventHandler instance
_app = None
_ui = None


# ─── HTTP Request Handler ────────────────────────────────────

class RackProHandler(BaseHTTPRequestHandler):
    """Handles POST requests and dispatches to the Fusion main thread."""

    def log_message(self, format, *args):
        """Route HTTP logs to Fusion's text palette."""
        pass  # Suppress default stderr logging

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_POST(self):
        """Handle POST requests to /ping, /build, /query, /export, /screenshot."""
        path = self.path.rstrip('/')
        valid_endpoints = {'/ping', '/build', '/query', '/export', '/screenshot', '/reload'}

        if path not in valid_endpoints:
            self._send_json(404, {'error': f'Unknown endpoint: {path}'})
            return

        # Read body
        content_len = int(self.headers.get('Content-Length', 0))
        body = {}
        if content_len > 0:
            raw = self.rfile.read(content_len)
            try:
                body = json.loads(raw)
            except json.JSONDecodeError as e:
                self._send_json(400, {'error': f'Invalid JSON: {e}'})
                return

        # /ping is handled directly (no Fusion API needed)
        if path == '/ping':
            self._send_json(200, _handle_ping())
            return

        # /reload is handled directly (re-imports Python modules)
        if path == '/reload':
            try:
                _reload_commands()
                self._send_json(200, {'success': True, 'message': 'Command modules reloaded'})
            except Exception as e:
                self._send_json(500, {'success': False, 'error': str(e)})
            return

        # All other endpoints need the main thread
        request_id = str(uuid.uuid4())
        event = threading.Event()

        with _lock:
            _pending[request_id] = {
                'endpoint': path,
                'body': body,
                'event': event,
                'result': None,
            }

        # Fire custom event to wake main thread
        try:
            _app.fireCustomEvent('RackProBridgeEvent', request_id)
        except Exception as e:
            self._send_json(500, {'error': f'Failed to fire event: {e}'})
            with _lock:
                _pending.pop(request_id, None)
            return

        # Determine timeout based on endpoint
        timeout = 120 if path == '/build' else TIMEOUT

        # Wait for main thread to process
        if not event.wait(timeout):
            with _lock:
                _pending.pop(request_id, None)
            self._send_json(504, {'error': f'Timeout waiting for Fusion ({timeout}s)'})
            return

        # Get result
        with _lock:
            entry = _pending.pop(request_id, None)

        if entry and entry['result'] is not None:
            self._send_json(200, entry['result'])
        else:
            self._send_json(500, {'error': 'No result from Fusion'})

    def do_GET(self):
        """Health check on GET /."""
        if self.path.rstrip('/') in ('', '/ping'):
            self._send_json(200, _handle_ping())
        else:
            self._send_json(404, {'error': 'Use POST'})

    def _send_json(self, status, data):
        """Send a JSON response with CORS headers."""
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)


# ─── Ping Handler (no Fusion API needed) ─────────────────────

def _handle_ping():
    """Return basic status info."""
    info = {'ok': True}
    try:
        if _app:
            info['fusion_version'] = _app.version
            product = _app.activeProduct
            if product:
                info['document'] = _app.activeDocument.name if _app.activeDocument else None
    except:
        pass
    return info


# ─── Lazy Command Imports ─────────────────────────────────────

def _ensure_commands_loaded():
    """Import command modules on first use (after Fusion's path is set up)."""
    global _commands_loaded
    global _build_model, _query_properties, _query_features, _query_interference
    global _export_stl, _export_step, _export_dxf, _take_screenshot

    if _commands_loaded:
        return

    from .commands.build_model import build_model
    from .commands.query_model import query_properties, query_features, query_interference
    from .commands.export_model import export_stl, export_step, export_dxf, take_screenshot

    _build_model = build_model
    _query_properties = query_properties
    _query_features = query_features
    _query_interference = query_interference
    _export_stl = export_stl
    _export_step = export_step
    _export_dxf = export_dxf
    _take_screenshot = take_screenshot
    _commands_loaded = True


def _reload_commands():
    """Force re-import of command modules to pick up code changes."""
    import importlib
    global _commands_loaded
    global _build_model, _query_properties, _query_features, _query_interference
    global _export_stl, _export_step, _export_dxf, _take_screenshot

    from .lib import constants as _const_mod
    from .lib import geometry as _geom_mod
    from .commands import build_model as _bm_mod
    from .commands import query_model as _qm_mod
    from .commands import export_model as _em_mod

    importlib.reload(_const_mod)
    importlib.reload(_geom_mod)
    importlib.reload(_bm_mod)
    importlib.reload(_qm_mod)
    importlib.reload(_em_mod)

    _build_model = _bm_mod.build_model
    _query_properties = _qm_mod.query_properties
    _query_features = _qm_mod.query_features
    _query_interference = _qm_mod.query_interference
    _export_stl = _em_mod.export_stl
    _export_step = _em_mod.export_step
    _export_dxf = _em_mod.export_dxf
    _take_screenshot = _em_mod.take_screenshot
    _commands_loaded = True


# ─── Custom Event Handler (Main Thread) ──────────────────────

class BridgeEventHandler(adsk.core.CustomEventHandler):
    def __init__(self):
        super().__init__()

    def notify(self, args):
        """Called on the main thread when the HTTP handler fires the event."""
        try:
            request_id = args.additionalInfo
            with _lock:
                entry = _pending.get(request_id)

            if not entry:
                return

            _ensure_commands_loaded()

            endpoint = entry['endpoint']
            body = entry['body']
            result = {'error': f'Unhandled endpoint: {endpoint}'}

            app = adsk.core.Application.get()
            design = adsk.fusion.Design.cast(app.activeProduct)

            if endpoint == '/build':
                if not design:
                    result = {'success': False, 'error': 'No active Fusion design. Create or open a document first.'}
                else:
                    new_doc = body.get('newDocument', False)
                    if new_doc:
                        doc = app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
                        design = adsk.fusion.Design.cast(app.activeProduct)
                    result = _build_model(body.get('config', body))

            elif endpoint == '/query':
                if not design:
                    result = {'success': False, 'error': 'No active Fusion design'}
                else:
                    what = body.get('what', 'properties')
                    comp = design.rootComponent
                    if what == 'properties':
                        result = _query_properties(comp)
                    elif what == 'features':
                        result = _query_features(design)
                    elif what == 'interference':
                        result = _query_interference(comp)
                    else:
                        result = {'success': False, 'error': f'Unknown query type: {what}'}

            elif endpoint == '/export':
                if not design:
                    result = {'success': False, 'error': 'No active Fusion design'}
                else:
                    fmt = body.get('format', 'stl')
                    path = body.get('path', '')
                    comp = design.rootComponent
                    if fmt == 'stl':
                        result = _export_stl(design, comp, path, body.get('bodyName'))
                    elif fmt == 'step':
                        result = _export_step(design, comp, path)
                    elif fmt == 'dxf':
                        result = _export_dxf(design, comp, path)
                    else:
                        result = {'success': False, 'error': f'Unknown format: {fmt}'}

            elif endpoint == '/screenshot':
                path = body.get('path', '')
                width = body.get('width', 1920)
                height = body.get('height', 1080)
                result = _take_screenshot(app, path, width, height)

            elif endpoint == '/reload':
                _reload_commands()
                result = {'success': True, 'message': 'Command modules reloaded'}

            # Store result and signal the waiting HTTP thread
            with _lock:
                if request_id in _pending:
                    _pending[request_id]['result'] = result
                    _pending[request_id]['event'].set()

        except Exception:
            # Make sure we always signal even on error
            try:
                with _lock:
                    if request_id in _pending:
                        _pending[request_id]['result'] = {
                            'success': False,
                            'error': traceback.format_exc(),
                        }
                        _pending[request_id]['event'].set()
            except:
                pass


# ─── Add-In Lifecycle ─────────────────────────────────────────

def run(context):
    """Called when the add-in is started."""
    global _app, _ui, _custom_event, _handler, _server, _server_thread

    try:
        _app = adsk.core.Application.get()
        _ui = _app.userInterface

        # Register custom event
        _handler = BridgeEventHandler()
        _custom_event = _app.registerCustomEvent('RackProBridgeEvent')
        _custom_event.add(_handler)

        # Start HTTP server on daemon thread
        _server = HTTPServer((HOST, PORT), RackProHandler)
        _server_thread = threading.Thread(target=_server.serve_forever, daemon=True)
        _server_thread.start()

        _ui.messageBox(f'RackProBridge running on {HOST}:{PORT}')

    except Exception:
        if _ui:
            _ui.messageBox(f'RackProBridge failed to start:\n{traceback.format_exc()}')


def stop(context):
    """Called when the add-in is stopped."""
    global _server, _server_thread, _custom_event, _handler

    try:
        # Shutdown HTTP server
        if _server:
            _server.shutdown()
            _server = None

        if _server_thread:
            _server_thread.join(timeout=5)
            _server_thread = None

        # Unregister custom event
        if _custom_event:
            if _handler:
                _custom_event.remove(_handler)
            _app.unregisterCustomEvent('RackProBridgeEvent')
            _custom_event = None
            _handler = None

    except:
        pass
