import json
import os
import sys
import traceback

from qgis.PyQt.QtCore import QTimer
from qgis.PyQt.QtWidgets import QApplication, QMessageBox
from qgis.core import QgsFeature, QgsGeometry, QgsPointXY, QgsProject, QgsVectorLayer
from qgis.utils import iface


LOG_PATH = os.environ["GEOAI_BRIDGE_TEST_LOG"]
PLUGIN_PARENT = os.environ["GEOAI_TEST_PLUGIN_PARENT"]

RESULTS = {
    "success": True,
    "steps": [],
}


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
    persist()
    QTimer.singleShot(0, QApplication.instance().quit)


def fail(step, error):
    record(step, False, str(error), traceback.format_exc())
    finish()


def build_memory_layer():
    layer = QgsVectorLayer(
        "Point?crs=EPSG:3857&field=value:double&field=name:string",
        "bridge_smoke_layer",
        "memory",
    )
    provider = layer.dataProvider()

    feature_one = QgsFeature(layer.fields())
    feature_one.setAttributes([1.0, "A"])
    feature_one.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(0, 0)))

    feature_two = QgsFeature(layer.fields())
    feature_two.setAttributes([9.0, "B"])
    feature_two.setGeometry(QgsGeometry.fromPointXY(QgsPointXY(10, 10)))

    provider.addFeatures([feature_one, feature_two])
    layer.updateExtents()
    QgsProject.instance().addMapLayer(layer)
    return layer


def main():
    try:
        if PLUGIN_PARENT not in sys.path:
            sys.path.insert(0, PLUGIN_PARENT)

        from qgis_plugin.geoai_assistant import QgisBridge

        record("bridge.import", True)
        bridge = QgisBridge(iface)

        layer = build_memory_layer()
        record("bridge.layer_created", True, data=layer.name())

        layers = bridge.getLayersList()
        record("bridge.getLayersList", "bridge_smoke_layer" in layers, data=layers)

        catalog = json.loads(bridge.getLayersCatalog())
        bridge_entry = next(
            (entry for entry in catalog if entry.get("name") == "bridge_smoke_layer"),
            {},
        )
        record(
            "bridge.getLayersCatalog",
            bridge_entry.get("name") == "bridge_smoke_layer"
            and bridge_entry.get("type") == "vector",
            data=bridge_entry,
        )

        fields = bridge.getLayerFields("bridge_smoke_layer")
        record("bridge.getLayerFields", fields == ["value", "name"], data=fields)

        diagnostics = json.loads(bridge.getLayerDiagnostics("bridge_smoke_layer"))
        record(
            "bridge.getLayerDiagnostics",
            diagnostics.get("layerName") == "bridge_smoke_layer"
            and diagnostics.get("featureCount") == 2
            and "fieldDiagnostics" in diagnostics,
            data=diagnostics,
        )

        stats = json.loads(bridge.getLayerStatistics("bridge_smoke_layer", "value"))
        record(
            "bridge.getLayerStatistics",
            abs(stats["mean"] - 5.0) < 0.001 and stats["count"] == 2,
            data=stats,
        )

        filter_message = bridge.filterLayer("bridge_smoke_layer", '"value" > 5')
        record(
            "bridge.filterLayer",
            layer.subsetString() == '"value" > 5',
            detail=filter_message,
        )

        visibility_message = bridge.setLayerVisibility("bridge_smoke_layer", False)
        layer_node = QgsProject.instance().layerTreeRoot().findLayer(layer.id())
        record(
            "bridge.setLayerVisibility",
            layer_node is not None and not layer_node.itemVisibilityChecked(),
            detail=visibility_message,
        )
        bridge.setLayerVisibility("bridge_smoke_layer", True)

        opacity_message = bridge.setLayerOpacity("bridge_smoke_layer", 0.35)
        record(
            "bridge.setLayerOpacity",
            abs(layer.opacity() - 0.35) < 0.001,
            detail=opacity_message,
        )

        zoom_message = bridge.zoomToLayer("bridge_smoke_layer")
        record(
            "bridge.zoomToLayer",
            iface.activeLayer() == layer,
            detail=zoom_message,
        )

        reprojected = bridge.reprojectLayer("bridge_smoke_layer", "EPSG:4326")
        record(
            "bridge.reprojectLayer",
            bool(QgsProject.instance().mapLayersByName(reprojected)),
            data=reprojected,
        )

        original_exec = QMessageBox.exec
        QMessageBox.exec = lambda self: QMessageBox.Ok
        try:
            script_message = bridge.runScript(
                "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'bridge_script_layer', 'memory')\n"
                "QgsProject.instance().addMapLayer(layer)\n"
            )
        finally:
            QMessageBox.exec = original_exec

        record(
            "bridge.runScript",
            bool(QgsProject.instance().mapLayersByName("bridge_script_layer")),
            detail=script_message,
        )

        direct_script_message = bridge.runScriptDirect(
            "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'bridge_script_direct_layer', 'memory')\n"
            "QgsProject.instance().addMapLayer(layer)\n"
        )
        record(
            "bridge.runScriptDirect",
            bool(QgsProject.instance().mapLayersByName("bridge_script_direct_layer")),
            detail=direct_script_message,
        )

        detailed_success = json.loads(
            bridge.runScriptDetailed(
                "layer = QgsVectorLayer('Point?crs=EPSG:4326', 'bridge_script_detailed_layer', 'memory')\n"
                "QgsProject.instance().addMapLayer(layer)\n",
                False,
            )
        )
        record(
            "bridge.runScriptDetailed.success",
            detailed_success.get("ok") is True
            and bool(
                QgsProject.instance().mapLayersByName("bridge_script_detailed_layer")
            ),
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
    except Exception as exc:
        fail("bridge.desktop.smoke", exc)
        return

    finish()


record("script.bootstrap", True)
QTimer.singleShot(1500, main)
