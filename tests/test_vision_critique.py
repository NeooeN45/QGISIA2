# -*- coding: utf-8 -*-
"""Tests du module vision_critique (auto-correction visuelle, pur Python)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import vision_critique as vc  # noqa: E402


def test_build_critique_prompt_contains_intent():
    prompt = vc.build_critique_prompt("analyse vegetation", {"title": "Carte 1"})
    assert "analyse vegetation" in prompt
    assert "cadrage" in prompt.lower() or "lisibilite" in prompt.lower()


def test_completeness_score_empty_low():
    out = vc.completeness_score({})
    assert out["score"] < 0.5
    assert "map" in out["missing"]


def test_completeness_score_complete_perfect():
    meta = {
        "title": "Titre",
        "map": {"extent": [1, 2, 3, 4]},
        "legend": True,
        "scalebar": True,
        "north": True,
    }
    out = vc.completeness_score(meta)
    assert out["score"] == 1.0
    assert out["missing"] == []


def test_suggest_fixes_for_empty():
    fixes = vc.suggest_fixes({})
    assert any("carte" in f.lower() or "map" in f.lower() for f in fixes)


def test_suggest_fixes_for_complete():
    meta = {
        "title": "Titre",
        "map": {"extent": [1, 2, 3, 4]},
        "legend": True,
        "scalebar": True,
        "north": True,
    }
    fixes = vc.suggest_fixes(meta)
    assert fixes == []
