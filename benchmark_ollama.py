#!/usr/bin/env python3
"""
Benchmark de vitesse des modèles Ollama — version rapide avec timeouts stricts.
"""

import json
import time
import urllib.request
import urllib.error
import sys
import threading

OLLAMA_URL          = "http://localhost:11434"
TEST_PROMPT         = "1+1="
NUM_PREDICT         = 8     # seulement 8 tokens — très rapide
FIRST_TOKEN_TIMEOUT = 12    # abandon si pas de 1er token après 12s
TOTAL_TIMEOUT       = 20    # abandon total après 20s

COLORS = {
    "green": "\033[92m", "yellow": "\033[93m", "red": "\033[91m",
    "cyan": "\033[96m",  "bold": "\033[1m",    "reset": "\033[0m",
}
def c(text, color): return f"{COLORS.get(color,'')}{text}{COLORS['reset']}"

def log(msg): print(f"    {msg}", flush=True)

def get_installed_models():
    try:
        req = urllib.request.Request(f"{OLLAMA_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            models = data.get("models", [])
            return [m["name"] for m in models]
    except Exception as e:
        print(c(f"Erreur connexion Ollama : {e}", "red"))
        sys.exit(1)

def benchmark_model(model_name, prompt, verbose=False):
    url = f"{OLLAMA_URL}/api/generate"
    payload = json.dumps({
        "model": model_name,
        "prompt": prompt,
        "stream": True,
        "options": {"num_predict": NUM_PREDICT, "temperature": 0.1},
    }).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

    result = {"ok": False, "error": "timeout", "tps": 0, "first_token_s": 0,
              "total_s": 0, "tokens": 0, "load_s": 0}
    done_event = threading.Event()

    def run():
        first_token_time = None
        total_tokens = 0
        start = time.perf_counter()
        last_print = [time.perf_counter()]

        try:
            with urllib.request.urlopen(req, timeout=TOTAL_TIMEOUT) as resp:
                for raw_line in resp:
                    # Abandon si timeout global dépassé
                    if time.perf_counter() - start > TOTAL_TIMEOUT:
                        result["error"] = f"timeout total ({TOTAL_TIMEOUT}s)"
                        done_event.set()
                        return

                    # Abort si pas de 1er token dans les 20s
                    if first_token_time is None and time.perf_counter() - start > FIRST_TOKEN_TIMEOUT:
                        result["error"] = f"pas de 1er token après {FIRST_TOKEN_TIMEOUT}s"
                        done_event.set()
                        return

                    line = raw_line.decode("utf-8").strip()
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    token = chunk.get("response", "")
                    if token:
                        now = time.perf_counter()
                        if first_token_time is None:
                            first_token_time = now - start
                            if verbose:
                                log(c(f"1er token : {first_token_time:.2f}s", "cyan"))
                        total_tokens += 1

                        # Log en temps réel toutes les 5 tokens
                        if verbose and total_tokens % 5 == 0:
                            elapsed = now - start
                            gen_t = elapsed - first_token_time if first_token_time else elapsed
                            live_tps = total_tokens / gen_t if gen_t > 0 else 0
                            elapsed_bar = "#" * min(total_tokens, 30)
                            log(f"[{elapsed_bar:<30}] {total_tokens} tok  {live_tps:.1f} tok/s  {elapsed:.1f}s")

                    if chunk.get("done"):
                        eval_count       = chunk.get("eval_count", total_tokens)
                        eval_duration_ns = chunk.get("eval_duration", 0)
                        load_duration_ns = chunk.get("load_duration", 0)
                        total_time       = time.perf_counter() - start

                        if eval_duration_ns > 0:
                            tps = eval_count / (eval_duration_ns / 1e9)
                        else:
                            gen_t = total_time - (first_token_time or 0)
                            tps = total_tokens / gen_t if gen_t > 0 else 0

                        result.update({
                            "ok": True, "tps": tps,
                            "first_token_s": first_token_time or 0,
                            "total_s": total_time,
                            "tokens": eval_count,
                            "load_s": load_duration_ns / 1e9,
                        })
                        done_event.set()
                        return

        except Exception as e:
            result["error"] = str(e)
            done_event.set()

    t = threading.Thread(target=run, daemon=True)
    t.start()
    done_event.wait(timeout=TOTAL_TIMEOUT + 2)

    if not done_event.is_set():
        result["error"] = f"thread timeout ({TOTAL_TIMEOUT}s)"
    return result

def rate_speed(tps):
    if tps >= 25: return c(f"{tps:.1f} tok/s  ⚡ Rapide",    "green")
    if tps >= 12: return c(f"{tps:.1f} tok/s  ✅ Correct",   "cyan")
    if tps >= 5:  return c(f"{tps:.1f} tok/s  ⚠  Lent",      "yellow")
    return             c(f"{tps:.1f} tok/s  ❌ Très lent",    "red")

def main():
    print(c("\n=== Benchmark Ollama — Vitesse des modèles locaux ===", "bold"))
    print(c(f"    Timeout 1er token : {FIRST_TOKEN_TIMEOUT}s | Timeout total : {TOTAL_TIMEOUT}s | {NUM_PREDICT} tokens/test\n", "cyan"))

    models = get_installed_models()
    if not models:
        print(c("Aucun modèle installé.", "red"))
        sys.exit(1)

    print(f"  {len(models)} modèle(s) trouvé(s) :")
    for m in models:
        size = ""
        print(f"    • {m}{size}")
    print()

    results = []

    for i, model in enumerate(models):
        print(c(f"[{i+1}/{len(models)}] Test : {model}", "bold"))

        # --- Test unique (charge + génère) ---
        print(f"  → Test en cours (timeout {TOTAL_TIMEOUT}s)...", flush=True)
        r = benchmark_model(model, TEST_PROMPT, verbose=True)

        if r["ok"]:
            print(c(f"  ✓ {r['tps']:.1f} tok/s | 1er token : {r['first_token_s']:.2f}s | load : {r['load_s']:.1f}s", "green"))
        else:
            print(c(f"  ✗ ABANDON : {r['error']}", "red"))

        results.append({
            "model": model, "ok": r["ok"],
            "tps": r.get("tps", 0),
            "first_token_s": r.get("first_token_s", 0),
            "total_s": r.get("total_s", 0),
            "tokens": r.get("tokens", 0),
            "load_s": r.get("load_s", 0),
            "error": r.get("error", ""),
        })
        print()

    # --- Résumé final ---
    print(c("=" * 65, "bold"))
    print(c("RÉSUMÉ — Classement par vitesse\n", "bold"))

    ok = sorted([r for r in results if r["ok"]], key=lambda x: x["tps"], reverse=True)
    ko = [r for r in results if not r["ok"]]

    if ok:
        print(f"  {'Modèle':<32} {'Vitesse':<26}  {'1er tok':>7}  {'Load':>6}")
        print("  " + "-" * 62)
        for r in ok:
            name = r["model"][:31]
            print(f"  {name:<32} {rate_speed(r['tps']):<26}  {r['first_token_s']:>5.2f}s  {r['load_s']:>4.1f}s")

    if ko:
        print(c(f"\n  Échecs ({len(ko)}) :", "red"))
        for r in ko:
            print(f"    ✗ {r['model']} — {r['error']}")

    print(c("\n  💡 Conseils :", "bold"))
    print("    • < 5 tok/s   → trop lent, prends un modèle plus petit")
    print("    • 12-25 tok/s → bon pour GeoSylva AI")
    print("    • > 25 tok/s  → excellent")
    if ok and ok[0]["tps"] < 12:
        print(c(f"\n  ⚠ Ton meilleur modèle ({ok[0]['model']}) est à {ok[0]['tps']:.1f} tok/s.", "yellow"))
        print(c("    → Essaie qwen3:4b ou gemma3:1b pour plus de vitesse.", "yellow"))
    print()

if __name__ == "__main__":
    main()
