# -*- coding: utf-8 -*-
"""Tests de la resolution d'assets STAC (pur, sans reseau)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import stac_assets as sa  # noqa: E402

ITEM = {"assets": {
    "red": {"href": "http://r.tif"},
    "nir": {"href": "http://n.tif"},
    "swir16": {"href": "http://s.tif"},
}}


def test_resolve_mapped_band():
    assert sa.resolve_asset_href(ITEM, "RED") == "http://r.tif"
    assert sa.resolve_asset_href(ITEM, "NIR") == "http://n.tif"
    assert sa.resolve_asset_href(ITEM, "SWIR") == "http://s.tif"


def test_resolve_missing_band():
    assert sa.resolve_asset_href(ITEM, "BLUE") is None
    assert sa.resolve_asset_href({}, "RED") is None
    assert sa.resolve_asset_href(ITEM, "") is None


def test_resolve_direct_key():
    assert sa.resolve_asset_href(ITEM, "red") == "http://r.tif"


def test_band_assets():
    out = sa.band_assets(ITEM, ["NIR", "RED", "BLUE"])
    assert out == {"NIR": "http://n.tif", "RED": "http://r.tif"}
