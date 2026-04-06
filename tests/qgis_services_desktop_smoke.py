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
from qgis.core import QgsProject
from qgis.utils import iface


LOG_PATH = os.environ["GEOAI_SERVICE_TEST_LOG"]
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
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {error.code} {error.reason}: {detail}") from error

    return run_in_worker(callback, timeout_ms=30000)


def request_text(url, method="GET", payload=None):
    def callback():
        data = None
        headers = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(request, timeout=20) as response:
            return response.read().decode("utf-8")

    return run_in_worker(callback, timeout_ms=30000)


def build_constant_raster(name, value):
    output_dir = Path(LOG_PATH).resolve().parent / "rasters"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{name}.tif"
    processing.run(
        "native:createconstantrasterlayer",
        {
            "EXTENT": "0,20,0,20",
            "TARGET_CRS": "EPSG:3857",
            "PIXEL_SIZE": 1,
            "NUMBER": value,
            "OUTPUT_TYPE": 5,
            "CREATION_OPTIONS": "COMPRESS=LZW",
            "OUTPUT": str(output_path),
        },
    )
    return output_path


def current_catalog(bridge_base):
    payload = request_json(f"{bridge_base}/api/qgis/getLayersCatalog")
    return json.loads(payload.get("result", "[]"))


def find_layer(catalog, name):
    return next((entry for entry in catalog if entry.get("name") == name), None)


def build_split_line_wkt(layer):
    extent = layer.extent()
    mid_y = (extent.yMinimum() + extent.yMaximum()) / 2
    return f"LINESTRING({extent.xMinimum()} {mid_y}, {extent.xMaximum()} {mid_y})"


