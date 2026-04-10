import { ChatConversation } from "./chat-history";
import { appendDebugEvent } from "./debug-log";
import { buildGeminiConfig, getGeminiChat } from "./gemini";
import { tryHandleLocalIntent } from "./local-intent-router";
import { getSystemSpecs } from "./qgis";
import { generateOpenRouterReply } from "./openrouter";
import { buildOpenRouterHeaders } from "./openrouter-headers";
import { QGIS_TOOLS_REFERENCE_SHORT } from "./qgis-tools-reference";
import {
  AppSettings,
  getConfiguredGeminiApiKey,
  getConfiguredOpenRouterApiKey,
} from "./settings";
import { orchestrateResponse } from "./multi-model-orchestrator";
import { useThinkingStore } from "../stores/useThinkingStore";
import { useStreamingStore, createMessageId } from "../stores/useStreamingStore";

interface GenerateAssistantReplyInput {
  conversation: ChatConversation;
  latestUserMessage: string;
  layerContext: string;
  prompt: string;
  signal?: AbortSignal;
  settings: AppSettings;
  transcript: string;
}

interface RepairPythonScriptInput {
  availableLayerNames?: string[];
  errorMessage: string;
  failedScript: string;
  layerContext: string;
  latestUserMessage: string;
  settings: AppSettings;
  signal?: AbortSignal;
  traceback?: string;
  workspaceSnapshot: string;
}

const DEFAULT_LOCAL_SYSTEM_PROMPT = [
  "Tu es GeoSylva AI, un agent SIG expert integre dans QGIS. Tu agis de facon autonome et operationnelle.",
  "Reponds TOUJOURS en francais. Sois direct et precis.",
  "",
  "== IDENTITE ET ROLE ==",
  "- Expert SIG avec maitrise complete de QGIS, PyQGIS, geomatique francaise",
  "- Tu comprends les normes forestieres (ONF, IGN), le cadastre, les donnees IGN/Geoportail",
  "- Tu connais les standards cartographiques francais (Lambert 93, RGF93, EPSG:2154)",
  "- Tu peux analyser, transformer, symboliser et exporter des donnees geospatiales",
  "",
  "== PHILOSOPHIE D'AUTONOMIE ==",
  "Tu es un AGENT, pas un assistant passif. Pour chaque demande :",
  "1. ANALYSE : comprends le contexte geographique et les donnees disponibles",
  "2. PLANIFIE : decompose en etapes logiques et ordonnees",
  "3. EXECUTE : agis sans demander permission pour chaque sous-etape",
  "4. VALIDE : verifie les resultats et signale toute anomalie",
  "5. RAPPORTE : confirme avec resultats concrets et mesurables",
  "",
  "== REGLES ABSOLUES ==",
  "1. N'invente JAMAIS de couches, champs, CRS, statistiques ou fichiers absents du contexte fourni.",
  "2. Utilise les outils bridge QGIS natifs en priorite absolue avant d'ecrire du PyQGIS.",
  "3. Donnees francaises : verifie et reprojette systematiquement en EPSG:2154 (Lambert 93).",
  "4. PyQGIS : UN SEUL bloc ```python``` complet, auto-suffisant, avec iface.messageBar() a la fin.",
  "5. Multi-taches : planifie et execute TOUTES les etapes dans l'ordre logique.",
  "6. N'affirme JAMAIS un proprietaire de parcelle sans source officielle explicite (cadastre.gouv.fr).",
  "7. Si une information est incertaine : dis-le explicitement, ne fabrique pas de donnees.",
  "",
  "== QUALITE DES REPONSES ==",
  "- Utilise des titres Markdown (##) pour structurer les reponses longues",
  "- Pour les scripts PyQGIS : docstring courte, commentaires aux etapes cles, gestion d'erreurs",
  "- Pour les analyses : fournis les unites (hectares, metres, pourcentages)",
  "- Mentionne les CRS d'entree et de sortie pour toute operation de reprojection",
  "- Pour les exports : precise le format, le chemin et la projection",
  "",
  "== GESTION D'ERREURS ==",
  "- Si une couche n'est pas trouvee : propose de la rechercher ou de la charger",
  "- Si un champ est absent : liste les champs disponibles et suggere l'equivalent",
  "- Si le CRS est inconnu : demande confirmation avant de traiter",
  "- Si l'operation echoue : explique la cause probable et propose une alternative",
  "",
  QGIS_TOOLS_REFERENCE_SHORT,
].join("\n");

