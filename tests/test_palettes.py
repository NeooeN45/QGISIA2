"""Tests pour palettes.py — pur Python, zéro dépendance QGIS."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import palettes as p  # noqa: E402


class TestListPalettes:
    def test_at_least_four_palettes(self) -> None:
        assert len(p.list_palettes()) >= 4


class TestGetPalette:
    def test_known_palette(self) -> None:
        pal = p.get_palette("okabe_ito")
        assert pal is not None
        assert len(pal) == 8
        assert all(c.startswith("#") for c in pal)

    def test_unknown_palette(self) -> None:
        assert p.get_palette("x") is None


class TestContrastRatio:
    def test_black_white(self) -> None:
        ratio = p.contrast_ratio("#000000", "#ffffff")
        assert ratio == pytest.approx(21.0, abs=0.1)

    def test_same_color_zero(self) -> None:
        ratio = p.contrast_ratio("#ff0000", "#ff0000")
        assert ratio == pytest.approx(1.0, abs=0.01)


class TestIsAccessible:
    def test_black_white_true(self) -> None:
        assert p.is_accessible("#000000", "#ffffff") is True

    def test_red_green_false(self) -> None:
        # Rouge/vert est souvent en dessous de 4.5
        assert p.is_accessible("#ff0000", "#00ff00") is False

    def test_threshold_param(self) -> None:
        # Noir/blanc passe tous les seuils
        assert p.is_accessible("#000000", "#ffffff", threshold=7.0) is True
