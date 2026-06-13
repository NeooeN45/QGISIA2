#!/usr/bin/env python3
"""Vrais tests d'intégration contre NVIDIA NIM (clé .env.local).

Reproduit le bug de fédération signalé et vérifie le tool-calling de l'agent.
Hors QGIS : le bridge QGIS est mocké, mais les appels LLM sont RÉELS.
"""
import os
import sys
import json
import time
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "QGISIA2" / "vendor"))
sys.path.insert(0, str(ROOT / "QGISIA2"))
sys.path.insert(0, str(ROOT))

# Charger .env.local
for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
    if line.strip() and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

KEY = os.environ.get("NVIDIA_API_KEY", "")
print(f"Clé NVIDIA: {'présente (' + KEY[:8] + '…)' if KEY else 'ABSENTE'}")
API_KEYS = {"nvidia_nim": KEY}

import llm_gateway  # noqa: E402

# ── TEST 1 : chat direct smart-default (réel) ─────────────────────────────────
print("\n[TEST 1] chat smart-default (NVIDIA réel)")
try:
    t = time.time()
    r = llm_gateway.chat(
        model="smart-default",
        messages=[{"role": "user", "content": "Dis bonjour en 5 mots."}],
        api_keys=API_KEYS, stream=False,
    )
    content = r["choices"][0]["message"]["content"]
    print(f"  [OK] {(time.time()-t)*1000:.0f}ms — {content[:60]!r}")
except Exception as e:
    print(f"  [FAIL] {type(e).__name__}: {str(e)[:200]}")

# ── TEST 2 : reproduire la fédération (bug Poitiers) ──────────────────────────
print("\n[TEST 2] AgentFederation.process — requête Poitiers (reproduit le bug)")
try:
    from agent_federation import AgentFederation
    logs = []
    fed = AgentFederation(API_KEYS)
    result = fed.process(
        "Surprend moi et crée quelque chose de visuel sur la ville de Poitiers",
        auto_route=True, progress_callback=lambda m: logs.append(m),
    )
    ar = result.get("agent_results", [])
    a0 = ar[0] if ar else None
    print(f"  routing = {result.get('routing')}")
    print(f"  logs = {logs}")
    if a0:
        print(f"  agent.success = {a0.success}")
        print(f"  agent.model_used = {a0.model_used!r}")
        print(f"  agent.error = {a0.error!r}")
        print(f"  agent.content[:120] = {(a0.content or '')[:120]!r}")
except Exception as e:
    import traceback
    print(f"  [FAIL] {type(e).__name__}: {str(e)[:200]}")
    traceback.print_exc()

# ── TEST 3 : route_intent isolé ───────────────────────────────────────────────
print("\n[TEST 3] route_intent (intent-router réel)")
try:
    from agent_federation import AgentFederation
    fed = AgentFederation(API_KEYS)
    t = time.time()
    intent = fed.route_intent("Crée une carte de Poitiers avec un fond OSM")
    print(f"  [OK] {(time.time()-t)*1000:.0f}ms — intent = {intent}")
except Exception as e:
    print(f"  [FAIL] {type(e).__name__}: {str(e)[:200]}")

# ── TEST 4 : tool-calling — le modèle émet-il des appels d'outils ? ───────────
print("\n[TEST 4] run_tool_loop — le modèle appelle-t-il des outils ? (bridge mocké)")
try:
    from agent_tools import run_tool_loop

    events = []

    def on_event(ev):
        events.append(ev)
        if ev.get("type") in ("tool_start", "iteration", "tool_result"):
            print(f"    · {ev.get('type')}: {ev.get('tool') or ev.get('i') or ''}")

    # Mock du bridge QGIS : renvoie des réponses canned pour tout outil bridge.
    class MockResp:
        status_code = 200
        def __init__(self, data): self._d = data
        def json(self): return self._d
        def raise_for_status(self): pass

    class MockClient:
        def post(self, url, json=None, **kw):
            tool = url.rstrip("/").split("/")[-1]
            return MockResp({"ok": True, "result": json or {}, "tool": tool})
        def __enter__(self): return self
        def __exit__(self, *a): pass

    t = time.time()
    res = run_tool_loop(
        [{"role": "user", "content": "Liste les couches du projet QGIS puis dis combien il y en a."}],
        API_KEYS, model="smart-default", max_iters=4, auto_mode=True,
        http_client=MockClient(), on_event=on_event,
    )
    tool_starts = [e for e in events if e.get("type") == "tool_start"]
    print(f"  [OK] {(time.time()-t)*1000:.0f}ms — outils appelés: {len(tool_starts)} "
          f"({[e['tool'] for e in tool_starts]})")
    print(f"  iterations = {res.get('iterations')}, content[:100] = {(res.get('content') or '')[:100]!r}")
    print(f"  >>> TOOL-CALLING {'FONCTIONNE' if tool_starts else 'NON DÉCLENCHÉ (modèle ne supporte pas les outils ?)'}")
except Exception as e:
    import traceback
    print(f"  [FAIL] {type(e).__name__}: {str(e)[:200]}")
    traceback.print_exc()

print("\n=== FIN ===")
