# P3-S1 — Catalogue mondial de données + chargement agentique — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou
> superpowers:executing-plans. Étapes en cases à cocher (`- [ ]`).

> **Répartition du travail (économie de tokens) :**
> - `[KIMI]` = code 100% spécifié ci-dessous → **exécutable par Devin/Kimi 2.6** tel quel.
> - `[CLAUDE]` = critique / spécifique au codebase QGIS → **codé/vérifié par Claude** (sous-agents).
> - Après les tâches `[KIMI]`, Claude **relit + lance les tests** avant l'intégration.

**Goal:** L'agent peut découvrir et charger en un appel toute donnée mondiale gratuite
diffusée en XYZ/WMTS/WMS (fonds + thématiques).

**Architecture:** Un registre JSON curé (`data_sources.json`) + un module pur
(`data_catalog.py`) consommé par un outil natif (`list_data_sources`) et un slot bridge
QGIS (`addDataSource`) qui réutilise `_create_service_layer` existant.

**Tech Stack:** Python (stdlib), pytest, PyQGIS (slot bridge), JSON.

**Branche:** continuer sur `chore/hygiene-puis-nvidia`.

---

## Structure de fichiers

| Fichier | Rôle | Propriétaire |
|---------|------|--------------|
| `QGISIA2/config/data_sources.json` | Registre curé des sources mondiales | `[KIMI]` |
| `QGISIA2/data_catalog.py` | Pur Python : load/get/list/build_service_config | `[KIMI]` |
| `tests/test_data_catalog.py` | Tests unitaires du catalogue | `[KIMI]` |
| `QGISIA2/native_tools.py` | + outil `list_data_sources` | `[KIMI]` |
| `tests/test_native_tools.py` | + test du nouvel outil | `[KIMI]` |
| `QGISIA2/geoai_assistant.py` | + slot `addDataSource` + route HTTP | `[CLAUDE]` |
| `QGISIA2/mcp_server.py` | + tools MCP `list_data_sources`/`addDataSource` | `[CLAUDE]` |
| `tests/qgis_real_smoke.py` | + vérif réelle `addDataSource` | `[CLAUDE]` |

---

## Task 1 `[KIMI]` : Registre + module catalogue + tests

**Files:**
- Create: `QGISIA2/config/data_sources.json`
- Create: `QGISIA2/data_catalog.py`
- Create: `tests/test_data_catalog.py`

- [ ] **Step 1 : Créer le registre `QGISIA2/config/data_sources.json`** (contenu exact)

