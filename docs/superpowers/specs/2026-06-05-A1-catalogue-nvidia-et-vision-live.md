# A1 — Catalogue NVIDIA NIM gratuit (juin 2026) + Vision live du canvas

**Date** : 2026-06-05
**Source** : catalogue live `build.nvidia.com` (Free Endpoint), fourni par l'utilisateur.
**But** : (1) figer la sélection de modèles gratuits réellement disponibles aujourd'hui ;
(2) ajouter la capacité « vision live » : l'IA voit le canvas QGIS pour mieux modifier la carte.

> ⚠️ **Supersede** : ce catalogue remplace la liste « validée » d'avril 2026. Plusieurs modèles
> jugés 404 à l'époque (mistral-large-3, riva-translate, content-safety) **existent maintenant**.
> Le script de validation (Chantier A-S1) doit re-tester CETTE liste avant figeage en `models.json`.

---

## 1. Modèles gratuits pertinents pour QGISIA+ (par capacité)

### Raisonnement / agentique / tool calling (cerveaux)
| Modèle | Points forts | Rôle proposé |
|--------|-------------|--------------|
| `nemotron-3-ultra-550b-a55b` | Hybrid Mamba-Transformer MoE, **1M ctx**, agentic reasoning/coding/planning/**tool calling** | Raisonnement spatial lourd (« les folies ») |
| `nemotron-3-super-120b-a12b` | Même famille, 1M ctx, agentic + tool calling | **Cerveau général / planner / QGIS expert** ⭐ |
| `nemotron-3-nano-30b-a3b` | MoE 1M ctx, coding/reasoning/**tool calling**, rapide | **Routeur** + tâches rapides |
| `deepseek-v4-flash` | 284B MoE, 1M ctx, coding & agents rapides | Fallback raisonnement/code |
| `glm-5.1` | Agentic workflows, long-horizon reasoning | Fallback raisonnement |
| `gpt-oss-120b` | MoE reasoning (OpenAI open) | Fallback généraliste |
| `llama-3.3-70b-instruct` | Reasoning + function calling, fiable, rapide | Fallback robuste (confirmé avril) |
| `nemotron-mini-4b-instruct` | SLM RAG + function calling | Routeur ultra-léger |

### Code PyQGIS
| Modèle | Points forts | Rôle |
|--------|-------------|------|
| `qwen3-coder-480b-a35b-instruct` | **Agentic coding** + browser use, 256K | **Code PyQGIS** ⭐ |
| `mistral-small-4-119b-2603` | Hybrid MoE instruct+reasoning+coding, multimodal, 256K | Fallback code/multimodal |
| `nemotron-3-super-120b-a12b` | Coding + tool calling | Fallback code |

### Vision / multimodal (cartes, canvas, documents)
| Modèle | Points forts | Rôle |
|--------|-------------|------|
| `nemotron-nano-12b-v2-vl` | **Multi-image + vidéo**, visual Q&A, summarization, rapide | **Vision live du canvas** ⭐ (boucle rapide) |
| `nemotron-3-nano-omni-30b-a3b-reasoning` | **Omni-modal** (image/vidéo/speech/texte) + reasoning | Vision raisonnée (analyse carte profonde) |
| `llama-3.1-nemotron-nano-vl-8b-v1` | VLM **doc intelligence** | Légendes, PDF, plans |
| `qwen3.5-397b-a17b` | VLM 400B MoE, vision + RAG + agentic | Vision premium (qualité max) |
| `phi-4-multimodal-instruct` | Reasoning image + audio | Fallback multimodal léger |
| `llama-3.2-90b/11b-vision-instruct` | VLM image (confirmés avril) | Fallback vision fiable |

### Extraction structurée / safety / RAG / utilitaires
| Modèle | Rôle |
|--------|------|
| `mistral-large-3-675b-instruct-2512` (VLM) ou `nemotron-3-super-120b` | Extraction JSON structurée |
| `nemotron-3.5-content-safety` (**multimodal**) / `llama-3.1-nemotron-safety-guard-8b-v3` | Safety guard (texte + image) |
| `riva-translate-4b-instruct-v1_1` | Traduction FR↔EN technique (12 langues) |
| `nv-embedcode-7b-v1` | Embeddings code (RAG PyQGIS) |
| `rerank-qa-mistral-4b` | Reranking RAG |
| `gliner-pii` | Détection/masquage PII avant envoi cloud |

---

## 2. Remapping fédération (NVIDIA-first, à confirmer par validation)

| Agent | Primaire | Fallbacks |
|-------|----------|-----------|
| Router | `nemotron-3-nano-30b-a3b` | `nemotron-mini-4b-instruct`, `groq/llama-3.1-8b-instant` |
| Général / QGIS expert / planner | `nemotron-3-super-120b-a12b` | `llama-3.3-70b-instruct`, `gpt-oss-120b` |
| Raisonnement spatial lourd | `nemotron-3-ultra-550b-a55b` | `deepseek-v4-flash`, `glm-5.1` |
| Code PyQGIS | `qwen3-coder-480b-a35b-instruct` | `mistral-small-4-119b-2603`, `llama-3.3-70b` |
| Vision live canvas (rapide) | `nemotron-nano-12b-v2-vl` | `llama-3.2-11b-vision`, `phi-4-multimodal` |
| Vision carte profonde | `nemotron-3-nano-omni-30b-a3b-reasoning` | `qwen3.5-397b-a17b`, `llama-3.2-90b-vision` |
| Doc intelligence | `llama-3.1-nemotron-nano-vl-8b-v1` | `phi-4-multimodal` |
| Extraction JSON | `mistral-large-3-675b-instruct-2512` | `nemotron-3-super-120b` |
| Safety | `nemotron-3.5-content-safety` | `llama-3.1-nemotron-safety-guard-8b-v3` |
| Traduction | `riva-translate-4b-instruct-v1_1` | `llama-3.3-70b` |
| Embeddings / rerank (RAG) | `nv-embedcode-7b-v1` / `rerank-qa-mistral-4b` | local Ollama |

Préfixe LiteLLM : `nvidia_nim/<owner>/<model>` (api_base `https://integrate.api.nvidia.com/v1`).

---

## 3. NOUVELLE capacité — Vision live du canvas (boucle « voir → corriger »)

**Besoin utilisateur** : que l'IA *analyse la carte en direct* pour mieux la modifier.

**Pattern** (inspiré des agents « computer-use » / screenshot loop) :
```
Agent décide une action (style, étiquetage, emprise, buffer…)
   └─► qgis_tools applique l'action (PyQGIS)
        └─► render_canvas() → PNG  (outil déjà prévu dans mcp_server.py)
             └─► VLM rapide (nemotron-nano-12b-v2-vl) "regarde" le rendu
                  └─► critique visuelle structurée (JSON) :
                       { lisible: bool, chevauchement_labels: bool,
                         entites_visibles: bool, contraste_ok: bool, suggestions: [...] }
                       └─► si NOK → l'agent ajuste et reboucle (max N itérations)
```

**Pourquoi c'est puissant** : la modification de carte devient **auto-corrective**. L'agent ne
génère plus « à l'aveugle » — il *voit* que les étiquettes se chevauchent, qu'un buffer est
invisible, que les couleurs jurent, et corrige. C'est le saut qualitatif vers une carto
réellement assistée.

**Intégration sur l'existant** :
- `mcp_server.py` : outil `render_canvas` (rendu du canvas courant → image) + `get_map_state`.
- `vision-multipart` (front) / agent vision : envoi du PNG au VLM.
- `agent_graph.py` (LangGraph) : nœud `visual_check` avec boucle bornée (garde anti-boucle).
- `qgis_tools.py` : actions de correction (réétiquetage, opacité, palette, zoom).

**Modèle** : `nemotron-nano-12b-v2-vl` (rapide, multi-image) pour la boucle ; escalade vers
`nemotron-3-nano-omni-30b-a3b-reasoning` si analyse fine nécessaire.

**Placement roadmap** : capacité transverse **A-S3.5** — s'appuie sur le tool calling (S3),
sert l'auto-pilot (S4) et la repro de carte (S6).

---

## 4. Impact sur les docs précédents

- **A0 / A1** : le remapping fédération de A1 remplace le tableau « modèles validés avril » du
  Chantier A. À réinjecter dans la spec A lors de l'écriture du plan A-S1/S2.
- **A0bis** : ajouter A-S3.5 (vision live) à la roadmap ; elle renforce S4 et S6.
- **Action obligatoire** : le script `validate_nvidia_models.py` (A-S1) doit tester CETTE liste
  (les noms exacts `<owner>/<model>` du catalogue) avant figeage, car le tier gratuit évolue
  vite (modèles datés « 1d / 3d / 1mo » dans le catalogue).
