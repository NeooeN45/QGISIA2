# A2 — Concurrents, fonctionnalités & sources de données (recherche multi-agents)

**Date** : 2026-06-05
**Méthode** : 3 agents parallèles (concurrents / inventaire features / sources géodonnées).
**But** : compléter la vision produit avant de construire — quoi copier, quoi ajouter, quelles
données brancher. Tout open-source/gratuit, NVIDIA NIM au cœur.

---

## 1. Concurrents — ce qu'on copie

| Projet | Force | À copier | Effort |
|--------|-------|----------|--------|
| GIS Copilot / SpatialAnalysisAgent | 600+ outils QGIS documentés pour le LLM | **Métadonnées structurées par outil** injectées au prompt (meilleur tool-calling) | Moyen |
| QgisStreamMCP | 30+ datasets FR + **recettes auto** (`run_recipe("risque_inondation")`) | **Bibliothèque de recettes thématiques** paramétrées | Moyen |
| IntelliGeo | Génère du **modèle graphique** Processing (pas que du code jetable) | Sortie workflow réutilisable/éditable | Moyen |
| opengeos/GeoAgent | Confirmation hooks avant ops destructives | **Garde de confirmation** + thread GUI | Faible |
| opengeos/geoai (plugin) | Détection clé-en-main (DeepForest arbres, OmniWaterMask, SAM3, Moondream) | **Pipelines de détection pré-emballés** sans code | Moyen |
| Bunting Labs AI Vectorizer | « Autocomplete » de vectorisation de cartes scannées | Vectorisation assistée + auto-calage | Élevé |
| ArcGIS Pro Assistant 3.6 | NL → action UI directe (pas que du code) | **Déclenchement d'actions UI QGIS** | Moyen |
| Felt AI | Dashboards no-code + popups IA + styling auto | **Génération de dashboards + narration** | Élevé |
| Atlas.co | Enrichissement auto (scores/classes générés) | Enrichissement automatique de données | Moyen |
| kepler.gl AI | « Data never sent to LLM » | **Garantie privacy affichée** (UX) | Faible |
| samgeo (SAM3) | Détection open-vocabulary par prompt texte | Masques live sur la carte par prompt | Moyen |

**Top 5 manques à combler** : (1) recettes/workflows thématiques paramétrés ; (2) dashboards +
narration de données ; (3) détection d'objets clé-en-main sur imagerie ; (4) sortie « modèle
graphique » Processing éditable ; (5) confirmation hooks + auto-diagnostic.
**Atout déjà supérieur** : couverture native de l'écosystème FR (IGN, Cadastre, Hub'Eau, DVF,
GBIF) + NIM gratuit + Ollama offline — quasi personne ne couvre la France aussi bien.

---

## 2. Fonctionnalités à fort « wow » + utilité