```json
{
  "version": 1,
  "description": "Catalogue de sources cartographiques mondiales gratuites (XYZ/WMTS/WMS).",
  "sources": [
    {"id": "osm-standard", "name": "OpenStreetMap standard", "category": "basemap", "provider": "OSM", "service_type": "XYZ", "url": "https://tile.openstreetmap.org/{z}/{x}/{y}.png", "params": {"zmax": 19}, "license": "ODbL", "coverage": "monde", "attribution": "© OpenStreetMap contributors"},
    {"id": "carto-positron", "name": "CARTO Positron (clair)", "category": "basemap", "provider": "CARTO", "service_type": "XYZ", "url": "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png", "params": {"zmax": 20}, "license": "CC-BY (OSM)", "coverage": "monde", "attribution": "© OpenStreetMap, © CARTO"},
    {"id": "carto-dark", "name": "CARTO Dark Matter (sombre)", "category": "basemap", "provider": "CARTO", "service_type": "XYZ", "url": "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", "params": {"zmax": 20}, "license": "CC-BY (OSM)", "coverage": "monde", "attribution": "© OpenStreetMap, © CARTO"},
    {"id": "carto-voyager", "name": "CARTO Voyager", "category": "basemap", "provider": "CARTO", "service_type": "XYZ", "url": "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png", "params": {"zmax": 20}, "license": "CC-BY (OSM)", "coverage": "monde", "attribution": "© OpenStreetMap, © CARTO"},
    {"id": "opentopomap", "name": "OpenTopoMap (relief)", "category": "relief", "provider": "OpenTopoMap", "service_type": "XYZ", "url": "https://a.tile.opentopomap.org/{z}/{x}/{y}.png", "params": {"zmax": 17}, "license": "CC-BY-SA", "coverage": "monde", "attribution": "© OpenTopoMap (CC-BY-SA)"},
    {"id": "osm-hot", "name": "OSM Humanitarian (HOT)", "category": "basemap", "provider": "HOT", "service_type": "XYZ", "url": "https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", "params": {"zmax": 19}, "license": "ODbL", "coverage": "monde", "attribution": "© OpenStreetMap, HOT"},
    {"id": "esri-world-imagery", "name": "ESRI World Imagery (satellite)", "category": "satellite", "provider": "Esri", "service_type": "XYZ", "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", "params": {"zmax": 19}, "license": "Esri (usage attribué)", "coverage": "monde", "attribution": "Esri, Maxar, Earthstar Geographics"},
    {"id": "esri-hillshade", "name": "ESRI World Hillshade (relief ombré)", "category": "relief", "provider": "Esri", "service_type": "XYZ", "url": "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}", "params": {"zmax": 16}, "license": "Esri (usage attribué)", "coverage": "monde", "attribution": "Esri"},
    {"id": "esri-natgeo", "name": "ESRI NatGeo World Map", "category": "basemap", "provider": "Esri", "service_type": "XYZ", "url": "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}", "params": {"zmax": 16}, "license": "Esri (usage attribué)", "coverage": "monde", "attribution": "Esri, National Geographic"},
    {"id": "s2cloudless", "name": "Sentinel-2 cloudless (EOX)", "category": "satellite", "provider": "EOX", "service_type": "XYZ", "url": "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg", "params": {"zmax": 14}, "license": "CC-BY-NC-SA 4.0", "coverage": "monde", "attribution": "Sentinel-2 cloudless by EOX"},
    {"id": "esa-worldcover", "name": "ESA WorldCover 10 m (occupation du sol)", "category": "occupation_sol", "provider": "ESA / Terrascope", "service_type": "WMS", "url": "https://services.terrascope.be/wms/v2", "params": {"layers": "WORLDCOVER_2021_MAP", "format": "image/png", "crs": "EPSG:3857"}, "license": "CC-BY 4.0", "coverage": "monde", "attribution": "© ESA WorldCover 2021"},
    {"id": "ign-plan", "name": "IGN Plan v2 (France)", "category": "france", "provider": "IGN / Géoplateforme", "service_type": "WMTS", "url": "https://data.geopf.fr/wmts", "params": {"layer": "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2", "tileMatrixSet": "PM", "format": "image/png", "style": "normal"}, "license": "Licence Ouverte Etalab", "coverage": "France", "attribution": "© IGN-F / Géoplateforme"},
    {"id": "ign-ortho", "name": "IGN Orthophotos (France)", "category": "france", "provider": "IGN / Géoplateforme", "service_type": "WMTS", "url": "https://data.geopf.fr/wmts", "params": {"layer": "ORTHOIMAGERY.ORTHOPHOTOS", "tileMatrixSet": "PM", "format": "image/jpeg", "style": "normal"}, "license": "Licence Ouverte Etalab", "coverage": "France", "attribution": "© IGN-F / Géoplateforme"},
    {"id": "ign-cadastre", "name": "Cadastre (PCI, France)", "category": "france", "provider": "IGN / Géoplateforme", "service_type": "WMTS", "url": "https://data.geopf.fr/wmts", "params": {"layer": "CADASTRALPARCELS.PARCELLAIRE_EXPRESS", "tileMatrixSet": "PM", "format": "image/png", "style": "normal"}, "license": "Licence Ouverte Etalab", "coverage": "France", "attribution": "© IGN-F / DGFiP"},
    {"id": "ign-scan25", "name": "IGN Cartes topo (SCAN 25, France)", "category": "france", "provider": "IGN / Géoplateforme", "service_type": "WMTS", "url": "https://data.geopf.fr/wmts", "params": {"layer": "GEOGRAPHICALGRIDSYSTEMS.MAPS", "tileMatrixSet": "PM", "format": "image/jpeg", "style": "normal"}, "license": "Licence Ouverte Etalab", "coverage": "France", "attribution": "© IGN-F / Géoplateforme"},
    {"id": "carto-labels", "name": "CARTO labels seuls (overlay)", "category": "labels", "provider": "CARTO", "service_type": "XYZ", "url": "https://a.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png", "params": {"zmax": 20}, "license": "CC-BY (OSM)", "coverage": "monde", "attribution": "© OpenStreetMap, © CARTO"}
  ]
}
```

