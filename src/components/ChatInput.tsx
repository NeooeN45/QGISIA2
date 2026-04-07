import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Database,
  Layers,
  Loader2,
  Paperclip,
  Send,
  Settings,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { ConversationMode } from "../lib/chat-history";
import { isQgisAvailable, LayerSummary, openQgisLayersPanel, openQgisSettings } from "../lib/qgis";
import { getActiveModel } from "../lib/settings";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useUIStore } from "../stores/useUIStore";
import { useDocumentStore } from "../stores/useDocumentStore";
import { appendDebugEvent } from "../lib/debug-log";
import { toast } from "sonner";
import { extractTextFromFile, formatFileSize, getFileIcon } from "../lib/document-utils";

interface QuickTest {
  label: string;
  prompt: string;
}

const quickTests: QuickTest[] = [
  {
    label: "Test plan projet",
    prompt:
      "Prépare un plan de vérification du projet QGIS actuel, indique les couches présentes, les risques et la prochaine action recommandée.",
  },
  {
    label: "Test couches",
    prompt:
      "Utilise les outils QGIS et dis-moi exactement combien de couches sont chargées et leur nom.",
  },
  {
    label: "Test diagnostic",
    prompt:
      "Utilise les outils QGIS pour résumer la première couche du projet : type, CRS, visibilité, opacité et alertes utiles.",
  },
  {
    label: "Test action sûre",
    prompt:
      "Propose une action non destructive et vérifiable sur le projet QGIS courant, puis attends ma validation.",
  },
  {
    label: "Test NDVI",
    prompt:
      "Si des rasters NDVI sont chargés, fusionne ceux de 2023 et 2024 en image bi-annuelle et centre la carte dessus.",
  },
  {
    label: "Test inventaire",
    prompt:
      "Si une emprise polygonale est présente, crée un dispositif d'inventaire 250 x 250 avec la grille et les centroïdes.",
  },
];

interface ChatInputProps {
  conversationMode: ConversationMode;
  isLoading: boolean;
  onSendMessage: (message: string) => Promise<void>;
  onStopGeneration?: () => void;
  selectedLayers: LayerSummary[];
  layerContextById: Record<string, string>;
  onToggleLayerSelection: (layerId: string) => void;
}

