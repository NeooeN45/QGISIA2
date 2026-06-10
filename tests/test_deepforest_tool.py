"""Tests pour deepforest_tool.py — pur Python, zéro dépendance QGIS."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import deepforest_tool as dft  # noqa: E402


class TestIsAvailable:
    def test_returns_tuple(self) -> None:
        result = dft.is_available()
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert isinstance(result[0], bool)
        assert isinstance(result[1], str)


class TestDetectTreesUnavailable:
    def test_raises_when_deepforest_not_importable(self, monkeypatch) -> None:
        # Simule l'absence de deepforest
        monkeypatch.setitem(sys.modules, "deepforest", None)
        monkeypatch.setattr(dft, "is_available", lambda: (False, "deepforest simulé absent"))
        with pytest.raises(dft.DeepForestUnavailableError):
            dft.detect_trees("/fake/raster.tif", "/fake/out.geojson")


class TestDeepForestUnavailableError:
    def test_is_runtime_error(self) -> None:
        with pytest.raises(RuntimeError):
            raise dft.DeepForestUnavailableError("test")


class TestTreeDetectionResult:
    def test_dataclass_fields(self) -> None:
        result = dft.TreeDetectionResult(
            ok=True,
            geojson_path="/tmp/out.geojson",
            tree_count=42,
            message="ok",
            duration_s=1.23,
        )
        assert result.tree_count == 42