- [ ] **Step 2 : Écrire le test (échec attendu)** `tests/test_data_catalog.py`

```python
# -*- coding: utf-8 -*-
"""Tests du catalogue de donnees mondiales (pur Python, sans QGIS)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2"))

import data_catalog as dc  # noqa: E402

REQUIRED = {"id", "name", "category", "provider", "service_type", "url"}


def test_load_sources_non_empty():
    sources = dc.load_sources()
    assert len(sources) >= 15


def test_every_source_has_valid_schema():
    for s in dc.load_sources():
        assert REQUIRED.issubset(s.keys()), f"champs manquants: {s.get('id')}"
        assert s["service_type"] in dc.VALID_SERVICE_TYPES, s["id"]
        assert isinstance(s["url"], str) and s["url"].strip(), s["id"]


def test_ids_are_unique():
    ids = [s["id"] for s in dc.load_sources()]
    assert len(ids) == len(set(ids))


def test_get_source_found_and_missing():
    assert dc.get_source("osm-standard")["service_type"] == "XYZ"
    assert dc.get_source("inconnu") is None


def test_list_sources_summary_and_filter():
    alls = dc.list_sources()
    assert all(set(x.keys()) == {"id", "name", "category", "coverage", "provider"} for x in alls)
    sat = dc.list_sources(category="satellite")
    assert sat and all(x["category"] == "satellite" for x in sat)
    assert dc.list_sources(category="inexistante") == []


def test_build_service_config_xyz():
    cfg = dc.build_service_config(dc.get_source("osm-standard"))
    assert cfg["service_type"] == "XYZ"
    assert cfg["url"].startswith("https://")
    assert cfg["zmax"] == 19


def test_build_service_config_wms():
    cfg = dc.build_service_config(dc.get_source("esa-worldcover"))
    assert cfg["service_type"] == "WMS"
    assert cfg["layers"] == "WORLDCOVER_2021_MAP"
    assert cfg["format"] == "image/png"
    assert cfg["crs"] == "EPSG:3857"


def test_build_service_config_wmts():
    cfg = dc.build_service_config(dc.get_source("ign-plan"))
    assert cfg["service_type"] == "WMTS"
    assert cfg["layer"] == "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2"
    assert cfg["tileMatrixSet"] == "PM"
```

- [ ] **Step 3 : Lancer le test → échec attendu**

Run : `python -m pytest tests/test_data_catalog.py -q`
Expected : FAIL (`ModuleNotFoundError: No module named 'data_catalog'`).

- [ ] **Step 4 : Implémenter `QGISIA2/data_catalog.py`** (contenu exact)

