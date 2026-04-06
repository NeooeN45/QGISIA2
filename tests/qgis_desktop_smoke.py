import importlib.util
import json
import os
import sys
import threading
import traceback
import urllib.request
from pathlib import Path

from qgis.PyQt.QtCore import QEventLoop, QTimer
from qgis.PyQt.QtWidgets import QApplication, QMessageBox, QPushButton, QTextBrowser
from qgis.core import (
    QgsFeature,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsVectorLayer,
)
from qgis.utils import iface


LOG_PATH = os.environ["GEOAI_TEST_LOG"]
PLUGIN_PARENT = os.environ["GEOAI_TEST_PLUGIN_PARENT"]


RESULTS = {
    "success": True,
    "steps": [],
}
PLUGIN_INSTANCE = None


def persist():
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "w", encoding="utf-8") as handle:
        json.dump(RESULTS, handle, ensure_ascii=False, indent=2)


def record(step, ok, detail="", data=None):
    RESULTS["steps"].append(
        {
            "step": step,
            "ok": bool(ok),
            "detail": detail,
            "data": data,
        }
    )
    if not ok:
        RESULTS["success"] = False
    persist()


def finish():
    global PLUGIN_INSTANCE
    try:
        if PLUGIN_INSTANCE is not None:
            PLUGIN_INSTANCE.unload()
    except Exception:
        record("plugin.unload", False, traceback.format_exc())
    persist()
    QTimer.singleShot(0, QApplication.instance().quit)


def fail(step, error):
    record(step, False, str(error), traceback.format_exc())
    finish()


def wait(ms):
    loop = QEventLoop()
    QTimer.singleShot(ms, loop.quit)
    loop.exec()


def run_in_worker(callback, timeout_ms=15000):
    result = {}
    state = {"done": False}

    def target():
        try:
            result["value"] = callback()
        except Exception as exc:
            result["error"] = exc
            result["traceback"] = traceback.format_exc()
        finally:
            state["done"] = True

    worker = threading.Thread(target=target, daemon=True)
    worker.start()

    elapsed = 0
    while not state["done"] and elapsed < timeout_ms:
        wait(50)
        elapsed += 50

    if not state["done"]:
        raise TimeoutError("timed out")

    if "error" in result:
        raise RuntimeError(result["traceback"])

    return result.get("value")


def request_json(url, method="GET", payload=None):
    def callback():
        data = None
        headers = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))

    return run_in_worker(callback)


def request_text(url):
    def callback():
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.read().decode("utf-8")

    return run_in_worker(callback)


def run_js(page, script, timeout_ms=10000):
    loop = QEventLoop()
    result = {"done": False, "value": None}

    def callback(value):
        result["done"] = True
        result["value"] = value
        loop.quit()

    page.runJavaScript(script, callback)
    QTimer.singleShot(timeout_ms, loop.quit)
    loop.exec()
    return result["value"]


def wait_for_load(view, timeout_ms=30000):
    if not view.page().isLoading():
        return True

    loop = QEventLoop()
    state = {"ok": False, "seen": False}

    def on_load(ok):
        state["ok"] = ok
        state["seen"] = True
        loop.quit()

    view.loadFinished.connect(on_load)
    QTimer.singleShot(timeout_ms, loop.quit)
    loop.exec()
    try:
        view.loadFinished.disconnect(on_load)
    except Exception:
        pass

    return state["seen"] and state["ok"]


def build_memory_layer():
    layer = QgsVectorLayer(
        "Point?crs=EPSG:3857&field=value:double&field=name:string",
        "smoke_layer",
        "memory",
    )
    provider = layer.dataProvider()

    feature_one = QgsFeature(layer.fields())
    feature_one.setAttributes([2.0, "A"])
    feature_one.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(0, 0)))

    feature_two = QgsFeature(layer.fields())
    feature_two.setAttributes([8.0, "B"])
    feature_two.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(10, 10)))

    provider.addFeatures([feature_one, feature_two])
    layer.updateExtents()
    QgsProject.instance().addMapLayer(layer)
    return layer


