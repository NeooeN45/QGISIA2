# A0bis — Capacités avancées (recherche multi-agents)

**Date** : 2026-06-05
**Méthode** : 3 agents de recherche parallèles, axes indépendants de la vision produit.
**But** : transformer QGISIA+ en agent SIG « incroyable, complet, ultra-pratique » — depuis un
prompt vague + documents, agir automatiquement dans QGIS, s'enrichir via le web, et reproduire
une carte depuis une image. Tout en open-source gratuit, NVIDIA NIM au cœur.

> Statut : **recherche/design**. Ces capacités enrichissent le Chantier A en sprints
> additionnels (S3+). Elles ne se construisent PAS toutes d'un coup — voir roadmap en fin.

---

## Axe 1 — Auto-pilot depuis prompt vague + documents

**Découverte clé : `opengeos/GeoAgent` (MIT)** résout déjà le plus dur du problème QGIS :
exécuteur séquentiel avec **marshalling sur le thread GUI** (obligatoire pour canvas/layer-tree)
+ **confirmation-gating** par métadonnées d'outil (`requires_confirmation`, `destructive`).
→ Pattern à étudier/adapter directement.

| Reco | Repo/lib | Licence | Effort | Intégration QGISIA+ |
|------|----------|---------|--------|---------------------|
| Plan-and-Execute (planner→executor) | langchain-ai/langgraph, Beyond-React | MIT | Moyen | `agent_graph.py` + fédération (routeur = planner) |
| Auto-clarification / défauts SIG | LangGraph interrupt (HITL) | MIT | Faible | nœud `clarify` + UI React |
| Doc grounding PDF/DOCX/images | **Docling** (IBM) / PyMuPDF4LLM | MIT / AGPL | Moyen | `rag_indexer`/`rag_store` |
| Exécution gated + thread GUI | **opengeos/GeoAgent** (pattern), qgis_mcp | MIT | Moyen | `mcp_server.py` + `qgis_tools.py` |
| État/mémoire de tâche | LangGraph `SqliteSaver` | MIT | Faible | `agent_graph.py` (SQLite déjà dans QGIS) |

**Top 3** : (1) étudier GeoAgent ; (2) Plan-and-Execute + checkpointer SQLite dans
`agent_graph.py` ; (3) Docling→RAG (PyMuPDF4LLM si vendorisation stricte).

---

## Axe 2 — IA branchée au web (enrichissement des requêtes)

Tout se branche comme **outils function-calling** du gateway, **outils MCP** dans
`mcp_server.py`, ou **connecteurs REST** à côté de l'existant (IGN/Overpass/Hub'Eau).

| Reco | Repo/API | Licence/tier | Effort | Intégration |
|------|----------|--------------|--------|-------------|
| Méta-recherche web self-host | **SearXNG** | AGPL, illimité, sans clé | Moyen | outil `web_search` (LiteLLM a un connecteur SearXNG natif) |
| Recherche managée (fallback) | Tavily | 1000 crédits/mois | Faible | outil `web_search` secondaire (clé en env) |
| Extraction HTML→markdown offline | **trafilatura** | Apache-2.0, local | Faible | post-fetch, pur Python vendorisable |
| Faits + citations | Wikipedia/Wikidata REST+SPARQL | CC0/CC-BY-SA | Faible | `wiki_lookup` / `wikidata_sparql` (anti-hallucination) |
| Géocodage | **Nominatim** / Photon self-host | ODbL/MIT, sans clé | Faible | connecteur REST miroir de l'existant |
| Élévation + météo | **Open-Meteo** | sans clé, self-host | Faible | connecteurs `elevation`/`weather` |
| Découverte de couches | **STAC** (`pystac-client`) + OGC API Records | BSD/Apache | Moyen | outil `discover_layers` (Copernicus expose déjà STAC) |

**Pattern grounding** : `search → fetch → trafilatura → chunk → ré-injection avec URLs` +
nœud LangGraph « hallucination check », imposer la citation des sources.

**Top 3** : (1) SearXNG self-host (gratuit, illimité, privacy-first = aligné projet) ;
(2) trafilatura + grounding cité ; (3) Agent Géo = Nominatim + STAC + Open-Meteo.

---

## Axe 3 — Reproduire une carte depuis une image

