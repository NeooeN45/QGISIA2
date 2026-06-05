# Chantier B — Hygiène du repo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assainir le dépôt QGISIA+ (archives, scripts éparpillés, versions et licence incohérentes) sans aucune régression d'import ni de test.

**Architecture:** Opérations de fichiers réversibles + corrections de chemins. Les fichiers Python suivis par git sont déplacés via `git mv` puis leurs `sys.path` corrigés ; les artefacts non suivis (`.zip`) sont supprimés/déplacés au niveau filesystem. Chaque tâche se termine par une vérification (pytest / tsc / git status) et un commit.

**Tech Stack:** git, PowerShell 7 (Windows), Python/pytest, Node/Vitest, tsc.

**Branche de travail :** `chore/hygiene-puis-nvidia` (déjà créée, contient déjà le commit de spec).

---

## Structure de fichiers (décisions de décomposition)

| Chemin | Rôle | Action |
|--------|------|--------|
| `releases/` | Builds publiables (gitignoré) | Créé ; reçoit `QGISIA_Plus_v3.4.zip` |
| `tests/manual/` | Scripts de test runnables (`__main__`, réseau/clés) non collectés par pytest | Créé ; reçoit les `test_*.py` racine |
| `tests/manual/conftest.py` | Empêche pytest de collecter `tests/manual/` | Créé |
| `tests/fixtures/` | Données de tests | Créé ; reçoit `nvidia_models_test_results.json` |
| `scripts/` | Helpers de dev (checks, install, benchmark, ps1, dev_server) | Existant ; reçoit les helpers racine |
| `VERSION` | Source unique de version (`3.4`) | Créé |

**Note de déviation vs spec** : la spec disait « `test_*.py` → `tests/` ». On les met dans
`tests/manual/` (avec `conftest.py` qui bloque la collecte) car ce sont des scripts
`__main__` nécessitant clés/réseau ; les y collecter directement casserait `pytest tests/`.
Intention de centralisation respectée.

---

## Task 0 : Baseline avant modifications

**Files:** aucun (lecture seule).

- [ ] **Step 1 : Capturer l'état des tests Python**

Run (depuis la racine du repo) :
```powershell
python -m pytest tests/ -q
```
Expected : noter le résultat (PASS/FAIL/erreurs de collecte). Sert de référence « avant ».
Si pytest n'est pas dispo ou échoue déjà, le consigner — on compare l'état après à cet état.

- [ ] **Step 2 : Capturer l'état du front**

Run :
```powershell
npm run lint
npm run test
```
Expected : noter PASS/FAIL de `tsc --noEmit` et de Vitest comme référence « avant ».

- [ ] **Step 3 : Confirmer la branche**

Run :
```powershell
git rev-parse --abbrev-ref HEAD
```
Expected : `chore/hygiene-puis-nvidia`. Sinon : `git checkout chore/hygiene-puis-nvidia`.

---

## Task 1 : B.1 — Archives `.zip`

**Files:**
- Create: `releases/` (dossier)
- Modify: `.gitignore`
- Delete (filesystem, non suivis git) : tous les `.zip` racine sauf `QGISIA_Plus_v3.4.zip`

- [ ] **Step 1 : Créer `releases/` et y déplacer la dernière archive**

Run :
```powershell
New-Item -ItemType Directory -Force releases | Out-Null
Move-Item -Force "QGISIA_Plus_v3.4.zip" "releases/QGISIA_Plus_v3.4.zip"
```

- [ ] **Step 2 : Supprimer les anciennes archives racine**

Run :
```powershell
Remove-Item -Force "GeoSylva_AI.zip","GeoSylvaAI_v2.1_Sprint1b.zip","QGISIA2_backup_UI_v2.1.zip","QGISIA2_v2.1_debug_console.zip","QGISIA2_v2.1_fix_import.zip","QGISIA2_v2.1_fix_install.zip","QGISIA2_v2.1_nvidia.zip"
Get-ChildItem -Filter "QGISIA_Plus_v2.*.zip" | Remove-Item -Force
Get-ChildItem -Filter "QGISIA_Plus_v3.0.zip","QGISIA_Plus_v3.1.zip","QGISIA_Plus_v3.2.zip","QGISIA_Plus_v3.3.zip" | Remove-Item -Force
```

- [ ] **Step 3 : Vérifier qu'il ne reste aucun `.zip` à la racine**

