"""Tests pour legend_normalizer.py — pur Python, zéro dépendance QGIS."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import legend_normalizer as ln  # noqa: E402


class TestNormalizeColor:
    def test_rgb_triple(self) -> None:
        assert ln.normalize_color("255,0,0") == "#ff0000"

    def test_rgb_function(self) -> None:
        assert ln.normalize_color("rgb(255, 0, 0)") == "#ff0000"
        assert ln.normalize_color("RGB(0, 128, 0)") == "#008000"

    def test_short_hex(self) -> None:
        assert ln.normalize_color("#fff") == "#ffffff"

    def test_full_hex(self) -> None:
        assert ln.normalize_color("#ff0000") == "#ff0000"

    def test_color_name_en(self) -> None:
        assert ln.normalize_color("red") == "#ff0000"
        assert ln.normalize_color("green") == "#008000"

    def test_color_name_fr(self) -> None:
        assert ln.normalize_color("rouge") == "#ff0000"
        assert ln.normalize_color("vert") == "#008000"

    def test_gibberish_returns_none(self) -> None:
        assert ln.normalize_color("bidon") is None
        assert ln.normalize_color("") is None


class TestNormalizeLegend:
    def test_single_item_french_keys(self) -> None:
        raw = [{"nom": "Forêt", "couleur": "vert"}]
        result = ln.normalize_legend(raw)
        assert result == [{"value": "Forêt", "label": "Forêt", "color": "#008000"}]

    def test_ignores_item_without_valid_color(self) -> None:
        raw = [{"label": "Forêt", "color": "bidon"}]
        assert ln.normalize_legend(raw) == []

    def test_preserves_value_when_present(self) -> None:
        raw = [{"label": "Zone A", "value": "ZA-01", "color": "#ff0000"}]
        result = ln.normalize_legend(raw)
        assert result[0]["value"] == "ZA-01"

    def test_empty_list(self) -> None:
        assert ln.normalize_legend([]) == []

    def test_multiple_items(self) -> None:
        raw = [
            {"label": "Eau", "color": "blue"},
            {"nom": "Forêt", "couleur": "vert"},
        ]
        result = ln.normalize_legend(raw)
        assert len(result) == 2
        assert result[0]["color"] == "#0000ff"
        assert result[1]["color"] == "#008000"
