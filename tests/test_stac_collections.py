# -*- coding: utf-8 -*-
"""Tests du module stac_collections (multi-capteurs, pur Python)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import stac_collections as sc  # noqa: E402


def test_list_collections_has_at_least_three():
    ids = {c["id"] for c in sc.list_collections()}
    assert {"sentinel-2-l2a", "sentinel-1-grd", "landsat-c2-l2"}.issubset(ids)


def test_get_collection_found_and_missing():
    assert sc.get_collection("sentinel-2-l2a") is not None
    assert sc.get_collection("inconnu") is None


def test_asset_key_for_sentinel2_red():
    assert sc.asset_key_for("sentinel-2-l2a", "RED") == "red"


def test_asset_key_for_sentinel1_vv():
    assert sc.asset_key_for("sentinel-1-grd", "VV") == "vv"


def test_asset_key_for_sentinel1_vh():
    assert sc.asset_key_for("sentinel-1-grd", "VH") == "vh"


def test_asset_key_for_unknown_collection():
    assert sc.asset_key_for("inconnu", "RED") is None


def test_asset_key_for_unknown_band():
    assert sc.asset_key_for("sentinel-2-l2a", "INFRAROUGE") is None