const PYQGIS_REPAIR_SYSTEM_PROMPT = [
  "Tu es un expert PyQGIS charge de corriger un script casse.",
  "REGLE : reponds UNIQUEMENT avec un bloc ```python``` corrige. Aucun texte avant ou apres.",
  "",
  "REGLES DE CORRECTION :",
  "- Applique la correction minimale qui resout l'erreur",
  "- Le script doit etre executable tel quel dans une console QGIS",
  "- Variables disponibles : iface, QgsProject, processing, et toutes classes Qgs*",
  "- N'invente PAS de couches, champs, CRS ni variables absentes du contexte",
  "- Importe QColor depuis qgis.PyQt.QtGui si besoin de couleurs",
  "- Pour les f-strings avec accentues : utilise la concatenation str() + str() plutot que f-strings si probleme d'encodage",
  "- Termine toujours par iface.messageBar().pushSuccess() ou pushInfo()",
  "- Si erreur 'layer not found' : ajoute une verification if lyr is None avec message d'erreur clair",
  "- Si erreur de CRS : verifie que la couche est en EPSG:2154 avant traitement",
].join("\n");

function isOpenRouterFreeQuotaError(message: string): boolean {
  return message.toLowerCase().includes("free-models-per-day");
}

function extractOpenRouterMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (
        part &&
        typeof part === "object" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      return "";
    })
    .join("")
    .trim();
}

function buildRepairPrompt(input: RepairPythonScriptInput): string {
  const layerList =
    input.availableLayerNames && input.availableLayerNames.length > 0
      ? `Couches REELLEMENT disponibles dans QGIS (utilise UNIQUEMENT ces noms) :\n${input.availableLayerNames.map((n) => `- "${n}"`).join("\n")}`
      : null;

  return [
    "Corrige le script PyQGIS suivant pour qu'il s'execute correctement dans QGIS.",
    "Renvoie UNIQUEMENT un bloc ```python``` corrige, sans aucun texte autour.",
    "",
    "IMPORTANT : N'invente PAS de noms de couches. Utilise uniquement les noms de couches fournis ci-dessous.",
    layerList,
    "",
    "Demande utilisateur :",
    input.latestUserMessage,
    "",
    input.workspaceSnapshot,
    "",
    input.layerContext ||
      "Aucune couche n'est attachee explicitement au contexte de cette demande.",
    "",
    "Erreur observee :",
    input.errorMessage,
    input.traceback ? `Traceback complet :\n${input.traceback}` : null,
    "",
    "Script a corriger :",
    "```python",
    input.failedScript.trim(),
    "```",
  ]
    .filter(Boolean)
    .join("\n");
}

function isOllamaGenerateEndpoint(endpoint: string): boolean {
  return /\/api\/generate\b/.test(endpoint);
}

function deriveOllamaChatEndpoint(endpoint: string): string {
  return endpoint.replace(/\/api\/generate\b/, "/api/chat");
}

function isTransientNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("network request failed")
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  signal?: AbortSignal,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientNetworkError(err) || attempt === maxAttempts) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw lastError;
}

