# GeoSylva AI for QGIS

Projet hybride :
- interface web `React + Vite + TypeScript`
- plugin QGIS `PyQGIS`

## Fonctionnalités clés

- historique de conversations persisté localement
- contexte de discussion par couche avec portée `couche` ou `sélection active`
- barre latérale rétractable pour naviguer entre sessions et couches
- mode `plan d'exécution` pour préparer un traitement avant action
- diagnostic automatique des couches avec alertes qualité
- gestion directe des couches : visibilité, opacité, zoom et filtres
- appels QGIS depuis l'agent et depuis l'interface
- provider `OpenRouter` avec orchestration multi-agent
- rôles configurables `planner`, `planner deep`, `reviewer`, `retriever`, `executor`
- reranking embeddings OpenRouter pour prioriser le bon contexte avant réponse
- mode `tools` OpenRouter pour appeler directement les outils QGIS
- catalogue de services et APIs officiels pour IGN/cartes.gouv.fr, geo.api.gouv.fr, Overpass, NASA et Copernicus
- recherche officielle cadastre/communes/OSM directement depuis l’onglet `Services`
- stylage parcellaire, étiquetage et découpe de parcelles sélectionnées
- fusion multi-bandes de rasters pour construire des composites bi-annuels NDVI / CRswir
- création de grilles d’inventaire et génération automatique des centroïdes

## Développement web

Prérequis : Node.js 20+

1. `npm install`
2. Optionnel : créez un fichier `.env.local` avec `VITE_GEMINI_API_KEY=...` et/ou `VITE_OPENROUTER_API_KEY=...`
3. Lancez `npm run dev`

L'application web peut fonctionner seule. Depuis QGIS, le plugin utilise :
- `QWebChannel` si le runtime web Python de QGIS est disponible
- sinon un bridge HTTP local et l'ouverture automatique de l'interface dans le navigateur

Par défaut, l'interface démarre maintenant en mode **local** avec Ollama sur `qwen3:4b-instruct-2507-q4_K_M`.

## OpenRouter multi-agent

Le menu **Paramètres IA** permet maintenant de configurer une pile OpenRouter complète :

- `planner` rapide
- `planner deep`
- `reviewer`
- `retriever` embeddings
- `executor`

Le mode OpenRouter expose aussi :

- choix `single agent` ou `multi-agent`
- mode `draft` ou `tools` pour autoriser les appels QGIS
- clé API locale ou `VITE_OPENROUTER_API_KEY`
- endpoint, nom d'application et `HTTP-Referer`

## Workflow TP télédétection

Le plugin sait maintenant couvrir directement les étapes opérationnelles visibles dans le TP :

- charger les couches de contexte et les flux officiels utiles
- fusionner des rasters d’indices `NDVI` ou `CRswir` en images bi-annuelles
- créer un dispositif d’inventaire sur une emprise polygonale
- générer automatiquement les centroïdes des mailles

Depuis l’interface :

- onglet `Services` > section `Fusion bi-annuelle`
- onglet `Services` > section `Dispositif d'inventaire`

En langage naturel, les formulations suivantes sont maintenant prises en charge proprement en mode local :

- `fusionne les rasters NDVI 2023 et 2024 en image bi-annuelle`
- `crée un dispositif d'inventaire 250 x 250 avec les centroïdes`
- `ajoute la commune de Poitiers en cadastre et centre dessus`

Validation réelle QGIS disponible dans :

- `tests/qgis_tp_desktop_smoke.py`
- `C:\Users\camil\Documents\Projet\_qgis_geoai_test\logs\tp_desktop_smoke.json`
- ordre des providers et politique `data_collection`
- mode `Zero Data Retention (ZDR)`
- `response-healing` pour fiabiliser les sorties JSON structurées
- lecture de l'état de la clé OpenRouter via `/api/v1/key`
- affichage optionnel de la trace multi-agent dans la réponse
- profils prêts à l'emploi `gratuit`, `valeur`, `qualité`

