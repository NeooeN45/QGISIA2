# Design — Amélioration de QGISIA+ (GeoSylva AI)

**Date** : 2026-06-05
**Statut** : Validé (en attente de relecture utilisateur)
**Auteur** : Camil + Claude

---

## Contexte

QGISIA+ est un assistant IA pour QGIS (plugin Python + UI React servie en local).
Le projet est avancé mais en phase d'accumulation rapide : dette d'hygiène, code LLM
en double chemin, et une fédération multi-agents NVIDIA NIM construite mais **non branchée**.

Objectif global : **assainir le repo puis faire de NVIDIA NIM le cerveau réel de l'app**,
avec NVIDIA (tier gratuit `build.nvidia.com`) comme cœur et les autres providers en fallback.

## Décomposition en chantiers

Le périmètre « améliorer tout le projet » est découpé en chantiers indépendants,
chacun avec son propre cycle spec → plan → implémentation :

| # | Chantier | État |
|---|----------|------|
| **B** | Hygiène du repo | **Spec ci-dessous — chantier courant** |
| **A** | Cerveau NVIDIA NIM (gateway + fédération) | Design validé — Phase 2 (annexe) |
| C | Découpe du monolithe `geoai_assistant.py` (3612 l.) | À spécifier plus tard |
| D | Refactor gros fichiers front (SettingsModal, qgis-tools…) | Au fil de l'eau |
| E | Qualité & CI (tests centralisés, lint, couverture) | À spécifier plus tard |

**Ordre validé** : B → A, puis C/D/E au fil de l'eau.

---

# Chantier B — Hygiène du repo (scope de cette spec)

Objectif : terrain propre et lisible avant le travail NVIDIA. Tout est réversible
sauf la suppression explicitement validée des anciens builds.

## B.1 — Archives `.zip`

- **Constat** : ~24 archives `.zip` à la racine (~700 Mo), de `v2.2` à `v3.4`.
  Déjà couvertes par `*.zip` dans `.gitignore` (donc hors git, mais polluent le dossier).
- **Décision utilisateur** : garder uniquement la dernière (`QGISIA_Plus_v3.4.zip`),
  supprimer les ~23 autres (builds régénérables via `npm run build`).
- **Action** :
  1. Créer `releases/`.
  2. Déplacer `QGISIA_Plus_v3.4.zip` → `releases/`.
  3. Supprimer les autres `.zip` de la racine (y compris `GeoSylva_AI.zip`,
     `GeoSylvaAI_v2.1_Sprint1b.zip`, `QGISIA2_*.zip`, `QGISIA_Plus_v2.x`→`v3.3`).
  4. Vérifier que `releases/` reste gitignoré (ajouter `releases/` au `.gitignore`).

## B.2 — Centralisation des scripts

- **Constat** : 15 `test_*.py` + helpers (`check_*.py`, `install_*.py`,
  `benchmark_ollama.py`, `dev_server.py`, `*.ps1`) éparpillés à la racine,
  alors qu'un dossier `tests/` propre existe déjà.
- **Action** :
  1. Déplacer tous les `test_*.py` de la racine → `tests/`.
  2. Déplacer les helpers de dev (`check_gateway.py`, `check_nvidia_setup.py`,
     `install_gateway.py`, `benchmark_ollama.py`, `*.ps1`) → `scripts/`.
  3. Corriger les imports / `sys.path` impactés (ces scripts importent depuis `QGISIA2/`).
  4. Lancer la suite de tests après déplacement pour confirmer 0 régression d'import.
- **Garde-fou** : si un script casse de façon non triviale après déplacement,
  le laisser en place et le noter plutôt que forcer.

## B.3 — Cohérence de version

- **Constat** : `package.json` = `1.0.0`, `metadata.txt` = `2.1`, zips jusqu'à `v3.4`.
- **Décision utilisateur** : aligner sur **`3.4`**, source unique de vérité.
- **Action** :
  1. Créer un fichier `VERSION` racine contenant `3.4`.
  2. Mettre `package.json` → `"version": "3.4.0"`.
  3. Mettre `QGISIA2/metadata.txt` → `version=3.4`.
  4. Documenter dans le README que `VERSION` est la source unique.

## B.4 — Licence

- **Constat** : le README affiche un badge **MIT** ; le `metadata.txt` n'indique pas de
  licence ; le fichier `LICENSE` existe (contenu à vérifier).
- **Action** :
  1. Lire `LICENSE` et déterminer la licence réelle.
  2. Aligner badge README ↔ fichier `LICENSE` ↔ champ licence éventuel.
  3. Si divergence non triviale, **demander à l'utilisateur** quelle licence fait foi.

## B.5 — Fichiers morts / temporaires

