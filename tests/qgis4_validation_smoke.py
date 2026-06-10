# -*- coding: utf-8 -*-
"""
Validation Smoke QGIS 4.0 — QGISIA+ v3.4

A executer DANS QGIS (console Python ou qgis --code) pour verifier que
TOUS les modules du plugin s'importent et que les fonctions critiques
repondent sans erreur.

Usage dans QGIS :
    exec(open(r'C:/chemin/vers/tests/qgis4_validation_smoke.py').read())

Sortie : JSON dans QGISIA_TEST_LOG (defaut %TEMP%/qgisia_validation.json)
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import traceback
from pathlib import Path

LOG_PATH = os.environ.get("QGISIA_TEST_LOG", os.path.join(tempfile.gettempdir(), "qgisia_validation.json"))
PARENT = os.environ.get("QGISIA_PLUGIN_PARENT", str(Path(__file__).parent.parent))

RESULTS = {"success": True, "qgis_version": "", "python_version": "", "steps": []}


def rec(step: str, ok: bool, detail: str = "", data=None) -> None:
    RESULTS["steps"].append({
        "step": step,
        "ok": bool(ok),
        "detail": str(detail)[:300],
        "data": data,
    })
    if not ok:
        RESULTS["success"] = False
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(RESULTS, f, ensure_ascii=False, indent=2)


def _try_import(module_name: str, package: str = "QGISIA2") -> bool:
    """Importe un module du plugin et log le resultat."""
    try:
        if PARENT not in sys.path:
            sys.path.insert(0, PARENT)
        mod = __import__(f"{package}.{module_name}", fromlist=[module_name])
        rec(f"import.{module_name}", True, getattr(mod, "__file__", "ok"))
        return True
    except Exception as exc:
        rec(f"import.{module_name}", False, f"{type(exc).__name__}: {exc}")
        return False


def _try_call(module_name: str, fn_name: str, *args, **kwargs) -> bool:
    """Appelle une fonction d'un module et log le resultat."""
    try:
        mod = __import__(f"QGISIA2.{module_name}", fromlist=[module_name])
        fn = getattr(mod, fn_name)
        result = fn(*args, **kwargs)
        rec(f"call.{module_name}.{fn_name}", True, str(result)[:200])
        return True
    except Exception as exc:
        rec(f"call.{module_name}.{fn_name}", False, f"{type(exc).__name__}: {exc}")
        return False


def main():
    # --- Infos environnement -------------------------------------------------
    try:
        from qgis.core import Qgis
        RESULTS["qgis_version"] = Qgis.QGIS_VERSION
    except Exception as exc:
        RESULTS["qgis_version"] = f"erreur: {exc}"

    RESULTS["python_version"] = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

    # --- Core plugin ---------------------------------------------------------
    _try_import("__init__")
    _try_import("config")
    _try_import("geoai_assistant")
    _try_import("ui")
    _try_import("icon_config")

    # --- LLM Gateway & Installer ---------------------------------------------
    _try_import("llm_gateway")
    _try_import("llm_installer")
    _try_call("llm_installer", "is_vendor_ready")

    # --- Agents --------------------------------------------------------------
    _try_import("agent_runner")
    _try_import("agent_federation")
    _try_import("agent_tools")
    _try_import("agent_guardrails")
    _try_import("agent_memory")
    _try_import("agent_bridge")
    _try_import("agent_workflows")
    _try_import("agent_graph")

    # --- MCP Server ----------------------------------------------------------
    _try_import("mcp_server")
    _try_call("mcp_server", "list_tool_specs")
    _try_call("mcp_server", "get_tool", "getLayersList")

    # --- Outils natifs & catalogue -------------------------------------------
    _try_import("native_tools")
    _try_import("data_catalog")
    _try_call("data_catalog", "list_sources")

    # --- Raster & indices ----------------------------------------------------
    _try_import("spectral_indices")
    _try_import("raster_style")
    _try_import("classification")
    _try_import("change_classes")
    _try_import("raster_remote")

    # --- Carto & layout ------------------------------------------------------
    _try_import("layout_specs")
    _try_import("layout_auto")
    _try_import("atlas_specs")
    _try_import("map_repro")
    _try_import("legend_normalizer")
    _try_import("symbology_presets")
    _try_import("symbology_library")

    # --- Export & rapports ---------------------------------------------------
    _try_import("report_export")
    _try_import("report_templates")

    # --- Analyse spatiale ----------------------------------------------------
    _try_import("terrain_formulas")
    _try_import("cluster_utils")
    _try_import("geo_utils")

    # --- Dossiers & blueprints -----------------------------------------------
    _try_import("dossier_blueprint")
    _try_call("dossier_blueprint", "list_dossiers")

    # --- STAC & Earth-2 ------------------------------------------------------
    _try_import("stac_assets")
    _try_import("stac_collections")
    _try_import("earth2_forecast")

    # --- Vision & critique ---------------------------------------------------
    _try_import("vision_critique")

    # --- Version manager (compat multi-QGIS) ---------------------------------
    _try_import("version_manager")

    # --- Predictive & DeepForest ---------------------------------------------
    _try_import("predict_trend")
    _try_import("deepforest_tool")

    # --- Pipeline engine -----------------------------------------------------
    _try_import("pipeline_engine")

    # --- Bridge QGIS (si on est dans QGIS) -----------------------------------
    try:
        from qgis.core import QgsProject
        from qgis.utils import iface
        rec("qgis.iface", iface is not None)
        rec("qgis.project", QgsProject.instance() is not None)
    except Exception as exc:
        rec("qgis.bridge", False, str(exc))

    # --- Recapitulatif -------------------------------------------------------
    ok_count = sum(1 for s in RESULTS["steps"] if s["ok"])
    total = len(RESULTS["steps"])
    rec("_summary", RESULTS["success"], f"{ok_count}/{total} checks OK")

    print(f"\n=== QGISIA+ Validation Smoke ===")
    print(f"QGIS   : {RESULTS['qgis_version']}")
    print(f"Python : {RESULTS['python_version']}")
    print(f"Result : {ok_count}/{total} OK  |  Success: {RESULTS['success']}")
    print(f"Log    : {LOG_PATH}")
    print("==================================\n")

    # Pretty print des echecs
    failures = [s for s in RESULTS["steps"] if not s["ok"]]
    if failures:
        print("FAILURES:")
        for f in failures:
            print(f"  - {f['step']}: {f['detail']}")
    else:
        print("Tous les modules sont charges et fonctionnels.")

    return RESULTS


if __name__ == "__main__":
    main()
