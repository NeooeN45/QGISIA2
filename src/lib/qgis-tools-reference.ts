/**
 * Comprehensive QGIS tools reference injected into LLM prompts.
 * This gives the LLM full knowledge of available bridge functions,
 * official data sources, and how to chain complex workflows.
 */

export const QGIS_TOOLS_REFERENCE = `
## Outils QGIS disponibles via le bridge

Tu as accès à un bridge QGIS qui expose les fonctions suivantes. Quand l'utilisateur demande une action,
utilise ces outils natifs au lieu d'écrire du PyQGIS libre quand c'est possible.

### Gestion des couches
- **getLayersCatalog()** → liste complète des couches chargées (id, nom, type, geometryType, crs, featureCount, visible, opacity, provider)
- **getLayerFields(layerId)** → liste des noms de champs d'une couche
- **getLayerDiagnostics(layerId)** → diagnostic complet : géométries invalides, taux de remplissage des champs, alertes
- **getLayerStatistics(layerId, field)** → statistiques d'un champ (count, sum, mean, min, max, range, stddev)
- **setLayerVisibility(layerId, visible)** → afficher/masquer une couche
- **setLayerOpacity(layerId, opacity)** → régler l'opacité (0.0 à 1.0)
- **zoomToLayer(layerId)** → centrer et zoomer la carte sur une couche
- **filterLayer(layerId, subsetString)** → appliquer un filtre SQL sur une couche (ex: "commune = 'Rennes'")
- **reprojectLayer(layerId, targetCrs)** → reprojeter une couche (ex: "EPSG:2154")

### Style et étiquettes
- **applyParcelStylePreset(layerId, presetId)** → appliquer un style cadastral prédéfini
- **setLayerLabels(layerId, fieldName, enabled)** → activer/désactiver les étiquettes sur un champ

### Ajout de données
- **addRasterFile(filePath, layerName)** → charger un fichier raster (.tif, .img, .vrt)
- **addGeoJsonLayer(geojson, layerName)** → ajouter une couche GeoJSON directement
- **addServiceLayer(config)** → ajouter un flux distant (WMS, WFS, WMTS, XYZ, WCS, ArcGIS)

### Calcul raster
- **calculateRasterFormula(layerIds[], formula, outputName, outputPath?)** → calculatrice raster (formules type "A * B", "A - B", "(A - B) / (A + B)")
- **mergeRasterBands(layerIds[], outputName, outputPath?)** → fusion multi-bandes (pour images bi-annuelles NDVI, CRswir, etc.)
- **calculateMnh(mnsLayerId, mntLayerId, outputName, outputPath?, clampNegative?)** → calcul du Modèle Numérique de Hauteur (MNS - MNT)

### Inventaire forestier
- **createInventoryGrid(layerId, cellWidth, cellHeight, gridName, centroidsName, clipToSource?)** → créer une grille d'inventaire et ses centroïdes sur une emprise polygonale

### Exécution de scripts
- **runScript(script)** → exécuter un script PyQGIS dans la console QGIS
- **runScriptDetailed(script, requireConfirmation)** → exécuter avec retour détaillé (ok, message, traceback)

### Sélection de fichiers
- **pickFile(fileFilter, title)** → ouvrir un sélecteur de fichiers QGIS

## Sources de données officielles disponibles

L'utilisateur peut charger directement ces sources dans QGIS via addServiceLayer(config) :

### Fonds de carte (13 sources)
- OpenStreetMap Standard, HOT, Cycle Map, Transport, Outdoors, Landscape
- CartoDB Dark Matter, Positron, Voyager
- Esri World Imagery, Street, Topo, Physical, Shaded Relief, Terrain, National Geographic

### Forêts (13 sources - RASTER + VECTEUR)
**Raster :**
- Forêts IGN (WMS) — massifs forestiers IGN
- Forêts publiques ONF (WMS) — domaine forestier public
- Peuplements forestiers (WMS)
- Végétation (WMS) — zones végétalisées
- Couverture forestière Copernicus (WMS)
- NDVI Sentinel-2 (WMS) — indice de végétation
- MODIS NDVI (WMS) — indice de végétation MODIS
- MODIS Fire (WMS) — détecteur de feux forestiers

**Vecteur :**
- Forêts publiques France (WFS) — ONF
- Peuplements forestiers (WFS)
- Essences forestières (WFS)
- Zones agricoles (WFS)
- Vignes France (WFS)

### Topographie (5 sources)
- SCAN25 (IGN) — 1:25000
- SCAN50 (IGN) — 1:50000
- SCAN100 (IGN) — 1:100000
- Plan IGN V2 (WMTS)
- ALTI (MNT) — modèle numérique de terrain

### Satellite (3 sources)
- Géoplateforme Ortho (IGN)
- NASA GIBS TrueColor
- Sentinel-2

### Environnement (5 sources)
- Corine Land Cover (EEA)
- NOAA Radar
- NOAA Precipitation

### Administratif (4 sources)
- Communes France (WFS)
- Départements France (WFS)
- Régions France (WFS)
- EPCI France (WFS)

### Géologie (3 sources)
- Carte géologique France (WFS) — BRGM
- Mines et carrières (WFS) — BRGM
- Zones sismiques (WFS) — BRGM

### Infrastructure (3 sources)
- Réseau routier (WFS)
- Autoroutes (WFS)
- Voies ferrées (WFS)

### Urbanisme (3 sources)
- Bâti 3D France (WFS)
- Zones urbanisées (WFS)
- Adresses (WFS)

### Sol et RUM (6 sources)
- Réserve Utile Maximale des sols (WFS) — INRAE
- Capacité de rétention eau sols (WFS) — INRAE
- Texture des sols (WFS)
- Profondeur du sol (WFS)
- European Soil Water Capacity (WFS) — EUSOIL
- European Soil Moisture (WFS) — EUSOIL

### Démographie (2 sources)
- World Cities (WFS)
- Population Centers (WFS)

### IGN / Géoplateforme
- Orthophotos IGN (WMTS) — imagerie aérienne haute résolution
- Plan IGN (WMTS) — fond cartographique officiel
- Carte IGN (WMTS) — carte topographique
- Parcelles cadastrales IGN (WMS/WFS) — cadastre vectoriel
- BDTOPO IGN — bâtiments, routes, hydrographie
- MNT/MNS IGN — modèles numériques de terrain et surface

### API Carto / geo.api.gouv.fr
- **searchCadastreParcels(codeInsee, section?, numero?)** → recherche et ajout de parcelles cadastrales par commune
- **searchGeoApiCommunes(name)** → recherche de communes par nom avec géométrie

### OpenStreetMap
- **searchOverpassFeatures(query, endpoint?)** → requête Overpass API pour extraire des données OSM

### Satellite
- **searchCopernicusProducts(collection?, nameContains?, limit?)** → catalogue Copernicus (Sentinel-2, etc.)
- **searchNasaCatalog(collection, bbox?, limit?)** → catalogue NASA STAC (HLSS30, Landsat, etc.)

## Workflows types (chaînage d'outils)

### Cadastre communal complet
1. searchGeoApiCommunes(nom) → résoudre le code INSEE
2. searchCadastreParcels(codeInsee) → charger les parcelles
3. applyParcelStylePreset(layerId, "cadastre") → appliquer le style
4. setLayerLabels(layerId, "", true) → activer les étiquettes
5. zoomToLayer(layerId) → centrer la carte

### Image bi-annuelle NDVI/CRswir
1. Identifier les rasters NDVI dans les couches chargées
2. mergeRasterBands([id_2023, id_2024], "NDVI_biannuel") → fusion
3. zoomToLayer(outputLayerId) → centrer sur le résultat

### Dispositif d'inventaire forestier
1. Identifier une couche polygonale d'emprise
2. createInventoryGrid(layerId, 250, 250, "Grille", "Centroides", true)
3. zoomToLayer(gridLayerId) → centrer sur la grille

### Calcul MNH (Modèle Numérique de Hauteur)
1. Identifier MNS et MNT dans les rasters chargés
2. calculateMnh(mnsId, mntId, "MNH", "", true) → calcul MNS - MNT
3. zoomToLayer(mnhLayerId) → centrer

### Analyse de couche complète
1. getLayerDiagnostics(layerId) → vérifier la qualité
2. getLayerStatistics(layerId, field) → statistiques par champ
3. Synthétiser les alertes et recommander des actions correctives

### Ajout d'un flux distant
1. addServiceLayer({ serviceType: "WMS", url: "...", layerName: "...", name: "..." })
2. zoomToLayer(newLayerId) → centrer

## Règles pour le code PyQGIS

Quand tu dois écrire du PyQGIS (et seulement quand aucun outil natif ne couvre le besoin) :
- Utilise TOUJOURS un unique bloc \`\`\`python\`\`\` complet et exécutable
- Les imports disponibles : iface, QgsProject, processing, et toutes les classes Qgs*
- Ne crée JAMAIS de couches, champs ou CRS qui n'existent pas dans le contexte
- Préfère processing.run() pour les algorithmes QGIS natifs
- Gère les erreurs proprement avec try/except
- Termine par un message de confirmation (print ou iface.messageBar())

Algorithmes processing courants :
- processing.run("native:buffer", {...}) — zones tampon
- processing.run("native:clip", {...}) — découpage
- processing.run("native:intersection", {...}) — intersection
- processing.run("native:dissolve", {...}) — fusion
- processing.run("native:difference", {...}) — différence
- processing.run("native:joinattributestable", {...}) — jointure attributaire
- processing.run("native:fieldcalculator", {...}) — calculatrice de champs
- processing.run("native:selectbyexpression", {...}) — sélection par expression
- processing.run("native:extractbyexpression", {...}) — extraction par expression
- processing.run("native:centroids", {...}) — centroïdes
- processing.run("native:voronoipolygons", {...}) — Voronoï
- processing.run("native:convexhull", {...}) — enveloppe convexe
- processing.run("gdal:rastercalculator", {...}) — calcul raster avancé
- processing.run("gdal:translate", {...}) — conversion raster
- processing.run("gdal:contour", {...}) — courbes de niveau
`.trim();

