# -*- coding: utf-8 -*-
"""Tests de la reproduction de carte (legende -> QML), pur Python."""
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import map_repro as mr  # noqa: E402


def test_parse_legend_from_fenced_json():
    text = (
        "Voici la legende :\n```json\n"
        '[{"label":"Foret","color":"#228B22","geometry":"polygon"},'
        ' {"label":"Route","color":"#808080","geometry":"line"}]\n```\nVoila.'
    )
    legend = mr.parse_legend(text)
    assert len(legend) == 2
    assert legend[0] == {"label": "Foret", "color": "#228B22", "geometry": "polygon"}
    assert legend[1]["geometry"] == "line"


def test_parse_legend_tolerates_prose_and_keys_fr():
    text = '[{"classe":"Eau","couleur":"#1E90FF"}]'
    legend = mr.parse_legend(text)
    assert legend == [{"label": "Eau", "color": "#1E90FF", "geometry": "polygon"}]


def test_parse_legend_empty_on_garbage():
    assert mr.parse_legend("pas de json ici") == []
    assert mr.parse_legend("") == []


def test_hex_to_qgis_color():
    assert mr.hex_to_qgis_color("#228B22") == "34,139,34,255"
    assert mr.hex_to_qgis_color("228B22") == "34,139,34,255"
    assert mr.hex_to_qgis_color("#fff") == "255,255,255,255"
    assert mr.hex_to_qgis_color("xyz") == "0,0,0,255"   # non-hexadecimal
    assert mr.hex_to_qgis_color("") == "0,0,0,255"


def test_legend_to_qml_is_valid_xml_with_categories():
    legend = [
        {"label": "Foret", "color": "#228B22", "geometry": "polygon"},
        {"label": "Eau", "color": "#1E90FF", "geometry": "polygon"},
    ]
    qml = mr.legend_to_qml(legend, field="occupation")
    # XML valide ?
    root = ET.fromstring(qml[qml.index("<qgis"):])
    renderer = root.find("renderer-v2")
    assert renderer.get("type") == "categorizedSymbol"
    assert renderer.get("attr") == "occupation"
    cats = renderer.find("categories").findall("category")
    assert len(cats) == 2
    assert {c.get("label") for c in cats} == {"Foret", "Eau"}
    # couleur convertie presente
    assert "34,139,34,255" in qml
    assert "30,144,255,255" in qml


def test_legend_to_qml_line_and_point_symbols():
    qml_line = mr.legend_to_qml([{"label": "R", "color": "#000000", "geometry": "line"}])
    assert 'type="line"' in qml_line and "SimpleLine" in qml_line
    qml_pt = mr.legend_to_qml([{"label": "P", "color": "#000000", "geometry": "point"}])
    assert 'type="marker"' in qml_pt and "SimpleMarker" in qml_pt


def test_legend_to_qml_empty_legend_still_valid():
    qml = mr.legend_to_qml([])
    ET.fromstring(qml[qml.index("<qgis"):])  # ne leve pas
