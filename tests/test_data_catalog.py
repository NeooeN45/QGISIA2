# -*- coding: utf-8 -*-
"""Tests du catalogue de donnees mondiales (pur Python, sans QGIS)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import data_catalog as dc  # noqa: E402

REQUIRED = {"id", "name", "category", "provider", "service_type", "url"}


def test_load_sources_non_empty():
    sources = dc.load_sources()
    assert len(sources) >= 15


def test_every_source_has_valid_schema():
    for s in dc.load_sources():
        assert REQUIRED.issubset(s.keys()), f"champs manquants: {s.get('id')}"
        assert s["service_type"] in dc.VALID_SERVICE_TYPES, s["id"]
        assert isinstance(s["url"], str) and s["url"].strip(), s["id"]


def test_ids_are_unique():
    ids = [s["id"] for s in dc.load_sources()]
    assert len(ids) == len(set(ids))


def test_get_source_found_and_missing():
    assert dc.get_source("osm-standard")["service_type"] == "XYZ"
    assert dc.get_source("inconnu") is None


def test_list_sources_summary_and_filter():
    alls = dc.list_sources()
    assert all(set(x.keys()) == {"id", "name", "category", "coverage", "provider"} for x in alls)
    sat = dc.list_sources(category="satellite")
    assert sat and all(x["category"] == "satellite" for x in sat)
    assert dc.list_sources(category="inexistante") == []


def test_build_service_config_xyz():
    cfg = dc.build_service_config(dc.get_source("osm-standard"))
    assert cfg["service_type"] == "XYZ"
    assert cfg["url"].startswith("https://")
    assert cfg["zmax"] == 19


def test_build_service_config_wms():
    cfg = dc.build_service_config(dc.get_source("esa-worldcover"))
    assert cfg["service_type"] == "WMS"
    assert cfg["layers"] == "WORLDCOVER_2021_MAP"
    assert cfg["format"] == "image/png"
    assert cfg["crs"] == "EPSG:3857"


def test_build_service_config_wmts():
    cfg = dc.build_service_config(dc.get_source("ign-plan"))
    assert cfg["service_type"] == "WMTS"
    assert cfg["layer"] == "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2"
    assert cfg["tileMatrixSet"] == "PM"


def test_build_service_config_wfs():
    cfg = dc.build_service_config(dc.get_source("ign-communes-wfs"))
    assert cfg["service_type"] == "WFS"
    assert cfg["layer"] == "ADMINEXPRESS-COG-CARTO.LATEST:commune"
    assert cfg["crs"] == "EPSG:4326"
    assert cfg["version"] == "2.0.0"


def test_catalog_has_vector_wfs_sources():
    wfs = [s for s in dc.load_sources() if s["service_type"] == "WFS"]
    assert len(wfs) >= 3
