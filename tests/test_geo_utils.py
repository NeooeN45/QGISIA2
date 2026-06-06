# -*- coding: utf-8 -*-
"""Tests des utilitaires bbox (pur, sans QGIS)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import geo_utils as gu  # noqa: E402


def test_bbox_from_point_shape():
    b = gu.bbox_from_point(43.6, 1.44, 5)
    assert len(b) == 4
    minlon, minlat, maxlon, maxlat = b
    assert minlon < maxlon and minlat < maxlat
    # centre proche du point d'origine
    assert abs((minlat + maxlat) / 2 - 43.6) < 1e-6
    assert abs((minlon + maxlon) / 2 - 1.44) < 1e-6


def test_bbox_to_string():
    assert gu.bbox_to_string((1, 2, 3, 4)) == "1,2,3,4"


def test_bbox_center():
    assert gu.bbox_center((0, 0, 2, 4)) == (2.0, 1.0)


def test_bbox_radius_grows():
    small = gu.bbox_from_point(0, 0, 1)
    big = gu.bbox_from_point(0, 0, 10)
    assert (big[2] - big[0]) > (small[2] - small[0])
