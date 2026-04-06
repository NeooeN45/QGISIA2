import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Layers, Settings as SettingsIcon, Code2, Sparkles, RefreshCw, FileText } from "lucide-react";

import { Toaster, toast } from "sonner";

import Chat from "./components/Chat";
import TaskStatusPanel from "./components/TaskStatusPanel";
import { InstallationWizard } from "./components/InstallationWizard";
import OllamaSetupWizard from "./components/OllamaSetupWizard";
import CommandPalette from "./components/CommandPalette";
import IntroAnimation from "./components/IntroAnimation";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import {
  ChatConversation,
  createMessage,
} from "./lib/chat-history";
import {
  getLayerDiagnostics,
  getLayerFields,
  getLayersList,
  isQgisAvailable,
  LayerSummary,
  runScriptDetailed,
} from "./lib/qgis";
import {
  generateAssistantReply,
  repairPythonScriptWithProvider,
} from "./lib/llm";
import { AppSettings } from "./lib/settings";
import { appendDebugEvent } from "./lib/debug-log";
import { QGIS_TOOLS_REFERENCE } from "./lib/qgis-tools-reference";
import { useSettingsStore } from "./stores/useSettingsStore";
import { useConversationStore } from "./stores/useConversationStore";
import { useLayerStore } from "./stores/useLayerStore";
import { useUIStore } from "./stores/useUIStore";
import { detectOllama } from "./lib/ollama-auto-detect";

type ResetMode = "welcome" | "reset";

async function buildAssistantMessage(mode: ResetMode) {
  if (isQgisAvailable()) {
    const layers = await getLayersList();

    if (layers.length > 0) {
      return createMessage(
        "assistant",
        mode === "welcome"
          ? `Bonjour ! Je suis prêt à vous aider. J'ai détecté les couches suivantes dans votre projet : **${layers.join(", ")}**. Que souhaitez-vous faire ?`
          : `Nouvelle discussion prête. Couches détectées : **${layers.join(", ")}**. Quelle analyse voulez-vous lancer ?`,
      );
    }

    return createMessage(
      "assistant",
      mode === "welcome"
        ? "Bonjour ! Je suis GeoAI QGIS. Votre projet est actuellement vide. Souhaitez-vous que je vous aide à ajouter des données ou à créer une nouvelle couche ?"
        : "Nouvelle discussion prête. Votre projet est vide. Souhaitez-vous de l'aide pour ajouter des données ?",
    );
  }

  return createMessage(
    "assistant",
    mode === "welcome"
      ? "Bonjour ! Je suis votre assistant **GeoAI QGIS**.\n\nJe peux vous aider à générer des scripts PyQGIS, analyser vos couches, filtrer vos données et préparer des opérations SIG dans QGIS."
      : "Nouvelle discussion prête. Comment puis-je vous aider ?",
  );
}