```python
# -*- coding: utf-8 -*-
"""
Catalogue de sources cartographiques mondiales gratuites (XYZ / WMTS / WMS).

Module pur Python (testable sans QGIS). Lit QGISIA2/config/data_sources.json et
construit la config attendue par le bridge (_create_service_layer).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional

CATALOG_PATH = Path(__file__).parent / "config" / "data_sources.json"
VALID_SERVICE_TYPES = {"XYZ", "WMTS", "WMS"}


def load_sources() -> List[dict]:
    if not CATALOG_PATH.exists():
        return []
    try:
        return json.loads(CATALOG_PATH.read_text(encoding="utf-8")).get("sources", [])
    except (json.JSONDecodeError, OSError):
        return []


def get_source(source_id: str) -> Optional[dict]:
    return next((s for s in load_sources() if s.get("id") == source_id), None)


def list_sources(category: Optional[str] = None) -> List[dict]:
    sources = load_sources()
    if category:
        sources = [s for s in sources if s.get("category") == category]
    return [
        {
            "id": s.get("id"),
            "name": s.get("name"),
            "category": s.get("category"),
            "coverage": s.get("coverage"),
            "provider": s.get("provider"),
        }
        for s in sources
    ]


def build_service_config(source: dict) -> dict:
    """Transforme une entree du catalogue en config pour _create_service_layer."""
    st = source.get("service_type")
    params = source.get("params", {}) or {}
    cfg = {
        "service_type": st,
        "url": source.get("url", ""),
        "name": source.get("name", source.get("id")),
    }
    if st == "XYZ":
        cfg["zmax"] = params.get("zmax", 19)
        cfg["zmin"] = params.get("zmin", 0)
    elif st == "WMS":
        cfg["layers"] = params.get("layers", "")
        cfg["format"] = params.get("format", "image/png")
        cfg["crs"] = params.get("crs", "EPSG:3857")
    elif st == "WMTS":
        cfg["layer"] = params.get("layer", "")
        cfg["tileMatrixSet"] = params.get("tileMatrixSet", "PM")
        cfg["format"] = params.get("format", "image/png")
        cfg["style"] = params.get("style", "normal")
    return cfg
```

- [ ] **Step 5 : Lancer le test → succès**

Run : `python -m pytest tests/test_data_catalog.py -q`
Expected : PASS (8 tests).

- [ ] **Step 6 : Commit**

```bash
git add QGISIA2/config/data_sources.json QGISIA2/data_catalog.py tests/test_data_catalog.py
git commit -m "feat(data): registre mondial de sources cartographiques + module data_catalog + tests"
```

---

## Task 2 `[KIMI]` : Outil natif `list_data_sources`

**Files:**
- Modify: `QGISIA2/native_tools.py`
- Modify: `tests/test_native_tools.py`

- [ ] **Step 1 : Ajouter le test** dans `tests/test_native_tools.py` (à la fin du fichier)

```python
def test_list_data_sources_tool():
    out = nt._list_data_sources({}, None)
    assert out["count"] >= 15
    assert any(s["id"] == "osm-standard" for s in out["sources"])


def test_list_data_sources_filter_category():
    out = nt._list_data_sources({"category": "satellite"}, None)
    assert out["count"] >= 1
    assert all(s["category"] == "satellite" for s in out["sources"])
```

Et mettre à jour `test_to_openai_tools_and_names` : ajouter `"list_data_sources"` au set attendu.

- [ ] **Step 2 : Lancer → échec attendu**

Run : `python -m pytest tests/test_native_tools.py -q`
Expected : FAIL (`_list_data_sources` absent).

- [ ] **Step 3 : Implémenter le tool natif** dans `QGISIA2/native_tools.py`

Ajouter cette fonction (avant `_generate_layer_style`) :
```python
def _list_data_sources(args: dict, get_json: Callable) -> dict:
    try:
        from data_catalog import list_sources  # type: ignore
    except ImportError:
        from .data_catalog import list_sources  # type: ignore
    sources = list_sources(args.get("category"))
    return {"count": len(sources), "sources": sources}
```

Et ajouter cette entrée dans la liste `NATIVE_TOOLS` (avant `list_symbology_presets`) :
```python
    NativeTool(
        name="list_data_sources",
        description=(
            "Lister les sources cartographiques mondiales gratuites chargeables "
            "(fonds OSM/CARTO/ESRI, satellite, occupation du sol ESA WorldCover, "
            "IGN/Cadastre France...). Filtrer par 'category'. Enchainer avec "
            "addDataSource pour charger une source dans QGIS."
        ),
        input_schema={
            "type": "object",
            "properties": {"category": {"type": "string", "description": "ex: basemap, satellite, france, occupation_sol, relief"}},
        },
        executor=_list_data_sources,
    ),
```

