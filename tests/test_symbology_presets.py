# -*- coding: utf-8 -*-
"""Tests de la base de symbologies institutionnelles francaises."""
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import symbology_presets as sp  # noqa: E402


def test_load_presets_has_french_institutions():
    ids = {p["id"] for p in sp.load_presets()}
    for expected in ("onf-peuplements", "ign-bdforet", "plu-zonage",
                     "cadastre-dgfip", "clc-occupation-sol", "ppri-inondation"):
        assert expected in ids


def test_list_presets_summary_shape():
    presets = sp.list_presets()
    onf = next(p for p in presets if p["id"] == "onf-peuplements")
    assert onf["institution"] == "ONF"
    assert onf["field"] == "essence"
    assert onf["categories"] >= 5


def test_get_preset_unknown_returns_none():
    assert sp.get_preset("inconnu") is None


def test_preset_to_qml_uses_values_and_colors():
    qml = sp.preset_to_qml("onf-peuplements")
    assert qml is not None
    root = ET.fromstring(qml[qml.index("<qgis"):])
    renderer = root.find("renderer-v2")
    assert renderer.get("attr") == "essence"
    cats = renderer.find("categories").findall("category")
    values = {c.get("value") for c in cats}
    assert "chene" in values        # valeur du champ (pas le label)
    labels = {c.get("label") for c in cats}
    assert "Chenaie" in labels
    assert "46,139,87,255" in qml   # #2E8B57 converti


def test_preset_to_qml_field_override():
    qml = sp.preset_to_qml("plu-zonage", field="zone_plu")
    root = ET.fromstring(qml[qml.index("<qgis"):])
    assert root.find("renderer-v2").get("attr") == "zone_plu"
    assert "U" in {c.get("value") for c in root.find("renderer-v2").find("categories")}


def test_preset_to_qml_unknown_returns_none():
    assert sp.preset_to_qml("inconnu") is None


def test_all_presets_have_valid_schema_and_qml():
    required_fields = {"id", "name", "geometry", "field", "categories"}
    for preset in sp.load_presets():
        assert required_fields.issubset(preset.keys()), f"champs manquants: {preset.get('id')}"
        assert isinstance(preset["categories"], list)
        assert preset["categories"], f"categories vides: {preset['id']}"
        for cat in preset["categories"]:
            assert "value" in cat, f"value manquant: {preset['id']}"
            assert "label" in cat, f"label manquant: {preset['id']}"
            assert "color" in cat, f"color manquant: {preset['id']}"
            assert cat["color"].startswith("#") and len(cat["color"]) == 7
        qml = sp.preset_to_qml(preset["id"])
        assert qml is not None, f"QML null pour {preset['id']}"
        assert "categorizedSymbol" in qml, f"categorizedSymbol absent dans QML: {preset['id']}"