**Quick wins (faible effort, fort impact)** :
1. **Analyse spatiale en langage naturel** (buffer/intersection/proximité/multicritère) → `processing.run()`.
2. **Diagnostic & auto-réparation données** (géométries invalides, topologie, valeurs manquantes) — Geometry/Topology Checker.
3. **Indices spectraux par prompt** (NDVI/NDWI/NDBI/NBR) — `QgsRasterCalculator`.
4. **Hot-spots & autocorrélation** (Getis-Ord Gi*, Moran's I) — `esda`/`libpysal`.

**Vitrines NIM (effort moyen, fort effet)** :
5. **Génération auto de mise en page imprimable + Atlas** (layout/légende/échelle) — `QgsLayout`.
6. **Rapport/storytelling automatique** (synthèse + graphiques + reco) — capitalise sur l'export PDF/Word existant.
7. **Détection de changement & occupation du sol** multi-temporelle — `opengeos/geoai` (torchange), foundation models Prithvi-EO / Clay.
8. **Extraction d'objets** (bâti/routes/arbres) — samgeo (déjà là) + DeepForest + OmniWaterMask.

**Plus ambitieux** : workflows métier en 1 clic (forêt/urba/agri/risques), simulation what-if,
voice-to-GIS (NIM ASR Parakeet/Canary), historique/undo/templates partageables.

---

## 3. Sources de cartes & données à brancher (gratuit/ouvert)

### ⭐ Sentinel-1 & Sentinel-2 (priorité explicite utilisateur)
- **Microsoft Planetary Computer** — STAC `planetarycomputer.microsoft.com/api/stac/v1` :
  Sentinel-2 L2A, **Sentinel-1 GRD/RTC**, Landsat, NAIP, DEM. Recherche temporelle puissante.
- **Earth Search (AWS / Element84)** — STAC `earth-search.aws.element84.com/v1`, **sans clé** :
  Sentinel-1/2, Landsat C2, en COG.
- **Copernicus Data Space** — déjà branché ; compléter avec l'accès STAC.
- **Sentinel via Géoplateforme IGN** — WMTS/WMS, mosaïques Sentinel-2 prêtes (Licence Ouverte, FR).
- Usage typique agent : Sentinel-2 pour NDVI/occupation du sol/changement ; **Sentinel-1 (radar)**
  pour inondations, humidité du sol, suivi tout-temps (sans nuages).

### Fonds de carte / tuiles
Protomaps/PMTiles (offline planétaire), CARTO (Positron/Voyager), Stadia/Stamen (terrain/toner),
ESRI World Imagery (satellite), MapTiler (vector + terrain RGB), OpenTopoMap.

### Imagerie & catalogues
Planet NICFI (tropiques <5 m), Maxar Open Data (post-catastrophe THR), USGS NAIP, STAC Index (annuaire).

### Données thématiques mondiales
ESA WorldCover 10 m, Google Dynamic World, Copernicus DEM / FABDEM, **Overture Maps** (2,3 Md bâtiments + POI + routes), WorldPop/GHSL (population), HydroSHEDS (hydro), Open-Meteo (météo/ERA5 sans clé).

### France / Europe complémentaires
RPG (parcelles agricoles), BD Forêt v2 IGN, INSEE Filosofi carroyé 200 m, Sentinel Géoplateforme.

### Top 10 à intégrer (mix FR + mondial)
1. Planetary Computer (STAC) · 2. Earth Search AWS (STAC sans clé) · 3. Overture Maps ·
4. ESA WorldCover · 5. Protomaps/PMTiles · 6. Open-Meteo · 7. RPG + BD Forêt ·
8. INSEE Filosofi · 9. Copernicus DEM/FABDEM · 10. ESRI World Imagery + Stadia/CARTO.

**Intégration** : privilégier **STAC** (recherche temporelle, Sentinel) + **WMTS/XYZ**
(clé-en-main QGIS) ; **GeoParquet** (Overture, INSEE) via DuckDB pour l'analytique sans téléchargement.

---

## 4. Où ça atterrit dans la roadmap (Chantier A)

| Capacité issue de A2 | Sprint cible |
|----------------------|--------------|
| Métadonnées outils + tool calling | A-S3 (tool calling) |
| Recettes/workflows thématiques + actions UI | A-S4 (auto-pilot) |
| Web/géo-grounding + nouvelles sources (STAC Sentinel, Overture, Open-Meteo) | A-S5 (web-grounding) + connecteurs REST |
| Détection objets / changement / occupation du sol / repro carte | A-S6 (vision) |
| Quick wins (analyse NL, diagnostic, indices, hot-spots) | À glisser en A-S3/S4 (forte valeur, faible effort) |
| Dashboards + narration, mise en page auto | A-S7 (rendu & livrables) — nouveau |
| Confirmation hooks + privacy affichée | transverse (A-S3.5 + UX) |

> Ces éléments **enrichissent** la roadmap existante (B → A-S1…S7). Ils ne se construisent pas
> tous d'un coup : la fondation (B → S1 gateway → S2 fédération → S3 tool calling) reste le
> chemin critique. Le reste se parallélise après S3.

## Sources principales
- Concurrents : [SpatialAnalysisAgent](https://plugins.qgis.org/plugins/SpatialAnalysisAgent-master/) ·
  [GIS Copilot (paper)](https://www.tandfonline.com/doi/full/10.1080/17538947.2025.2497489) ·
  [GeoAI plugin](https://plugins.qgis.org/plugins/geoai/) · [opengeos/GeoAgent](https://github.com/opengeos/GeoAgent) ·
  [Esri AI Assistants](https://www.esri.com/arcgis-blog/products/arcgis-online/geoai/whats-new-in-ai-assistants-october-2025) ·
  [Atlas — Top GIS Copilots](https://atlas.co/blog/top-3-gis-copilots-ai-assistants-for-geospatial-analysis/)
- Sources : [Planetary Computer](https://planetarycomputer.microsoft.com/) ·
  [Earth Search](https://element84.com/earth-search/) · [Overture](https://docs.overturemaps.org/) ·
  [ESA WorldCover](https://esa-worldcover.org/) · [Protomaps](https://protomaps.com/) ·
  [Open-Meteo](https://open-meteo.com/) · [RPG IGN](https://geoservices.ign.fr/documentation/donnees/vecteur/rpg)
