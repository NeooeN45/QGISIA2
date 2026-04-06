import { ChatConversation } from "./chat-history";
import { appendDebugEvent } from "./debug-log";
import { buildGeminiConfig, getGeminiChat } from "./gemini";
import { tryHandleLocalIntent } from "./local-intent-router";
import { generateOpenRouterReply } from "./openrouter";
import { buildOpenRouterHeaders } from "./openrouter-headers";
import { QGIS_TOOLS_REFERENCE_SHORT } from "./qgis-tools-reference";
import {
  AppSettings,
  getConfiguredGeminiApiKey,
  getConfiguredOpenRouterApiKey,
} from "./settings";

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
  "Tu es GeoSylva AI, un assistant expert en SIG integre dans QGIS.",
  "Reponds toujours en francais.",
  "",
  "REGLES STRICTES :",
  "1. N'invente JAMAIS de couches, de champs, de CRS, de statistiques ni de resultats absents du contexte fourni.",
  "2. Si la demande est ambigue ou si une information manque, pose une question courte au lieu d'improviser.",
  "3. Privilegie TOUJOURS les outils natifs du bridge QGIS au lieu d'ecrire du PyQGIS libre.",
  "4. Quand tu dois ecrire du PyQGIS, fournis UN SEUL bloc ```python``` complet, executable tel quel dans QGIS.",
  "5. N'affirme jamais un proprietaire de parcelle sans source publique explicite.",
  "6. Quand plusieurs actions sont necessaires, enchaine-les dans l'ordre logique et explique chaque etape.",
  "",
  QGIS_TOOLS_REFERENCE_SHORT,
].join("\n");

const PYQGIS_REPAIR_SYSTEM_PROMPT = [
  "Tu es un expert PyQGIS charge de corriger un script casse.",
  "Reponds uniquement avec un unique bloc ```python``` corrige.",
  "N'ajoute aucun commentaire hors du bloc.",
  "Le script doit etre executable tel quel dans une console QGIS avec iface, QgsProject, processing et les classes Qgs disponibles.",
  "N'invente pas de couches, de champs, de CRS, ni de variables absentes du contexte fourni.",
  "Applique la correction minimale necessaire pour resoudre l'erreur et satisfaire la demande utilisateur.",
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
  return [
    "Corrige le script PyQGIS suivant pour qu'il s'execute correctement dans QGIS.",
    "Renvoie uniquement un bloc ```python``` corrige, sans texte autour.",
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

async function generateLocalReply(
  settings: AppSettings,
  prompt: string,
  options?: {
    signal?: AbortSignal;
    system?: string;
  },
): Promise<string> {
  const systemContent = options?.system || DEFAULT_LOCAL_SYSTEM_PROMPT;

  // Prefer chat API for better conversation quality
  const useChat = isOllamaGenerateEndpoint(settings.localEndpoint);
  const endpoint = useChat
    ? deriveOllamaChatEndpoint(settings.localEndpoint)
    : settings.localEndpoint;

  const body = useChat
    ? {
        model: settings.localModel,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: prompt },
        ],
        stream: false,
      }
    : /\/v1\/chat\/completions/.test(settings.localEndpoint)
      ? {
          model: settings.localModel,
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: prompt },
          ],
          stream: false,
        }
      : {
          model: settings.localModel,
          prompt,
          stream: false,
          system: systemContent,
        };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
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
      return msg.content.trim();
    }
  }

  // Ollama /api/generate format
  if (typeof data.response === "string" && data.response.trim()) {
    return data.response.trim();
  }

  // OpenAI-compatible format
  if (Array.isArray(data.choices) && data.choices.length > 0) {
    const choice = data.choices[0] as Record<string, unknown>;
    const choiceMsg = choice.message as Record<string, unknown> | undefined;
    if (choiceMsg && typeof choiceMsg.content === "string" && choiceMsg.content.trim()) {
      return choiceMsg.content.trim();
    }
  }

  // Generic fallback
  if (typeof data.content === "string" && data.content.trim()) {
    return data.content.trim();
  }

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
        ...buildGeminiConfig(),
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
    const routed = await tryHandleLocalIntent(
      input.latestUserMessage,
      input.conversation.mode,
    );
    if (routed.handled && routed.response) {
      return routed.response;
    }

    return generateLocalReply(settings, input.prompt, {
      signal: input.signal,
    });
  }

  if (settings.provider === "google") {
    if (!settings.googleApiKey.trim() && !getConfiguredGeminiApiKey()) {
      throw new Error("Aucune cle API Gemini n'est configuree.");
    }

    const chat = getGeminiChat(settings);
    const response = await chat.sendMessage({
      message: input.prompt,
      config: {
        ...buildGeminiConfig(),
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
