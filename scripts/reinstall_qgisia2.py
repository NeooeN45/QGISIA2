"""
Script de purge + réinstallation du plugin QGISIA2 dans QGIS 4.

À copier-coller dans la console Python de QGIS :
Plugins → Python Console (Ctrl+Alt+P) → onglet Editor → coller → Run
"""

import os
import shutil
import subprocess

# ── Chemins ──────────────────────────────────────────────────────────────────

USER_PLUGINS_DIR = os.path.join(
    os.environ["APPDATA"],
    "QGIS", "QGIS4", "profiles", "default", "python", "plugins"
)
PLUGIN_NAME = "QGISIA2"
PLUGIN_DIR = os.path.join(USER_PLUGINS_DIR, PLUGIN_NAME)

# Chemin source du projet (à adapter si besoin)
SOURCE_DIR = os.path.join(
    os.path.expanduser("~"),
    "Desktop", "Micro Entreprise", "04_PROJETS_EN_COURS",
    "Projet", "QGISIA", "QGISIA2"
)

# ── 1. Décharger le plugin ───────────────────────────────────────────────────

print("[1/4] Déchargement du plugin...")
from qgis.utils import unloadPlugin
try:
    unloadPlugin(PLUGIN_NAME)
    print(f"    ✓ {PLUGIN_NAME} déchargé")
except Exception as e:
    print(f"    ℹ Non chargé ou déjà déchargé ({e})")

# ── 2. Supprimer l'ancienne version ──────────────────────────────────────────

print("[2/4] Suppression de l'ancien dossier...")
if os.path.isdir(PLUGIN_DIR):
    shutil.rmtree(PLUGIN_DIR)
    print(f"    ✓ {PLUGIN_DIR} supprimé")
else:
    print(f"    ℹ Dossier inexistant")

# ── 3. Copier depuis le source ───────────────────────────────────────────────

print("[3/4] Copie depuis le source...")
if not os.path.isdir(SOURCE_DIR):
    print(f"    ✗ SOURCE_DIR introuvable : {SOURCE_DIR}")
    print("    → Modifiez SOURCE_DIR dans le script")
    raise SystemExit

shutil.copytree(SOURCE_DIR, PLUGIN_DIR)
print(f"    ✓ Copié depuis {SOURCE_DIR}")

# ── 4. Recharger et démarrer ─────────────────────────────────────────────────

print("[4/4] Rechargement...")
from qgis.utils import loadPlugin, startPlugin

loadPlugin(PLUGIN_NAME)
startPlugin(PLUGIN_NAME)
print(f"    ✓ {PLUGIN_NAME} redémarré !")

# ── 5. Vérification icône ────────────────────────────────────────────────────

icon_svg = os.path.join(PLUGIN_DIR, "icon.svg")
if os.path.isfile(icon_svg):
    with open(icon_svg, "r") as f:
        content = f.read()
    if "#22c55e" in content or "fill='#22c55e'" in content:
        print("    ✓ Icône = étoile verte (emerald-500)")
    else:
        print("    ⚠ Icône SVG ne contient pas la couleur emerald attendue")
else:
    print("    ⚠ icon.svg introuvable dans le plugin")

print("\n✅ Plugin QGISIA2 réinstallé avec succès !")
