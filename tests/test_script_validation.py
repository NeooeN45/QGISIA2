# -*- coding: utf-8 -*-
"""Tests de la validation de sécurité des scripts PyQGIS (module pur)."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "QGISIA2"))

import script_validation as sv  # noqa: E402


# ── Scripts d'attaque : doivent être bloqués ──────────────────────────────────

ATTACKS = [
    "import os\nos.system('calc')",
    "exec = __import__('os').system\nexec('calc')",
    "().__class__.__bases__[0].__subclasses__()",
    "getattr(__builtins__, 'ev' + 'al')('1')",
    "from subprocess import Popen",
    "o = open('/etc/passwd')",
    "globals()['x'] = 1",
    "import socket",
    "eval('2+2')",
    "x = (1).__class__.__mro__",
]


def test_attacks_are_blocked():
    for script in ATTACKS:
        ok, msg = sv.validate_script(script)
        assert ok is False, f"NON bloqué (faille): {script!r}"
        assert msg


# ── Scripts PyQGIS légitimes : doivent passer ─────────────────────────────────

LEGIT = [
    "layer = QgsProject.instance().mapLayersByName('test')[0]\nprint(layer.featureCount())",
    "from qgis.core import QgsVectorLayer\nimport processing\nprocessing.run('native:buffer', {})",
    "iface.messageBar().pushMessage('ok')",
    "feats = [f for f in layer.getFeatures()]\nprint(len(feats))",
]


def test_legit_scripts_pass():
    for script in LEGIT:
        ok, msg = sv.validate_script(script)
        assert ok is True, f"Faux positif: {script!r} -> {msg}"


def test_hallucinated_function_detected():
    ok, msg = sv.validate_script("searchCadastreParcels('75001')")
    assert ok is False
    assert "searchCadastreParcels" in msg


def test_syntax_error_is_not_falsely_blocked_by_ast():
    # Un script non parsable n'est pas bloqué par l'AST (l'exécution lèvera
    # l'erreur), mais reste soumis à la blocklist regex.
    assert sv.ast_security_scan("def (") is None


def test_regex_blocklist_catches_exit():
    ok, _ = sv.validate_script("exit()")
    assert ok is False
