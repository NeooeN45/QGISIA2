# -*- coding: utf-8 -*-
"""Vérification du Gateway IA et des alias NVIDIA"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'QGISIA2'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'QGISIA2', 'vendor'))

# Import direct depuis les fichiers
from llm_installer import ensure_vendor_on_path, is_vendor_ready, VENDOR_DIR, MARKER_FILE

print(f'Vendor dir exists: {VENDOR_DIR.exists()}')
print(f'Marker file exists: {MARKER_FILE.exists()}')

# Charger config manuellement
import json
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'QGISIA2', 'config', 'models.json')
config = json.load(open(CONFIG_PATH, encoding='utf-8'))

aliases = [
    {"alias": name, **data}
    for name, data in config.get("aliases", {}).items()
]

print('=== Statut Gateway ===')
print(f'Vendor ready: {is_vendor_ready()}')

print('\n=== Aliases disponibles ===')
for a in aliases:
    desc = a.get('description', 'N/A')
    print(f"  - {a['alias']}: {desc[:50]}...")

print('\n=== NVIDIA NIM Aliases ===')
nvidia = [a for a in aliases if 'nvidia' in a['alias']]
for a in nvidia:
    print(f"\n  {a['alias']}:")
    print(f"    Primary: {a.get('primary', 'N/A')}")
    print(f"    Fallbacks: {a.get('fallbacks', [])}")
    print(f"    Temperature: {a.get('temperature', 'N/A')}")

print(f"\nTotal aliases: {len(aliases)}")
print(f"Aliases NVIDIA: {len(nvidia)}")

# Test import litellm
print('\n=== Test litellm ===')
try:
    import litellm
    print(f'litellm importé: {type(litellm)}')
    print('Gateway prêt à être utilisé!')
except Exception as e:
    print(f'Erreur import litellm: {e}')
