# -*- coding: utf-8 -*-
import functools
import http.server
import importlib
import json
import os
import socketserver
import statistics
import sys
import tempfile
import threading
import traceback
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlencode, urlparse

# Correction des problèmes de versions multiples QGIS
try:
    from .version_manager import fix_qgis_multi_version_issues
    fix_qgis_multi_version_issues()
except ImportError:
    # Si le module n'est pas disponible, continuer sans
    pass

# Import de la configuration de l'icône
try:
    from .icon_config import ICON_CONFIG, MENU_CONFIG, TOOLBAR_CONFIG
except ImportError:
    # Fallback si la configuration n'est pas disponible
    ICON_CONFIG = {}
    MENU_CONFIG = {}
    TOOLBAR_CONFIG = {}

# Import des modules d'installation Ollama
try:
    from .system_capabilities import system_capabilities
    from .ollama_installer import ollama_installer
except ImportError:
    # Fallback si les modules ne sont pas disponibles
    system_capabilities = None
    ollama_installer = None

import processing
import qgis.PyQt
from qgis.PyQt.QtCore import QObject, Qt, QUrl, QVariant, pyqtSignal, pyqtSlot
from qgis.PyQt.QtGui import QDesktopServices, QColor, QFont, QGuiApplication, QIcon
from qgis.PyQt.QtWidgets import (
    QAction,
    QFileDialog,
    QDockWidget,
    QFrame,
    QHBoxLayout,
    QLabel,
    QMessageBox,
    QPushButton,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)
from qgis.core import (
    QgsCoordinateReferenceSystem,
    QgsDataSourceUri,
    QgsFeature,
    QgsField,
    QgsFillSymbol,
    QgsGeometry,
    QgsLineSymbol,
    QgsRasterLayer,
    QgsMapLayerType,
    QgsMessageLog,
    QgsPalLayerSettings,
    QgsProject,
    QgsSingleSymbolRenderer,
    QgsTextBufferSettings,
    QgsTextFormat,
    QgsVectorLayer,
    QgsVectorLayerSimpleLabeling,
    QgsWkbTypes,
    Qgis,
)

QWebEngineView = None
QWebChannel = None
BridgeQObject = QObject
BridgeSlot = pyqtSlot
WebQUrl = QUrl
WEB_IMPORT_ERROR = None


def _qgis_site_packages():
    """Détecte le site-packages de QGIS avec gestion des versions multiples"""
    # Essayer d'abord avec le gestionnaire de versions
    try:
        from .version_manager import qgis_version_manager
        site_packages = qgis_version_manager.current_site_packages
        if site_packages:
            return str(site_packages)
    except ImportError:
        pass
    
    # Fallback à la méthode originale
    qgis_pyqt_dir = Path(qgis.PyQt.__file__).resolve()
    try:
        apps_dir = qgis_pyqt_dir.parents[4]
    except IndexError:
        return None

    for site_packages in sorted(apps_dir.glob("Python*/Lib/site-packages")):
        if (site_packages / "PyQt5").exists():
            return str(site_packages)

    return None


def _prefer_qgis_pyqt(site_packages):
    if not site_packages:
        return

    try:
        sys.path.remove(site_packages)
    except ValueError:
        pass

    sys.path.insert(0, site_packages)

    pyqt_module = sys.modules.get("PyQt5")
    module_path = getattr(pyqt_module, "__file__", None)
    if not module_path:
        return

    resolved_module_path = str(Path(module_path).resolve())
    if resolved_module_path.startswith(site_packages):
        return

    for module_name in list(sys.modules):
        if (
            module_name == "PyQt5"
            or module_name.startswith("PyQt5.")
            or module_name.startswith("qgis.PyQt.QtWebEngine")
            or module_name.startswith("qgis.PyQt.QtWebChannel")
        ):
            del sys.modules[module_name]


def _import_web_runtime():
    site_packages = _qgis_site_packages()
    _prefer_qgis_pyqt(site_packages)

    web_engine_module = importlib.import_module("PyQt5.QtWebEngineWidgets")
    web_channel_module = importlib.import_module("PyQt5.QtWebChannel")
    web_core_module = importlib.import_module("PyQt5.QtCore")
    web_engine_path = str(Path(web_engine_module.__file__).resolve())
    web_channel_path = str(Path(web_channel_module.__file__).resolve())
    web_core_path = str(Path(web_core_module.__file__).resolve())
    if site_packages and (
        not web_engine_path.startswith(site_packages)
        or not web_channel_path.startswith(site_packages)
        or not web_core_path.startswith(site_packages)
    ):
        raise ImportError(
            "Runtime web Qt résolu hors de QGIS: "
            f"engine={web_engine_path}, channel={web_channel_path}, core={web_core_path}"
        )

    return (
        web_engine_module.QWebEngineView,
        web_channel_module.QWebChannel,
        web_core_module.QObject,
        web_core_module.pyqtSlot,
        web_core_module.QUrl,
    )


try:
    QWebEngineView, QWebChannel, BridgeQObject, BridgeSlot, WebQUrl = _import_web_runtime()
except Exception as exc:
    WEB_IMPORT_ERROR = exc