def test_bridge(plugin):
    layer = build_memory_layer()
    bridge = plugin.bridge

    layers = bridge.getLayersList()
    record("bridge.getLayersList", "smoke_layer" in layers, data=layers)

    catalog = json.loads(bridge.getLayersCatalog())
    layer_entry = next(
        (entry for entry in catalog if entry.get("name") == "smoke_layer"),
        {},
    )
    record(
        "bridge.getLayersCatalog",
        layer_entry.get("name") == "smoke_layer" and layer_entry.get("type") == "vector",
        data=layer_entry,
    )

    fields = bridge.getLayerFields("smoke_layer")
    record("bridge.getLayerFields", fields == ["value", "name"], data=fields)

    diagnostics = json.loads(bridge.getLayerDiagnostics("smoke_layer"))
    record(
        "bridge.getLayerDiagnostics",
        diagnostics.get("layerName") == "smoke_layer"
        and diagnostics.get("featureCount") == 2
        and "fieldDiagnostics" in diagnostics,
        data=diagnostics,
    )

    stats_raw = bridge.getLayerStatistics("smoke_layer", "value")
    stats = json.loads(stats_raw)
    record(
        "bridge.getLayerStatistics",
        abs(stats["mean"] - 5.0) < 0.001 and stats["count"] == 2,
        data=stats,
    )

    filter_message = bridge.filterLayer("smoke_layer", '"value" > 5')
    record(
        "bridge.filterLayer",
        layer.subsetString() == '"value" > 5',
        detail=filter_message,
    )

    visibility_message = bridge.setLayerVisibility("smoke_layer", False)
    layer_node = QgsProject.instance().layerTreeRoot().findLayer(layer.id())
    record(
        "bridge.setLayerVisibility",
        layer_node is not None and not layer_node.itemVisibilityChecked(),
        detail=visibility_message,
    )
    bridge.setLayerVisibility("smoke_layer", True)

    opacity_message = bridge.setLayerOpacity("smoke_layer", 0.45)
    record(
        "bridge.setLayerOpacity",
        abs(layer.opacity() - 0.45) < 0.001,
        detail=opacity_message,
    )

    zoom_message = bridge.zoomToLayer("smoke_layer")
    record(
        "bridge.zoomToLayer",
        iface.activeLayer() == layer,
        detail=zoom_message,
    )

    reprojected_layer_name = bridge.reprojectLayer("smoke_layer", "EPSG:4326")
    record(
        "bridge.reprojectLayer",
        bool(QgsProject.instance().mapLayersByName(reprojected_layer_name)),
        data=reprojected_layer_name,
    )

    original_exec = QMessageBox.exec
    QMessageBox.exec = lambda self: QMessageBox.Ok
    try:
        script_message = bridge.runScript(
            "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'script_layer', 'memory')\n"
            "QgsProject.instance().addMapLayer(layer)\n"
        )
    finally:
        QMessageBox.exec = original_exec

    record(
        "bridge.runScript",
        bool(QgsProject.instance().mapLayersByName("script_layer")),
        detail=script_message,
    )

    direct_script_message = bridge.runScriptDirect(
        "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'script_direct_layer', 'memory')\n"
        "QgsProject.instance().addMapLayer(layer)\n"
    )
    record(
        "bridge.runScriptDirect",
        bool(QgsProject.instance().mapLayersByName("script_direct_layer")),
        detail=direct_script_message,
    )

    detailed_success = json.loads(
        bridge.runScriptDetailed(
            "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'script_detailed_layer', 'memory')\n"
            "QgsProject.instance().addMapLayer(layer)\n",
            False,
        )
    )
    record(
        "bridge.runScriptDetailed.success",
        detailed_success.get("ok") is True
        and bool(QgsProject.instance().mapLayersByName("script_detailed_layer")),
        data=detailed_success,
    )

    detailed_failure = json.loads(
        bridge.runScriptDetailed(
            "raise RuntimeError('bridge detailed failure')\n",
            False,
        )
    )
    record(
        "bridge.runScriptDetailed.failure",
        detailed_failure.get("ok") is False
        and "bridge detailed failure" in (detailed_failure.get("message") or "")
        and "RuntimeError" in (detailed_failure.get("traceback") or ""),
        data=detailed_failure,
    )


def test_web_channel(plugin):
    view = plugin.view
    ok = wait_for_load(view)
    record("web.loadFinished", ok, detail=view.url().toString())
    if not ok:
        raise RuntimeError("Le front embarqué n'a pas chargé correctement.")

    page = view.page()
    wait(1500)

    boot_state = run_js(
        page,
        """
        (function() {
          return JSON.stringify({
            hasQgis: !!window.qgis,
            hasGetLayersList: !!(window.qgis && window.qgis.getLayersList),
            location: window.location.href
          });
        })();
        """,
    )
    boot = json.loads(boot_state)
    record(
        "web.window.qgis",
        boot["hasQgis"] and boot["hasGetLayersList"],
        data=boot,
    )

    run_js(
        page,
        """
        (function() {
          window.__geoaiTestResult = null;
          if (!window.qgis || !window.qgis.getLayersList) {
            window.__geoaiTestResult = JSON.stringify({ ok: false, reason: "missing bridge" });
            return;
          }
          window.qgis.getLayersList(function(result) {
            window.__geoaiTestResult = JSON.stringify({
              ok: Array.isArray(result),
              layers: result
            });
          });
        })();
        """,
    )

    payload = None
    for _ in range(40):
        payload = run_js(page, "window.__geoaiTestResult")
        if payload:
            break
        wait(250)

    if not payload:
        raise RuntimeError("Le callback JS via QWebChannel n'a jamais répondu.")

    callback_result = json.loads(payload)
    record(
        "web.qwebchannel.callback",
        callback_result["ok"] and "smoke_layer" in callback_result["layers"],
        data=callback_result,
    )