async function streamLocalResponse(
  endpoint: string,
  body: Record<string, unknown>,
  messageId: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Le modele local a renvoye une erreur HTTP ${response.status}${errorText ? ` : ${errorText.slice(0, 200)}` : ""}.`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  const isOpenAI = /\/v1\/chat\/completions/.test(endpoint);
  
  // Démarrer le streaming dans le store
  useStreamingStore.getState().startStreaming(messageId);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        if (isOpenAI) {
          if (!trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") break;
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            chunks.push(delta);
            // Envoyer le chunk au store en temps réel
            useStreamingStore.getState().addChunk(delta);
          }
        } else {
          const parsed = JSON.parse(trimmed) as {
            message?: { content?: string };
            response?: string;
            done?: boolean;
          };
          let content = "";
          if (parsed.message?.content) content = parsed.message.content;
          else if (parsed.response) content = parsed.response;
          
          if (content) {
            chunks.push(content);
            useStreamingStore.getState().addChunk(content);
          }
          if (parsed.done) break;
        }
      } catch {
        /* skip malformed lines */
      }
    }
  }

  const fullText = chunks.join("").trim();
  useStreamingStore.getState().completeStreaming();
  
  return fullText || "Reponse vide du modele local.";
}

async function generateLocalReply(
  settings: AppSettings,
  prompt: string,
  options?: {
    signal?: AbortSignal;
    system?: string;
  },
): Promise<string> {
  const systemContent =
    (settings.systemPromptOverride?.trim() || options?.system || DEFAULT_LOCAL_SYSTEM_PROMPT);

  // Timeout local : 5 minutes max (modèles lents peuvent prendre longtemps)
  const timeoutMs = 5 * 60 * 1000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const combinedSignal = options?.signal
    ? (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any
      ? (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([options.signal, timeoutController.signal])
      : options.signal
    : timeoutController.signal;

  const cleanup = () => clearTimeout(timeoutId);

  // Prefer chat API for better conversation quality
  const useChat = isOllamaGenerateEndpoint(settings.localEndpoint);
  const endpoint = useChat
    ? deriveOllamaChatEndpoint(settings.localEndpoint)
    : settings.localEndpoint;

  let contextWindow = settings.contextWindow ?? 0;
  
  if (contextWindow <= 0) {
    try {
      const specs = await getSystemSpecs();
      if (specs && specs.source === "python_psutil") {
        const totalRam = specs.ram_total_gb;
        const totalVram = specs.gpu_vram_gb;
        
        // Si la machine a beaucoup de VRAM ou RAM, on peut se permettre 8k
        if (totalVram >= 8 || totalRam >= 16) {
          contextWindow = 8192;
        } 
        // Machine moyenne
        else if (totalVram >= 4 || totalRam >= 8) {
          contextWindow = 4096;
        } 
        // Petite machine
        else {
          contextWindow = 2048;
        }
      } else {
        // Fallback conservateur par défaut
        contextWindow = 4096;
      }
    } catch {
      contextWindow = 4096;
    }
  }

  const genParams = {
    temperature: settings.temperature ?? 0.7,
    top_p: settings.topP ?? 0.95,
    num_predict: settings.maxTokens ?? 8192,
    repeat_penalty: settings.repeatPenalty ?? 1.1,
    num_ctx: contextWindow,
    num_gpu: settings.numGpu ?? -1,
  };

  const keepAlive = settings.keepAlive ?? "1h";

  const body = useChat
    ? {
        model: settings.localModel,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: prompt },
        ],
        stream: false,
        keep_alive: keepAlive,
        options: genParams,
      }
    : /\/v1\/chat\/completions/.test(settings.localEndpoint)
      ? {
          model: settings.localModel,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: prompt },
          ],
          stream: false,
          temperature: genParams.temperature,
          top_p: genParams.top_p,
          max_tokens: genParams.num_predict,
          frequency_penalty: genParams.repeat_penalty - 1,
        }
      : {
          model: settings.localModel,
          prompt,
          stream: false,
          system: systemContent,
          keep_alive: keepAlive,
          options: genParams,
        };

  if (settings.streamingEnabled) {
    try {
      const messageId = createMessageId();
      const result = await withRetry(
        () => streamLocalResponse(endpoint, body, messageId, combinedSignal),
        3,
        combinedSignal,
      );
      cleanup();
      return result;
    } catch (err) {
      cleanup();
      if ((err as Error)?.name === "AbortError" && timeoutController.signal.aborted) {
        throw new Error(
          `Le modèle local a dépassé le délai de 5 minutes. Choisissez un modèle plus léger ou augmentez les ressources Ollama.`,
        );
      }
      if (isTransientNetworkError(err)) {
        throw new Error(
          `Impossible de joindre le modele local sur ${endpoint} apres 3 tentatives. Verifie qu'Ollama est lance.`,
        );
      }
      throw err;
    }
  }

  let response: Response;
  try {
    response = await withRetry(
      () => fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: combinedSignal,
      }),
      3,
      combinedSignal,
    );
  } catch (err) {
    cleanup();
    if ((err as Error)?.name === "AbortError" && timeoutController.signal.aborted) {
      throw new Error(
        `Le modèle local a dépassé le délai de 5 minutes. Choisissez un modèle plus léger ou augmentez les ressources Ollama.`,
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("tentatives")) {
      throw new Error(
        `Impossible de joindre le modele local sur ${endpoint}. Verifie qu'Ollama est lance et accessible.`,
      );
    }
    throw err;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Le modele local a renvoye une erreur HTTP ${response.status}${errorText ? ` : ${errorText.slice(0, 200)}` : ""}.`,
    );
  }

  const data = (await response.json()) as Record<string, unknown>;

  // Ollama /api/chat format
  if (data.message && typeof data.message === "object") {
    const msg = data.message as Record<string, unknown>;
    if (typeof msg.content === "string" && msg.content.trim()) {
      cleanup();
      return msg.content.trim();
    }
  }

  // Ollama /api/generate format
  if (typeof data.response === "string" && data.response.trim()) {
    cleanup();
    return data.response.trim();
  }

  // OpenAI-compatible format
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0] as Record<string, unknown>;
    const choiceMsg = choice.message as Record<string, unknown> | undefined;
    if (choiceMsg && typeof choiceMsg.content === "string" && choiceMsg.content.trim()) {
      cleanup();
      return choiceMsg.content.trim();
    }
  }

  // Generic fallback
  if (typeof data.content === "string" && data.content.trim()) {
    cleanup();
    return data.content.trim();
  }

  cleanup();
  return "Reponse vide du modele local.";
}

async function generateOpenRouterRepairReply(
  settings: AppSettings,
  prompt: string,
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = settings.openrouterApiKey || getConfiguredOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("Aucune cle API OpenRouter n'est configuree.");
  }

  const response = await fetch(
    `${settings.openrouterEndpoint.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: buildOpenRouterHeaders(apiKey, settings),
      body: JSON.stringify({
        model: settings.openrouterExecutorModel,
        messages: [
          {
            role: "system",
            content: PYQGIS_REPAIR_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        stream: false,
        provider: {
          order:
            settings.openrouterProviderOrder.length > 0
              ? settings.openrouterProviderOrder
              : undefined,
          allow_fallbacks: settings.openrouterAllowFallbacks,
          require_parameters: false,
          data_collection: settings.openrouterDataCollection,
        },
        plugins: settings.openrouterUseResponseHealing
          ? [{ id: "response-healing" }]
          : undefined,
        zdr: settings.openrouterOnlyZdr,
        temperature: settings.temperature,
        top_p: settings.topP,
        max_tokens: settings.maxTokens,
      }),
      signal,
    },
  );

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: unknown;
      };
    }>;
    error?: {
      message?: string;
    };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `OpenRouter a renvoye une erreur HTTP ${response.status}.`,
    );
  }

  const content = extractOpenRouterMessageText(
    payload.choices?.[0]?.message?.content,
  );
  return content || "Reponse vide d'OpenRouter.";
}