class QgisBridge(BridgeQObject):
    """Bridge between the embedded web app and the active QGIS session."""

    DIAGNOSTIC_SAMPLE_LIMIT = 1500

    def __init__(self, iface):
        super().__init__()
        self.iface = iface

    def _find_layer(self, layer_ref):
        if not layer_ref:
            return None

        layers = QgsProject.instance().mapLayersByName(layer_ref)
        if layers:
            return layers[0]

        return QgsProject.instance().mapLayer(layer_ref)

    def _notify(self, message, level=Qgis.Info, duration=4):
        self.iface.messageBar().pushMessage("GeoSylva AI", message, level=level, duration=duration)
        QgsMessageLog.logMessage(message, "GeoSylva AI", level=level)

    def _layer_node(self, layer):
        if layer is None:
            return None

        return QgsProject.instance().layerTreeRoot().findLayer(layer.id())

    def _layer_opacity(self, layer):
        if layer is None:
            return 1.0

        if hasattr(layer, "opacity"):
            try:
                return float(layer.opacity())
            except Exception:
                pass

        renderer = getattr(layer, "renderer", lambda: None)()
        if renderer is not None and hasattr(renderer, "opacity"):
            try:
                return float(renderer.opacity())
            except Exception:
                pass

        return 1.0

    def _apply_layer_opacity(self, layer, opacity_value):
        clamped_opacity = max(0.0, min(1.0, float(opacity_value)))
        applied = False

        if hasattr(layer, "setOpacity"):
            try:
                layer.setOpacity(clamped_opacity)
                applied = True
            except Exception:
                applied = False

        if not applied:
            renderer = getattr(layer, "renderer", lambda: None)()
            if renderer is not None and hasattr(renderer, "setOpacity"):
                renderer.setOpacity(clamped_opacity)
                applied = True

        if not applied:
            return False

        layer.triggerRepaint()

        layer_tree_view = getattr(self.iface, "layerTreeView", lambda: None)()
        if layer_tree_view is not None and hasattr(layer_tree_view, "refreshLayerSymbology"):
            layer_tree_view.refreshLayerSymbology(layer.id())

        self.iface.mapCanvas().refresh()
        return True

    def _layer_summary(self, layer):
        layer_type = "unknown"
        geometry_type = ""

        if layer.type() == QgsMapLayerType.VectorLayer:
            layer_type = "vector"
        elif layer.type() == QgsMapLayerType.RasterLayer:
            layer_type = "raster"
        elif layer.type() == QgsMapLayerType.MeshLayer:
            layer_type = "mesh"
        elif layer.type() == QgsMapLayerType.VectorTileLayer:
            layer_type = "vector-tile"
        elif layer.type() == QgsMapLayerType.PointCloudLayer:
            layer_type = "point-cloud"
        elif layer.type() == QgsMapLayerType.AnnotationLayer:
            layer_type = "annotation"
        elif layer.type() == QgsMapLayerType.PluginLayer:
            layer_type = "plugin"

        if isinstance(layer, QgsVectorLayer):
            geometry_type = QgsWkbTypes.geometryDisplayString(layer.geometryType())

        feature_count = None
        selected_feature_count = 0
        subset_string = ""
        editable = False

        if isinstance(layer, QgsVectorLayer):
            feature_count = int(layer.featureCount())
            selected_feature_count = int(layer.selectedFeatureCount())
            subset_string = layer.subsetString() or ""
            editable = bool(layer.isEditable())

        layer_node = self._layer_node(layer)
        is_visible = True if layer_node is None else bool(layer_node.itemVisibilityChecked())

        return {
            "id": layer.id(),
            "name": layer.name(),
            "type": layer_type,
            "geometryType": geometry_type,
            "crs": layer.crs().authid() if layer.crs().isValid() else "",
            "featureCount": feature_count,
            "selectedFeatureCount": selected_feature_count,
            "visible": is_visible,
            "opacity": round(self._layer_opacity(layer), 3),
            "subsetString": subset_string,
            "provider": layer.providerType() if hasattr(layer, "providerType") else "",
            "editable": editable,
        }

    def _extent_payload(self, layer):
        if layer is None:
            return None

        extent = layer.extent()
        if extent is None or extent.isEmpty():
            return None

        return {
            "xmin": extent.xMinimum(),
            "ymin": extent.yMinimum(),
            "xmax": extent.xMaximum(),
            "ymax": extent.yMaximum(),
        }

    def _layer_diagnostics(self, layer):
        summary = self._layer_summary(layer)
        diagnostics = {
            "layerId": summary["id"],
            "layerName": summary["name"],
            "layerType": summary["type"],
            "geometryType": summary["geometryType"],
            "crs": summary["crs"],
            "featureCount": summary["featureCount"],
            "selectedFeatureCount": summary["selectedFeatureCount"],
            "sampledFeatureCount": 0,
            "isSampled": False,
            "invalidGeometryCount": 0,
            "emptyGeometryCount": 0,
            "subsetString": summary["subsetString"],
            "extent": self._extent_payload(layer),
            "warnings": [],
            "fieldDiagnostics": [],
        }

        if not isinstance(layer, QgsVectorLayer):
            diagnostics["warnings"].append(
                "Diagnostic détaillé disponible principalement pour les couches vectorielles."
            )
            return diagnostics

        feature_count = int(layer.featureCount())
        sampled_feature_count = min(feature_count, self.DIAGNOSTIC_SAMPLE_LIMIT)
        is_sampled = feature_count > self.DIAGNOSTIC_SAMPLE_LIMIT
        field_names = [field.name() for field in layer.fields()]
        field_null_counts = {field_name: 0 for field_name in field_names}
        invalid_geometry_count = 0
        empty_geometry_count = 0

        for index, feature in enumerate(layer.getFeatures()):
            if index >= self.DIAGNOSTIC_SAMPLE_LIMIT:
                break

            geometry = feature.geometry()
            if geometry is None or geometry.isNull():
                empty_geometry_count += 1
            else:
                try:
                    if geometry.isEmpty():
                        empty_geometry_count += 1
                    elif not geometry.isGeosValid():
                        invalid_geometry_count += 1
                except Exception:
                    pass

            for field_name in field_names:
                raw_value = feature[field_name]
                if raw_value in (None, ""):
                    field_null_counts[field_name] += 1

        denominator = sampled_feature_count or 1
        field_diagnostics = []
        for field in layer.fields():
            null_count = field_null_counts.get(field.name(), 0)
            field_diagnostics.append(
                {
                    "name": field.name(),
                    "type": field.typeName(),
                    "nullCount": null_count,
                    "fillRate": round(max(0.0, 1.0 - (null_count / denominator)), 4),
                }
            )

        warnings = []
        if feature_count == 0:
            warnings.append("La couche est vide.")
        if summary["selectedFeatureCount"] == 0:
            warnings.append("Aucune entité n'est sélectionnée.")
        if invalid_geometry_count > 0:
            warnings.append(
                f"{invalid_geometry_count} géométrie(s) invalide(s) détectée(s) sur l'échantillon."
            )
        if empty_geometry_count > 0:
            warnings.append(
                f"{empty_geometry_count} géométrie(s) vide(s) ou nulles détectée(s) sur l'échantillon."
            )
        sparse_fields = [
            field["name"]
            for field in field_diagnostics
            if field["fillRate"] < 0.6
        ]
        if sparse_fields:
            warnings.append(
                "Champs peu renseignés : " + ", ".join(sparse_fields[:6])
            )
        if is_sampled:
            warnings.append(
                f"Diagnostic calculé sur un échantillon de {sampled_feature_count} entités."
            )

        diagnostics.update(
            {
                "sampledFeatureCount": sampled_feature_count,
                "isSampled": is_sampled,
                "invalidGeometryCount": invalid_geometry_count,
                "emptyGeometryCount": empty_geometry_count,
                "warnings": warnings,
                "fieldDiagnostics": field_diagnostics,
            }
        )
        return diagnostics

    def _encode_uri(self, params):
        normalized = {}
        for key, value in params.items():
            if value is None:
                continue
            if isinstance(value, bool):
                normalized[key] = "1" if value else "0"
            else:
                normalized[key] = str(value)

        return urlencode(normalized, doseq=True)

    def _encode_qgis_uri(self, params):
        uri = QgsDataSourceUri()
        for key, value in params.items():
            if value is None:
                continue
            if isinstance(value, bool):
                uri.setParam(key, "1" if value else "0")
            else:
                uri.setParam(key, str(value))

        encoded = uri.encodedUri()
        if isinstance(encoded, bytes):
            return encoded.decode("utf-8")
        return str(encoded)

    def _add_layer_to_project(self, layer, layer_name=None):
        if layer is None or not layer.isValid():
            return None

        if layer_name:
            layer.setName(layer_name)

        QgsProject.instance().addMapLayer(layer)
        return layer

    def _layer_error_message(self, layer):
        if layer is None:
            return ""

        details = []

        try:
            layer_error = layer.error()
            summary = getattr(layer_error, "summary", None)
            message = getattr(layer_error, "message", None)
            if callable(summary):
                details.append(str(summary() or "").strip())
            if callable(message):
                details.append(str(message() or "").strip())
        except Exception:
            pass

        try:
            provider = layer.dataProvider()
            if provider is not None and hasattr(provider, "error"):
                provider_error = provider.error()
                provider_summary = getattr(provider_error, "summary", None)
                provider_message = getattr(provider_error, "message", None)
                if callable(provider_summary):
                    details.append(str(provider_summary() or "").strip())
                if callable(provider_message):
                    details.append(str(provider_message() or "").strip())
        except Exception:
            pass

        normalized = [entry for entry in details if entry]
        if not normalized:
            return ""

        return " | ".join(dict.fromkeys(normalized))

    def _ensure_raster_layer(self, layer_ref):
        layer = self._find_layer(layer_ref)
        if layer is None or layer.type() != QgsMapLayerType.RasterLayer:
            return None
        return layer

    def _resolve_output_destination(self, output_path):
        if not output_path:
            return "TEMPORARY_OUTPUT"

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        return str(output_file)

    def _runtime_directory(self):
        runtime_dir = Path(tempfile.gettempdir()) / "geoai_qgis_runtime"
        runtime_dir.mkdir(parents=True, exist_ok=True)
        return runtime_dir

    def _write_temp_geojson(self, geojson_text, layer_name):
        safe_name = "".join(
            character if character.isalnum() or character in ("_", "-") else "_"
            for character in (layer_name or "geojson")
        ).strip("_") or "geojson"
        target = self._runtime_directory() / f"{safe_name}.geojson"
        target.write_text(geojson_text, encoding="utf-8")
        return str(target)

    def _refresh_layer_rendering(self, layer):
        if layer is None:
            return

        layer.triggerRepaint()
        layer_tree_view = getattr(self.iface, "layerTreeView", lambda: None)()
        if layer_tree_view is not None and hasattr(layer_tree_view, "refreshLayerSymbology"):
            layer_tree_view.refreshLayerSymbology(layer.id())
        self.iface.mapCanvas().refresh()

    def _guess_label_field(self, layer):
        if not isinstance(layer, QgsVectorLayer):
            return ""

        field_names = [field.name() for field in layer.fields()]
        preferred_fields = [
            "numero",
            "idu",
            "id",
            "section",
            "nom",
            "name",
            "code",
            "code_insee",
        ]
        normalized_fields = {field_name.lower(): field_name for field_name in field_names}

        for preferred_field in preferred_fields:
            if preferred_field in normalized_fields:
                return normalized_fields[preferred_field]

        return field_names[0] if field_names else ""

    def _create_service_layer(self, config):
        service_type = str(config.get("serviceType", "")).strip()
        layer_name = str(config.get("name", "")).strip() or "Service distant"
        url = str(config.get("url", "")).strip()
        layer_ref = str(config.get("layerName", "")).strip()
        style = str(config.get("style", "")).strip()
        image_format = str(config.get("format", "")).strip() or "image/png"
        crs = str(config.get("crs", "")).strip()
        tile_matrix_set = str(config.get("tileMatrixSet", "")).strip()
        version = str(config.get("version", "")).strip() or "2.0.0"
        z_min = config.get("zMin")
        z_max = config.get("zMax")

        if not service_type or not url:
            raise ValueError("Configuration de service distante incomplète.")

        if service_type in ("XYZ", "TMS"):
            uri = self._encode_uri(
                {
                    "type": "xyz",
                    "url": url,
                    "zmin": z_min if z_min is not None else 0,
                    "zmax": z_max if z_max is not None else 22,
                }
            )
            return QgsRasterLayer(uri, layer_name, "wms")

        if service_type == "WMS":
            uri = self._encode_qgis_uri(
                {
                    "contextualWMSLegend": 0,
                    "crs": crs or "EPSG:3857",
                    "dpiMode": 7,
                    "featureCount": 10,
                    "format": image_format,
                    "layers": layer_ref,
                    "styles": style,
                    "url": url,
                }
            )
            return QgsRasterLayer(uri, layer_name, "wms")

        if service_type == "WMTS":
            wmts_url = url
            if "GetCapabilities" not in wmts_url and "WMTSCapabilities.xml" not in wmts_url:
                separator = "&" if "?" in wmts_url else "?"
                wmts_url = (
                    f"{wmts_url}{separator}SERVICE=WMTS&REQUEST=GetCapabilities"
                )
            uri = self._encode_qgis_uri(
                {
                    "contextualWMSLegend": 0,
                    "crs": crs or "EPSG:3857",
                    "dpiMode": 7,
                    "featureCount": 10,
                    "format": image_format,
                    "layers": layer_ref,
                    "styles": style or "default",
                    "type": "wmts",
                    "tileMatrixSet": tile_matrix_set or "PM",
                    "url": wmts_url,
                }
            )
            return QgsRasterLayer(uri, layer_name, "wms")

        if service_type == "WFS":
            query = unquote(
                urlencode(
                    {
                        "service": "WFS",
                        "version": version,
                        "request": "GetFeature",
                        "typename": layer_ref,
                        "srsname": crs or "EPSG:4326",
                    }
                )
            )
            separator = "&" if "?" in url else "?"
            uri = f"{url}{separator}{query}"
            return QgsVectorLayer(uri, layer_name, "WFS")

        if service_type == "WCS":
            uri = self._encode_qgis_uri(
                {
                    "url": url,
                    "identifier": layer_ref,
                    "crs": crs or "",
                    "format": image_format or "image/tiff",
                    "version": version,
                }
            )
            return QgsRasterLayer(uri, layer_name, "wcs")

        if service_type == "ArcGISMapServer":
            return QgsRasterLayer(url, layer_name, "arcgismapserver")

        if service_type == "ArcGISFeatureServer":
            return QgsVectorLayer(url, layer_name, "arcgisfeatureserver")

        raise ValueError(f"Type de service non supporté: {service_type}")

    def _run_raster_calculator(self, raster_layers, formula, output_name, output_path):
        if len(raster_layers) == 0 or len(raster_layers) > 6:
            raise ValueError("Le calcul raster attend entre 1 et 6 rasters.")

        params = {
            "FORMULA": formula,
            "NO_DATA": -9999,
            "EXTENT_OPT": 3,
            "RTYPE": 5,
            "CREATION_OPTIONS": "COMPRESS=LZW",
            "OUTPUT": self._resolve_output_destination(output_path),
        }

        for index, layer in enumerate(raster_layers):
            letter = "ABCDEF"[index]
            params[f"INPUT_{letter}"] = layer.source()
            params[f"BAND_{letter}"] = 1

        result = processing.run("gdal:rastercalculator", params)
        output = result.get("OUTPUT")
        output_value = str(output)
        raster_layer = QgsRasterLayer(output_value, output_name)
        if not raster_layer.isValid():
            raise RuntimeError("Le raster calculé n'est pas exploitable.")

        self._add_layer_to_project(raster_layer, output_name)
        return {
            "outputLayerName": raster_layer.name(),
            "outputPath": output_value,
            "formula": formula,
        }

    def _run_raster_band_merge(self, raster_layers, output_name, output_path):
        if len(raster_layers) < 2:
            raise ValueError("La fusion multi-bandes attend au moins 2 rasters.")

        params = {
            "INPUT": [layer.source() for layer in raster_layers],
            "PCT": False,
            "SEPARATE": True,
            "NODATA_INPUT": None,
            "NODATA_OUTPUT": -9999,
            "OPTIONS": "COMPRESS=LZW",
            "EXTRA": "",
            "DATA_TYPE": 0,
            "OUTPUT": self._resolve_output_destination(output_path),
        }

        result = processing.run("gdal:merge", params)
        output = result.get("OUTPUT")
        output_value = str(output)
        raster_layer = QgsRasterLayer(output_value, output_name)
        if not raster_layer.isValid():
            raise RuntimeError("Le raster fusionne n'est pas exploitable.")

        self._add_layer_to_project(raster_layer, output_name)
        return {
            "outputLayerName": raster_layer.name(),
            "outputPath": output_value,
            "inputLayers": [layer.name() for layer in raster_layers],
            "separateBands": True,
        }

    def _run_inventory_grid(
        self,
        source_layer,
        cell_width,
        cell_height,
        grid_name,
        centroids_name,
        clip_to_source,
    ):
        if source_layer is None:
            raise ValueError("Couche source introuvable pour creer la grille.")

        cell_width = float(cell_width)
        cell_height = float(cell_height)
        if cell_width <= 0 or cell_height <= 0:
            raise ValueError("La taille de maille doit etre strictement positive.")

        grid_result = processing.run(
            "native:creategrid",
            {
                "TYPE": 2,
                "EXTENT": source_layer.extent(),
                "HSPACING": cell_width,
                "VSPACING": cell_height,
                "HOVERLAY": 0,
                "VOVERLAY": 0,
                "CRS": source_layer.crs(),
                "OUTPUT": "memory:",
            },
        )
        grid_layer = grid_result.get("OUTPUT")
        if grid_layer is None:
            raise RuntimeError("La grille d'inventaire n'a pas ete produite.")

        clipped = False
        if (
            clip_to_source
            and isinstance(source_layer, QgsVectorLayer)
            and source_layer.geometryType() == QgsWkbTypes.PolygonGeometry
        ):
            clip_result = processing.run(
                "native:clip",
                {
                    "INPUT": grid_layer,
                    "OVERLAY": source_layer,
                    "OUTPUT": "memory:",
                },
            )
            grid_layer = clip_result.get("OUTPUT")
            clipped = True

        if grid_layer is None:
            raise RuntimeError("La grille clippee n'est pas exploitable.")

        grid_layer.setName(grid_name)
        QgsProject.instance().addMapLayer(grid_layer)
        self._refresh_layer_rendering(grid_layer)

        centroids_result = processing.run(
            "native:centroids",
            {
                "INPUT": grid_layer,
                "ALL_PARTS": False,
                "OUTPUT": "memory:",
            },
        )
        centroid_layer = centroids_result.get("OUTPUT")
        if centroid_layer is None:
            raise RuntimeError("Les centroides n'ont pas pu etre generes.")

        centroid_layer.setName(centroids_name)
        QgsProject.instance().addMapLayer(centroid_layer)
        self._refresh_layer_rendering(centroid_layer)

        return {
            "gridLayerName": grid_layer.name(),
            "centroidLayerName": centroid_layer.name(),
            "sourceLayerName": source_layer.name(),
            "cellWidth": cell_width,
            "cellHeight": cell_height,
            "clipped": clipped,
        }

    @BridgeSlot()
    def openLayers(self):
        self.iface.showLayerPanel()
        self._notify("Panneau des couches ouvert.", Qgis.Info)

    @BridgeSlot()
    def openSettings(self):
        self._notify(
            "Les paramètres du modèle se configurent depuis l'interface GeoSylva AI.",
            Qgis.Info,
        )

    @BridgeSlot(str, str, result=str)
    def pickFile(self, file_filter, title):
        selected_file, _ = QFileDialog.getOpenFileName(
            self.iface.mainWindow(),
            str(title or "Choisir un fichier"),
            "",
            str(file_filter or "Tous les fichiers (*.*)"),
        )
        return selected_file or ""

    @BridgeSlot(result=list)
    def getLayersList(self):
        return [layer.name() for layer in QgsProject.instance().mapLayers().values()]

    @BridgeSlot(result=str)
    def getLayersCatalog(self):
        ordered_layers = QgsProject.instance().layerTreeRoot().layerOrder()
        if not ordered_layers:
            ordered_layers = list(QgsProject.instance().mapLayers().values())

        payload = [self._layer_summary(layer) for layer in ordered_layers]
        return json.dumps(payload, ensure_ascii=False)

    @BridgeSlot(str, result=list)
    def getLayerFields(self, layer_ref):
        layer = self._find_layer(layer_ref)
        if not isinstance(layer, QgsVectorLayer):
            return []

        return [field.name() for field in layer.fields()]

    @BridgeSlot(str, result=str)
    def getLayerDiagnostics(self, layer_ref):
        layer = self._find_layer(layer_ref)
        if layer is None:
            return ""

        return json.dumps(self._layer_diagnostics(layer), ensure_ascii=False)

    @BridgeSlot(str, str, result=str)
    def filterLayer(self, layer_ref, subset_string):
        layer = self._find_layer(layer_ref)
        if layer is None:
            message = "Couche introuvable."
            self._notify(message, Qgis.Warning)
            return message

        if not hasattr(layer, "setSubsetString"):
            message = "Cette couche ne supporte pas les filtres attributaires."
            self._notify(message, Qgis.Warning)
            return message

        layer.setSubsetString(subset_string)
        message = f"Filtre appliqué sur {layer.name()}."
        self._notify(message, Qgis.Success)
        return message

    @BridgeSlot(str, bool, result=str)
    def setLayerVisibility(self, layer_ref, is_visible):
        layer = self._find_layer(layer_ref)
        layer_node = self._layer_node(layer)
        if layer is None or layer_node is None:
            message = "Couche introuvable."
            self._notify(message, Qgis.Warning)
            return message

        layer_node.setItemVisibilityChecked(bool(is_visible))
        self.iface.mapCanvas().refresh()

        message = f"{layer.name()} {'affichée' if is_visible else 'masquée'}."
        self._notify(message, Qgis.Info)
        return message

    @BridgeSlot(str, float, result=str)
    def setLayerOpacity(self, layer_ref, opacity_value):
        layer = self._find_layer(layer_ref)
        if layer is None:
            message = "Couche introuvable."
            self._notify(message, Qgis.Warning)
            return message

        opacity = max(0.0, min(1.0, float(opacity_value)))
        if not self._apply_layer_opacity(layer, opacity):
            message = "Impossible de modifier l'opacité de cette couche."
            self._notify(message, Qgis.Warning)
            return message

        message = f"Opacité de {layer.name()} réglée à {int(round(opacity * 100))}%."
        self._notify(message, Qgis.Success)
        return message

    @BridgeSlot(str, result=str)
    def zoomToLayer(self, layer_ref):
        layer = self._find_layer(layer_ref)
        if layer is None:
            message = "Couche introuvable."
            self._notify(message, Qgis.Warning)
            return message

        self.iface.setActiveLayer(layer)
        self.iface.zoomToActiveLayer()
        message = f"Vue centrée sur {layer.name()}."
        self._notify(message, Qgis.Info)
        return message

    @BridgeSlot(str, str, result=str)
    def getLayerStatistics(self, layer_ref, field_name):
        layer = self._find_layer(layer_ref)
        if not isinstance(layer, QgsVectorLayer):
            return ""

        field_index = layer.fields().indexOf(field_name)
        if field_index == -1:
            return ""

        values = []
        for feature in layer.getFeatures():
            raw_value = feature[field_index]
            if raw_value in (None, ""):
                continue
            try:
                values.append(float(raw_value))
            except (TypeError, ValueError):
                continue

        if not values:
            return ""

        count = len(values)
        total = sum(values)
        mean = total / count
        minimum = min(values)
        maximum = max(values)

        payload = {
            "count": count,
            "sum": total,
            "mean": mean,
            "min": minimum,
            "max": maximum,
            "range": maximum - minimum,
            "sampleStandardDeviation": statistics.stdev(values) if count > 1 else 0.0,
            "populationStandardDeviation": statistics.pstdev(values) if count > 0 else 0.0,
        }

        return json.dumps(payload)

    @BridgeSlot(str, str, result=str)
    def reprojectLayer(self, layer_ref, target_crs_authid):
        layer = self._find_layer(layer_ref)
        if not isinstance(layer, QgsVectorLayer):
            return ""

        target_crs = QgsCoordinateReferenceSystem(target_crs_authid)
        if not target_crs.isValid():
            self._notify("CRS cible invalide.", Qgis.Warning)
            return ""

        try:
            result = processing.run(
                "native:reprojectlayer",
                {
                    "INPUT": layer,
                    "TARGET_CRS": target_crs,
                    "OUTPUT": "memory:",
                },
            )
        except Exception:
            QgsMessageLog.logMessage(
                traceback.format_exc(),
                "GeoAI",
                level=Qgis.Critical,
            )
            self._notify("La reprojection a échoué.", Qgis.Critical, duration=6)
            return ""

        output_layer = result.get("OUTPUT")
        if output_layer is None:
            return ""

        output_layer.setName(f"{layer.name()}_{target_crs.authid().replace(':', '_')}")
        QgsProject.instance().addMapLayer(output_layer)
        self._notify(f"Couche reprojetée créée : {output_layer.name()}.", Qgis.Success)
        return output_layer.name()

    @BridgeSlot(str, result=str)
    def addServiceLayer(self, config_json):
        try:
            config = json.loads(config_json) if config_json else {}
        except json.JSONDecodeError:
            message = "Configuration de service distante invalide."
            self._notify(message, Qgis.Warning)
            return message

        try:
            layer = self._create_service_layer(config)
        except Exception as exc:
            message = f"Impossible de préparer le service distant : {exc}"
            self._notify(message, Qgis.Warning, duration=6)
            return message

        if self._add_layer_to_project(layer, config.get("name")) is None:
            reason = self._layer_error_message(layer)
            message = "Le service distant n'a pas pu être chargé dans QGIS."
            if reason:
                message = f"{message} Cause: {reason}"
            self._notify(message, Qgis.Warning, duration=6)
            return message

        message = f"Service ajouté : {layer.name()}."
        self._notify(message, Qgis.Success)
        return message

    @BridgeSlot(str, str, result=str)
    def addRasterFile(self, file_path, layer_name):
        file_path = str(file_path or "").strip()
        if not file_path or not Path(file_path).exists():
            message = "Fichier raster introuvable."
            self._notify(message, Qgis.Warning)
            return message

        final_name = str(layer_name or "").strip() or Path(file_path).stem
        layer = QgsRasterLayer(file_path, final_name)
        if self._add_layer_to_project(layer, final_name) is None:
            message = "Le raster n'a pas pu être chargé."
            self._notify(message, Qgis.Warning)
            return message

        message = f"Raster chargé : {final_name}."
        self._notify(message, Qgis.Success)
        return message

    @BridgeSlot(str, str, result=str)
    def addGeoJsonLayer(self, geojson_text, layer_name):
        geojson_text = str(geojson_text or "").strip()
        if not geojson_text:
            message = "GeoJSON vide."
            self._notify(message, Qgis.Warning)
            return message

        try:
            parsed = json.loads(geojson_text)
            normalized_geojson = json.dumps(parsed, ensure_ascii=False)
        except Exception:
            message = "GeoJSON invalide."
            self._notify(message, Qgis.Warning)
            return message

        final_name = str(layer_name or "").strip() or "GeoJSON"
        file_path = self._write_temp_geojson(normalized_geojson, final_name)
        layer = QgsVectorLayer(file_path, final_name, "ogr")
        if self._add_layer_to_project(layer, final_name) is None:
            message = "Le GeoJSON n'a pas pu etre charge."
            self._notify(message, Qgis.Warning)
            return message

        message = f"Couche GeoJSON ajoutee : {final_name}."
        self._notify(message, Qgis.Success)
        return message

    @BridgeSlot(str, str, result=str)
    def applyParcelStylePreset(self, layer_ref, preset_id):
        layer = self._find_layer(layer_ref)
        if not isinstance(layer, QgsVectorLayer):
            message = "Couche vectorielle introuvable pour appliquer un style."
            self._notify(message, Qgis.Warning)
            return message

        preset = str(preset_id or "").strip().lower() or "cadastre"

        if layer.geometryType() == QgsWkbTypes.PolygonGeometry:
            symbol_props = {
                "outline_style": "solid",
                "outline_width": "0.8",
            }
            if preset == "focus":
                symbol_props.update(
                    {
                        "color": "255,203,70,55",
                        "outline_color": "255,189,46,255",
                    }
                )
            else:
                symbol_props.update(
                    {
                        "color": "46,212,191,38",
                        "outline_color": "76,99,255,255",
                    }
                )
            symbol = QgsFillSymbol.createSimple(symbol_props)
        elif layer.geometryType() == QgsWkbTypes.LineGeometry:
            symbol = QgsLineSymbol.createSimple(
                {
                    "line_color": "76,99,255,255",
                    "line_width": "0.9",
                }
            )
        else:
            message = "Le preset cadastral cible principalement les couches polygones ou lignes."
            self._notify(message, Qgis.Warning)
            return message

        layer.setRenderer(QgsSingleSymbolRenderer(symbol))
        self._refresh_layer_rendering(layer)
        message = f"Style applique a {layer.name()}."
        self._notify(message, Qgis.Success)
        return message

    @BridgeSlot(str, str, bool, result=str)
    def setLayerLabels(self, layer_ref, field_name, enabled):
        layer = self._find_layer(layer_ref)
        if not isinstance(layer, QgsVectorLayer):
            message = "Couche vectorielle introuvable pour les etiquettes."
            self._notify(message, Qgis.Warning)
            return message

        if not enabled:
            layer.setLabelsEnabled(False)
            self._refresh_layer_rendering(layer)
            message = f"Etiquettes desactivees sur {layer.name()}."
            self._notify(message, Qgis.Success)
            return message

        final_field_name = str(field_name or "").strip() or self._guess_label_field(layer)
        if not final_field_name or layer.fields().indexOf(final_field_name) < 0:
            message = "Aucun champ valide pour creer les etiquettes."
            self._notify(message, Qgis.Warning)
            return message

        label_settings = QgsPalLayerSettings()
        label_settings.fieldName = final_field_name
        label_settings.enabled = True
        if layer.geometryType() == QgsWkbTypes.PointGeometry:
            label_settings.placement = QgsPalLayerSettings.AroundPoint
        elif layer.geometryType() == QgsWkbTypes.LineGeometry:
            label_settings.placement = QgsPalLayerSettings.Line
        else:
            label_settings.placement = QgsPalLayerSettings.Horizontal

        text_format = QgsTextFormat()
        text_format.setFont(QFont("Segoe UI", 10, QFont.DemiBold))
        text_format.setSize(9.5)
        text_format.setColor(QColor("#f8fafc"))
        buffer_settings = QgsTextBufferSettings()
        buffer_settings.setEnabled(True)
        buffer_settings.setColor(QColor("#111827"))
        buffer_settings.setSize(1.1)
        text_format.setBuffer(buffer_settings)
        label_settings.setFormat(text_format)

        layer.setLabeling(QgsVectorLayerSimpleLabeling(label_settings))
        layer.setLabelsEnabled(True)
        self._refresh_layer_rendering(layer)
        message = f"Etiquettes activees sur {layer.name()} avec le champ {final_field_name}."
        self._notify(message, Qgis.Success)
        return message

    @BridgeSlot(str, str, str, result=str)
    def splitSelectedLayerByLine(self, layer_ref, line_wkt, output_name):
        layer = self._find_layer(layer_ref)
        if not isinstance(layer, QgsVectorLayer):
            message = "Couche vectorielle introuvable pour la decoupe."
            self._notify(message, Qgis.Warning)
            return message
        if layer.geometryType() != QgsWkbTypes.PolygonGeometry:
            message = "La decoupe par ligne est reservee aux couches polygonales."
            self._notify(message, Qgis.Warning)
            return message
        if layer.selectedFeatureCount() <= 0:
            message = "Selectionne au moins une entite avant de lancer la decoupe."
            self._notify(message, Qgis.Warning)
            return message

        split_geometry = QgsGeometry.fromWkt(str(line_wkt or "").strip())
        if split_geometry is None or split_geometry.isNull() or split_geometry.isEmpty():
            message = "Ligne de decoupe invalide."
            self._notify(message, Qgis.Warning)
            return message

        split_layer = QgsVectorLayer(
            f"LineString?crs={layer.crs().authid()}",
            "geoai_split_line",
            "memory",
        )
        split_provider = split_layer.dataProvider()
        split_provider.addAttributes([QgsField("id", QVariant.Int)])
        split_layer.updateFields()
        split_feature = QgsFeature(split_layer.fields())
        split_feature.setAttributes([1])
        split_feature.setGeometry(split_geometry)
        split_provider.addFeatures([split_feature])
        split_layer.updateExtents()

        try:
            selected_result = processing.run(
                "native:saveselectedfeatures",
                {
                    "INPUT": layer,
                    "OUTPUT": "memory:",
                },
            )
            selected_layer = selected_result.get("OUTPUT")
            split_result = processing.run(
                "native:splitwithlines",
                {
                    "INPUT": selected_layer,
                    "LINES": split_layer,
                    "OUTPUT": "memory:",
                },
            )
        except Exception:
            QgsMessageLog.logMessage(
                traceback.format_exc(),
                "GeoAI",
                level=Qgis.Critical,
            )
            message = "La decoupe des entites selectionnees a echoue."
            self._notify(message, Qgis.Critical, duration=6)
            return message

        output_layer = split_result.get("OUTPUT")
        if output_layer is None:
            message = "Aucune couche de sortie n'a ete produite."
            self._notify(message, Qgis.Warning)
            return message

        final_output_name = str(output_name or "").strip() or f"{layer.name()}_split"
        output_layer.setName(final_output_name)
        QgsProject.instance().addMapLayer(output_layer)
        self._refresh_layer_rendering(output_layer)
        message = f"Couche decoupee creee : {final_output_name}."
        self._notify(message, Qgis.Success)
        return message

    @BridgeSlot(str, str, str, str, result=str)
    def calculateRasterFormula(self, layer_ids_json, formula, output_name, output_path):
        try:
            layer_ids = json.loads(layer_ids_json) if layer_ids_json else []
        except json.JSONDecodeError:
            layer_ids = []

        if not isinstance(layer_ids, list):
            layer_ids = []

        raster_layers = []
        for layer_ref in layer_ids:
            layer = self._ensure_raster_layer(layer_ref)
            if layer is None:
                message = f"Raster introuvable ou invalide: {layer_ref}"
                self._notify(message, Qgis.Warning)
                return ""
            raster_layers.append(layer)

        if not formula:
            self._notify("La formule raster est requise.", Qgis.Warning)
            return ""

        final_output_name = str(output_name or "").strip() or "Raster_calcule"

        try:
            payload = self._run_raster_calculator(
                raster_layers,
                str(formula).strip(),
                final_output_name,
                str(output_path or "").strip(),
            )
        except Exception:
            QgsMessageLog.logMessage(
                traceback.format_exc(),
                "GeoAI",
                level=Qgis.Critical,
            )
            self._notify("Le calcul raster a échoué.", Qgis.Critical, duration=6)
            return ""

        self._notify(f"Raster calculé créé : {payload['outputLayerName']}.", Qgis.Success)
        return json.dumps(payload, ensure_ascii=False)

    @BridgeSlot(str, str, str, result=str)
    def mergeRasterBands(self, layer_ids_json, output_name, output_path):
        try:
            layer_ids = json.loads(layer_ids_json) if layer_ids_json else []
        except json.JSONDecodeError:
            layer_ids = []

        if not isinstance(layer_ids, list):
            layer_ids = []

        raster_layers = []
        for layer_ref in layer_ids:
            layer = self._ensure_raster_layer(layer_ref)
            if layer is None:
                message = f"Raster introuvable ou invalide: {layer_ref}"
                self._notify(message, Qgis.Warning)
                return ""
            raster_layers.append(layer)

        final_output_name = str(output_name or "").strip() or "Fusion_biannuelle"

        try:
            payload = self._run_raster_band_merge(
                raster_layers,
                final_output_name,
                str(output_path or "").strip(),
            )
        except Exception:
            QgsMessageLog.logMessage(
                traceback.format_exc(),
                "GeoSylva AI",
                level=Qgis.Critical,
            )
            self._notify("La fusion raster a échoué.", Qgis.Critical, duration=6)
            return ""

        self._notify(
            f"Fusion multi-bandes créée : {payload['outputLayerName']}.",
            Qgis.Success,
        )
        return json.dumps(payload, ensure_ascii=False)

    @BridgeSlot(str, float, float, str, str, bool, result=str)
    def createInventoryGrid(
        self,
        layer_ref,
        cell_width,
        cell_height,
        grid_name,
        centroids_name,
        clip_to_source,
    ):
        layer = self._find_layer(layer_ref)
        if layer is None:
            self._notify("Couche source introuvable pour la grille.", Qgis.Warning)
            return ""

        final_grid_name = str(grid_name or "").strip() or f"{layer.name()}_grille"
        final_centroids_name = (
            str(centroids_name or "").strip() or f"{final_grid_name}_centroides"
        )

        try:
            payload = self._run_inventory_grid(
                layer,
                cell_width,
                cell_height,
                final_grid_name,
                final_centroids_name,
                bool(clip_to_source),
            )
        except Exception:
            QgsMessageLog.logMessage(
                traceback.format_exc(),
                "GeoSylva AI",
                level=Qgis.Critical,
            )
            self._notify(
                "La creation du dispositif d'inventaire a échoué.",
                Qgis.Critical,
                duration=6,
            )
            return ""

        self._notify(
            f"Dispositif d'inventaire créé : {payload['gridLayerName']} + {payload['centroidLayerName']}.",
            Qgis.Success,
        )
        return json.dumps(payload, ensure_ascii=False)

    @BridgeSlot(str, str, str, str, bool, result=str)
    def calculateMnh(self, mns_layer_ref, mnt_layer_ref, output_name, output_path, clamp_negative):
        mns_layer = self._ensure_raster_layer(mns_layer_ref)
        mnt_layer = self._ensure_raster_layer(mnt_layer_ref)
        if mns_layer is None or mnt_layer is None:
            self._notify("MNS ou MNT introuvable.", Qgis.Warning)
            return ""

        formula = "(A-B)*(A>B)" if clamp_negative else "A-B"
        final_output_name = str(output_name or "").strip() or "MNH"

        try:
            payload = self._run_raster_calculator(
                [mns_layer, mnt_layer],
                formula,
                final_output_name,
                str(output_path or "").strip(),
            )
        except Exception:
            QgsMessageLog.logMessage(
                traceback.format_exc(),
                "GeoAI",
                level=Qgis.Critical,
            )
            self._notify("Le calcul du MNH a échoué.", Qgis.Critical, duration=6)
            return ""

        self._notify(f"MNH créé : {payload['outputLayerName']}.", Qgis.Success)
        return json.dumps(payload, ensure_ascii=False)

    def _execute_script_payload(self, script, require_confirmation=True):
        if require_confirmation:
            message_box = QMessageBox(self.iface.mainWindow())
            message_box.setIcon(QMessageBox.Warning)
            message_box.setWindowTitle("GeoSylva AI")
            message_box.setText("Confirmer l'exécution du script PyQGIS ?")
            message_box.setInformativeText(
                "Le code proposé par l'IA va s'exécuter dans votre session QGIS."
            )
            message_box.setDetailedText(script)
            message_box.setStandardButtons(QMessageBox.Ok | QMessageBox.Cancel)
            message_box.setDefaultButton(QMessageBox.Cancel)

            if message_box.exec() != QMessageBox.Ok:
                message = "Exécution annulée."
                self._notify(message, Qgis.Warning)
                return {
                    "ok": False,
                    "message": message,
                    "traceback": "",
                }

        context = {
            "__builtins__": __builtins__,
            "iface": self.iface,
            "processing": processing,
            "Qgis": Qgis,
            "QgsCoordinateReferenceSystem": QgsCoordinateReferenceSystem,
            "QgsMessageLog": QgsMessageLog,
            "QgsProject": QgsProject,
            "QgsVectorLayer": QgsVectorLayer,
        }

        try:
            exec(script, context, context)
        except Exception as exc:
            error_message = traceback.format_exc()
            QgsMessageLog.logMessage(
                f"Erreur script IA :\n{error_message}",
                "GeoSylva AI",
                level=Qgis.Critical,
            )
            message = f"Erreur lors de l'exécution : {exc}"
            self._notify(message, Qgis.Critical, duration=6)
            return {
                "ok": False,
                "message": message,
                "traceback": error_message,
            }

        message = "Script exécuté avec succès."
        self._notify(message, Qgis.Success)
        return {
            "ok": True,
            "message": message,
            "traceback": "",
        }

    def _execute_script(self, script, require_confirmation=True):
        return self._execute_script_payload(
            script,
            require_confirmation=require_confirmation,
        )["message"]

    @BridgeSlot(str, bool, result=str)
    def runScriptDetailed(self, script, require_confirmation=True):
        return json.dumps(
            self._execute_script_payload(
                script,
                require_confirmation=require_confirmation,
            ),
            ensure_ascii=False,
        )

    @BridgeSlot(str, result=str)
    def runScript(self, script):
        return self._execute_script(script, require_confirmation=True)

    @BridgeSlot(str, result=str)
    def runScriptDirect(self, script):
        return self._execute_script(script, require_confirmation=False)

    # ═══════════════════════════════════════════════════════════════════════════════
    # Fonctions pour l'installation et la gestion d'Ollama
    # ═══════════════════════════════════════════════════════════════════════════════

    @BridgeSlot(result=str)
    def getSystemCapabilities(self):
        """Retourne les capacités du système pour Ollama"""
        if system_capabilities is None:
            return json.dumps({"error": "Module system_capabilities non disponible"})
        return json.dumps(system_capabilities.to_dict())

    @BridgeSlot(result=str)
    def getOllamaStatus(self):
        """Retourne le statut d'Ollama"""
        if ollama_installer is None:
            return json.dumps({
                "error": "Module ollama_installer non disponible"
            })
        
        return json.dumps({
            "installed": ollama_installer.is_installed(),
            "running": ollama_installer.is_running(),
            "installed_models": [m["name"] for m in ollama_installer.get_installed_models()],
        })

    @BridgeSlot(str, result=str)
    def installOllamaModel(self, model_name):
        """Installe un modèle Ollama (sans callback de progression pour l'instant)"""
        if ollama_installer is None:
            return json.dumps({"success": False, "error": "Module ollama_installer non disponible"})
        
        try:
            success = ollama_installer.install_model(model_name)
            return json.dumps({"success": success})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    @BridgeSlot(str, result=str)
    def removeOllamaModel(self, model_name):
        """Supprime un modèle Ollama"""
        if ollama_installer is None:
            return json.dumps({"success": False, "error": "Module ollama_installer non disponible"})
        
        try:
            success = ollama_installer.remove_model(model_name)
            return json.dumps({"success": success})
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})


