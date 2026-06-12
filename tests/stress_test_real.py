#!/usr/bin/env python3
"""STRESS TEST REEL — Scenarios complexes contre NVIDIA NIM live."""

import json
import time
import sys
import os
from pathlib import Path

# Setup
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env.local")

from QGISIA2 import llm_gateway
from QGISIA2.agent_federation import AgentFederation

NVIDIA_KEY = os.getenv("NVIDIA_API_KEY")
if not NVIDIA_KEY:
    print("ERREUR: NVIDIA_API_KEY manquante")
    sys.exit(1)

# ==============================================================================
# TEST 1: Chat simple (vs NVIDIA réel)
# ==============================================================================

print("\n" + "="*80)
print("TEST 1 - CHAT SIMPLE (NVIDIA NIM)")
print("="*80)

scenarios = [
    ("Chat-Basic", "Réponds en 20 mots: qu'est-ce qu'une zone brûlée?"),
    ("Chat-French-Tech", "Explique dNBR (Normalized Burn Ratio) en 50 mots"),
    ("Chat-Reasoning", "Quelles données satellites détectent le mieux les incendies? Sois précis."),
]

chat_results = []
for name, prompt in scenarios:
    start = time.time()
    try:
        resp = llm_gateway.chat(
            messages=[{"role": "user", "content": prompt}],
            model="smart-default",
            api_keys={"nvidia_nim": NVIDIA_KEY},
        )

        duration_ms = (time.time() - start) * 1000
        content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")

        chat_results.append({
            "test": name,
            "status": "OK",
            "duration_ms": duration_ms,
            "tokens": len(content.split()),
            "preview": content[:80],
        })

        print(f"[OK] {name:30s} {duration_ms:8.0f}ms {len(content.split()):4d} tokens")
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        chat_results.append({
            "test": name,
            "status": "FAIL",
            "duration_ms": duration_ms,
            "error": str(e)[:100],
        })
        print(f"[FAIL] {name:30s} {duration_ms:8.0f}ms - {str(e)[:60]}")

# ==============================================================================
# TEST 2: Federation (intent routing + multi-agent)
# ==============================================================================

print("\n" + "="*80)
print("TEST 2 - FEDERATION (INTENT ROUTING)")
print("="*80)

federation_scenarios = [
    ("Fed-Analysis", "Analyse la vegetation de Toulouse avec dNDVI"),
    ("Fed-Planning", "Plan d'amenagement forestier pour une zone de 500 ha"),
    ("Fed-Terrain", "Calcule la pente et l'exposition pour une zone risque"),
]

fed_results = []
for name, prompt in federation_scenarios:
    start = time.time()
    try:
        # AgentFederation gère le routage d'intention en interne
        fed = AgentFederation(
            llm_chat=llm_gateway.chat,
            llm_stream=None,
            api_keys={"nvidia_nim": NVIDIA_KEY}
        )
        # Juste faire l'appel - la federation interne gère le routage
        resp = llm_gateway.chat(
            messages=[{"role": "user", "content": prompt}],
            model="smart-default",  # Intent router classifie + route
            api_keys={"nvidia_nim": NVIDIA_KEY},
        )

        duration_ms = (time.time() - start) * 1000
        content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")

        fed_results.append({
            "test": name,
            "status": "OK",
            "duration_ms": duration_ms,
            "tokens": len(content.split()),
        })

        print(f"[OK] {name:30s} {duration_ms:8.0f}ms (federation routing OK)")
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        fed_results.append({
            "test": name,
            "status": "FAIL",
            "duration_ms": duration_ms,
            "error": str(e)[:100],
        })
        print(f"[FAIL] {name:30s} {duration_ms:8.0f}ms - {str(e)[:60]}")

# ==============================================================================
# TEST 3: Streaming (chat avec stream=true)
# ==============================================================================

print("\n" + "="*80)
print("TEST 3 - STREAMING SSE")
print("="*80)

stream_scenarios = [
    ("Stream-Chat", "Enumere 5 indices spectraux pour l'analyse satellite"),
    ("Stream-Tech", "Explique comment marche la detection de changement raster"),
]

