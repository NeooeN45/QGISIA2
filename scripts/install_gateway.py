# -*- coding: utf-8 -*-
"""Script d'installation du Gateway IA"""
import sys
import os

# Ajouter QGISIA2 au path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), 'QGISIA2'))

from llm_installer import install_if_needed, get_install_status

def progress_cb(msg):
    print(f'[INSTALL] {msg}')

print('=== Installation du Gateway IA ===')
print(f'Python: {sys.executable}')
print('')

result = install_if_needed(progress_cb=progress_cb, force=False)

print('')
print('=== Résultat ===')
print(f'Success: {result.get("success")}')
print(f'Already installed: {result.get("already_installed")}')
if result.get('error'):
    print(f'Error: {result.get("error")}')

if result.get('logs'):
    print('\n=== Logs ===')
    for log in result.get('logs', []):
        print(f"  [{log.get('stage')}] {log.get('message')}")

# Vérification
if result.get('success'):
    print('\n=== Vérification ===')
    try:
        from llm_installer import ensure_vendor_on_path, is_vendor_ready
        ensure_vendor_on_path()
        import litellm
        print(f'✓ litellm importé: {litellm.__version__}')
        print(f'✓ Vendor ready: {is_vendor_ready()}')
    except Exception as e:
        print(f'✗ Erreur: {e}')