def test_http_bridge(plugin):
    base_url = plugin.external_ui_url or plugin._web_url("http")
    if not base_url:
        raise RuntimeError("Aucune URL HTTP GeoAI n'a été générée.")

    bridge_base = base_url.split("?", 1)[0].rsplit("/", 1)[0]

    health = request_json(f"{bridge_base}/api/qgis/health")
    record("http.health", health.get("ok") is True, data=health)

    probe_html = request_text(base_url)
    record(
        "http.static_page",
        "<html" in probe_html.lower() and "root" in probe_html.lower(),
        detail=base_url,
    )

    layer = build_memory_layer()

    layers = request_json(f"{bridge_base}/api/qgis/getLayersList")
    record(
        "http.getLayersList",
        layers.get("ok") is True and "smoke_layer" in (layers.get("result") or []),
        data=layers,
    )

    catalog = request_json(f"{bridge_base}/api/qgis/getLayersCatalog")
    catalog_payload = json.loads(catalog.get("result") or "[]")
    layer_entry = next(
        (entry for entry in catalog_payload if entry.get("name") == "smoke_layer"),
        {},
    )
    record(
        "http.getLayersCatalog",
        layer_entry.get("name") == "smoke_layer" and layer_entry.get("type") == "vector",
        data=layer_entry,
    )

    fields = request_json(
        f"{bridge_base}/api/qgis/getLayerFields?layerId=smoke_layer"
    )
    record(
        "http.getLayerFields",
        fields.get("result") == ["value", "name"],
        data=fields,
    )

    diagnostics = request_json(
        f"{bridge_base}/api/qgis/getLayerDiagnostics?layerId=smoke_layer"
    )
    diagnostics_payload = json.loads(diagnostics.get("result") or "{}")
    record(
        "http.getLayerDiagnostics",
        diagnostics_payload.get("layerName") == "smoke_layer"
        and diagnostics_payload.get("featureCount") == 2
        and "fieldDiagnostics" in diagnostics_payload,
        data=diagnostics_payload,
    )

    stats = request_json(
        f"{bridge_base}/api/qgis/getLayerStatistics?layerId=smoke_layer&field=value"
    )
    stats_payload = json.loads(stats.get("result") or "{}")
    record(
        "http.getLayerStatistics",
        abs(stats_payload.get("mean", 0) - 5.0) < 0.001
        and stats_payload.get("count") == 2,
        data=stats_payload,
    )

    filter_result = request_json(
        f"{bridge_base}/api/qgis/filterLayer",
        method="POST",
        payload={"layerId": "smoke_layer", "subsetString": '"value" > 5'},
    )
    record(
        "http.filterLayer",
        layer.subsetString() == '"value" > 5',
        detail=filter_result.get("result", ""),
    )

    visibility_result = request_json(
        f"{bridge_base}/api/qgis/setLayerVisibility",
        method="POST",
        payload={"layerId": "smoke_layer", "visible": False},
    )
    layer_node = QgsProject.instance().layerTreeRoot().findLayer(layer.id())
    record(
        "http.setLayerVisibility",
        layer_node is not None and not layer_node.itemVisibilityChecked(),
        data=visibility_result,
    )
    request_json(
        f"{bridge_base}/api/qgis/setLayerVisibility",
        method="POST",
        payload={"layerId": "smoke_layer", "visible": True},
    )

    opacity_result = request_json(
        f"{bridge_base}/api/qgis/setLayerOpacity",
        method="POST",
        payload={"layerId": "smoke_layer", "opacity": 0.4},
    )
    record(
        "http.setLayerOpacity",
        abs(layer.opacity() - 0.4) < 0.001,
        data=opacity_result,
    )

    zoom_result = request_json(
        f"{bridge_base}/api/qgis/zoomToLayer",
        method="POST",
        payload={"layerId": "smoke_layer"},
    )
    record(
        "http.zoomToLayer",
        iface.activeLayer() == layer,
        data=zoom_result,
    )

    reproject_result = request_json(
        f"{bridge_base}/api/qgis/reprojectLayer",
        method="POST",
        payload={"layerId": "smoke_layer", "targetCrs": "EPSG:4326"},
    )
    reprojected_layer_name = reproject_result.get("result", "")
    record(
        "http.reprojectLayer",
        bool(QgsProject.instance().mapLayersByName(reprojected_layer_name)),
        data=reproject_result,
    )

    original_exec = QMessageBox.exec
    QMessageBox.exec = lambda self: QMessageBox.Ok
    try:
        script_result = request_json(
            f"{bridge_base}/api/qgis/runScript",
            method="POST",
            payload={
                "script": (
                    "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'script_layer', 'memory')\n"
                    "QgsProject.instance().addMapLayer(layer)\n"
                )
            },
        )
    finally:
        QMessageBox.exec = original_exec

    record(
        "http.runScript",
        bool(QgsProject.instance().mapLayersByName("script_layer")),
        data=script_result,
    )

    direct_script_result = request_json(
        f"{bridge_base}/api/qgis/runScriptDirect",
        method="POST",
        payload={
            "script": (
                "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'script_direct_layer_http', 'memory')\n"
                "QgsProject.instance().addMapLayer(layer)\n"
            )
        },
    )
    record(
        "http.runScriptDirect",
        bool(QgsProject.instance().mapLayersByName("script_direct_layer_http")),
        data=direct_script_result,
    )

    detailed_script_result = request_json(
        f"{bridge_base}/api/qgis/runScriptDetailed",
        method="POST",
        payload={
            "script": (
                "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'script_detailed_layer_http', 'memory')\n"
                "QgsProject.instance().addMapLayer(layer)\n"
            ),
            "requireConfirmation": False,
        },
    )
    detailed_script_payload = json.loads(detailed_script_result.get("result") or "{}")
    record(
        "http.runScriptDetailed.success",
        detailed_script_payload.get("ok") is True
        and bool(QgsProject.instance().mapLayersByName("script_detailed_layer_http")),
        data=detailed_script_payload,
    )

    detailed_failure_result = request_json(
        f"{bridge_base}/api/qgis/runScriptDetailed",
        method="POST",
        payload={
            "script": "raise RuntimeError('http detailed failure')\n",
            "requireConfirmation": False,
        },
    )
    detailed_failure_payload = json.loads(
        detailed_failure_result.get("result") or "{}"
    )
    record(
        "http.runScriptDetailed.failure",
        detailed_failure_payload.get("ok") is False
        and "http detailed failure"
        in (detailed_failure_payload.get("message") or "")
        and "RuntimeError" in (detailed_failure_payload.get("traceback") or ""),
        data=detailed_failure_payload,
    )


