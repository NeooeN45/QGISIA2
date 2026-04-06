# GeoSylva AI for QGIS

Assistant IA pour QGIS — interface web React servie directement par le plugin, avec bridge QGIS integre.

## Installation rapide (v2.0)

### Methode ZIP (recommandee)
1. Telechargez `geoai_assistant.zip` depuis le depot GitHub
2. Dans QGIS : **Extensions > Installer/Gerer les extensions > Installer depuis un ZIP**
3. Selectionnez le ZIP et cliquez **Installer**
4. Activez **GeoSylva AI** dans la liste des extensions

> **Aucun serveur externe requis.** Cliquez sur le bouton GeoSylva AI dans la barre d'outils, l'interface s'ouvre automatiquement dans votre navigateur avec le bridge QGIS actif.

## Providers IA supportes

| Provider | Modele par defaut |
|---|---|
| **Local / Ollama** (defaut) | `qwen3:4b` via `localhost:11434` |
| **Google Gemini** | `gemini-2.5-flash` |
| **OpenRouter** | Multi-agent configurable |

## Fonctionnalites cles

- historique de conversations persiste localement
- contexte de discussion par couche avec portee `couche` ou `selection active`
- barre laterale retractable pour naviguer entre sessions et couches
- mode `plan d'execution` pour preparer un traitement avant action
- diagnostic automatique des couches avec alertes qualite
- gestion directe des couches : visibilite, opacite, zoom et filtres
- appels QGIS depuis l'agent et depuis l'interface
- provider `OpenRouter` avec orchestration multi-agent
- roles configurables `planner`, `planner deep`, `reviewer`, `retriever`, `executor`
- reranking embeddings OpenRouter pour prioriser le bon contexte avant reponse
- mode `tools` OpenRouter pour appeler directement les outils QGIS
- catalogue de services et APIs officiels pour IGN, geo.api.gouv.fr, Overpass, NASA et Copernicus
- recherche officielle cadastre/communes/OSM directement depuis l'onglet `Services`
- stylage parcellaire, etiquetage et decoupe de parcelles selectionnees
- fusion multi-bandes de rasters pour construire des composites bi-annuels NDVI / CRswir
- creation de grilles d'inventaire et generation automatique des centroides

## OpenRouter multi-agent

Profils integres : **gratuit**, **valeur** (recommande), **qualite**

Le menu **Parametres IA** permet de configurer la pile complete : planner, planner deep, reviewer, retriever embeddings, executor.

## Sources officielles et services

L'onglet **Services** expose :
- `IGN / cartes.gouv.fr / Geoplateforme`
- `API Carto Cadastre`
- `geo.api.gouv.fr`
- `Overpass / OpenStreetMap`
- `Copernicus Data Space`
- `NASA Earthdata / CMR STAC`

## Developpement (rebuilder le frontend)

Prerequis : Node.js 20+

```bash
npm install
npm run build   # genere qgis_plugin/web/
```

Optionnel - fichier `.env.local` :
```
VITE_GEMINI_API_KEY=...
VITE_OPENROUTER_API_KEY=...
```

Pour le developpement live (Vite dev server) :
```bash
npm run dev   # http://localhost:5173
```

## Ce que le plugin expose a l'IA

- liste et catalogue des couches du projet
- lecture des champs attributaires et diagnostic detaille
- application de filtres, visibilite, opacite et zoom
- statistiques sur un champ numerique
- reprojection d'une couche vecteur
- ajout de GeoJSON distants dans la carte
- style parcellaire et etiquetage automatique
- decoupe des entites selectionnees par ligne
- chargement de services WMS/WFS/XYZ
- calcul raster et calcul de MNH
- execution confirmee de scripts PyQGIS

## Compatibilite

- QGIS 3.16+ et QGIS 4.0 (Qt6/PyQt6)
- Windows, Linux, macOS
- Python 3.9+