export default function ChatInput({
  conversationMode,
  isLoading,
  onSendMessage,
  onStopGeneration,
  selectedLayers,
  layerContextById,
  onToggleLayerSelection,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [showTests, setShowTests] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settings = useSettingsStore((s) => s.settings);
  const isQgisConnected = useUIStore((s) => s.isQgisConnected);
  const documents = useDocumentStore((s) => s.documents);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  }, [input]);

  useEffect(() => {
    const handler = () => textareaRef.current?.focus();
    document.addEventListener("focusChatInput", handler);
    return () => document.removeEventListener("focusChatInput", handler);
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isLoading) return;
    
    let messageToSend = input;
    
    // Add document context if documents are present
    if (documents.length > 0) {
      const docContext = documents
        .map((doc) => `--- Document: ${doc.name} ---\n${doc.content}\n--- Fin du document ---`)
        .join("\n\n");
      messageToSend = `${input}\n\n[Documents joints]\n${docContext}`;
    }
    
    void onSendMessage(messageToSend);
    setInput("");
  };

  const handleQgisAction = (action: "layers" | "settings") => {
    if (!isQgisAvailable()) {
      appendDebugEvent({
        level: "error",
        source: "qgis",
        title: "QGIS indisponible",
        message: "Le bridge QGIS n'est pas connecte.",
      });
      toast.error("QGIS n'est pas connecté.");
      return;
    }
    if (action === "layers") {
      openQgisLayersPanel();
    } else {
      openQgisSettings();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const addDocument = useDocumentStore.getState().addDocument;
    
    for (const file of files) {
      try {
        const content = await extractTextFromFile(file);
        addDocument({
          name: file.name,
          type: file.type,
          size: file.size,
          content,
        });
        toast.success(`Fichier "${file.name}" ajouté avec succès`);
      } catch (error) {
        console.error("Error extracting text from file:", error);
        toast.error(`Erreur lors de l'extraction du texte de ${file.name}`);
      }
    }
    
    // Reset input
    e.target.value = "";
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-gray-50 dark:from-[#131314] via-gray-50/95 dark:via-[#131314]/95 to-transparent px-4 pb-8 pt-20 md:px-6">
      <div className="pointer-events-auto mx-auto max-w-4xl">
        {selectedLayers.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {selectedLayers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => onToggleLayerSelection(layer.id)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-100 transition-all hover:bg-emerald-500/20"
                title="Retirer cette couche du contexte"
              >
                <span>{layer.name}</span>
                <span className="text-emerald-200/70">
                  {layerContextById[layer.id] === "selection"
                    ? "sélection"
                    : layer.crs || "sans CRS"}
                </span>
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        {isQgisConnected && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowTests((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-white/20 hover:text-white/40 transition-colors"
            >
              <ChevronDown size={10} className={`transition-transform duration-150 ${showTests ? "rotate-180" : ""}`} />
              Tests rapides
            </button>
            {showTests && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {quickTests.map((test) => (
                  <button
                    key={test.label}
                    type="button"
                    onClick={() => { void onSendMessage(test.prompt); setShowTests(false); }}
                    disabled={isLoading}
                    className="rounded-full border border-cyan-500/20 bg-cyan-500/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-100 transition-all hover:bg-cyan-500/14 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {test.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="group relative">
          <div className="absolute -inset-4 rounded-[44px] bg-gradient-to-r from-blue-500 via-emerald-500 to-violet-500 opacity-[0.18] blur-3xl transition-all duration-700 group-focus-within:opacity-[0.55] group-focus-within:-inset-6" />
          <div className="absolute -inset-2 rounded-[40px] bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 opacity-[0.08] blur-xl transition-all duration-500 group-focus-within:opacity-[0.25]" />
          <div className="relative rounded-[32px] border border-gray-200 dark:border-[#333537] bg-gray-100/95 dark:bg-[#1a1a1b]/95 px-5 py-2.5 shadow-xl dark:shadow-2xl dark:shadow-black/60 transition-all focus-within:border-emerald-500/50 focus-within:bg-white dark:focus-within:bg-[#1e2022] focus-within:shadow-emerald-500/10">
            <div className="flex items-end gap-3">
              <div className="hidden items-center gap-1.5 md:flex">
                <button
                  type="button"
                  onClick={() => handleQgisAction("layers")}
                  className="rounded-full p-3 text-gray-500 dark:text-[#c4c7c5] transition-all hover:bg-blue-400/10 hover:text-blue-500 dark:hover:text-blue-400"
                  title="Couches QGIS"
                >
                  <Layers size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => handleQgisAction("settings")}
                  className="rounded-full p-3 text-gray-500 dark:text-[#c4c7c5] transition-all hover:bg-purple-400/10 hover:text-purple-500 dark:hover:text-purple-400"
                  title="Paramètres extension"
                >
                  <Settings size={20} />
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit(event);
                  }
                }}
                placeholder={
                  selectedLayers.length > 0
                    ? conversationMode === "plan"
                      ? `Décrivez le plan à préparer pour ${selectedLayers
                          .map((layer) => layer.name)
                          .join(", ")}...`
                      : `Posez votre question en restant focalisé sur ${selectedLayers
                          .map((layer) => layer.name)
                          .join(", ")}...`
                    : conversationMode === "plan"
                      ? "Décrivez le traitement à planifier..."
                      : "Décrivez votre tâche SIG ou demandez un script..."
                }
                rows={1}
                className="chat-scrollbar max-h-56 flex-1 resize-none border-none bg-transparent px-2 py-3 text-base font-medium text-gray-900 dark:text-white outline-none placeholder:text-gray-500 dark:placeholder:text-[#8e918f]"
              />

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full p-3 text-gray-500 dark:text-[#c4c7c5] transition-all hover:bg-blue-400/10 hover:text-blue-500 dark:hover:text-blue-400"
                  title="Joindre un fichier"
                >
                  <Paperclip size={20} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.csv,.json,.xml,.js,.py,.ts,.tsx,.jsx,.sql,.sh"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {isLoading && onStopGeneration ? (
                  <button
                    type="button"
                    onClick={onStopGeneration}
                    className="rounded-full border border-red-500/30 bg-red-500/10 p-3 text-red-400 transition-all hover:bg-red-500/20"
                    title="Arrêter la génération"
                  >
                    <div className="h-3 w-3 rounded-sm bg-red-500" />
                  </button>
                ) : (
                  <>
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      className={cn(
                        "rounded-full p-3 transition-all shadow-2xl",
                        input.trim() && !isLoading
                          ? "scale-105 bg-emerald-500 text-white shadow-emerald-500/30 hover:bg-emerald-400"
                          : "bg-gray-200 dark:bg-[#131314] text-[#444746]",
                      )}
                    >
                      {isLoading ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Send size={20} />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </form>

        {documents.length > 0 && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Documents joints ({documents.length})
              </span>
              <button
                type="button"
                onClick={() => useDocumentStore.getState().clearDocuments()}
                className="text-[10px] text-red-400 hover:text-red-300"
              >
                Tout effacer
              </button>
            </div>
            <div className="space-y-1.5">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2"
                >
                  <span className="text-lg">{getFileIcon(doc.name)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-secondary)]">
                    {doc.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    {formatFileSize(doc.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => useDocumentStore.getState().removeDocument(doc.id)}
                    className="rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-1 text-[var(--text-muted)] transition-all hover:border-red-400/30 hover:text-red-500"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            <Sparkles size={12} className="text-blue-400" />
            {getActiveModel(settings)}
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            <Database size={12} className="text-emerald-400" />
            PyQGIS natif
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            <Workflow size={12} className="text-fuchsia-400" />
            {settings.provider === "openrouter"
              ? settings.openrouterAgentMode === "multi"
                ? "OpenRouter multi-agent"
                : "OpenRouter single"
              : settings.provider === "google"
                ? "Gemini"
                : "Local"}
          </div>
          {selectedLayers.length > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              <Layers size={12} className="text-cyan-400" />
              {selectedLayers.length} couche(s) ciblée(s)
            </div>
          )}
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
            <Sparkles size={12} className="text-emerald-400" />
            {conversationMode === "plan" ? "Mode plan" : "Mode action"}
          </div>
        </div>
      </div>
    </div>
  );
}