def continue_after_run():
    try:
        plugin = PLUGIN_INSTANCE
        record("plugin.run.start", True)
        plugin.run()
        dock_ok = plugin.dock is not None
        record("plugin.run", dock_ok)
        if not dock_ok:
            raise RuntimeError("Le dock GeoAI n'a pas été créé.")

        if plugin.view is not None:
            view_url = plugin.view.url().toString()
            record(
                "plugin.web_url",
                view_url.startswith("http://127.0.0.1:"),
                detail=view_url,
            )
            test_bridge(plugin)
            test_web_channel(plugin)
        else:
            record("plugin.ui_mode", True, detail="external-browser")
            fallback_widget = plugin.dock.widget()
            fallback_buttons = [
                button.text() for button in fallback_widget.findChildren(QPushButton)
            ]
            fallback_browsers = fallback_widget.findChildren(QTextBrowser)
            has_open_button = any(
                ("GeoSylva" in text) or ("GeoAI" in text) for text in fallback_buttons
            )
            has_copy_button = any("Copier" in text for text in fallback_buttons)
            record(
                "plugin.fallback_ui",
                has_open_button and has_copy_button and len(fallback_browsers) >= 2,
                data={
                    "buttons": fallback_buttons,
                    "hasOpenButton": has_open_button,
                    "hasCopyButton": has_copy_button,
                    "textBrowsers": len(fallback_browsers),
                },
            )
            test_http_bridge(plugin)
    except Exception as exc:
        fail("desktop.smoke", exc)
        return

    finish()


def main():
    global PLUGIN_INSTANCE
    try:
        plugin_dir = Path(PLUGIN_PARENT) / "qgis_plugin"
        init_path = plugin_dir / "__init__.py"
        spec = importlib.util.spec_from_file_location(
            "qgis_plugin",
            init_path,
            submodule_search_locations=[str(plugin_dir)],
        )
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Impossible de charger le plugin depuis {init_path}")

        qgis_plugin = importlib.util.module_from_spec(spec)
        sys.modules["qgis_plugin"] = qgis_plugin
        spec.loader.exec_module(qgis_plugin)

        record("plugin.import", True, detail=qgis_plugin.__file__)

        plugin = qgis_plugin.classFactory(iface)
        PLUGIN_INSTANCE = plugin
        plugin.initGui()
        record("plugin.initGui", plugin.action is not None)
        record(
            "plugin.icon",
            plugin.action is not None and not plugin.action.icon().isNull(),
        )
    except Exception as exc:
        fail("desktop.smoke", exc)
        return

    QTimer.singleShot(1000, continue_after_run)


record("script.bootstrap", True)
QTimer.singleShot(8000, main)
