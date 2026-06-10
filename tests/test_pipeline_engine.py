"""Tests pour pipeline_engine.py — pur Python, zéro dépendance QGIS."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import pipeline_engine as pe  # noqa: E402


class TestValidatePipeline:
    def test_valid_pipeline_no_errors(self) -> None:
        pipeline = {
            "name": "Analyse vegetation",
            "steps": [
                {"id": "s1", "action": "load_satellite", "params": {"source_id": "s2"}, "needs": []},
                {"id": "s2", "action": "compute_index", "params": {"index": "ndvi"}, "needs": ["s1"]},
                {"id": "s3", "action": "report", "params": {}, "needs": ["s2"]},
            ],
        }
        assert pe.validate_pipeline(pipeline) == []

    def test_duplicate_id(self) -> None:
        pipeline = {
            "name": "Dup",
            "steps": [
                {"id": "s1", "action": "layout", "params": {}, "needs": []},
                {"id": "s1", "action": "report", "params": {}, "needs": []},
            ],
        }
        errors = pe.validate_pipeline(pipeline)
        assert any("duplique" in e for e in errors)

    def test_unknown_action(self) -> None:
        pipeline = {
            "name": "Unknown",
            "steps": [
                {"id": "s1", "action": "magic_spell", "params": {}, "needs": []},
            ],
        }
        errors = pe.validate_pipeline(pipeline)
        assert any("inconnue" in e for e in errors)

    def test_missing_required_param(self) -> None:
        pipeline = {
            "name": "Missing param",
            "steps": [
                {"id": "s1", "action": "buffer", "params": {}, "needs": []},
            ],
        }
        errors = pe.validate_pipeline(pipeline)
        assert any("param requis manquant" in e for e in errors)

    def test_missing_dependency(self) -> None:
        pipeline = {
            "name": "Missing dep",
            "steps": [
                {"id": "s1", "action": "compute_index", "params": {"index": "ndvi"}, "needs": ["ghost"]},
            ],
        }
        errors = pe.validate_pipeline(pipeline)
        assert any("dependance inexistante" in e for e in errors)

    def test_cycle_detected(self) -> None:
        pipeline = {
            "name": "Cycle",
            "steps": [
                {"id": "a", "action": "layout", "params": {}, "needs": ["b"]},
                {"id": "b", "action": "layout", "params": {}, "needs": ["a"]},
            ],
        }
        errors = pe.validate_pipeline(pipeline)
        assert any("Cycle" in e for e in errors)


class TestTopologicalOrder:
    def test_respects_needs(self) -> None:
        pipeline = {
            "name": "Topo",
            "steps": [
                {"id": "s1", "action": "load_satellite", "params": {"source_id": "s2"}, "needs": []},
                {"id": "s2", "action": "compute_index", "params": {"index": "ndvi"}, "needs": ["s1"]},
                {"id": "s3", "action": "classify", "params": {"method": "kmeans"}, "needs": ["s2"]},
            ],
        }
        order = pe.topological_order(pipeline)
        assert order.index("s1") < order.index("s2")
        assert order.index("s2") < order.index("s3")

    def test_raises_on_cycle(self) -> None:
        pipeline = {
            "name": "Cycle",
            "steps": [
                {"id": "a", "action": "layout", "params": {}, "needs": ["b"]},
                {"id": "b", "action": "layout", "params": {}, "needs": ["a"]},
            ],
        }
        with pytest.raises(ValueError):
            pe.topological_order(pipeline)

    def test_empty_pipeline(self) -> None:
        assert pe.topological_order({"name": "empty", "steps": []}) == []

    def test_parallel_steps(self) -> None:
        pipeline = {
            "name": "Parallel",
            "steps": [
                {"id": "s1", "action": "layout", "params": {}, "needs": []},
                {"id": "s2", "action": "layout", "params": {}, "needs": []},
                {"id": "s3", "action": "report", "params": {}, "needs": ["s1", "s2"]},
            ],
        }
        order = pe.topological_order(pipeline)
        assert order.index("s3") > order.index("s1")
        assert order.index("s3") > order.index("s2")


class TestResolveIO:
    def test_links_compute_index_to_load_satellite(self) -> None:
        pipeline = {
            "name": "IO",
            "steps": [
                {"id": "load", "action": "load_satellite", "params": {"source_id": "s2"}, "needs": []},
                {"id": "idx", "action": "compute_index", "params": {"index": "ndvi"}, "needs": ["load"]},
            ],
        }
        io = pe.resolve_io(pipeline)
        assert io["idx"]["inputs_from"] == ["load"]
        assert io["load"]["output"] == "raster_layer"

    def test_no_inputs_for_first_step(self) -> None:
        pipeline = {
            "name": "First",
            "steps": [
                {"id": "load", "action": "load_satellite", "params": {"source_id": "s2"}, "needs": []},
            ],
        }
        io = pe.resolve_io(pipeline)
        assert io["load"]["inputs_from"] == []


class TestEstimateCost:
    def test_counts_correctly(self) -> None:
        pipeline = {
            "name": "Cost",
            "steps": [
                {"id": "s1", "action": "load_satellite", "params": {"source_id": "s2"}, "needs": []},
                {"id": "s2", "action": "suitability", "params": {"preset_id": "p"}, "needs": ["s1"]},
                {"id": "s3", "action": "classify", "params": {"method": "kmeans"}, "needs": ["s1"]},
                {"id": "s4", "action": "report", "params": {}, "needs": ["s3"]},
            ],
        }
        cost = pe.estimate_cost(pipeline)
        assert cost["steps"] == 4
        assert cost["network_steps"] == 1
        assert cost["heavy_steps"] == 3

    def test_empty_pipeline_zero(self) -> None:
        assert pe.estimate_cost({"name": "empty", "steps": []}) == {
            "steps": 0, "network_steps": 0, "heavy_steps": 0,
        }
