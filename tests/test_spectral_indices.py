# -*- coding: utf-8 -*-
"""Tests du module spectral_indices (pur Python, sans QGIS)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import spectral_indices as si  # noqa: E402


def test_list_indices_contains_expected():
    ids = {i["id"] for i in si.list_indices()}
    assert {"ndvi", "ndwi", "ndbi", "nbr", "evi"}.issubset(ids)


def test_build_expression_ndvi():
    expr = si.build_expression("ndvi", {"NIR": "b8@1", "RED": "b4@1"})
    assert expr == "(b8@1 - b4@1) / (b8@1 + b4@1)"


def test_build_expression_unknown_raises():
    import pytest
    with pytest.raises(ValueError):
        si.build_expression("unknown", {"NIR": "b8@1"})


def test_build_expression_missing_band_raises():
    import pytest
    with pytest.raises(ValueError):
        si.build_expression("ndvi", {"RED": "b4@1"})


def test_list_indices_contains_new_ones():
    ids = {i["id"] for i in si.list_indices()}
    expected = {
        "savi", "msavi2", "ndmi", "bsi", "mndwi", "ndsi", "gci", "exg",
        "gndvi", "osavi", "evi2", "arvi", "vari", "tgi", "ndre", "cire",
        "awei", "nbr2", "bai", "nbri", "baei", "ui", "ibi", "si",
    }
    assert expected.issubset(ids)


def test_at_least_twenty_five_indices() -> None:
    assert len(si.list_indices()) >= 25


def test_build_expression_ndmi():
    expr = si.build_expression("ndmi", {"NIR": "b8@1", "SWIR": "b11@1"})
    assert expr == "(b8@1 - b11@1) / (b8@1 + b11@1)"


def test_build_expression_mndwi():
    expr = si.build_expression("mndwi", {"GREEN": "b3@1", "SWIR": "b11@1"})
    assert expr == "(b3@1 - b11@1) / (b3@1 + b11@1)"


def test_build_expression_ndsi():
    expr = si.build_expression("ndsi", {"GREEN": "b3@1", "SWIR": "b11@1"})
    assert expr == "(b3@1 - b11@1) / (b3@1 + b11@1)"


def test_build_expression_gci():
    expr = si.build_expression("gci", {"NIR": "b8@1", "GREEN": "b3@1"})
    assert expr == "(b8@1 / b3@1) - 1"


def test_build_expression_exg():
    expr = si.build_expression("exg", {"GREEN": "b3@1", "RED": "b4@1", "BLUE": "b2@1"})
    assert expr == "2 * b3@1 - b4@1 - b2@1"


def test_build_expression_osavi():
    expr = si.build_expression("osavi", {"NIR": "b8@1", "RED": "b4@1"})
    assert "1.16" in expr


def test_build_expression_evi2():
    expr = si.build_expression("evi2", {"NIR": "b8@1", "RED": "b4@1"})
    assert "2.5" in expr and "2.4" in expr


def test_build_expression_bai():
    expr = si.build_expression("bai", {"RED": "b4@1", "NIR": "b8@1"})
    assert "0.1" in expr and "0.06" in expr


def test_build_expression_awei():
    expr = si.build_expression("awei", {"GREEN": "b3@1", "NIR": "b8@1", "SWIR1": "b11@1", "SWIR2": "b12@1"})
    assert "4" in expr and "2.75" in expr


def test_build_expression_nbr2():
    expr = si.build_expression("nbr2", {"SWIR1": "b11@1", "SWIR2": "b12@1"})
    assert expr == "(b11@1 - b12@1) / (b11@1 + b12@1)"


def test_sentinel2_band_map_has_eight_keys():
    bm = si.sentinel2_band_map()
    assert set(bm.keys()) == {"BLUE", "GREEN", "RED", "RED_EDGE", "NIR", "SWIR", "SWIR1", "SWIR2"}


def test_index_metadata_returns_name_and_usage():
    meta = si.index_metadata("ndvi")
    assert meta is not None
    assert meta["name"] == "NDVI"
    assert meta["usage"] == "vegetation"
    assert meta["range"] == (-1.0, 1.0)


def test_index_metadata_unknown_returns_none():
    assert si.index_metadata("unknown") is None


def test_list_index_metadata_has_all():
    metas = si.list_index_metadata()
    assert len(metas) >= 25
    assert all(m["name"] for m in metas)