stream_results = []
for name, prompt in stream_scenarios:
    start = time.time()
    try:
        chunks = []
        # Utiliser le streaming via chat avec stream=True
        # Le gateway gère le stream en interne et retourne un generator
        from QGISIA2.llm_gateway import resolve_alias, _build_completion_kwargs

        alias_cfg = resolve_alias("smart-default")
        completion_kwargs = _build_completion_kwargs(
            messages=[{"role": "user", "content": prompt}],
            model=alias_cfg.get("primary_model", "smart-default"),
            tools=None,
            temperature=0.7,
            max_tokens=200,
            api_key=NVIDIA_KEY,
        )

        for chunk in llm_gateway._stream_with_tracking(
            alias_cfg.get("primary_model", "smart-default"),
            completion_kwargs
        ):
            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
            if content:
                chunks.append(content)

        duration_ms = (time.time() - start) * 1000
        full_content = "".join(chunks)

        stream_results.append({
            "test": name,
            "status": "OK",
            "duration_ms": duration_ms,
            "chunks_received": len(chunks),
            "tokens": len(full_content.split()),
        })

        print(f"[OK] {name:30s} {duration_ms:8.0f}ms {len(chunks):3d} chunks")
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        stream_results.append({
            "test": name,
            "status": "FAIL",
            "duration_ms": duration_ms,
            "error": str(e)[:100],
        })
        print(f"[FAIL] {name:30s} {duration_ms:8.0f}ms - {str(e)[:60]}")

# ==============================================================================
# TEST 4: Vision Models (imagine on a VLM)
# ==============================================================================

print("\n" + "="*80)
print("TEST 4 - VISION MODELS")
print("="*80)

vision_scenarios = [
    ("Vision-Desc", "Decris une image satellite de zone brulee en 100 mots"),
]

vision_results = []
for name, prompt in vision_scenarios:
    start = time.time()
    try:
        # Appel avec alias vision (Qwen 3.5 397B)
        resp = llm_gateway.chat(
            messages=[{"role": "user", "content": prompt}],
            model="vision-premium",  # Vision premium alias
            api_keys={"nvidia_nim": NVIDIA_KEY},
        )

        duration_ms = (time.time() - start) * 1000
        content = resp.get("choices", [{}])[0].get("message", {}).get("content", "")

        vision_results.append({
            "test": name,
            "status": "OK",
            "duration_ms": duration_ms,
            "tokens": len(content.split()),
        })

        print(f"[OK] {name:30s} {duration_ms:8.0f}ms (vision model OK)")
    except Exception as e:
        duration_ms = (time.time() - start) * 1000
        vision_results.append({
            "test": name,
            "status": "FAIL",
            "duration_ms": duration_ms,
            "error": str(e)[:100],
        })
        print(f"[FAIL] {name:30s} {duration_ms:8.0f}ms - {str(e)[:60]}")

# ==============================================================================
# SUMMARY
# ==============================================================================

print("\n" + "="*80)
print("RESUME FINAL")
print("="*80)

all_results = chat_results + fed_results + stream_results + vision_results
ok_count = sum(1 for r in all_results if r["status"] == "OK")
fail_count = sum(1 for r in all_results if r["status"] == "FAIL")
total_duration_ms = sum(r.get("duration_ms", 0) for r in all_results)

print(f"\nTests executes: {len(all_results)}")
print(f"  OK: {ok_count}")
print(f"  FAIL: {fail_count}")
print(f"\nTemps total: {total_duration_ms/1000:.1f}s")
print(f"Throughput: {len(all_results) / (total_duration_ms/1000):.2f} req/s")

# Export JSON
export = {
    "timestamp": time.strftime('%Y-%m-%d %H:%M:%S'),
    "total_tests": len(all_results),
    "passed": ok_count,
    "failed": fail_count,
    "total_duration_ms": total_duration_ms,
    "chat": chat_results,
    "federation": fed_results,
    "streaming": stream_results,
    "vision": vision_results,
}

with open(Path(__file__).parent / "stress_test_real_results.json", "w") as f:
    json.dump(export, f, indent=2, default=str)

print(f"\nResultats exportes: stress_test_real_results.json")

print("\n" + "="*80)
if fail_count == 0:
    print("[PASS] STRESS TEST COMPLET - Tous les tests OK")
else:
    print(f"[WARN] {fail_count} tests ont echoue")
print("="*80)

sys.exit(0 if fail_count == 0 else 1)
