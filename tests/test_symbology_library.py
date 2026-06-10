"""Tests pour symbology_library.py — pur Python, zéro dépendance QGIS."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import symbology_library as slib  # noqa: E402


class TestListByInstitution:
    def test_groups_presets_by_institution(self) -> None:
        groups = slib.list_by_institution()
        assert len(groups) > 0
        for inst, ids in groups.items():
            assert len(ids) > 0
            assert len(ids) == len(set(ids))


class TestListCategories:
    def test_returns_unique_categories(self) -> None:
        cats = slib.list_categories()
        assert len(cats) == len(set(cats))
        assert len(cats) > 0


class TestSearchPresets:
    def test_search_plu_finds_zonage(self) -> None:
        results = slib.search_presets("plu")
        ids = {r["id"] for r in results}
        assert "plu-zonage" in ids or "plu-sous-zones" in ids or "plui" in ids

    def test_search_insensitive_accented(self) -> None:
        results = slib.search_presets("brgm")
        ids = {r["id"] for r in results}
        assert "geologie-brgm" in ids or "hydrogeologie" in ids

    def test_search_no_results(self) -> None:
        results = slib.search_presets("xyznonsense")
        assert results == []


class TestGetPresetSummary:
    def test_known_preset(self) -> None:
        summary = slib.get_preset_summary("plu-zonage")
        assert summary is not None
        assert summary["id"] == "plu-zonage"
        assert summary["name"]
        assert summary["institution"]
        assert summary["field"]
        assert summary["n_categories"] > 0

    def test_unknown_preset(self) -> None:
        assert slib.get_preset_summary("inconnu") is None


class TestLoadedPresetsIntegrity:
    def test_all_presets_have_id_name_field(self) -> None:
        from symbology_presets import load_presets

        presets = load_presets()
        assert len(presets) >= 40
        for p in presets:
            assert p.get("id")
            assert p.get("name")
            assert p.get("institution")
            assert p.get("field")
            assert len(p.get("categories", [])) > 0

    def test_all_colors_valid_hex(self) -> None:
        import re
        from symbology_presets import load_presets

        for p in load_presets():
            for cat in p.get("categories", []):
                color = cat.get("color", "")
                assert color.startswith("#")
                assert len(color) in (4, 7)
                assert re.match(r"^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$", color)