/**
 * Short version for local models with limited context windows.
 */
export const QGIS_TOOLS_REFERENCE_SHORT = `
## Outils QGIS disponibles

### Couches : getLayersCatalog, getLayerFields, getLayerDiagnostics, getLayerStatistics, setLayerVisibility, setLayerOpacity, zoomToLayer, filterLayer, reprojectLayer
### Style : applyParcelStylePreset, setLayerLabels
### Données : addRasterFile, addGeoJsonLayer, addServiceLayer (WMS/WFS/WMTS/XYZ/WCS)
### Raster : calculateRasterFormula, mergeRasterBands, calculateMnh
### Inventaire : createInventoryGrid (grille + centroïdes)
### Scripts : runScript (PyQGIS libre), runScriptDetailed (avec traceback)
### Sources : searchCadastreParcels, searchGeoApiCommunes, searchOverpassFeatures, searchCopernicusProducts, searchNasaCatalog, loadOfficialSource (IGN ortho/plan/carte, cadastre, BDTOPO)

### Workflows types
- Cadastre : searchGeoApiCommunes → searchCadastreParcels → applyParcelStylePreset → setLayerLabels → zoomToLayer
- NDVI bi-annuel : identifier rasters → mergeRasterBands → zoomToLayer
- Inventaire : identifier polygone → createInventoryGrid → zoomToLayer
- MNH : identifier MNS+MNT → calculateMnh → zoomToLayer
- Analyse : getLayerDiagnostics → getLayerStatistics → synthèse

### PyQGIS (quand aucun outil natif ne suffit)
- Un seul bloc \`\`\`python\`\`\` complet et exécutable
- Imports disponibles : iface, QgsProject, processing, Qgs*
- Préférer processing.run() pour les algorithmes natifs (buffer, clip, intersection, dissolve, joinattributestable, fieldcalculator, selectbyexpression, centroids, etc.)
- Ne jamais inventer de couches/champs/CRS absents du contexte
`.trim();