async function buildLayerContext(
  selectedLayerIds: string[],
  layerContextById: Record<string, "layer" | "selection">,
  layers: LayerSummary[],
): Promise<string> {
  if (selectedLayerIds.length === 0) {
    return "";
  }

  const selectedLayers = selectedLayerIds
    .map((layerId) => layers.find((layer) => layer.id === layerId))
    .filter((layer): layer is LayerSummary => Boolean(layer));

  if (selectedLayers.length === 0) {
    return "";
  }

  const layerBlocks = await Promise.all(
    selectedLayers.map(async (layer) => {
      const fields = await getLayerFields(layer.id);
      const diagnostics = await getLayerDiagnostics(layer.id);
      const previewFields = fields.slice(0, 12).join(", ");
      const featureCount =
        typeof layer.featureCount === "number" ? `${layer.featureCount}` : "inconnu";
      const scope = layerContextById[layer.id] === "selection" ? "selection" : "layer";
      const scopeLabel =
        scope === "selection"
          ? layer.selectedFeatureCount > 0
            ? `sélection active (${layer.selectedFeatureCount} entité(s))`
            : "sélection active demandée mais aucune entité n'est sélectionnée"
          : "couche entière";
      const warnings =
        diagnostics && diagnostics.warnings.length > 0
          ? `  alertes: ${diagnostics.warnings.join(" | ")}`
          : null;

      return [
        `- ${layer.name}`,
        `  id: ${layer.id}`,
        `  portée demandée: ${scopeLabel}`,
        `  type: ${[layer.type, layer.geometryType].filter(Boolean).join(" / ") || "inconnu"}`,
        `  crs: ${layer.crs || "inconnu"}`,
        `  entités: ${featureCount}`,
        `  visibilité: ${layer.visible ? "visible" : "masquée"}`,
        `  opacité: ${Math.round(layer.opacity * 100)}%`,
        layer.subsetString ? `  filtre actif: ${layer.subsetString}` : null,
        warnings,
        previewFields
          ? `  champs: ${previewFields}${fields.length > 12 ? ", ..." : ""}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
    }),
  );

  return [
    "Contexte QGIS explicitement attaché par l'utilisateur.",
    "Priorise ces couches dans ton analyse et dis clairement quand tu sors de ce périmètre.",
    layerBlocks.join("\n\n"),
  ].join("\n\n");
}

function buildWorkspaceSnapshot(layers: LayerSummary[]): string {
  if (layers.length === 0) {
    return "Snapshot automatique du projet QGIS courant : aucune couche chargee.";
  }

  const layerLines = layers.slice(0, 12).map((layer) => {
    const typeLabel =
      [layer.type, layer.geometryType].filter(Boolean).join(" / ") || "inconnu";
    const featureCount =
      typeof layer.featureCount === "number"
        ? `${layer.featureCount} entite(s)`
        : "nombre d'entites inconnu";

    return [
      `- ${layer.name}`,
      `  id: ${layer.id}`,
      `  type: ${typeLabel}`,
      `  crs: ${layer.crs || "inconnu"}`,
      `  contenu: ${featureCount}`,
      `  visibilite: ${layer.visible ? "visible" : "masquee"}`,
      `  opacite: ${Math.round(layer.opacity * 100)}%`,
      layer.subsetString ? `  filtre actif: ${layer.subsetString}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const remainingCount = layers.length - layerLines.length;

  return [
    "Snapshot automatique du projet QGIS courant.",
    `Nombre de couches chargees: ${layers.length}.`,
    layerLines.join("\n\n"),
    remainingCount > 0
      ? `... ${remainingCount} couche(s) supplementaire(s) non listee(s).`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildModelPrompt(
  conversation: ChatConversation,
  layerContext: string,
  workspaceSnapshot: string,
): string {
  const transcript = buildRecentTranscript(conversation);

  const modeInstruction =
    conversation.mode === "plan"
      ? [
          "Tu es l'agent planificateur de GeoSylva AI QGIS.",
          "Reponds en francais.",
          "Ne fournis pas directement de script exécutable sauf si l'utilisateur le demande explicitement.",
          "N'invente jamais de couches, de champs, de CRS, de statistiques ou de resultats absents du contexte.",
          "Quand une information doit venir du web, utilise les outils et API officielles listés ci-dessous.",
          "N'affirme jamais un proprietaire de parcelle sans source explicite et publiquement disponible.",
          "Quand la demande correspond a un workflow connu, propose la bonne chaine d'outils.",
          "Quand plusieurs taches sont demandees, planifie-les toutes dans l'ordre logique.",
          "Réponds avec les sections: Objectif, Couches concernées, Plan d'exécution (étapes numérotées avec outils), Risques, Validation demandée.",
        ].join("\n")
      : [
          "Tu es l'agent opérateur de GeoSylva AI QGIS.",
          "Reponds en francais.",
          "N'invente jamais de couches, de champs, de CRS, de statistiques ou de resultats absents du contexte.",
          "Utilise les outils QGIS natifs du bridge quand ils permettent de réaliser la demande.",
          "Avant d'ecrire du PyQGIS, cherche d'abord s'il existe un outil natif ou une chaine d'outils.",
          "Quand plusieurs taches sont demandees, enchaine-les dans l'ordre et explique chaque etape.",
          "N'affirme jamais un proprietaire de parcelle sans source explicite et publiquement disponible.",
          "Réponds à la dernière demande utilisateur avec une réponse directement exploitable.",
        ].join("\n");

  return [
    modeInstruction,
    "",
    QGIS_TOOLS_REFERENCE,
    "",
    workspaceSnapshot,
    "",
    layerContext || "Aucune couche n'est attachée explicitement au contexte de cette discussion.",
    "",
    "Historique récent de la conversation :",
    transcript,
    "",
    conversation.mode === "plan"
      ? "Reste au niveau planifié et demande validation avant action lourde."
      : "Donne une réponse opérationnelle, concise et exploitable dans QGIS.",
  ].join("\n\n");
}

function buildRecentTranscript(conversation: ChatConversation): string {
  const recentMessages = conversation.messages.slice(-12);
  return recentMessages
    .map((message) =>
      `${message.role === "user" ? "Utilisateur" : "Assistant"}:\n${message.content}`,
    )
    .join("\n\n");
}

interface AutoExecutionAttempt {
  attempt: number;
  repaired: boolean;
  resultMessage: string;
  script: string;
  success: boolean;
}

function looksLikePythonScript(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return false;
  }

  return /(iface|Qgs|processing\b|import\s+\w+|from\s+\w+\s+import)/.test(
    normalized,
  );
}

function extractFirstPythonBlock(content: string): string | null {
  const explicitMatch = content.match(/```(?:python|py)\s*\r?\n([\s\S]*?)```/i);
  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim();
  }

  const genericMatch = content.match(/```\s*\r?\n([\s\S]*?)```/);
  if (genericMatch?.[1] && looksLikePythonScript(genericMatch[1])) {
    return genericMatch[1].trim();
  }

  return null;
}

function replaceFirstPythonBlock(content: string, script: string): string {
  const replacement = ["```python", script.trim(), "```"].join("\n");
  const explicitPattern = /```(?:python|py)\s*\r?\n[\s\S]*?```/i;
  if (explicitPattern.test(content)) {
    return content.replace(explicitPattern, replacement);
  }

  const genericPattern = /```\s*\r?\n([\s\S]*?)```/;
  const genericMatch = content.match(genericPattern);
  if (genericMatch?.[1] && looksLikePythonScript(genericMatch[1])) {
    return content.replace(genericPattern, replacement);
  }

  return [content, replacement].filter(Boolean).join("\n\n");
}

function summarizeExecutionMessage(value: string): string {
  const firstLine = value.split(/\r?\n/).find((line) => line.trim().length > 0) || value;
  return firstLine.trim() || "Erreur non detaillee.";
}

function buildAutoExecutionReport(
  attempts: AutoExecutionAttempt[],
  finalState: "success" | "failed" | "unavailable",
): string {
  const headline =
    finalState === "success"
      ? `> Exécution automatique PyQGIS réussie en ${attempts.length} tentative(s).`
      : finalState === "unavailable"
        ? "> Exécution automatique PyQGIS indisponible : QGIS n'est pas connecté."
        : `> Exécution automatique PyQGIS en échec après ${attempts.length} tentative(s).`;

  const details =
    attempts.length > 0
      ? attempts
          .map((attempt) => {
            const state = attempt.success ? "succès" : "échec";
            const source = attempt.repaired ? "script corrigé" : "script initial";
            return `- tentative ${attempt.attempt} (${source}) : ${state} - ${summarizeExecutionMessage(attempt.resultMessage)}`;
          })
          .join("\n")
      : "- aucun script n'a pu être lancé.";

  const footer =
    finalState === "failed"
      ? "Consulte le Journal diagnostic pour le traceback complet."
      : null;

  return [headline, "", details, footer].filter(Boolean).join("\n");
}

async function maybeAutoExecuteAssistantPythonScript(input: {
  assistantContent: string;
  conversation: ChatConversation;
  latestUserMessage: string;
  layerContext: string;
  refreshLayers: () => Promise<void>;
  settings: AppSettings;
  signal?: AbortSignal;
  workspaceSnapshot: string;
}): Promise<string> {
  const {
    assistantContent,
    conversation,
    latestUserMessage,
    layerContext,
    refreshLayers,
    settings,
    signal,
    workspaceSnapshot,
  } = input;

  if (!settings.autoExecutePythonScripts || conversation.mode === "plan") {
    return assistantContent;
  }

  const initialScript = extractFirstPythonBlock(assistantContent);
  if (!initialScript) {
    return assistantContent;
  }

  if (!isQgisAvailable()) {
    appendDebugEvent({
      level: "warning",
      source: "assistant",
      title: "Execution automatique PyQGIS indisponible",
      message:
        "Un script Python a ete genere, mais QGIS n'est pas connecte dans cette session.",
    });

    return [assistantContent, "", buildAutoExecutionReport([], "unavailable")].join(
      "\n\n",
    );
  }

  const attempts: AutoExecutionAttempt[] = [];
  const maxRepairs = settings.autoRepairPythonScripts
    ? settings.autoRepairMaxAttempts
    : 0;

  let currentScript = initialScript;
  let currentContent = assistantContent;

  for (let repairAttempt = 0; repairAttempt <= maxRepairs; repairAttempt += 1) {
    const result = await runScriptDetailed(currentScript, {
      requireConfirmation: false,
    });

    if (!result) {
      appendDebugEvent({
        level: "warning",
        source: "assistant",
        title: "Execution automatique PyQGIS indisponible",
        message:
          "Le bridge QGIS n'a pas renvoye de resultat detaille pendant l'execution automatique.",
      });

      return [currentContent, "", buildAutoExecutionReport(attempts, "unavailable")].join(
        "\n\n",
      );
    }

    attempts.push({
      attempt: repairAttempt + 1,
      repaired: repairAttempt > 0,
      resultMessage: result.message,
      script: currentScript,
      success: result.ok,
    });

    appendDebugEvent({
      level: result.ok ? "success" : "warning",
      source: "assistant",
      title: result.ok
        ? "Execution automatique PyQGIS reussie"
        : "Execution automatique PyQGIS echouee",
      message: result.message,
      details: [currentScript, result.traceback || ""].filter(Boolean).join("\n\n"),
    });

    if (result.ok) {
      await refreshLayers();
      toast.success(
        repairAttempt > 0
          ? "Script PyQGIS corrigé puis exécuté automatiquement."
          : "Script PyQGIS exécuté automatiquement.",
      );

      return [currentContent, "", buildAutoExecutionReport(attempts, "success")].join(
        "\n\n",
      );
    }

    if (repairAttempt >= maxRepairs) {
      break;
    }

    try {
      const repairedContent = await repairPythonScriptWithProvider({
        errorMessage: result.message,
        failedScript: currentScript,
        layerContext,
        latestUserMessage,
        settings,
        signal,
        traceback: result.traceback,
        workspaceSnapshot,
      });
      const repairedScript = extractFirstPythonBlock(repairedContent);

      if (!repairedScript) {
        appendDebugEvent({
          level: "warning",
          source: "assistant",
          title: "Reparation automatique PyQGIS sans script",
          message:
            "Le modele a tente une reparation, mais n'a pas renvoye de bloc Python exploitable.",
          details: repairedContent,
        });
        break;
      }

      if (repairedScript.trim() === currentScript.trim()) {
        appendDebugEvent({
          level: "warning",
          source: "assistant",
          title: "Reparation automatique PyQGIS inchangee",
          message:
            "Le modele a renvoye un script identique apres echec. La boucle de relance est interrompue.",
        });
        break;
      }

      currentScript = repairedScript;
      currentContent = replaceFirstPythonBlock(currentContent, repairedScript);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "La reparation automatique a echoue.";
      appendDebugEvent({
        level: "error",
        source: "assistant",
        title: "Reparation automatique PyQGIS echouee",
        message,
        details: error instanceof Error ? error.stack : undefined,
      });
      break;
    }
  }

  toast.error("Le script PyQGIS a échoué et n'a pas pu être corrigé automatiquement.");

  return [currentContent, "", buildAutoExecutionReport(attempts, "failed")].join(
    "\n\n",
  );
}

export default function App() {
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);

  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const convStore = useConversationStore;

  const layers = useLayerStore((s) => s.layers);
  const isRefreshingLayers = useLayerStore((s) => s.isRefreshing);
  const refreshLayers = useLayerStore((s) => s.refresh);

  const isLoading = useUIStore((s) => s.isLoading);
  const setIsLoading = useUIStore((s) => s.setIsLoading);
  const setIsQgisConnected = useUIStore((s) => s.setIsQgisConnected);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const abortControllerRef = useRef<AbortController | null>(null);

  const activeConversation = convStore.getState().activeConversation();

  // Apply theme to document
  useEffect(() => {
    const applyTheme = () => {
      const theme = settings.theme;
      console.log("[THEME DEBUG] ===========================================");
      console.log("[THEME DEBUG] Applying theme:", theme);
      console.log("[THEME DEBUG] Current document classes:", document.documentElement.className);
      console.log("[THEME DEBUG] Settings object:", settings);

      appendDebugEvent({
        level: "info",
        source: "app",
        title: "Theme Applied",
        message: `Applying theme: ${theme} | Current classes: ${document.documentElement.className}`,
      });

      if (theme === "dark") {
        console.log("[THEME DEBUG] Setting dark mode");
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else if (theme === "light") {
        console.log("[THEME DEBUG] Setting light mode");
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      } else {
        // auto mode
        console.log("[THEME DEBUG] Auto mode - checking system preference");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        console.log("[THEME DEBUG] System prefers dark:", prefersDark);
        if (prefersDark) {
          document.documentElement.classList.add("dark");
          document.documentElement.classList.remove("light");
        } else {
          document.documentElement.classList.add("light");
          document.documentElement.classList.remove("dark");
        }
      }

      console.log("[THEME DEBUG] After applying - document classes:", document.documentElement.className);

      appendDebugEvent({
        level: "info",
        source: "app",
        title: "Theme Classes Updated",
        message: `New classes: ${document.documentElement.className}`,
      });
    };

    applyTheme();

    // Listen for system preference changes when in auto mode
    if (settings.theme === "auto") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme();
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  const createNewConversation = useCallback(async () => {
    const nextMessage = await buildAssistantMessage(
      conversations.length === 0 ? "welcome" : "reset",
    );
    convStore.getState().createNew(nextMessage);
  }, [conversations.length]);

  const handleExportConversation = useCallback(() => {
    const conv = convStore.getState().activeConversation();
    if (conv) {
      const { exportConversationToMarkdown, downloadFile } = require("./lib/conversation-export");
      const markdown = exportConversationToMarkdown(conv);
      downloadFile(markdown, `${conv.title || "conversation"}.md`, "text/markdown");
      toast.success("Conversation exportée en Markdown");
    }
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      ctrlKey: true,
      action: () => void createNewConversation(),
      description: "Nouvelle conversation",
    },
    {
      key: "/",
      ctrlKey: true,
      action: () => {
        // Focus sur l'input de chat - à implémenter avec ref
        toast.info("Focus sur la zone de chat (à implémenter)");
      },
      description: "Focus sur la zone de chat",
    },
    {
      key: "s",
      ctrlKey: true,
      action: () => handleExportConversation(),
      description: "Sauvegarder la conversation",
    },
    {
      key: "l",
      ctrlKey: true,
      action: () => toggleSidebar(),
      description: "Ouvrir/fermer la sidebar",
    },
  ]);

  const handleUpdateSettings = useCallback(
    (newSettings: typeof settings) => {
      setSettings(newSettings);
      toast.success("Paramètres mis à jour");
    },
    [setSettings],
  );

  const handleSendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const currentConversation = convStore.getState().activeConversation();

      if (!trimmed || !currentConversation) {
        return;
      }

      const userMessage = createMessage("user", trimmed);
      const conversationSnapshot = {
        ...currentConversation,
        messages: [...currentConversation.messages, userMessage],
      };

      convStore.getState().addUserMessage(userMessage);
      setIsLoading(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const currentLayers = useLayerStore.getState().layers;
      const currentSettings = useSettingsStore.getState().settings;
      const doRefresh = useLayerStore.getState().refresh;

      try {
        const layerContext = await buildLayerContext(
          conversationSnapshot.selectedLayerIds,
          conversationSnapshot.layerContextById,
          currentLayers,
        );
        const workspaceSnapshot = buildWorkspaceSnapshot(currentLayers);
        const prompt = buildModelPrompt(
          conversationSnapshot,
          layerContext,
          workspaceSnapshot,
        );
        const assistantContent = await generateAssistantReply({
          conversation: conversationSnapshot,
          latestUserMessage: trimmed,
          layerContext,
          prompt,
          settings: currentSettings,
          signal: abortController.signal,
          transcript: buildRecentTranscript(conversationSnapshot),
        });
        const assistantContentWithAutoExecution =
          await maybeAutoExecuteAssistantPythonScript({
            assistantContent,
            conversation: conversationSnapshot,
            latestUserMessage: trimmed,
            layerContext,
            refreshLayers: doRefresh,
            settings: currentSettings,
            signal: abortController.signal,
            workspaceSnapshot,
          });

        const assistantMessage = createMessage(
          "assistant",
          assistantContentWithAutoExecution,
        );
        convStore
          .getState()
          .addAssistantMessage(currentConversation.id, assistantMessage);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erreur inattendue.";

        if (
          message === "signal is aborted without reason" ||
          message === "This operation was aborted"
        ) {
          toast.info("Génération arrêtée.");
        } else if (error instanceof DOMException && error.name === "AbortError") {
          toast.info("Génération arrêtée.");
        } else {
          console.error("GeoAI error:", error);
          appendDebugEvent({
            level: "error",
            source: "assistant",
            title: "Generation assistant echouee",
            message,
            details:
              error instanceof Error && error.stack
                ? error.stack
                : undefined,
          });
          toast.error(message);
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [setIsLoading],
  );

  const handleToggleLayerSelection = useCallback((layerId: string) => {
    convStore.getState().toggleLayerSelection(layerId);
  }, []);

  const handleSetConversationMode = useCallback(
    (mode: "chat" | "plan") => {
      convStore.getState().setMode(mode);
    },
    [],
  );

  const handleSetLayerContextScope = useCallback(
    (layerId: string, scope: "layer" | "selection") => {
      convStore.getState().setLayerContextScope(layerId, scope);
    },
    [],
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string) => {
      const fallback = await buildAssistantMessage("reset");
      convStore.getState().remove(conversationId, fallback);
    },
    [],
  );

  const handleSetLayerVisibility = useCallback(
    async (layerId: string, visible: boolean) => {
      const status = await useLayerStore.getState().setVisibility(layerId, visible);
      if (status) {
        toast.success(status);
      }
    },
    [],
  );

  const handleSetLayerOpacity = useCallback(
    async (layerId: string, opacity: number) => {
      const status = await useLayerStore.getState().setOpacity(layerId, opacity);
      if (status) {
        toast.success(status);
      }
    },
    [],
  );

  const handleZoomToLayer = useCallback(async (layerId: string) => {
    const status = await useLayerStore.getState().zoom(layerId);
    if (status) {
      toast.success(status);
    }
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, [setIsLoading]);

  // Initialize conversations
  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      const welcomeMsg = await buildAssistantMessage("welcome");
      if (!cancelled) {
        convStore.getState().initialize(welcomeMsg);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist conversations on change
  useEffect(() => {
    convStore.getState().persist();
  }, [conversations, activeConversationId]);

  // Auto-select first conversation when active is missing
  useEffect(() => {
    const { activeConversationId: id, conversations: convs } =
      convStore.getState();

    if (!id && convs.length > 0) {
      convStore.getState().select(convs[0].id);
      return;
    }

    if (id && convs.length > 0 && !convs.some((c) => c.id === id)) {
      convStore.getState().select(convs[0].id);
    }
  }, [activeConversationId, conversations]);

  // Refresh layers periodically & check QGIS connection
  useEffect(() => {
    void refreshLayers();
    setIsQgisConnected(isQgisAvailable());

    const layerInterval = window.setInterval(() => {
      void refreshLayers();
    }, 6000);

    const qgisInterval = window.setInterval(() => {
      setIsQgisConnected(isQgisAvailable());
    }, 1000);

    return () => {
      window.clearInterval(layerInterval);
      window.clearInterval(qgisInterval);
    };
  }, [refreshLayers, setIsQgisConnected]);

  // State pour le wizard d'installation Ollama
  const [showInstallationWizard, setShowInstallationWizard] = useState(false);
  const [showOllamaWizard, setShowOllamaWizard] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showIntroAnimation, setShowIntroAnimation] = useState(true);

  const setShowSettings = useUIStore((s) => s.setShowSettings);
  const setShowPluginSetup = useUIStore((s) => s.setShowPluginSetup);

  // Auto-détection d'Ollama au démarrage
  useEffect(() => {
    const autoDetectOllama = async () => {
      // Ne pas lancer si le provider n'est pas "local" ou si un modèle est déjà configuré
      if (settings.provider !== "local" || (settings.localModel && settings.localModel !== "")) {
        return;
      }

      const ollamaAvailable = await detectOllama();
      if (!ollamaAvailable) {
        // Ollama n'est pas détecté, montrer le wizard après un délai
        setTimeout(() => setShowOllamaWizard(true), 2000);
      }
    };

    autoDetectOllama();
  }, [settings.provider, settings.localModel]);

  const handleOllamaWizardComplete = (model: string) => {
    handleUpdateSettings({
      ...settings,
      localModel: model,
    });
    setShowOllamaWizard(false);
    toast.success(`Modèle ${model} configuré avec succès`);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "k",
      ctrlKey: true,
      action: () => setShowCommandPalette(true),
      description: "Ouvrir la palette de commandes",
    },
  ]);

  // Command palette commands
  const commands = [
    {
      id: "new-conversation",
      label: "Nouvelle discussion",
      description: "Créer une nouvelle conversation",
      icon: <Plus size={18} />,
      action: () => createNewConversation(),
      category: "Conversations",
    },
    {
      id: "refresh-layers",
      label: "Rafraîchir les couches",
      description: "Recharger la liste des couches QGIS",
      icon: <RefreshCw size={18} />,
      action: () => refreshLayers(),
      category: "QGIS",
    },
    {
      id: "open-settings",
      label: "Paramètres IA",
      description: "Ouvrir les paramètres du provider IA",
      icon: <SettingsIcon size={18} />,
      action: () => setShowSettings(true),
      category: "Paramètres",
    },
    {
      id: "open-plugin",
      label: "Installation Plugin",
      description: "Voir les instructions d'installation du plugin QGIS",
      icon: <Code2 size={18} />,
      action: () => setShowPluginSetup(true),
      category: "Paramètres",
    },
    {
      id: "toggle-mode",
      label: "Changer de mode",
      description: "Basculer entre mode Discussion et Plan",
      icon: <Sparkles size={18} />,
      action: () => {
        const currentMode = activeConversation?.mode || "chat";
        handleSetConversationMode(currentMode === "chat" ? "plan" : "chat");
      },
      category: "Conversations",
    },
  ];

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-xl focus:border-2 focus:border-blue-500 focus:bg-blue-500/10 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none"
      >
        Aller au contenu principal
      </a>
      <div id="main-content" className="flex h-screen w-full overflow-hidden">
        <Toaster position="top-right" theme={settings.theme === "light" ? "light" : "dark"} />
        <TaskStatusPanel />
        
        {showIntroAnimation && (
          <IntroAnimation
            onComplete={() => setShowIntroAnimation(false)}
            isFirstTime={!localStorage.getItem("geosylva-intro-seen")}
          />
        )}
      
      {showInstallationWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#131314] p-6 shadow-2xl">
            <InstallationWizard
              onComplete={(selectedModel) => {
                setShowInstallationWizard(false);
                toast.success(`Modèle ${selectedModel} installé avec succès`);
              }}
              onCancel={() => setShowInstallationWizard(false)}
            />
          </div>
        </div>
      )}

      {showOllamaWizard && (
        <OllamaSetupWizard
          onComplete={handleOllamaWizardComplete}
          onClose={() => setShowOllamaWizard(false)}
        />
      )}

      {showCommandPalette && (
        <CommandPalette
          commands={commands}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      <Chat
        activeConversation={activeConversation}
        activeConversationId={activeConversationId}
        conversations={conversations}
        isLoading={isLoading}
        isRefreshingLayers={isRefreshingLayers}
        layers={layers}
        messages={activeConversation?.messages || []}
        onCreateConversation={createNewConversation}
        onDeleteConversation={handleDeleteConversation}
        onRefreshLayers={refreshLayers}
        onSelectConversation={(id: string) => convStore.getState().select(id)}
        onSendMessage={handleSendMessage}
        onSetLayerOpacity={handleSetLayerOpacity}
        onSetLayerContextScope={handleSetLayerContextScope}
        onSetLayerVisibility={handleSetLayerVisibility}
        onStopGeneration={stopGeneration}
        onToggleLayerSelection={handleToggleLayerSelection}
        onUpdateConversationMode={handleSetConversationMode}
        onUpdateSettings={handleUpdateSettings}
        onZoomToLayer={handleZoomToLayer}
        conversationMode={activeConversation?.mode || "chat"}
        layerContextById={activeConversation?.layerContextById || {}}
        selectedLayerIds={activeConversation?.selectedLayerIds || []}
        settings={settings}
      />
      </div>
      </>
  );
}
