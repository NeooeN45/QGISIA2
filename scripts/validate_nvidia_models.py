#!/usr/bin/env python3
"""
Validation complete : cle API NVIDIA NIM + test de chaque modele disponible.
Genere un rapport JSON + console colorée.
"""

import os
import sys
import json
import time
import re
from pathlib import Path

# ── Config ───────────────────────────────────────────────────────────────────

API_BASE = "https://integrate.api.nvidia.com/v1"
PROMPT_TEST = "Bonjour. Reponds uniquement par 'OK'."
DELAY_BETWEEN_REQUESTS = 1.5  # secondes (rate-limit free tier)
TIMEOUT = 25

# ── Liste des modeles a tester (extraite du catalogue NVIDIA NIM free tier) ──

MODELS = [
    # NVIDIA proprietaires
    ("nvidia/nemotron-3-ultra-550b-a55b", "Nemotron 3 Ultra 550B"),
    ("nvidia/nemotron-3-super-120b-a12b", "Nemotron 3 Super 120B"),
    ("nvidia/nemotron-3.5-content-safety", "Nemotron 3.5 Content Safety"),
    ("nvidia/nemotron-3-content-safety", "Nemotron 3 Content Safety"),
    ("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "Nemotron 3 Nano Omni Reasoning"),
    ("nvidia/nemotron-3-nano-30b-a3b", "Nemotron 3 Nano 30B"),
    ("nvidia/nemotron-mini-4b-instruct", "Nemotron Mini 4B"),
    ("nvidia/nemotron-nano-12b-v2-vl", "Nemotron Nano 12B v2 VL"),
    ("nvidia/nemotron-voicechat", "Nemotron Voicechat"),
    ("nvidia/nemotron-content-safety-reasoning-4b", "Nemotron Safety Reasoning 4B"),
    ("nvidia/cosmos3-nano", "Cosmos3 Nano"),
    ("nvidia/cosmos3-nano-reasoner", "Cosmos3 Nano Reasoner"),
    ("nvidia/cosmos-transfer2.5-2b", "Cosmos Transfer 2.5 2B"),
    ("nvidia/cosmos-transfer1-7b", "Cosmos Transfer1 7B"),
    ("nvidia/cosmos-predict1-5b", "Cosmos Predict1 5B"),
    ("nvidia/synthetic-video-detector", "Synthetic Video Detector"),
    ("nvidia/Active Speaker Detection", "Active Speaker Detection"),
    ("nvidia/ising-calibration-1-35b-a3b", "Ising Calibration 1 35B"),
    ("nvidia/riva-translate-4b-instruct-v1.1", "Riva Translate 4B"),
    ("nvidia/nv-embed-v1", "NV-Embed v1"),
    ("nvidia/nv-embedcode-7b-v1", "NV-EmbedCode 7B"),
    ("nvidia/gliner-pii", "GLiNER PII"),
    ("nvidia/llama-3.1-nemotron-safety-guard-8b-v3", "Llama 3.1 Nemotron Safety 8B"),
    ("nvidia/llama-3.3-nemotron-super-49b-v1.5", "Llama 3.3 Nemotron Super 49B v1.5"),
    ("nvidia/llama-3.3-nemotron-super-49b-v1", "Llama 3.3 Nemotron Super 49B v1"),
    ("nvidia/llama-3.1-nemotron-nano-vl-8b-v1", "Llama 3.1 Nemotron Nano VL 8B"),
    ("nvidia/llama-3.1-nemotron-nano-8b-v1", "Llama 3.1 Nemotron Nano 8B"),
    ("nvidia/nemotron-nano-9b-v2", "Nemotron Nano 9B v2"),
    ("nvidia/nvidia-nemotron-nano-9b-v2", "NVIDIA Nemotron Nano 9B v2"),
    ("nvidia/usdcode", "USDCode"),
    ("nvidia/magpie-tts-zeroshot", "Magpie TTS Zeroshot"),
    ("nvidia/Background Noise Removal", "Background Noise Removal"),
    ("nvidia/sparsedrive", "SparseDrive"),
    ("nvidia/bevformer", "BevFormer"),
    ("nvidia/streampetr", "StreamPETR"),

    # Meta
    ("meta/llama-3.3-70b-instruct", "Llama 3.3 70B"),
    ("meta/llama-3.1-70b-instruct", "Llama 3.1 70B"),
    ("meta/llama-3.1-8b-instruct", "Llama 3.1 8B"),
    ("meta/llama-3.2-90b-vision-instruct", "Llama 3.2 90B Vision"),
    ("meta/llama-3.2-11b-vision-instruct", "Llama 3.2 11B Vision"),
    ("meta/llama-3.2-3b-instruct", "Llama 3.2 3B"),
    ("meta/llama-3.2-1b-instruct", "Llama 3.2 1B"),
    ("meta/llama-4-maverick-17b-128e-instruct", "Llama 4 Maverick 17B"),
    ("meta/llama-guard-4-12b", "Llama Guard 4 12B"),

    # Mistral AI
    ("mistralai/mistral-large-3-675b-instruct-2512", "Mistral Large 3 675B"),
    ("mistralai/mistral-medium-3.5-128b", "Mistral Medium 3.5 128B"),
    ("mistralai/mistral-small-4-119b-2603", "Mistral Small 4 119B"),
    ("mistralai/ministral-14b-instruct-2512", "Ministral 14B"),
    ("mistralai/mistral-nemotron", "Mistral Nemotron"),
    ("mistralai/mixtral-8x7b-instruct-v0.1", "Mixtral 8x7B"),

    # Qwen
    ("qwen/qwen3.5-122b-a10b", "Qwen 3.5 122B"),
    ("qwen/qwen3.5-397b-a17b", "Qwen 3.5 397B"),
    ("qwen/qwen3-coder-480b-a35b-instruct", "Qwen 3 Coder 480B"),
    ("qwen/qwen3-next-80b-a3b-instruct", "Qwen 3 Next 80B"),

    # DeepSeek
    ("deepseek-ai/deepseek-v4-flash", "DeepSeek V4 Flash"),

    # Google
    ("google/gemma-4-31b-it", "Gemma 4 31B"),
    ("google/gemma-3n-e4b-it", "Gemma 3n e4b"),
    ("google/gemma-3n-e2b-it", "Gemma 3n e2b"),
    ("google/gemma-2-2b-it", "Gemma 2 2B"),
    ("google/paligemma", "PaliGemma"),

    # OpenAI
    ("openai/gpt-oss-20b", "GPT-OSS 20B"),
    ("openai/gpt-oss-120b", "GPT-OSS 120B"),

    # Autres
    ("stepfun-ai/step-3.7-flash", "Step 3.7 Flash"),
    ("stepfun-ai/step-3.5-flash", "Step 3.5 Flash"),
    ("moonshotai/kimi-k2.6", "Kimi K2.6"),
    ("z-ai/glm-5.1", "GLM 5.1"),
    ("minimaxai/minimax-m2.7", "MiniMax M2.7"),
    ("microsoft/phi-4-mini-instruct", "Phi 4 Mini"),
    ("microsoft/phi-4-multimodal-instruct", "Phi 4 Multimodal"),
    ("bytedance/seed-oss-36b-instruct", "Seed OSS 36B"),
    ("sarvamai/sarvam-m", "Sarvam M"),
    ("dracarys-llama-3.1-70b-instruct", "Dracarys Llama 3.1 70B"),
    ("upstage/solar-10.7b-instruct", "Solar 10.7B"),
    ("stockmark/stockmark-2-100b-instruct", "Stockmark 2 100B"),
]

# ── Helpers ──────────────────────────────────────────────────────────────────

class Colors:
    OK = ""
    KO = ""
    WARN = ""
    INFO = ""
    RESET = ""


def _safe_print(tag, msg):
    import sys
    line = f"{tag} {msg}\n"
    sys.stdout.buffer.write(line.encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()


def log_ok(msg): _safe_print("[OK]", msg)
def log_ko(msg): _safe_print("[KO]", msg)
def log_info(msg): _safe_print("[INFO]", msg)
def log_warn(msg): _safe_print("[WARN]", msg)


def test_api_key(api_key):
    """Test simple : liste les modeles disponibles via l'API NVIDIA."""
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{API_BASE}/models",
            headers={"Authorization": f"Bearer {api_key}"},
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read())
            models = data.get("data", [])
            return True, len(models)
    except Exception as e:
        return False, str(e)


def test_model(model_id, api_key):
    """Envoi un prompt minimal pour verifier que le modele repond."""
    try:
        import urllib.request
        payload = json.dumps({
            "model": model_id,
            "messages": [{"role": "user", "content": PROMPT_TEST}],
            "max_tokens": 5,
            "temperature": 0.0,
        }).encode("utf-8")

        req = urllib.request.Request(
            f"{API_BASE}/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        start = time.time()
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read())
            latency = round((time.time() - start) * 1000)
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return True, latency, content[:50]
    except Exception as e:
        return False, 0, str(e)[:120]


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    # 1. Recuperer la cle API
    api_key = os.environ.get("NVIDIA_API_KEY", "").strip()
    if not api_key:
        # Essayer de lire .env.local
        env_path = Path(__file__).parent.parent / ".env.local"
        if env_path.exists():
            text = env_path.read_text(encoding="utf-8")
            m = re.search(r'NVIDIA_API_KEY=(\S+)', text)
            if m:
                api_key = m.group(1).strip()

    if not api_key:
        log_ko("Aucune cle API NVIDIA trouvee. Definissez NVIDIA_API_KEY.")
        sys.exit(1)

    log_info(f"Cle API : {api_key[:12]}...{api_key[-4:]}")

    # 2. Valider la cle
    log_info("Validation de la cle API...")
    ok, info = test_api_key(api_key)
    if ok:
        log_ok(f"Cle API valide — {info} modeles accessibles")
    else:
        log_ko(f"Cle API invalide : {info}")
        sys.exit(1)

    # 3. Tester chaque modele
    _safe_print("", f"\n{'='*70}")
    _safe_print("", f"Test de {len(MODELS)} modeles (delai {DELAY_BETWEEN_REQUESTS}s entre chaque)")
    _safe_print("", f"{'='*70}\n")

    results = []
    passed = 0
    failed = 0

    for idx, (model_id, label) in enumerate(MODELS, 1):
        ok, latency, detail = test_model(model_id, api_key)
        status = "OK" if ok else "KO"
        results.append({
            "model": model_id,
            "label": label,
            "status": status,
            "latency_ms": latency if ok else None,
            "detail": detail,
        })

        if ok:
            log_ok(f"[{idx:3d}/{len(MODELS)}] {label:45s} ({latency:>5}ms) {detail[:30]}")
            passed += 1
        else:
            # Filtrer les messages d'erreur trop verbeux
            err_short = detail[:80]
            log_ko(f"[{idx:3d}/{len(MODELS)}] {label:45s} — {err_short}")
            failed += 1

        if idx < len(MODELS):
            time.sleep(DELAY_BETWEEN_REQUESTS)

    # 4. Rapport
    _safe_print("", f"\n{'='*70}")
    _safe_print("", f"RESULTAT : {passed} OK / {failed} KO / {len(MODELS)} total")
    _safe_print("", f"{'='*70}")

    # Sauvegarde JSON
    report_path = Path(__file__).parent / "nvidia_validation_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({
            "api_key_valid": True,
            "total": len(MODELS),
            "passed": passed,
            "failed": failed,
            "models": results,
        }, f, indent=2, ensure_ascii=False)
    log_info(f"Rapport JSON : {report_path}")

    # Resume des KO
    if failed:
        _safe_print("", "\nModeles en echec :")
        for r in results:
            if r["status"] == "KO":
                _safe_print("", f"  - {r['label']} ({r['model']})")
                _safe_print("", f"    {r['detail'][:100]}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