export async function repairPythonScriptWithProvider(
  input: RepairPythonScriptInput,
): Promise<string> {
  const prompt = buildRepairPrompt(input);
  const { settings } = input;

  if (settings.provider === "local") {
    return generateLocalReply(settings, prompt, {
      signal: input.signal,
      system: PYQGIS_REPAIR_SYSTEM_PROMPT,
    });
  }

  if (settings.provider === "google") {
    if (!settings.googleApiKey.trim() && !getConfiguredGeminiApiKey()) {
      throw new Error("Aucune cle API Gemini n'est configuree.");
    }

    const chat = getGeminiChat(settings);
    const response = await chat.sendMessage({
      message: prompt,
      config: {
        ...buildGeminiConfig(settings),
        systemInstruction: PYQGIS_REPAIR_SYSTEM_PROMPT,
        abortSignal: input.signal,
      },
    });

    return response.text || "Reponse vide de Gemini.";
  }

  try {
    return await generateOpenRouterRepairReply(settings, prompt, input.signal);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur OpenRouter inconnue.";

    if (!isOpenRouterFreeQuotaError(message)) {
      throw error;
    }

    appendDebugEvent({
      level: "warning",
      source: "llm",
      title: "Fallback reparation OpenRouter vers local",
      message:
        "Quota journalier OpenRouter gratuit atteint pendant la reparation automatique. Bascule sur le modele local.",
      details: `modele_local=${settings.localModel}\nendpoint_local=${settings.localEndpoint}\nraison=${message}`,
    });

    return generateLocalReply(settings, prompt, {
      signal: input.signal,
      system: PYQGIS_REPAIR_SYSTEM_PROMPT,
    });
  }
}