def test_services_and_rasters(plugin):
    external_url = getattr(plugin, "external_ui_url", "") or ""
    record(
        "plugin.external_ui_url",
        external_url.startswith("http://127.0.0.1:"),
        detail=external_url,
    )
    if not external_url:
        raise RuntimeError("URL externe GeoAI indisponible.")

    bridge_base = external_url.split("/index.html", 1)[0]
    health = request_json(f"{bridge_base}/api/qgis/health")
    record("http.health", health.get("ok") is True, data=health)

    xyz_payload = request_json(
        f"{bridge_base}/api/qgis/addServiceLayer",
        method="POST",
        payload={
            "config": json.dumps(
                {
                    "name": "osm_service_test",
                    "serviceType": "XYZ",
                    "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                    "zMin": 0,
                    "zMax": 19,
                }
            )
        },
    )
    xyz_message = xyz_payload.get("result", "")
    xyz_catalog = current_catalog(bridge_base)
    record(
        "http.addServiceLayer.xyz",
        find_layer(xyz_catalog, "osm_service_test") is not None,
        detail=xyz_message,
    )

    wms_payload = request_json(
        f"{bridge_base}/api/qgis/addServiceLayer",
        method="POST",
        payload={
            "config": json.dumps(
                {
                    "name": "mundialis_wms_test",
                    "serviceType": "WMS",
                    "url": "https://ows.mundialis.de/osm/service?",
                    "layerName": "TOPO-WMS",
                    "format": "image/png",
                    "crs": "EPSG:3857",
                }
            )
        },
    )
    wms_message = wms_payload.get("result", "")
    wms_catalog = current_catalog(bridge_base)
    record(
        "http.addServiceLayer.wms",
        find_layer(wms_catalog, "mundialis_wms_test") is not None,
        detail=wms_message,
    )

    wmts_payload = request_json(
        f"{bridge_base}/api/qgis/addServiceLayer",
        method="POST",
        payload={
            "config": json.dumps(
                {
                    "name": "wien_wmts_test",
                    "serviceType": "WMTS",
                    "url": "https://maps.wien.gv.at/basemap/1.0.0/WMTSCapabilities.xml",
                    "layerName": "geolandbasemap",
                    "tileMatrixSet": "google3857",
                    "style": "normal",
                    "format": "image/png",
                    "crs": "EPSG:3857",
                }
            )
        },
    )
    wmts_message = wmts_payload.get("result", "")
    wmts_catalog = current_catalog(bridge_base)
    record(
        "http.addServiceLayer.wmts",
        find_layer(wmts_catalog, "wien_wmts_test") is not None,
        detail=wmts_message,
    )

    wfs_payload = request_json(
        f"{bridge_base}/api/qgis/addServiceLayer",
        method="POST",
        payload={
            "config": json.dumps(
                {
                    "name": "countries_wfs_test",
                    "serviceType": "WFS",
                    "url": "https://ahocevar.com/geoserver/wfs",
                    "layerName": "ne:ne_10m_admin_0_countries",
                    "version": "2.0.0",
                    "crs": "EPSG:4326",
                }
            )
        },
    )
    wfs_message = wfs_payload.get("result", "")
    wfs_catalog = current_catalog(bridge_base)
    record(
        "http.addServiceLayer.wfs",
        find_layer(wfs_catalog, "countries_wfs_test") is not None,
        detail=wfs_message,
    )

    cadastre_geojson = request_text(
        "https://apicarto.ign.fr/api/cadastre/parcelle?code_insee=35238&_limit=1"
    )
    add_cadastre = request_json(
        f"{bridge_base}/api/qgis/addGeoJsonLayer",
        method="POST",
        payload={
            "geojson": cadastre_geojson,
            "layerName": "cadastre_parcelle_test",
        },
    )
    cadastre_catalog = current_catalog(bridge_base)
    record(
        "http.addGeoJsonLayer.cadastre",
        find_layer(cadastre_catalog, "cadastre_parcelle_test") is not None,
        detail=add_cadastre.get("result", ""),
    )

    cadastre_layers = QgsProject.instance().mapLayersByName("cadastre_parcelle_test")
    if cadastre_layers:
        cadastre_layer = cadastre_layers[0]
        cadastre_layer.selectAll()

        style_payload = request_json(
            f"{bridge_base}/api/qgis/applyParcelStylePreset",
            method="POST",
            payload={
                "layerId": cadastre_layer.id(),
                "presetId": "cadastre",
            },
        )
        record(
            "http.applyParcelStylePreset",
            "Style applique" in style_payload.get("result", ""),
            detail=style_payload.get("result", ""),
        )

        label_payload = request_json(
            f"{bridge_base}/api/qgis/setLayerLabels",
            method="POST",
            payload={
                "layerId": cadastre_layer.id(),
                "fieldName": "",
                "enabled": True,
            },
        )
        record(
            "http.setLayerLabels",
            "Etiquettes activees" in label_payload.get("result", ""),
            detail=label_payload.get("result", ""),
        )

        split_payload = request_json(
            f"{bridge_base}/api/qgis/splitSelectedLayerByLine",
            method="POST",
            payload={
                "layerId": cadastre_layer.id(),
                "lineWkt": build_split_line_wkt(cadastre_layer),
                "outputName": "cadastre_split_test",
            },
        )
        split_catalog = current_catalog(bridge_base)
        record(
            "http.splitSelectedLayerByLine",
            find_layer(split_catalog, "cadastre_split_test") is not None,
            detail=split_payload.get("result", ""),
        )
    else:
        record(
            "http.cadastre.vector_layer",
            False,
            detail="Couche cadastre_parcelle_test introuvable apres import GeoJSON.",
        )

    mns_path = build_constant_raster("mns_test", 15)
    mnt_path = build_constant_raster("mnt_test", 10)
    record("test.raster_files", mns_path.exists() and mnt_path.exists(), data=[str(mns_path), str(mnt_path)])

    add_mns = request_json(
        f"{bridge_base}/api/qgis/addRasterFile",
        method="POST",
        payload={"filePath": str(mns_path), "layerName": "mns_test"},
    )
    add_mnt = request_json(
        f"{bridge_base}/api/qgis/addRasterFile",
        method="POST",
        payload={"filePath": str(mnt_path), "layerName": "mnt_test"},
    )
    raster_catalog = current_catalog(bridge_base)
    mns_entry = find_layer(raster_catalog, "mns_test")
    mnt_entry = find_layer(raster_catalog, "mnt_test")
    record(
        "http.addRasterFile",
        mns_entry is not None and mnt_entry is not None,
        data={"mns": add_mns.get("result", ""), "mnt": add_mnt.get("result", "")},
    )

    formula_output = Path(LOG_PATH).resolve().parent / "rasters" / "sum_test.tif"
    calc_payload = request_json(
        f"{bridge_base}/api/qgis/calculateRasterFormula",
        method="POST",
        payload={
            "layerIds": json.dumps([mns_entry["id"], mnt_entry["id"]]),
            "formula": "A+B",
            "outputName": "sum_test",
            "outputPath": str(formula_output),
        },
    )
    calc_catalog = current_catalog(bridge_base)
    record(
        "http.calculateRasterFormula",
        find_layer(calc_catalog, "sum_test") is not None and formula_output.exists(),
        detail=calc_payload.get("result", ""),
    )

    mnh_output = Path(LOG_PATH).resolve().parent / "rasters" / "mnh_test.tif"
    mnh_payload = request_json(
        f"{bridge_base}/api/qgis/calculateMnh",
        method="POST",
        payload={
            "mnsLayerId": mns_entry["id"],
            "mntLayerId": mnt_entry["id"],
            "outputName": "mnh_test",
            "outputPath": str(mnh_output),
            "clampNegative": True,
        },
    )
    final_catalog = current_catalog(bridge_base)
    record(
        "http.calculateMnh",
        find_layer(final_catalog, "mnh_test") is not None and mnh_output.exists(),
        detail=mnh_payload.get("result", ""),
    )

    record(
        "project.layers.summary",
        len(QgsProject.instance().mapLayers()) >= 5,
        data=[layer.name() for layer in QgsProject.instance().mapLayers().values()],
    )


def continue_after_run():
    try:
        plugin = PLUGIN_INSTANCE
        plugin.run()
        record("plugin.run", plugin.dock is not None)
        if plugin.dock is None:
            raise RuntimeError("Dock GeoAI introuvable.")
        wait(2500)
        test_services_and_rasters(plugin)
    except Exception as exc:
        fail("services.desktop.smoke", exc)
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
        fail("services.bootstrap", exc)
        return

    QTimer.singleShot(1000, continue_after_run)


record("script.bootstrap", True)
QTimer.singleShot(4000, main)