Profils intégrés :

- `gratuit`
  - planner : `qwen/qwen3-next-80b-a3b-instruct:free`
  - planner deep : `z-ai/glm-4.5-air:free`
  - reviewer : `openai/gpt-oss-120b:free`
  - retriever : `nvidia/llama-nemotron-embed-vl-1b-v2:free`
  - executor : `qwen/qwen3-coder:free`
- `valeur` (recommandé)
  - planner : `qwen/qwen3-next-80b-a3b-instruct`
  - planner deep : `openai/gpt-oss-120b`
  - reviewer : `openai/gpt-oss-120b`
  - retriever : `nvidia/llama-nemotron-embed-vl-1b-v2:free`
  - executor : `qwen/qwen3-coder-next`
- `qualité`
  - planner : `qwen/qwen3-next-80b-a3b-instruct`
  - planner deep : `openai/gpt-oss-120b`
  - reviewer : `openai/gpt-oss-120b`
  - retriever : `nvidia/llama-nemotron-embed-vl-1b-v2:free`
  - executor : `qwen/qwen3-coder`

Attention : les variantes `:free` ne sont pas adaptées aux données sensibles et restent limitées en quota.

Le projet conserve **Local/Ollama** comme provider global par défaut, mais le preset OpenRouter par défaut est maintenant **Valeur** pour un usage SIG quotidien.

Le planner et le reviewer OpenRouter utilisent maintenant des **structured outputs** JSON pour stabiliser les plans et validations internes avant de reformater la réponse pour l'utilisateur.

## Sources officielles et services

L’onglet **Services** expose maintenant un point d’entrée concret vers des sources officielles et utilisables :

- `IGN / cartes.gouv.fr / Geoplateforme`
- `API Carto Cadastre`
- `geo.api.gouv.fr`
- `Overpass / OpenStreetMap`
- `Copernicus Data Space`
- `NASA Earthdata / CMR STAC`

Le LLM peut appeler ces connecteurs pour rechercher des parcelles, des communes, des objets OSM, des produits Copernicus ou des scènes NASA, puis exploiter les résultats dans QGIS quand le flux s’y prête.

## LLM local

Le projet supporte Ollama via `http://localhost:11434/api/generate`.

Lancement rapide :
1. `.\start-local-llm.ps1`
2. Ouvrez ensuite GeoAI avec le preset local :
   `http://127.0.0.1:<port>/index.html?bridge=http&provider=local&model=qwen3:4b-instruct-2507-q4_K_M&endpoint=http://localhost:11434/api/generate`

Le script démarre Ollama si besoin, vérifie la présence du modèle `qwen3:4b-instruct-2507-q4_K_M`, puis envoie une requête de chauffe.

## Build du plugin

1. `npm run build`
2. Vérifiez que le build a été généré dans `qgis_plugin/web`
3. Copiez le dossier `qgis_plugin` dans votre répertoire de plugins QGIS
4. Activez **GeoSylva AI** dans le gestionnaire d'extensions QGIS

## Ce que le plugin expose

- liste des couches du projet
- catalogue détaillé des couches du projet
- lecture des champs attributaires
- diagnostic détaillé d'une couche
- application de filtres
- visibilité, opacité et zoom sur couche
- statistiques sur un champ numérique
- reprojection d'une couche vecteur
- ajout de GeoJSON distants dans la carte
- style parcellaire et étiquetage automatique
- découpe des entités sélectionnées par ligne
- chargement de services WMS/WFS/XYZ et services personnalisés
- calcul raster et calcul de MNH
- exécution confirmée de scripts PyQGIS

## Remarques

- Le plugin charge le front localement depuis `qgis_plugin/web/index.html`
- Sur certaines installations Windows de QGIS, `PyQt5.QtWebEngineWidgets` n'est pas fourni. Le plugin bascule alors automatiquement vers le navigateur système avec un bridge local `http://127.0.0.1:*`
- Les scripts PyQGIS générés par l'IA demandent une confirmation avant exécution
