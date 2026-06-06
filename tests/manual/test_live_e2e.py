# -*- coding: utf-8 -*-
"""
Test e2e LIVE contre NVIDIA NIM (necessite NVIDIA_API_KEY dans .env.local).
Verifie l'enchainement reel : gateway -> federation -> boucle de tool-calling.
Le bridge QGIS est mocke (pas de QGIS lance) pour isoler le comportement LLM.

Usage : python tests/manual/test_live_e2e.py
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2" / "vendor"))
sys.path.insert(0, str(ROOT / "QGISIA2"))

# Charge .env.local
for _name in (".env.local", ".env"):
    _p = ROOT / _name
    if _p.is_file():
        for _line in _p.read_text(encoding="utf-8").splitlines():
            _s = _line.strip()
            if _s and not _s.startswith("#") and "=" in _s:
                _k, _, _v = _s.partition("=")
                os.environ.setdefault(_k.strip(), _v.strip().strip('"').strip("'"))

KEY = os.environ.get("NVIDIA_API_KEY", "")
if not KEY or KEY in ("colle_ta_cle_ici", "ta_nouvelle_cle"):
    print("ERREUR: NVIDIA_API_KEY absente de .env.local")
    sys.exit(1)

API_KEYS = {"nvidia_nim": KEY}
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond)))
    print(("[OK] " if cond else "[KO] ") + name + (f"  -> {detail}" if detail else ""))


# 1) Gateway : chat via alias smart-default (NVIDIA Nemotron 3 Super)
print("\n--- 1) Gateway chat (smart-default) ---")
from llm_gateway import chat  # noqa: E402

r = chat(
    model="smart-default",
    messages=[{"role": "user", "content": "Reponds en un seul mot: bonjour"}],
    api_keys=API_KEYS,
    max_tokens=20,
)
content = r["choices"][0]["message"]["content"] or ""
model_used = r.get("_gateway", {}).get("model_used", "")
check("reponse non vide", len(content) > 0, repr(content[:40]))
check("modele NVIDIA utilise", "nvidia_nim" in model_used, model_used)

# 2) Federation : routage d'intention
print("\n--- 2) Federation routing ---")
from agent_federation import AgentFederation, AgentType  # noqa: E402

fed = AgentFederation(API_KEYS)
intent = fed.route_intent("Cree un buffer de 500m autour des ecoles")
check("routage -> CODE", intent == AgentType.CODE_GENERATOR, intent.value)

# 3) Boucle de tool-calling avec bridge QGIS mocke
print("\n--- 3) Tool-calling loop (bridge mocke) ---")
from agent_tools import run_tool_loop  # noqa: E402


class _FakeResp:
    def __init__(self, text):
        self.text = text

    def raise_for_status(self):
        return None


class _FakeBridge:
    def __init__(self):
        self.calls = []

    async def post(self, url, json):
        self.calls.append((url, json))
        return _FakeResp('[{"id":"layer_1","name":"forets_2024","type":"vector"}]')


bridge = _FakeBridge()
res = run_tool_loop(
    [{"role": "user",
      "content": "Liste les couches du projet QGIS en appelant l'outil disponible, puis resume."}],
    API_KEYS,
    model="smart-default",
    http_client=bridge,
    max_iters=3,
)
tools_called = [t["tool"] for t in res["trace"]]
check("le LLM a appele >=1 outil QGIS", len(res["trace"]) > 0, str(tools_called))
check("reponse finale non vide", len(res["content"]) > 0, res["content"][:60])

# Bilan
passed = sum(1 for _, ok in results if ok)
total = len(results)
print(f"\n{'=' * 50}")
print(f"LIVE E2E : {passed}/{total} checks OK")
print(f"{'=' * 50}")
sys.exit(0 if passed == total else 1)