- [ ] **Step 4 : Lancer → succès**

Run : `python -m pytest tests/test_native_tools.py -q`
Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add QGISIA2/native_tools.py tests/test_native_tools.py
git commit -m "feat(data): outil agent list_data_sources (decouverte du catalogue mondial)"
```

---

## Task 3 `[CLAUDE]` : Slot bridge `addDataSource` + route + tool MCP

> **Critique** : doit s'aligner sur la signature réelle de `_create_service_layer`
> (clés de config attendues pour XYZ/WMTS/WMS). Claude lit `geoai_assistant.py`
> (`_create_service_layer`, lignes ~620-700) AVANT d'écrire, puis adapte
> `data_catalog.build_service_config` si les clés diffèrent.

**Files:**
- Modify: `QGISIA2/geoai_assistant.py` (slot `addDataSource` près de `addServiceLayer` ~1072 ; route HTTP près de `addServiceLayer` ~2455)
- Modify: `QGISIA2/mcp_server.py` (tools MCP)

- [ ] **Step 1 : Lire `_create_service_layer`** pour confirmer les clés de config consommées (XYZ/WMTS/WMS) et aligner `build_service_config` si besoin.

- [ ] **Step 2 : Ajouter le slot** `addDataSource` (réutilise le chemin service existant) :
```python
    @BridgeSlot(str, str, result=str)
    def addDataSource(self, source_id, layer_name):
        """Charge une source du catalogue mondial (data_sources.json) dans QGIS."""
        try:
            from data_catalog import get_source, build_service_config
        except ImportError:
            from .data_catalog import get_source, build_service_config
        source = get_source(str(source_id or "").strip())
        if source is None:
            message = f"Source de donnees inconnue : {source_id}"
            self._notify(message, Qgis.Warning)
            return message
        config = build_service_config(source)
        if layer_name:
            config["name"] = layer_name
        try:
            layer = self._create_service_layer(config)
        except Exception as exc:  # noqa: BLE001
            message = f"Impossible de preparer la source : {exc}"
            self._notify(message, Qgis.Warning, duration=6)
            return message
        if self._add_layer_to_project(layer, config.get("name"),
                                      source=f"Catalog:{source['id']}") is None:
            reason = self._layer_error_message(layer)
            message = f"La source '{source['id']}' n'a pas pu etre chargee."
            if reason:
                message = f"{message} Cause: {reason}"
            self._notify(message, Qgis.Warning, duration=6)
            return message
        message = f"Source ajoutee : {layer.name()} ({source['provider']})."
        self._notify(message, Qgis.Success)
        return message
```

- [ ] **Step 3 : Ajouter la route HTTP** (près de `/api/qgis/addServiceLayer`) :
```python
            elif route == "/api/qgis/addDataSource":
                result = self._bridge_call(
                    "addDataSource",
                    body.get("sourceId", ""),
                    body.get("name", ""),
                )
```

- [ ] **Step 4 : Ajouter les tools MCP** dans `QGISIA2/mcp_server.py` (`TOOL_CATALOG`) :
```python
    McpToolSpec(
        name="list_data_sources",
        description="Lister les sources cartographiques mondiales gratuites du catalogue (filtre 'category').",
        input_schema={"type": "object", "properties": {"category": {"type": "string"}}},
        endpoint="/api/qgis/listDataSources",
        payload_builder=_direct_payload,
    ),
    McpToolSpec(
        name="addDataSource",
        description="Charger une source du catalogue mondial dans QGIS (fond, satellite, IGN...). Voir list_data_sources pour les id.",
        input_schema={
            "type": "object",
            "properties": {"sourceId": {"type": "string"}, "name": {"type": "string"}},
            "required": ["sourceId"],
        },
        endpoint="/api/qgis/addDataSource",
        payload_builder=_direct_payload,
    ),