Pipeline : **(A) géoréférencer → (B) VLM extrait légende/symbologie → (C) segmenter/vectoriser
→ (D) OCR toponymes → (E) générer QML/SLD via PyQGIS**. Réutilise massivement l'existant
(`vision-multipart`, agent vision, `samgeo_tool.py`, `qgis_tools.py`).

| Reco | Repo/modèle | Licence | Effort | Intégration |
|------|-------------|---------|--------|-------------|
| Extraction légende/symbologie | **Llama 3.2 Vision (NIM)** + prompt JSON | gratuit NIM | Faible | agent vision + vision multipart : crop légende → JSON {couleur, géom, label} |
| Palette couleurs fiable | scikit-learn KMeans | BSD | Faible | outil `color_tool` → symbologie |
| Segmentation entités | **opengeos/segment-geospatial** + Geo-SAM | MIT | Moyen | **déjà là** (`samgeo_tool.py`), piloté par labels VLM |
| Géoréférencement auto sans GCP | **Magic Georeferencer** (MatchAnything) | Apache-2.0 | Moyen | étape amont via `mcp_server`, recale sur OSM/IGN |
| OCR toponymes | PaddleOCR (léger) ; MapTextPipeline/mapKurator (cartes anciennes) | Apache-2.0 / voir repo | Faible→Élevé | outil OCR exposé MCP |
| Vectorisation raster→vecteur | gdal_polygonize (natif) + potrace | MIT/GPL | Faible | action PyQGIS après masques samgeo |
| Génération QML/SLD | PyQGIS `QgsCategorizedSymbolRenderer` + `saveNamedStyle()` | natif | Faible | cœur `qgis_tools` : JSON légende → symboles |

**Top 3** : (1) **VLM légende → JSON → QML** (le différenciateur, réutilise tout, gratuit) ;
(2) Magic Georeferencer en première étape (sinon tout reste en pixels) ;
(3) samgeo (déjà intégré) piloté par les labels du VLM.

---

## Le fil conducteur : le TOOL CALLING

Les trois axes convergent vers une seule capacité fondatrice : **exposer les actions QGIS,
la recherche web et la vision comme des outils (functions) appelables par le LLM**. C'est ce qui
fait passer de « chatbot qui écrit du code » à « agent qui agit ». Le gateway LiteLLM le supporte
déjà ; `mcp_server.py` est le point de centralisation.

## Roadmap proposée (intégration dans le Chantier A)

| Phase | Contenu | Pré-requis |
|-------|---------|-----------|
| **B** | Hygiène repo | — |
| **A-S1** | Gateway unifié + catalogue NVIDIA validé | B |
| **A-S2** | Fédération branchée (routing/model-tiering) | S1 |
| **A-S3** | **Tool calling QGIS** + consolidation MCP (les 14 outils standard, garde sécurité exec) | S2 |
| **A-S4** | Auto-pilot : Plan-and-Execute + checkpointer SQLite + doc grounding (Docling) | S3 |
| **A-S5** | Web-grounding : SearXNG + trafilatura + agents Web/Géo (Nominatim/STAC/Open-Meteo) | S3 |
| **A-S6** | Reproduction de carte : VLM légende→JSON→QML + géoréf auto + samgeo piloté | S3 |

S4/S5/S6 sont **parallélisables** une fois S3 (tool calling) en place.

## Sources principales
- [opengeos/GeoAgent](https://github.com/opengeos/GeoAgent) ·
  [GIS-Copilot/SpatialAnalysisAgent](https://github.com/GIS-Copilot/SpatialAnalysisAgent)
- [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) ·
  [docling](https://github.com/docling-project/docling)
- [SearXNG](https://github.com/searxng/searxng) · [crawl4ai](https://github.com/unclecode/crawl4ai) ·
  [trafilatura](https://trafilatura.readthedocs.io/) · [Open-Meteo](https://open-meteo.com/) ·
  [STAC](https://www.ogc.org/standards/stac/)
- [segment-geospatial](https://github.com/opengeos/segment-geospatial) ·
  [Geo-SAM](https://github.com/coolzhao/Geo-SAM) ·
  [Magic Georeferencer](https://github.com/FungoBungaloid/georefio) ·
  [MapTextPipeline](https://github.com/yyyyyxie/MapTextPipeline) ·
  [mapKurator](https://github.com/machines-reading-maps/mapkurator-system)