- **Constat** : `hf-model-test-results.json` (0 octet), divers `*_results.json` de tests.
- **Action** :
  1. Supprimer `hf-model-test-results.json` (vide).
  2. Vérifier que les JSON de résultats temporaires sont gitignorés (`*.json` l'est,
     avec whitelist `package.json`/`tsconfig.json`/etc. déjà en place).
  3. Conserver `nvidia_models_test_results.json` (utile pour le Chantier A) mais
     le déplacer dans `tests/fixtures/` ou `docs/`.

## B.6 — Nom produit

- **Constat** : README = « GeoSylva AI », plugin = « QGISIA2 », dossier = « QGISIA ».
- **Action** : clarifier le nom produit officiel dans le README (note de cohérence,
  pas de renommage de code à ce stade).

## Critère de succès — Chantier B

- Racine du repo épurée : plus de `.zip` épars, plus de `test_*.py` à la racine.
- `npm run test` (Vitest) et la suite Python passent sans régression d'import.
- Une seule version (`3.4`) cohérente dans `VERSION`, `package.json`, `metadata.txt`.
- Licence cohérente entre README et fichier `LICENSE`.
- `git status` propre, aucun fichier suivi supprimé par erreur.

## Tests — Chantier B

- Après B.2 : exécuter `python -m pytest tests/` et `npm run test`.
- Vérifier `npm run lint` (tsc --noEmit) toujours vert.
- Vérification manuelle : le plugin se charge toujours (imports `QGISIA2/` intacts).

---

# Annexe — Chantier A (Phase 2, design déjà validé)

> Capturé ici pour mémoire. Fera l'objet de sa propre spec/plan au démarrage de la Phase 2.

## Architecture cible

Un seul chemin : l'UI passe par le gateway Python (déjà servi en HTTP), NVIDIA NIM en cœur.

```
UI React (Chat)
  └─► litellm-client.ts ──HTTP──► /api/llm/chat   (existe)   ← Sprint 1
                                  /api/llm/smart  (à créer)  ← Sprint 2
                                       │
                              llm_gateway.py (LiteLLM)
                                       │
                NVIDIA NIM (cœur) · OpenRouter/Gemini · Ollama
                                       │
                          agent_federation.py (router → agent)
```

Principes : catalogue **100% testé en live**, clés API **jamais** dans le navigateur.

## Sprint 1 — Unification du gateway

1. Script `validate_nvidia_models.py` (étend `test_all_nvidia_models.py`) →
   `config/models.validated.json`.
2. Curer `config/models.json` : primaires = modèles validés, NVIDIA en tête.
3. Brancher le chat (`Chat.tsx`/`llm.ts`) sur `streamChat()` de `litellm-client.ts`.
4. Champ clé NVIDIA dans `GatewaySettingsPanel.tsx` + `useGatewayStore.ts` (test ping).
5. Sélecteur « cerveau » dans le ChatHeader (alias `smart-default`/`vision`/`code-pyqgis`).

## Sprint 2 — Fédération branchée

1. Corriger `agent_federation.py` : chaque agent → modèle **validé**.
2. Endpoint `POST /api/llm/smart` dans `geoai_assistant.py` → `federation.process()`.
3. Client + store front, phases affichées via `ReasoningPhasesView.tsx`.
4. Mode « SIG Intelligent » (toggle chat simple ↔ fédération auto-routée).
5. Supprimer le bridge QWebChannel `agent_bridge.py` au profit de l'endpoint HTTP.

## Modèles NVIDIA validés (tests réels 2026-04-26, 7/15 OK)

| Agent | Modèle validé | Latence |
|-------|---------------|---------|
| Router | `nvidia/nemotron-mini-4b-instruct` | 322 ms |
| QGIS Expert / général / summarizer | `meta/llama-3.3-70b-instruct` | 498 ms |
| Raisonnement spatial | `meta/llama-3.1-70b-instruct` (405b option, ~12 s) | 977 ms |
| Vision carto | `meta/llama-3.2-90b-vision-instruct` (+ 11b fallback) | 0.6–3.3 s |
| Extraction JSON | `mistralai/mixtral-8x22b-instruct-v0.1` | 438 ms |
| Code PyQGIS | `qwen/qwen2.5-coder-32b-instruct` *(à valider)*, sinon `llama-3.3-70b` | — |
| Safety / Translate | modèles 404 → remplacés par prompt sur `llama-3.3-70b` | — |

**Modèles invalides à retirer du registre** : `mistral-large-3-675b-instruct-2512`,
`mistral-large-2-instruct`, `llama-3.1-nemotron-ultra-253b-v1`, `nemotron-4-340b`,
`riva-translate-4b-instruct*`, `llama-3.1-nemoguard-8b-content-safety`,
`nemotron-3-content-safety` (tous 404 ou jamais testés).

## Critères de succès — Chantier A

- Sprint 1 : une question SIG répond via NVIDIA depuis l'UI, fallback auto si timeout,
  budget tracké, clé jamais visible côté front.
- Sprint 2 : « buffer 500 m autour des écoles » → routé Code ; « analyse cette carte
  IGN » → routé Vision ; phases visibles dans l'UI.