```
> Note : `list_data_sources` est déjà exposé comme **outil natif** (Task 2) pour le
> tool-calling LLM. L'entrée MCP `listDataSources` sert les clients MCP externes ;
> ajouter la route `/api/qgis/listDataSources` qui appelle `data_catalog.list_sources`
> (lecture directe, sans bridge GUI) — ou réutiliser le natif. Claude tranche à l'exécution.

- [ ] **Step 5 : Vérifier syntaxe + suite**

Run :
```bash
python -c "import ast; ast.parse(open('QGISIA2/geoai_assistant.py',encoding='utf-8').read()); print('OK')"
python -m pytest tests/ -q
```
Expected : `OK` + suite verte.

- [ ] **Step 6 : Commit**

```bash
git add QGISIA2/geoai_assistant.py QGISIA2/mcp_server.py
git commit -m "feat(data): slot bridge addDataSource + route + tools MCP (chargement catalogue mondial)"
```

---

## Task 4 `[CLAUDE]` : Vérification QGIS réelle

**Files:**
- Modify: `tests/qgis_real_smoke.py` (ajouter une étape avant `_finish(plugin)`)

- [ ] **Step 1 : Ajouter l'étape de vérif** (charge un fond XYZ réel et vérifie la couche) :
```python
        # Catalogue mondial (P3-S1) : charger un fond depuis le catalogue
        try:
            before = len(QgsProject.instance().mapLayers())
            msg_osm = bridge.addDataSource("osm-standard", "")
            msg_esri = bridge.addDataSource("esri-world-imagery", "")
            after = len(QgsProject.instance().mapLayers())
            rec("bridge.addDataSource", after >= before + 2,
                f"{msg_osm} | {msg_esri} | layers {before}->{after}")
        except Exception as exc:
            rec("bridge.addDataSource", False, str(exc))
```

- [ ] **Step 2 : Lancer QGIS** (Claude, environnement local) :
```bash
tests/_run_qgis.bat tests/qgis_real_smoke.py
```
Expected (dans `tests/_qgis_real_log.json`) : `bridge.addDataSource` → `ok: true`,
layers passe de N à N+2 (OSM + ESRI World Imagery chargés en XYZ).

- [ ] **Step 3 : Commit**

```bash
git add tests/qgis_real_smoke.py
git commit -m "test(qgis): verif reelle addDataSource (catalogue mondial charge dans QGIS)"
```

---

## Task 5 `[CLAUDE]` : Revue + intégration

- [ ] **Step 1 : Relire le code produit par Kimi** (Task 1 & 2) — dispatcher un sous-agent
  `code-reviewer` sur le diff `data_catalog.py` + `data_sources.json` + tests : vérifier
  schéma, robustesse, URLs plausibles, cohérence des types.
- [ ] **Step 2 : Suite complète** : `python -m pytest tests/ -q` (vert) + `npm run lint` (pas de nouvelle erreur).
- [ ] **Step 3 : Mettre à jour la doc** : ajouter le catalogue mondial à `docs/AGENTIC_BACKEND.md` (section outils).
- [ ] **Step 4 : Commit de clôture** : `git commit -m "docs(data): documenter le catalogue mondial P3-S1"`.

---

## Self-review (effectuée à la rédaction)

- **Couverture spec** : registre→T1, data_catalog→T1, list_data_sources→T2,
  addDataSource(slot+route)→T3, tools MCP→T3, QGIS réel→T4, ≥15 sources + schéma→T1,
  doc→T5. Aucune lacune.
- **Placeholders** : aucun — code complet pour les tâches `[KIMI]`. La seule décision
  laissée à l'exécution (`[CLAUDE]` T3) est l'alignement sur `_create_service_layer`,
  explicitement balisée (lecture préalable requise) car spécifique au codebase.
- **Cohérence des types** : `service_type` ∈ {XYZ,WMTS,WMS} partout ; `build_service_config`
  produit les clés consommées par le slot ; `list_sources` renvoie le même schéma résumé
  dans le module, l'outil natif et les tests.