Run :
```powershell
Get-ChildItem -Path . -Filter *.zip -File | Select-Object Name
```
Expected : aucune sortie (les zips ne sont plus qu'au format `releases/QGISIA_Plus_v3.4.zip`).

- [ ] **Step 4 : Garantir que `releases/` est gitignoré**

Ajouter la ligne `releases/` au fichier `.gitignore` (après la ligne `*.zip`).
Vérifier ensuite :
```powershell
git status --porcelain releases/
```
Expected : aucune sortie (dossier ignoré).

- [ ] **Step 5 : Commit**

```powershell
git add .gitignore
git commit -m "chore(repo): conserver uniquement le build v3.4 dans releases/ (gitignore)"
```

---

## Task 2 : B.2 — Centraliser les scripts de test runnables

**Files:**
- Create: `tests/manual/` + `tests/manual/conftest.py`
- Modify (git mv + patch sys.path) : les 11 `test_*.py` racine
  - `test_agent_federation.py`, `test_all_nvidia_models.py`, `test_federation_live.py`,
    `test_federation_quick.py`, `test_final_real.py`, `test_gateway_nvidia.py`,
    `test_nvidia_install.py`, `test_nvidia_nim.py`, `test_nvidia_nim_live.py`,
    `test_scenario_real.py`, `test_scenario_simple.py`

- [ ] **Step 1 : Créer le dossier et le garde-collecte pytest**

Créer `tests/manual/conftest.py` avec ce contenu exact :
```python
# Empêche pytest de collecter les scripts runnables (__main__, réseau, clés API).
collect_ignore_glob = ["*"]
```

- [ ] **Step 2 : Déplacer les 11 scripts via git mv**

Run :
```powershell
$files = @(
  "test_agent_federation.py","test_all_nvidia_models.py","test_federation_live.py",
  "test_federation_quick.py","test_final_real.py","test_gateway_nvidia.py",
  "test_nvidia_install.py","test_nvidia_nim.py","test_nvidia_nim_live.py",
  "test_scenario_real.py","test_scenario_simple.py"
)
foreach ($f in $files) { git mv $f "tests/manual/$f" }
```

- [ ] **Step 3 : Patcher la résolution de chemin (10 fichiers au motif standard)**

Dans ces 10 fichiers (tous sauf `test_nvidia_nim.py`), remplacer la ligne :
```python
PLUGIN_DIR = os.path.dirname(os.path.abspath(__file__))
```
par :
```python
PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```
(`tests/manual/x.py` est 3 niveaux sous la racine, où vit `QGISIA2/`).

- [ ] **Step 4 : Patcher le cas particulier `test_nvidia_nim.py`**

Dans `tests/manual/test_nvidia_nim.py`, remplacer :
```python
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'QGISIA2'))
```
par :
```python
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'QGISIA2'))
```

- [ ] **Step 5 : Vérifier qu'un script déplacé importe toujours QGISIA2**

Run :
```powershell
python -c "import ast,sys; ast.parse(open('tests/manual/test_gateway_nvidia.py',encoding='utf-8').read()); print('syntax OK')"
python tests/manual/test_nvidia_nim.py
```
Expected : `syntax OK`, puis le script s'exécute jusqu'à son point réseau/clé (pas d'erreur
`ModuleNotFoundError` sur les modules `QGISIA2/`). Une erreur de clé API manquante est acceptable.

- [ ] **Step 6 : Vérifier que pytest ignore bien tests/manual/**

Run :
```powershell
python -m pytest tests/ -q
```
Expected : même résultat qu'au Task 0 Step 1 (aucune collecte de `tests/manual/`, aucune
nouvelle erreur). Si pytest tente de collecter `tests/manual/`, vérifier `conftest.py`.

- [ ] **Step 7 : Commit**

```powershell
git add -A tests/
git commit -m "chore(tests): centraliser les scripts test_*.py racine dans tests/manual/ + fix sys.path"
```

---

## Task 3 : B.2 (suite) — Centraliser les helpers de dev

**Files:**
- Modify (git mv) vers `scripts/` : `check_gateway.py`, `check_nvidia_setup.py`,
  `install_gateway.py`, `benchmark_ollama.py`, `dev_server.py`,
  `cleanup-models.ps1`, `cleanup-old-models.ps1`, `install-gemma4-versions.ps1`,
  `start-local-llm.ps1`, `test-hf-models.ps1`

- [ ] **Step 1 : Vérifier si un helper Python résout des chemins via `__file__`**

Run :
```powershell
Select-String -Path "check_gateway.py","check_nvidia_setup.py","install_gateway.py","benchmark_ollama.py","dev_server.py" -Pattern "__file__","QGISIA2" | Select-Object Filename,LineNumber,Line
```
Expected : noter chaque occurrence. Si un fichier construit un chemin via
`dirname(__file__)` + `QGISIA2`, il faudra le patcher au Step 3 (même logique +1 niveau :
`scripts/x.py` est 1 niveau sous la racine → `os.path.dirname(os.path.dirname(__file__))`).

- [ ] **Step 2 : Déplacer les helpers via git mv**

Run :
```powershell
$helpers = @(
  "check_gateway.py","check_nvidia_setup.py","install_gateway.py","benchmark_ollama.py","dev_server.py",
  "cleanup-models.ps1","cleanup-old-models.ps1","install-gemma4-versions.ps1","start-local-llm.ps1","test-hf-models.ps1"
)
foreach ($h in $helpers) { git mv $h "scripts/$h" }
```

- [ ] **Step 3 : Patcher les chemins des helpers si nécessaire**

Pour chaque fichier identifié au Step 1 avec un motif `os.path.dirname(os.path.abspath(__file__))`
pointant vers la racine, remplacer par `os.path.dirname(os.path.dirname(os.path.abspath(__file__)))`.
Si aucun helper ne résout de chemin relatif à la racine (cas attendu pour les `.ps1` et les
checks autonomes), ne rien modifier.

- [ ] **Step 4 : Vérifier qu'un helper se lance sans erreur d'import**

Run :
```powershell
python scripts/check_nvidia_setup.py
```
Expected : le script s'exécute (peut afficher des avertissements de config/clé manquante),
sans `ModuleNotFoundError` ni `FileNotFoundError` sur un chemin `QGISIA2/`.

- [ ] **Step 5 : Mettre à jour les références éventuelles dans la doc**

Run :
```powershell
Select-String -Path "README.md","PLUGIN_INSTALLATION.md","BEST_MODELS_GUIDE.md" -Pattern "dev_server.py|check_gateway.py|install_gateway.py|benchmark_ollama" | Select-Object Filename,LineNumber,Line
```
Pour chaque référence trouvée, mettre à jour le chemin (`python dev_server.py` →
`python scripts/dev_server.py`, etc.). Si aucune référence, ne rien faire.

- [ ] **Step 6 : Commit**

```powershell
git add -A
git commit -m "chore(scripts): déplacer les helpers de dev (checks, install, benchmark, ps1) dans scripts/"
```

---

## Task 4 : B.3 — Cohérence de version (cible 3.4)

**Files:**
- Create: `VERSION`
- Modify: `package.json:4`, `QGISIA2/metadata.txt:8`, `README.md`

- [ ] **Step 1 : Créer le fichier `VERSION`**

Créer `VERSION` à la racine avec ce contenu exact (une ligne) :
```
3.4
```

- [ ] **Step 2 : Aligner `package.json`**

Dans `package.json`, remplacer :
```json
  "version": "1.0.0",
```
par :
```json
  "version": "3.4.0",
```

- [ ] **Step 3 : Aligner `QGISIA2/metadata.txt`**

Dans `QGISIA2/metadata.txt`, remplacer :
```
version=2.1
```
par :
```
version=3.4
```

- [ ] **Step 4 : Documenter la source unique dans le README**

Dans `README.md`, ajouter sous le titre principal une ligne de note :
```markdown
> Version courante : **3.4** (source unique : fichier `VERSION` à la racine).
```

- [ ] **Step 5 : Vérifier la cohérence**

Run :
```powershell
Get-Content VERSION
Select-String -Path "package.json" -Pattern '"version"'
Select-String -Path "QGISIA2/metadata.txt" -Pattern "^version="
```
Expected : `3.4`, `"version": "3.4.0"`, `version=3.4` — tous cohérents.

- [ ] **Step 6 : Vérifier que le front compile toujours**

Run :
```powershell
npm run lint
```
Expected : `tsc --noEmit` vert (même état qu'au Task 0).

- [ ] **Step 7 : Commit**

```powershell
git add VERSION package.json QGISIA2/metadata.txt README.md
git commit -m "chore(version): aligner package.json, metadata.txt et README sur 3.4 (source unique VERSION)"
```

---

## Task 5 : B.4 — Cohérence de licence

**Files:**
- Modify: `QGISIA2/metadata.txt` (ajout champ licence)

Constat vérifié : `LICENSE` = **MIT**, badge README = **MIT** → déjà cohérents. Seul ajout :
expliciter la licence dans les métadonnées du plugin.

- [ ] **Step 1 : Ajouter le champ licence dans metadata.txt**

Dans `QGISIA2/metadata.txt`, après la ligne `author=QGISAI+`, ajouter :
```
license=MIT
```

- [ ] **Step 2 : Vérifier l'absence de contradiction licence**

Run :
```powershell
Select-String -Path "LICENSE","README.md","QGISIA2/metadata.txt" -Pattern "MIT","GPL","Apache" | Select-Object Filename,Line
```
Expected : uniquement des occurrences `MIT`, aucune mention `GPL`/`Apache`. Si une mention
contradictoire apparaît, **s'arrêter et demander à l'utilisateur** quelle licence fait foi.

- [ ] **Step 3 : Commit**

```powershell
git add QGISIA2/metadata.txt
git commit -m "chore(license): expliciter MIT dans metadata.txt (cohérent README/LICENSE)"
```

---

## Task 6 : B.5 — Fichiers morts et relocalisation des résultats

**Files:**
- Delete: `hf-model-test-results.json` (0 octet)
- Create: `tests/fixtures/`
- Modify (move) : `nvidia_models_test_results.json` → `tests/fixtures/`

- [ ] **Step 1 : Supprimer le fichier vide**

Run :
```powershell
if ((Get-Item "hf-model-test-results.json").Length -eq 0) { Remove-Item -Force "hf-model-test-results.json" }
```

- [ ] **Step 2 : Déplacer les résultats NVIDIA (utiles au Chantier A)**

Run :
```powershell
New-Item -ItemType Directory -Force tests/fixtures | Out-Null
Move-Item -Force "nvidia_models_test_results.json" "tests/fixtures/nvidia_models_test_results.json"
```

- [ ] **Step 3 : Garder le fixture sous git malgré `*.json` gitignoré**

`*.json` est gitignoré (avec whitelist). Forcer le suivi du fixture utile :
```powershell
git add -f tests/fixtures/nvidia_models_test_results.json
git status --porcelain tests/fixtures/
```
Expected : `A  tests/fixtures/nvidia_models_test_results.json`.

- [ ] **Step 4 : Vérifier la racine épurée**

Run :
```powershell
Get-ChildItem -Path . -Filter *.json -File | Select-Object Name
```
Expected : ne restent que les JSON de config légitimes whitelistés
(`package.json`, `package-lock.json`, `tsconfig.json`, `metadata.json`). Aucun JSON de
résultats temporaire à la racine.

- [ ] **Step 5 : Commit**

```powershell
git add -A
git commit -m "chore(repo): supprimer JSON vide et déplacer nvidia_models_test_results dans tests/fixtures/"
```

---

## Task 7 : B.6 — Clarifier le nom produit (doc uniquement)

**Files:**
- Modify: `README.md`

- [ ] **Step 1 : Ajouter une note de cohérence de nom**

Dans `README.md`, sous le titre `# 🌲 GeoSylva AI — Assistant IA pour QGIS`, ajouter :
```markdown
> **Nom produit** : « GeoSylva AI » (marketing) = plugin QGIS « QGISIA2 » (identifiant technique).
> Aucun renommage de code à ce stade — note de cohérence uniquement.
```

- [ ] **Step 2 : Commit**

```powershell
git add README.md
git commit -m "docs(readme): clarifier la correspondance GeoSylva AI / plugin QGISIA2"
```

---

## Task 8 : Vérification finale du Chantier B

**Files:** aucun (vérification).

- [ ] **Step 1 : Suite Python = pas de régression vs baseline**

Run :
```powershell
python -m pytest tests/ -q
```
Expected : résultat identique au Task 0 Step 1 (pas de nouvelle erreur d'import/collecte).

- [ ] **Step 2 : Front = lint + tests OK**

Run :
```powershell
npm run lint
npm run test
```
Expected : même état qu'au Task 0 Step 2.

- [ ] **Step 3 : Racine épurée et git propre**

Run :
```powershell
Get-ChildItem -Path . -File | Where-Object { $_.Name -match '^(test_|check_|install_|benchmark_).*\.py$' -or $_.Extension -in '.zip' } | Select-Object Name
git status
```
Expected : première commande sans sortie (plus de scripts/zips épars à la racine) ;
`git status` propre (tout committé, aucun fichier suivi supprimé par erreur).

- [ ] **Step 4 : Récapitulatif des critères de succès**

Vérifier manuellement contre la spec (`docs/superpowers/specs/2026-06-05-amelioration-qgisia-design.md`,
section « Critère de succès — Chantier B ») :
- [ ] Plus de `.zip` ni `test_*.py` à la racine
- [ ] `pytest tests/` et `npm run test` sans régression
- [ ] Version `3.4` cohérente (`VERSION` / `package.json` / `metadata.txt`)
- [ ] Licence MIT cohérente (README / LICENSE / metadata.txt)
- [ ] `git status` propre

---

## Self-review (effectuée à la rédaction)

- **Couverture spec** : B.1→Task1, B.2→Task2+3, B.3→Task4, B.4→Task5, B.5→Task6,
  B.6→Task7, critères de succès→Task8. Aucune lacune.
- **Placeholders** : aucun — chaque édition montre l'avant/après exact ou le contenu à créer.
- **Cohérence** : version `3.4` partout ; chemins `sys.path` patchés selon la profondeur
  réelle (`tests/manual/` = 3 niveaux, `scripts/` = 1 niveau).
- **Point de vigilance laissé explicite** : B.4 Step 2 et B.2 garde-fou demandent un arrêt +
  question utilisateur si une contradiction non triviale apparaît.
