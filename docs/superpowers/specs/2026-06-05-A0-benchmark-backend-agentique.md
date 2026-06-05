# A0 — Benchmark backend agentique & connexion QGIS

**Date** : 2026-06-05
**Angle** : backend / systèmes agentiques open-source (NVIDIA + meilleurs repos GitHub) +
meilleure connexion QGIS. (L'UI est considérée déjà bonne — hors scope, peaufinage ultérieur.)
**But** : identifier quoi brancher pour rendre le backend vraiment puissant, et le mapper sur
l'existant de QGISIA+.

---

## 1. Stack agentique open-source de NVIDIA

### NeMo Agent Toolkit (`nvidia-nat`) — la pièce maîtresse
- **Open-source, licence Apache-2.0**, `pip install nvidia-nat` (extras : `[langchain]`, etc.).
- **Framework-agnostique** : s'ajoute par-dessus LangChain/LangGraph, LlamaIndex, CrewAI,
  Semantic Kernel, Google ADK, ou de simples agents Python.
- **MCP dans les deux sens** : client (consommer des outils MCP distants) ET serveur
  (exposer ses outils/agents en MCP).
- **Atouts pour du multi-agent** : profiling/observabilité, évaluation & optimisation de
  prompts, primitives de perf (exécution parallèle, priority routing), protocole
  Agent-to-Agent (A2A), UI de debug intégrée.

### Modèles Nemotron 3 (open weights) — les cerveaux
- Famille **open** (poids + données + recettes sur Hugging Face), optimisée **agentique** :
  coding, math, raisonnement, **tool calling**, suivi d'instructions, **raisonnement visuel**.
- Architecture hybride **Mamba-Transformer MoE**, contexte natif jusqu'à **1M tokens**,
  pensée multi-agent.
- **Déployable partout** : NVIDIA **NIM** (tier gratuit — notre cœur), mais aussi vLLM,
  SGLang, **Ollama**, llama.cpp → cohérent avec notre offline-first.

**Verdict NVIDIA** : Nemotron via NIM = cœur modèles (gratuit). NeMo Agent Toolkit = on en
adopte d'abord les **patterns** (MCP, model tiering, profiling) ; dépendance `nvidia-nat`
optionnelle plus tard (éviter d'alourdir le `vendor/` du plugin trop tôt).

---

## 2. Meilleurs frameworks agents open-source (GitHub)

| Framework | Force | Pour QGISIA+ |
|-----------|-------|--------------|
| **LangGraph** | Graphe d'états durable, checkpointing, human-in-the-loop, streaming, production-ready | ⭐ **Déjà scaffoldé** dans le projet (`agent_graph.py`, Sprint 7). À consolider comme moteur. |
| **CrewAI** | Rôles d'agents, setup < 20 lignes, courbe d'apprentissage faible | Bon pour prototyper des « équipes » d'agents SIG, mais pas de checkpointing à l'échelle. |
| **agno** | Plateforme d'agents (build/run/manage) | À surveiller, plus lourd. |
| **mcp-agent** (lastmile) | Agents bâtis directement sur MCP + patterns de workflow | Pertinent si on standardise tout sur MCP. |

**Pattern de prod retenu (consensus 2026)** : *model tiering* — petits modèles rapides pour
le triage/routing, gros modèles pour le raisonnement. → C'est **exactement** notre fédération
(`nemotron-mini-4b` en routeur, `llama-3.x-70b`/Nemotron pour le raisonnement).

**Verdict frameworks** : rester sur **LangGraph** (déjà présent) comme moteur de graphe,
garder la fédération maison comme couche de routing/model-tiering. Pas de big-bang CrewAI.

---

## 3. Mieux connecter QGIS — le pattern MCP socket-server

Trois repos de référence, **même architecture** (à imiter / consolider) :

| Repo | Particularité | Licence |
|------|---------------|---------|
| `jjsantos01/qgis_mcp` | Référence d'origine. Plugin QGIS = **serveur socket in-process** ; ~**14 outils** exposés | (non précisée) |
| `anitagraser/QGIS2OllamaMCP` | Fork **Ollama-friendly** via **fastMCP**, ports 9876 (plugin) / 9877 (MCP), **13 outils**, `ping` diagnostic | **GPL-3.0** |
| `nkarasiak/qgis-mcp` | Variante Claude | — |

**Architecture commune** :
```
LLM/Agent ──MCP──► MCP server (Python, fastMCP) ──socket localhost──► Plugin QGIS (serveur in-process)
                                                                         └─► PyQGIS : layers, processing, render, exec
```

**Outils exposés (le standard de facto à couvrir)** :
- Projet : create / load / save
- Couches : add vector/raster, remove, get info, get features, zoom to extent
- Rendu : render map → image
- Processing : exécuter un algorithme du Processing Toolbox avec params
- Code : exécuter du PyQGIS arbitraire (⚠️ à garder derrière une garde de sécurité)
- Diagnostic : `ping`

---

## 4. Mapping sur l'existant QGISIA+ (ce qu'on a déjà vs à ajouter)

| Brique best-in-class | État dans QGISIA+ | Action |
|----------------------|-------------------|--------|
| Modèles agentiques NIM (Nemotron, tool calling) | Catalogue NVIDIA partiel, modèles 404 | Chantier A : curer + ajouter Nemotron 3 |
| Model tiering (routeur rapide + raisonneur) | Fédération `agent_federation.py` (non branchée) | Chantier A : brancher via `/api/llm/smart` |
| Moteur de graphe (LangGraph) | `agent_graph.py` scaffoldé (Sprint 7) | Consolider comme moteur de workflow |
| **QGIS exposé en MCP (socket/outils)** | **`mcp_server.py` déjà créé (Sprint 6)** | **Aligner sur le set d'outils standard (14) + garde sécurité sur exec** |
| Tool calling natif (function calling) | Gateway LiteLLM supporte `tools` | Brancher les outils QGIS comme functions appelables par le LLM |
| MCP client (consommer outils externes) | Absent | Optionnel : permettre à QGISIA+ d'utiliser des serveurs MCP tiers |
| Observabilité/profiling agents | Absent | Optionnel : patterns NeMo Agent Toolkit |

---

## 5. Recommandations (à réinjecter dans la spec du Chantier A)

1. **Cœur modèles** : NIM gratuit, ajouter les **Nemotron 3** (tool calling + vision) au
   catalogue validé, garder Ollama/Nemotron en fallback offline.
2. **Tool calling = la vraie clé de puissance** : exposer les outils QGIS (`qgis_tools.py`)
   comme *functions* appelables par le LLM via le gateway, plutôt que du texte → code → exec.
   C'est ce qui transforme un chatbot en agent qui *agit* dans QGIS.
3. **Standardiser sur MCP** : consolider `mcp_server.py` sur le set d'outils de référence
   (les 14 de `qgis_mcp`), avec **garde de sécurité** sur l'exécution PyQGIS arbitraire.
4. **Moteur** : LangGraph (`agent_graph.py`) comme graphe d'états + fédération en couche de
   routing (model tiering). Pas de réécriture CrewAI.
5. **Optionnel plus tard** : `nvidia-nat` (Apache-2.0) pour profiling/optim/A2A, et un mode
   MCP-client pour consommer des outils tiers. À ne pas embarquer dans le `vendor/` trop tôt.

**Impact sur le découpage** : ces points **enrichissent le Chantier A** (ils ne créent pas
un nouveau gros chantier). Le tool-calling QGIS + consolidation MCP peuvent devenir le
**Sprint 3 du Chantier A**, après gateway (S1) et fédération (S2).

---

## Sources
- [NVIDIA/NeMo-Agent-Toolkit (GitHub)](https://github.com/NVIDIA/NeMo-Agent-Toolkit)
- [NeMo Agent Toolkit — NVIDIA Developer](https://developer.nvidia.com/nemo-agent-toolkit)
- [LangChain × NVIDIA — Enterprise Agentic AI](https://www.langchain.com/blog/nvidia-enterprise)
- [NVIDIA Nemotron — Developer](https://developer.nvidia.com/nemotron)
- [Advancing Agentic AI with Nemotron Open Reasoning Models](https://developer.nvidia.com/blog/advancing-agentic-ai-with-nvidia-nemotron-open-reasoning-models/)
- [Nemotron 3 Super (HF / blog)](https://developer.nvidia.com/blog/introducing-nemotron-3-super-an-open-hybrid-mamba-transformer-moe-for-agentic-reasoning/)
- [jjsantos01/qgis_mcp](https://github.com/jjsantos01/qgis_mcp)
- [anitagraser/QGIS2OllamaMCP](https://github.com/anitagraser/QGIS2OllamaMCP)
- [nkarasiak/qgis-mcp](https://github.com/nkarasiak/qgis-mcp)
- [lastmile-ai/mcp-agent](https://github.com/lastmile-ai/mcp-agent)
- [Best open-source AI agent frameworks 2026 (Firecrawl)](https://www.firecrawl.dev/blog/best-open-source-agent-frameworks)
