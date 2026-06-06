# -*- coding: utf-8 -*-
"""Tests du module change_classes (severite de changement, pur Python)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import change_classes as cc  # noqa: E402


def test_list_schemes_has_at_least_two():
    ids = {s["id"] for s in cc.list_schemes()}
    assert {"dndvi", "dnbr_feu"}.issubset(ids)


def test_get_scheme_found_and_missing():
    assert cc.get_scheme("dndvi") is not None
    assert cc.get_scheme("inconnu") is None


def test_classify_value_dndvi():
    assert cc.classify_value("dndvi", -0.3) == "perte_forte"
    assert cc.classify_value("dndvi", -0.1) == "perte"
    assert cc.classify_value("dndvi", 0.0) == "stable"
    assert cc.classify_value("dndvi", 0.1) == "gain"
    assert cc.classify_value("dndvi", 0.3) == "gain_fort"


def test_classify_value_extremes():
    assert cc.classify_value("dndvi", -999) == "perte_forte"
    assert cc.classify_value("dndvi", 999) == "gain_fort"


def test_classify_value_unknown_raises():
    import pytest
    with pytest.raises(ValueError):
        cc.classify_value("inconnu", 0.5)
