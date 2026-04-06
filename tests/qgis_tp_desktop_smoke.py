import importlib.util
import json
import os
import sys
import threading
import traceback
import urllib.error
import urllib.request
from pathlib import Path

import processing
from qgis.PyQt.QtCore import QEventLoop, QTimer
from qgis.PyQt.QtWidgets import QApplication
from qgis.core import (
    QgsFeature,
    QgsGeometry,
    QgsPointXY,
    QgsProject,
    QgsVectorLayer,
)
from qgis.utils import iface


LOG_PATH = os.environ["GEOAI_TP_TEST_LOG"]
PLUGIN_PARENT = os.environ["GEOAI_TEST_PLUGIN_PARENT"]

RESULTS = {"success": True, "steps": []}
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


def run_in_worker(callback, timeout_ms=20000):
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
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {error.code} {error.reason}: {detail}") from error

    return run_in_worker(callback, timeout_ms=30000)


def current_catalog(bridge_base):
    payload = request_json(f"{bridge_base}/api/qgis/getLayersCatalog")
    return json.loads(payload.get("result", "[]"))


def find_layer(catalog, name):
    return next((entry for entry in catalog if entry.get("name") == name), None)


def build_constant_raster(name, value):
    output_dir = Path(LOG_PATH).resolve().parent / "tp_rasters"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{name}.tif"
    processing.run(
        "native:createconstantrasterlayer",
        {
            "EXTENT": "0,1000,0,1000",
            "TARGET_CRS": "EPSG:3857",
            "PIXEL_SIZE": 10,
            "NUMBER": value,
            "OUTPUT_TYPE": 5,
            "CREATION_OPTIONS": "COMPRESS=LZW",
            "OUTPUT": str(output_path),
        },
    )
    return output_path


def build_inventory_zone():
    layer = QgsVectorLayer(
        "Polygon?crs=EPSG:3857&field=name:string",
        "zone_etude_tp",
        "memory",
    )
    provider = layer.dataProvider()
    feature = QgsFeature(layer.fields())
    feature.setAttributes(["zone test"])
    feature.setGeometry(
        QgsGeometry.fromPolygonXY(
            [
                [
                    QgsPointXY(0, 0),
                    QgsPointXY(1000, 0),
                    QgsPointXY(1000, 1000),
                    QgsPointXY(0, 1000),
                    QgsPointXY(0, 0),
                ]
            ]
        )
    )
    provider.addFeatures([feature])
    layer.updateExtents()
    QgsProject.instance().addMapLayer(layer)
    return layer


def test_tp_workflows(plugin):
    external_url = getattr(plugin, "external_ui_url", "") or ""
    record(
        "plugin.external_ui_url",
        external_url.startswith("http://127.0.0.1:"),
        detail=external_url,
    )
    if not external_url:
        raise RuntimeError("URL externe GeoSylva AI indisponible.")

    bridge_base = external_url.split("/index.html", 1)[0]
    health = request_json(f"{bridge_base}/api/qgis/health")
    record("http.health", health.get("ok") is True, data=health)

    ndvi_2023_path = build_constant_raster("ndvi_2023_test", 35)
    ndvi_2024_path = build_constant_raster("ndvi_2024_test", 48)
    record(
        "tp.raster_files",
        ndvi_2023_path.exists() and ndvi_2024_path.exists(),
        data=[str(ndvi_2023_path), str(ndvi_2024_path)],
    )

    request_json(
        f"{bridge_base}/api/qgis/addRasterFile",
        method="POST",
        payload={"filePath": str(ndvi_2023_path), "layerName": "NDVI_2023_test"},
    )
    request_json(
        f"{bridge_base}/api/qgis/addRasterFile",
        method="POST",
        payload={"filePath": str(ndvi_2024_path), "layerName": "NDVI_2024_test"},
    )
    raster_catalog = current_catalog(bridge_base)
    ndvi_2023_entry = find_layer(raster_catalog, "NDVI_2023_test")
    ndvi_2024_entry = find_layer(raster_catalog, "NDVI_2024_test")
    record(
        "http.addRasterFile.tp",
        ndvi_2023_entry is not None and ndvi_2024_entry is not None,
        data={"2023": ndvi_2023_entry, "2024": ndvi_2024_entry},
    )

    merge_output = Path(LOG_PATH).resolve().parent / "tp_rasters" / "ndvi_2023_2024_biannuel.tif"
    merge_payload = request_json(
        f"{bridge_base}/api/qgis/mergeRasterBands",
        method="POST",
        payload={
            "layerIds": json.dumps([ndvi_2023_entry["id"], ndvi_2024_entry["id"]]),
            "outputName": "NDVI_2023_2024_biannuel",
            "outputPath": str(merge_output),
        },
    )
    merge_catalog = current_catalog(bridge_base)
    merge_entry = find_layer(merge_catalog, "NDVI_2023_2024_biannuel")
    record(
        "http.mergeRasterBands",
        merge_entry is not None and merge_output.exists(),
        detail=merge_payload.get("result", ""),
        data=merge_entry,
    )

    zone_layer = build_inventory_zone()
    record("tp.zone_layer", zone_layer.isValid(), data=zone_layer.name())

    grid_payload = request_json(
        f"{bridge_base}/api/qgis/createInventoryGrid",
        method="POST",
        payload={
            "layerId": zone_layer.id(),
            "cellWidth": 250,
            "cellHeight": 250,
            "gridName": "zone_etude_tp_grille",
            "centroidsName": "zone_etude_tp_centroides",
            "clipToSource": True,
        },
    )
    final_catalog = current_catalog(bridge_base)
    grid_entry = find_layer(final_catalog, "zone_etude_tp_grille")
    centroids_entry = find_layer(final_catalog, "zone_etude_tp_centroides")
    record(
        "http.createInventoryGrid",
        grid_entry is not None and centroids_entry is not None,
        detail=grid_payload.get("result", ""),
        data={"grid": grid_entry, "centroids": centroids_entry},
    )

    grid_layers = QgsProject.instance().mapLayersByName("zone_etude_tp_grille")
    centroid_layers = QgsProject.instance().mapLayersByName("zone_etude_tp_centroides")
    grid_count = grid_layers[0].featureCount() if grid_layers else 0
    centroid_count = centroid_layers[0].featureCount() if centroid_layers else 0
    record(
        "tp.inventory_counts",
        grid_count > 0 and centroid_count == grid_count,
        data={"grid": grid_count, "centroids": centroid_count},
    )


def continue_after_run():
    try:
        plugin = PLUGIN_INSTANCE
        plugin.run()
        record("plugin.run", plugin.dock is not None)
        if plugin.dock is None:
            raise RuntimeError("Dock GeoSylva AI introuvable.")
        wait(2500)
        test_tp_workflows(plugin)
    except Exception as exc:
        fail("tp.desktop.smoke", exc)
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
    except Exception as exc:
        fail("tp.bootstrap", exc)
        return

    QTimer.singleShot(1000, continue_after_run)


record("script.bootstrap", True)
QTimer.singleShot(4000, main)