class MainThreadExecutor(QObject):
    execute_requested = pyqtSignal(object)

    def __init__(self):
        super().__init__()
        self.execute_requested.connect(self._execute, Qt.QueuedConnection)

    @pyqtSlot(object)
    def _execute(self, request):
        try:
            request["result"] = request["callable"]()
        except Exception as exc:
            request["error"] = exc
            request["traceback"] = traceback.format_exc()
        finally:
            request["event"].set()

    def run(self, callback, timeout=15):
        request = {
            "callable": callback,
            "event": threading.Event(),
        }
        self.execute_requested.emit(request)
        if not request["event"].wait(timeout):
            raise TimeoutError("L'appel QGIS a expiré.")

        if "error" in request:
            raise RuntimeError(request.get("traceback") or str(request["error"]))

        return request.get("result")


class ThreadedAssetServer:
    def __init__(self, directory, bridge, executor):
        self.directory = directory
        self.bridge = bridge
        self.executor = executor
        self.httpd = None
        self.thread = None
        self.port = None

    def _send_json(self, handler, status_code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        handler.send_response(status_code)
        handler.send_header("Content-Type", "application/json; charset=utf-8")
        handler.send_header("Content-Length", str(len(body)))
        handler.send_header("Cache-Control", "no-store")
        handler.end_headers()
        handler.wfile.write(body)

    def _read_json_body(self, handler):
        length = int(handler.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}

        raw_body = handler.rfile.read(length)
        if not raw_body:
            return {}

        try:
            return json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def _bridge_call(self, method_name, *args):
        method = getattr(self.bridge, method_name)
        return self.executor.run(lambda: method(*args))

    def _handle_api_request(self, handler, request_method):
        parsed = urlparse(handler.path)
        route = parsed.path
        query = parse_qs(parsed.query)
        body = self._read_json_body(handler) if request_method == "POST" else {}

        try:
            if route == "/api/qgis/health":
                self._send_json(handler, 200, {"ok": True})
                return True

            if route == "/api/qgis/getLayersList":
                result = self._bridge_call("getLayersList")
            elif route == "/api/qgis/getLayersCatalog":
                result = self._bridge_call("getLayersCatalog")
            elif route == "/api/qgis/getLayerFields":
                result = self._bridge_call(
                    "getLayerFields",
                    query.get("layerId", [""])[0],
                )
            elif route == "/api/qgis/getLayerDiagnostics":
                result = self._bridge_call(
                    "getLayerDiagnostics",
                    query.get("layerId", [""])[0],
                )
            elif route == "/api/qgis/getLayerStatistics":
                result = self._bridge_call(
                    "getLayerStatistics",
                    query.get("layerId", [""])[0],
                    query.get("field", [""])[0],
                )
            elif route == "/api/qgis/openLayers":
                result = self._bridge_call("openLayers")
            elif route == "/api/qgis/openSettings":
                result = self._bridge_call("openSettings")
            elif route == "/api/qgis/pickFile":
                result = self._bridge_call(
                    "pickFile",
                    body.get("fileFilter", ""),
                    body.get("title", ""),
                )
            elif route == "/api/qgis/filterLayer":
                result = self._bridge_call(
                    "filterLayer",
                    body.get("layerId", ""),
                    body.get("subsetString", ""),
                )
            elif route == "/api/qgis/setLayerVisibility":
                result = self._bridge_call(
                    "setLayerVisibility",
                    body.get("layerId", ""),
                    bool(body.get("visible", True)),
                )
            elif route == "/api/qgis/setLayerOpacity":
                result = self._bridge_call(
                    "setLayerOpacity",
                    body.get("layerId", ""),
                    float(body.get("opacity", 1.0)),
                )
            elif route == "/api/qgis/zoomToLayer":
                result = self._bridge_call(
                    "zoomToLayer",
                    body.get("layerId", ""),
                )
            elif route == "/api/qgis/reprojectLayer":
                result = self._bridge_call(
                    "reprojectLayer",
                    body.get("layerId", ""),
                    body.get("targetCrs", ""),
                )
            elif route == "/api/qgis/addServiceLayer":
                result = self._bridge_call(
                    "addServiceLayer",
                    body.get("config", ""),
                )
            elif route == "/api/qgis/addRasterFile":
                result = self._bridge_call(
                    "addRasterFile",
                    body.get("filePath", ""),
                    body.get("layerName", ""),
                )
            elif route == "/api/qgis/addGeoJsonLayer":
                result = self._bridge_call(
                    "addGeoJsonLayer",
                    body.get("geojson", ""),
                    body.get("layerName", ""),
                )
            elif route == "/api/qgis/calculateRasterFormula":
                result = self._bridge_call(
                    "calculateRasterFormula",
                    body.get("layerIds", "[]"),
                    body.get("formula", ""),
                    body.get("outputName", ""),
                    body.get("outputPath", ""),
                )
            elif route == "/api/qgis/mergeRasterBands":
                result = self._bridge_call(
                    "mergeRasterBands",
                    body.get("layerIds", "[]"),
                    body.get("outputName", ""),
                    body.get("outputPath", ""),
                )
            elif route == "/api/qgis/createInventoryGrid":
                result = self._bridge_call(
                    "createInventoryGrid",
                    body.get("layerRef", body.get("layerId", "")),
                    float(body.get("cellWidth", 0) or 0),
                    float(body.get("cellHeight", 0) or 0),
                    body.get("gridName", ""),
                    body.get("centroidsName", ""),
                    bool(body.get("clipToSource", True)),
                )
            elif route == "/api/qgis/calculateMnh":
                result = self._bridge_call(
                    "calculateMnh",
                    body.get("mnsLayerId", ""),
                    body.get("mntLayerId", ""),
                    body.get("outputName", ""),
                    body.get("outputPath", ""),
                    bool(body.get("clampNegative", True)),
                )
            elif route == "/api/qgis/applyParcelStylePreset":
                result = self._bridge_call(
                    "applyParcelStylePreset",
                    body.get("layerId", ""),
                    body.get("presetId", ""),
                )
            elif route == "/api/qgis/setLayerLabels":
                result = self._bridge_call(
                    "setLayerLabels",
                    body.get("layerId", ""),
                    body.get("fieldName", ""),
                    bool(body.get("enabled", True)),
                )
            elif route == "/api/qgis/splitSelectedLayerByLine":
                result = self._bridge_call(
                    "splitSelectedLayerByLine",
                    body.get("layerId", ""),
                    body.get("lineWkt", ""),
                    body.get("outputName", ""),
                )
            elif route == "/api/qgis/runScript":
                result = self._bridge_call(
                    "runScript",
                    body.get("script", ""),
                )
            elif route == "/api/qgis/runScriptDirect":
                result = self._bridge_call(
                    "runScriptDirect",
                    body.get("script", ""),
                )
            elif route == "/api/qgis/runScriptDetailed":
                result = self._bridge_call(
                    "runScriptDetailed",
                    body.get("script", ""),
                    bool(body.get("requireConfirmation", True)),
                )
            else:
                return False
        except Exception as exc:
            self._send_json(
                handler,
                500,
                {
                    "ok": False,
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                },
            )
            return True

        self._send_json(handler, 200, {"ok": True, "result": result})
        return True

    def start(self):
        if self.httpd is not None:
            return self.port

        server_instance = self

        class AssetRequestHandler(http.server.SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=server_instance.directory, **kwargs)

            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path.startswith("/api/qgis/"):
                    if server_instance._handle_api_request(self, "GET"):
                        return

                self.path = parsed.path
                super().do_GET()

            def do_POST(self):
                if server_instance._handle_api_request(self, "POST"):
                    return

                self.send_error(404)

            def log_message(self, format, *args):
                return

        class QuietThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
            daemon_threads = True
            allow_reuse_address = True

        self.httpd = QuietThreadingServer(("127.0.0.1", 0), AssetRequestHandler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return self.port

    def stop(self):
        if self.httpd is None:
            return

        self.httpd.shutdown()
        self.httpd.server_close()
        self.httpd = None
        self.thread = None
        self.port = None


class GeoAIAssistant:
    def __init__(self, iface):
        self.iface = iface
        self.action = None
        self.asset_server = None
        self.bridge = None
        self.channel = None
        self.dock = None
        self.view = None
        self.external_ui_url = None
        self.main_thread_executor = MainThreadExecutor()
        self.plugin_dir = os.path.dirname(__file__)
        self.debug_log = os.environ.get("GEOAI_PLUGIN_DEBUG_LOG")

    def _debug(self, message):
        if not self.debug_log:
            return

        with open(self.debug_log, "a", encoding="utf-8") as handle:
            handle.write(f"{message}\n")

    def _web_entrypoint(self):
        return os.path.join(self.plugin_dir, "web", "index.html")

    def _web_directory(self):
        return os.path.join(self.plugin_dir, "web")

    def _ensure_bridge(self):
        if self.bridge is None:
            self.bridge = QgisBridge(self.iface)

    def _ensure_asset_server(self):
        web_dir = self._web_directory()
        if not os.path.exists(self._web_entrypoint()):
            return None

        if self.asset_server is None:
            self._ensure_bridge()
            self.asset_server = ThreadedAssetServer(
                web_dir,
                self.bridge,
                self.main_thread_executor,
            )

        return self.asset_server.start()

    def _web_url(self, bridge_mode=None):
        port = self._ensure_asset_server()
        if port is None:
            return None

        page_name = os.environ.get("GEOAI_TEST_PAGE", "index.html")
        bridge_query = f"?bridge={bridge_mode}" if bridge_mode else ""
        return f"http://127.0.0.1:{port}/{page_name}{bridge_query}"

    def _open_external_ui(self):
        self.external_ui_url = self._web_url("http")
        if not self.external_ui_url:
            return False

        self._debug(f"external_ui:url={self.external_ui_url}")
        if os.environ.get("GEOAI_DISABLE_BROWSER_LAUNCH") != "1":
            QDesktopServices.openUrl(QUrl(self.external_ui_url))

        self.iface.messageBar().pushMessage(
            "GeoSylva AI",
            "Interface ouverte dans votre navigateur.",
            level=Qgis.Info,
            duration=5,
        )
        return True

    def _copy_to_clipboard(self, value):
        clipboard = QGuiApplication.clipboard()
        if clipboard is not None:
            clipboard.setText(value)
            self.iface.messageBar().pushMessage(
                "GeoSylva AI",
                "URL GeoSylva AI copiée dans le presse-papier.",
                level=Qgis.Success,
                duration=4,
            )

    def _create_external_fallback_widget(self, url, error):
        container = QWidget()
        container.setObjectName("geoaiFallbackContainer")
        container.setStyleSheet(
            """
            QWidget#geoaiFallbackContainer {
                background: #08111f;
            }
            QFrame#geoaiFallbackCard {
                background: qlineargradient(
                    x1: 0, y1: 0, x2: 1, y2: 1,
                    stop: 0 #0d1b2a,
                    stop: 0.55 #10253b,
                    stop: 1 #15334b
                );
                border: 1px solid rgba(140, 183, 255, 0.18);
                border-radius: 18px;
            }
            QLabel#geoaiHeroTitle {
                color: #f8fbff;
                font-size: 19px;
                font-weight: 700;
            }
            QLabel#geoaiHeroBody {
                color: rgba(235, 244, 255, 0.88);
                font-size: 12px;
                line-height: 1.45em;
            }
            QLabel#geoaiBadge {
                background: rgba(96, 165, 250, 0.16);
                color: #bfdbfe;
                border: 1px solid rgba(147, 197, 253, 0.18);
                border-radius: 999px;
                padding: 5px 10px;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
            }
            QLabel#geoaiSectionTitle {
                color: #dbeafe;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
            }
            QTextBrowser#geoaiUrlBox, QTextBrowser#geoaiDetailBox {
                background: rgba(5, 10, 18, 0.55);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                color: #f8fbff;
                padding: 10px;
                selection-background-color: #2563eb;
            }
            QPushButton#geoaiPrimaryButton {
                background: #0f6dff;
                color: white;
                border: none;
                border-radius: 12px;
                padding: 10px 14px;
                font-weight: 700;
            }
            QPushButton#geoaiPrimaryButton:hover {
                background: #1f7cff;
            }
            QPushButton#geoaiSecondaryButton {
                background: rgba(255, 255, 255, 0.06);
                color: #e5efff;
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 12px;
                padding: 10px 14px;
                font-weight: 600;
            }
            QPushButton#geoaiSecondaryButton:hover {
                background: rgba(255, 255, 255, 0.1);
            }
            """
        )

        root_layout = QVBoxLayout(container)
        root_layout.setContentsMargins(18, 18, 18, 18)
        root_layout.setSpacing(16)

        card = QFrame()
        card.setObjectName("geoaiFallbackCard")
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(18, 18, 18, 18)
        card_layout.setSpacing(14)

        hero_layout = QHBoxLayout()
        hero_layout.setSpacing(14)

        icon_label = QLabel()
        icon_label.setFixedSize(164, 58)
        icon_label.setPixmap(QIcon(os.path.join(self.plugin_dir, "logo.png")).pixmap(164, 58))
        hero_layout.addWidget(icon_label, 0, Qt.AlignTop)

        hero_text_layout = QVBoxLayout()
        hero_text_layout.setSpacing(6)

        badge = QLabel("Mode navigateur")
        badge.setObjectName("geoaiBadge")
        badge.setAlignment(Qt.AlignCenter)
        hero_text_layout.addWidget(badge, 0, Qt.AlignLeft)

        title = QLabel("GeoSylva AI fonctionne, mais via le navigateur externe")
        title.setWordWrap(True)
        title.setObjectName("geoaiHeroTitle")
        hero_text_layout.addWidget(title)

        body = QLabel(
            "Le moteur Web Qt embarqué de cette installation QGIS n'est pas disponible. "
            "L'interface GeoSylva AI a donc été ouverte automatiquement dans votre navigateur, "
            "avec le bridge local QGIS déjà actif."
        )
        body.setWordWrap(True)
        body.setObjectName("geoaiHeroBody")
        hero_text_layout.addWidget(body)

        hero_layout.addLayout(hero_text_layout, 1)
        card_layout.addLayout(hero_layout)

        url_title = QLabel("URL active")
        url_title.setObjectName("geoaiSectionTitle")
        card_layout.addWidget(url_title)

        url_box = QTextBrowser()
        url_box.setObjectName("geoaiUrlBox")
        url_box.setOpenExternalLinks(True)
        url_box.setMaximumHeight(74)
        url_box.setHtml(
            f'<a href="{url}">{url}</a>' if url else "<span>URL indisponible</span>"
        )
        card_layout.addWidget(url_box)

        actions_layout = QHBoxLayout()
        actions_layout.setSpacing(10)

        open_button = QPushButton("Ouvrir GeoSylva AI")
        open_button.setObjectName("geoaiPrimaryButton")
        open_button.setEnabled(bool(url))
        open_button.clicked.connect(lambda: QDesktopServices.openUrl(QUrl(url)))
        actions_layout.addWidget(open_button)

        copy_button = QPushButton("Copier l'URL")
        copy_button.setObjectName("geoaiSecondaryButton")
        copy_button.setEnabled(bool(url))
        copy_button.clicked.connect(lambda: self._copy_to_clipboard(url))
        actions_layout.addWidget(copy_button)

        toggle_button = QPushButton("Voir le détail technique")
        toggle_button.setObjectName("geoaiSecondaryButton")
        actions_layout.addWidget(toggle_button)
        card_layout.addLayout(actions_layout)

        detail_box = QTextBrowser()
        detail_box.setObjectName("geoaiDetailBox")
        detail_box.setVisible(False)
        detail_box.setMinimumHeight(180)
        detail_box.setPlainText(str(error) if error else "Aucun détail supplémentaire.")
        card_layout.addWidget(detail_box)

        def toggle_details():
            is_visible = not detail_box.isVisible()
            detail_box.setVisible(is_visible)
            toggle_button.setText(
                "Masquer le détail technique" if is_visible else "Voir le détail technique"
            )

        toggle_button.clicked.connect(toggle_details)

        root_layout.addWidget(card)
        root_layout.addStretch(1)
        return container

    def _attach_web_channel(self, ok):
        self._debug(f"attach_web_channel:start:{ok}")
        if not ok or self.view is None or self.channel is None:
            return

        self.view.page().setWebChannel(self.channel)
        self._debug("attach_web_channel:webchannel_set")
        self.view.page().runJavaScript(
            """
            if (typeof QWebChannel !== 'undefined' && window.qt && window.qt.webChannelTransport) {
              new QWebChannel(window.qt.webChannelTransport, function(channel) {
                window.qgis = channel.objects.qgis;
              });
            }
            """
        )
        self._debug("attach_web_channel:init_js_sent")

    def _create_dock(self):
        self._debug("create_dock:start")
        self.dock = QDockWidget("GeoSylva AI", self.iface.mainWindow())
        self._debug("create_dock:dock_created")
        self.dock.setAllowedAreas(Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea)
        self.dock.setMinimumWidth(420)
        self.dock.setWindowIcon(QIcon(os.path.join(self.plugin_dir, "icon.png")))

        container = QWidget()
        self._debug("create_dock:container_created")
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)

        if QWebEngineView is None or QWebChannel is None:
            self._open_external_ui()
            self._debug(f"create_dock:web_import_error={WEB_IMPORT_ERROR!r}")
            layout.addWidget(
                self._create_external_fallback_widget(
                    self.external_ui_url or "",
                    WEB_IMPORT_ERROR,
                )
            )
            self.dock.setWidget(container)
            self.iface.addDockWidget(Qt.RightDockWidgetArea, self.dock)
            self._debug("create_dock:web_runtime_unavailable")
            return

        self.view = QWebEngineView()
        self._debug("create_dock:view_created")
        self.channel = QWebChannel()
        self._debug("create_dock:channel_created")
        self._ensure_bridge()
        self._debug("create_dock:bridge_created")
        self.channel.registerObject("qgis", self.bridge)
        self._debug("create_dock:object_registered")
        self.view.loadFinished.connect(self._attach_web_channel)
        self._debug("create_dock:load_signal_connected")

        entrypoint = self._web_entrypoint()
        self._debug(f"create_dock:entrypoint={entrypoint}")
        web_url = self._web_url()
        if web_url is not None:
            self._debug(f"create_dock:web_url={web_url}")
            self.view.setUrl(WebQUrl(web_url))
            self._debug("create_dock:url_set")
        else:
            self.view.setHtml(
                """
                <html>
                  <body style="font-family: sans-serif; padding: 24px; background: #131314; color: #e3e3e3;">
                    <h2>Build web introuvable</h2>
                    <p>Exécutez <code>npm install</code> puis <code>npm run build</code> pour générer le dossier <code>qgis_plugin/web</code>.</p>
                  </body>
                </html>
                """,
                WebQUrl.fromLocalFile(self.plugin_dir + os.sep),
            )
            self._debug("create_dock:html_fallback_set")

        layout.addWidget(self.view)
        self._debug("create_dock:view_added")
        self.dock.setWidget(container)
        self._debug("create_dock:widget_set")
        self.iface.addDockWidget(Qt.RightDockWidgetArea, self.dock)
        self._debug("create_dock:dock_added")

    def initGui(self):
        self._debug("initGui:start")
        icon_path = os.path.join(self.plugin_dir, "icon.png")
        
        # Action principale avec configuration
        action_name = ICON_CONFIG.get("name", "GeoSylva AI")
        action_tooltip = ICON_CONFIG.get("tooltip", "Ouvrir l'assistant IA GeoSylva")
        action_status_tip = ICON_CONFIG.get("status_tip", "Assistant IA pour QGIS")
        action_whats_this = ICON_CONFIG.get("whats_this", "")
        action_shortcut = ICON_CONFIG.get("shortcut", "Ctrl+Shift+G")
        
        self.action = QAction(QIcon(icon_path), action_name, self.iface.mainWindow())
        self.action.setObjectName("GeoAIAssistantAction")
        self.action.setToolTip(action_tooltip)
        self.action.setStatusTip(action_status_tip)
        if action_whats_this:
            self.action.setWhatsThis(action_whats_this)
        self.action.triggered.connect(self.run)
        
        # Raccourci clavier
        if action_shortcut:
            self.action.setShortcut(action_shortcut)
            shortcut_context = ICON_CONFIG.get("shortcut_context", "window")
            if shortcut_context == "window":
                self.action.setShortcutContext(Qt.WindowShortcut)
            else:
                self.action.setShortcutContext(Qt.ApplicationShortcut)
        
        # Ajouter à la barre d'outils
        self.iface.addToolBarIcon(self.action)
        
        # Ajouter au menu avec configuration
        menu_name = MENU_CONFIG.get("name", "&GeoSylva AI")
        use_submenu = MENU_CONFIG.get("submenu", True)
        show_icon = MENU_CONFIG.get("icon", True)
        
        self.menu = self.iface.pluginMenu()
        
        if use_submenu:
            self.geoai_menu = self.menu.addMenu(menu_name)
            self.geoai_menu.setObjectName("GeoAIMenu")
            if show_icon:
                self.geoai_menu.setIcon(QIcon(icon_path))
            
            # Action principale dans le sous-menu
            self.geoai_menu.addAction(self.action)
            
            # Ajouter les items du menu
            menu_items = MENU_CONFIG.get("items", [])
            for item in menu_items:
                if item.get("separator"):
                    self.geoai_menu.addSeparator()
                else:
                    item_name = item.get("name", "")
                    item_tooltip = item.get("tooltip", "")
                    item_icon = item.get("icon", "")
                    item_shortcut = item.get("shortcut", "")
                    
                    if item_name == "Ouvrir":
                        # L'action principale est déjà ajoutée
                        continue
                    elif item_name == "Paramètres...":
                        self.settings_action = QAction(item_name, self.iface.mainWindow())
                        if item_icon and item_icon != "icon.png":
                            self.settings_action.setIcon(QIcon.fromTheme(item_icon))
                        self.settings_action.setToolTip(item_tooltip)
                        self.settings_action.triggered.connect(self._open_settings)
                        self.geoai_menu.addAction(self.settings_action)
                    elif item_name == "Aide & Documentation":
                        self.help_action = QAction(item_name, self.iface.mainWindow())
                        if item_icon:
                            self.help_action.setIcon(QIcon.fromTheme(item_icon))
                        self.help_action.setToolTip(item_tooltip)
                        self.help_action.triggered.connect(self._open_help)
                        self.geoai_menu.addAction(self.help_action)
                    elif item_name == "À propos":
                        self.about_action = QAction(item_name, self.iface.mainWindow())
                        if item_icon:
                            self.about_action.setIcon(QIcon.fromTheme(item_icon))
                        self.about_action.setToolTip(item_tooltip)
                        self.about_action.triggered.connect(self._open_about)
                        self.geoai_menu.addAction(self.about_action)
        else:
            # Ajouter directement au menu sans sous-menu
            self.iface.addPluginToMenu(menu_name, self.action)
        
        # Ajouter au menu Processing si configuré
        processing_config = getattr(self, 'PROCESSING_MENU_CONFIG', {})
        if processing_config.get("add", False):
            try:
                processing_menu = self.iface.processingMenu()
                if processing_menu:
                    if processing_config.get("separator_before", False):
                        processing_menu.addSeparator()
                    processing_menu.addAction(self.action)
            except Exception:
                pass
        
        self._debug("initGui:end")

    def run(self):
        self._debug("run:start")
        if self.dock is None:
            self._create_dock()

        self.dock.show()
        self._debug("run:dock_shown")
        self.dock.raise_()
        self._debug("run:end")
    
    def _open_settings(self):
        """Ouvre les paramètres du plugin"""
        self._debug("open_settings:start")

        # Ouvrir le dock et afficher un message
        if self.dock is None:
            self._create_dock()

        self.dock.show()
        self.dock.raise_()

        # Informer l'utilisateur que les paramètres sont dans l'interface web
        self.iface.messageBar().pushMessage(
            "GeoSylva AI",
            "Les paramètres sont accessibles depuis l'interface web (icône ⚙️ en bas à droite).",
            level=Qgis.Info,
            duration=5,
        )

        # Si le bridge est disponible, envoyer un signal pour ouvrir les paramètres
        if self.bridge and hasattr(self.bridge, 'open_settings'):
            try:
                self.bridge.open_settings()
                self._debug("open_settings:signal_sent")
            except Exception as e:
                self._debug(f"open_settings:signal_error={e}")

        self._debug("open_settings:end")
    
    def _open_help(self):
        """Ouvre la documentation"""
        self._debug("open_help:start")
        # Chercher le fichier README.md
        readme_path = os.path.join(self.plugin_dir, "README.md")
        if os.path.exists(readme_path):
            # Ouvrir avec le navigateur par défaut
            QDesktopServices.openUrl(QUrl.fromLocalFile(readme_path))
            self._debug("open_help:readme_opened")
        else:
            # Fallback: ouvrir la documentation en ligne
            QDesktopServices.openUrl(QUrl("https://github.com/geosylva/geoai-ai-qgis"))
            self.iface.messageBar().pushMessage(
                "GeoSylva AI",
                "Documentation en ligne ouverte dans votre navigateur.",
                level=Qgis.Info,
                duration=3,
            )
            self._debug("open_help:online_opened")
        self._debug("open_help:end")
    
    def _open_about(self):
        """Affiche la boîte de dialogue À propos"""
        self._debug("open_about:start")
        from qgis.PyQt.QtWidgets import QMessageBox
        
        about_text = """
        <h2>GeoSylva AI</h2>
        <p><b>Assistant IA pour QGIS</b></p>
        <p>GeoSylva AI est un assistant intelligent qui vous aide à accomplir 
        des tâches SIG complexes en langage naturel.</p>
        
        <h3>Fonctionnalités:</h3>
        <ul>
            <li>Commandes en langage naturel</li>
            <li>Gestion de couches QGIS</li>
            <li>Exécution de scripts PyQGIS</li>
            <li>Intégration avec OpenRouter, Google Gemini, Ollama</li>
        </ul>
        
        <h3>Raccourci clavier:</h3>
        <p>Ctrl+Shift+G pour ouvrir le panneau</p>
        
        <p><i>Version 2.0.0</i></p>
        """
        
        QMessageBox.about(
            self.iface.mainWindow(),
            "À propos de GeoSylva AI",
            about_text
        )
        self._debug("open_about:end")

    def unload(self):
        self._debug("unload:start")
        
        # Arrêter le serveur d'assets
        if self.asset_server is not None:
            self.asset_server.stop()
            self.asset_server = None

        # Supprimer le dock
        if self.dock is not None:
            self.iface.removeDockWidget(self.dock)
            self.dock.deleteLater()
            self.dock = None

        # Supprimer les actions du menu
        if hasattr(self, 'geoai_menu'):
            self.geoai_menu.clear()
            self.menu.removeAction(self.geoai_menu.menuAction())
            self.geoai_menu.deleteLater()
        
        # Supprimer l'action principale
        if self.action is not None:
            self.iface.removeToolBarIcon(self.action)
            self.iface.removePluginMenu("&GeoSylva AI", self.action)
            self.action.deleteLater()
            self.action = None
        
        # Nettoyer les autres actions
        if hasattr(self, 'settings_action'):
            self.settings_action.deleteLater()
        if hasattr(self, 'help_action'):
            self.help_action.deleteLater()
        if hasattr(self, 'about_action'):
            self.about_action.deleteLater()
        
        self._debug("unload:end")