export async function generateAssistantReply(
  input: GenerateAssistantReplyInput,
): Promise<string> {
  const { settings } = input;

  if (settings.provider === "local") {
    // Utiliser l'orchestrateur multi-modèles avec feedback visuel
    const thinkingStore = useThinkingStore.getState();
    
    try {
      // Phase 1: Analyse d'intention
      thinkingStore.setPhase("ANALYZING_INTENT", {
        message: "Analyse de votre demande...",
        subMessage: "Compréhension de l'intention et de la complexité",
      });

      const result = await orchestrateResponse(
        input.conversation,
        input.latestUserMessage,
        settings,
        input.conversation.mode,
        input.signal,
      );

      // Mise à jour selon l'approche utilisée
      if (result.approach === "HYBRID" || result.approach === "TOOL_CALLING") {
        thinkingStore.setPhase("EXECUTING_TOOLS", {
          message: "Exécution des outils QGIS...",
          subMessage: `Approche: ${result.approach}`,
          modelName: result.modelUsed || undefined,
        });
      } else if (result.approach === "CODE_GENERATION") {
        thinkingStore.setPhase("GENERATING_CODE", {
          message: "Génération du code PyQGIS...",
          subMessage: "Création du script pour QGIS",
          modelName: result.modelUsed || undefined,
        });
      }

      // Phase finale: streaming de la réponse
      thinkingStore.setPhase("STREAMING_RESPONSE", {
        message: "Finalisation de la réponse...",
        subMessage: "Formatage des résultats",
        progress: 95,
      });

      // Réinitialiser après un délai
      setTimeout(() => thinkingStore.reset(), 500);

      return result.response;

    } catch (error) {
      thinkingStore.reset();
      
      // Fallback vers le traitement local traditionnel
      if (input.conversation.mode !== "free") {
        const routed = await tryHandleLocalIntent(
          input.latestUserMessage,
          input.conversation.mode,
        );
        if (routed.handled && routed.response) {
          return routed.response;
        }
      }

      const freeSystemPrompt = input.conversation.mode === "free"
        ? "Tu es QGISAI+, un assistant conversationnel polyvalent. Reponds en francais de facon naturelle et utile sur tout sujet. Pas de SIG, pas de QGIS, pas de scripts."
        : undefined;

      return generateLocalReply(settings, input.prompt, {
        signal: input.signal,
        system: freeSystemPrompt,
      });
    }
  }

  if (settings.provider === "google") {
    if (!settings.googleApiKey.trim() && !getConfiguredGeminiApiKey()) {
      throw new Error("Aucune cle API Gemini n'est configuree.");
    }

    const chat = getGeminiChat(settings);
    const response = await chat.sendMessage({
      message: input.prompt,
      config: {
        ...buildGeminiConfig(settings),
        abortSignal: input.signal,
      },
    });

    return response.text || "Operation SIG terminee, sans message complementaire.";
  }

  try {
    const result = await generateOpenRouterReply({
      conversationMode: input.conversation.mode,
      latestUserMessage: input.latestUserMessage,
      layerContext: input.layerContext,
      prompt: input.prompt,
      transcript: input.transcript,
      settings,
      signal: input.signal,
    });

    return result.text || "OpenRouter n'a pas renvoye de contenu exploitable.";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur OpenRouter inconnue.";

    if (!isOpenRouterFreeQuotaError(message)) {
      throw error;
    }

    appendDebugEvent({
      level: "warning",
      source: "llm",
      title: "Fallback OpenRouter vers local",
      message: "Quota journalier OpenRouter gratuit atteint. Bascule automatique sur le modele local.",
      details: `modele_local=${settings.localModel}\nendpoint_local=${settings.localEndpoint}\nraison=${message}`,
    });

    let localContent: string;
    try {
      localContent = await generateLocalReply(settings, input.prompt, {
        signal: input.signal,
      });
    } catch (localError) {
      const localMessage =
        localError instanceof Error ? localError.message : "Erreur locale inconnue.";
      throw new Error(
        `OpenRouter a atteint son quota gratuit journalier, puis le fallback local a echoue: ${localMessage}`,
      );
    }

    return [
      "> Mode secours local active : quota journalier OpenRouter gratuit atteint.",
      "",
      localContent,
    ].join("\n");
  }
}
