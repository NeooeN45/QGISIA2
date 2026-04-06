import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Copy,
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  FlaskConical,
  Info,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Server,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import OllamaSetupWizard from "./OllamaSetupWizard";
import { toast } from "sonner";

import { cn } from "@/src/lib/utils";

import {
  applyOpenRouterStackPreset,
  AppSettings,
  DEFAULT_OPENROUTER_STACK_PRESET_ID,
  DEFAULT_LOCAL_ENDPOINT,
  DEFAULT_LOCAL_MODEL,
  GEMINI_MODEL_PRESETS,
  getActiveModel,
  getConfiguredGeminiApiKey,
  getConfiguredOpenRouterApiKey,
  getOpenRouterStackPresetId,
  hasConfiguredGeminiApiKey,
  hasConfiguredOpenRouterApiKey,
  LOCAL_MODEL_PRESETS,
  normalizeSettings,
  OPENROUTER_ROLE_PRESETS,
  OPENROUTER_STACK_PRESETS,
  validateSettings,
} from "../lib/settings";
import { fetchOpenRouterKeyInfo, OpenRouterKeyInfo } from "../lib/openrouter";
import {
  appendDebugEvent,
  clearDebugEvents,
  DebugEvent,
  formatDebugEventsForClipboard,
  getDebugUpdateEventName,
  loadDebugEvents,
} from "../lib/debug-log";
import {
  ModelProbeResult,
  probeActiveProvider,
  probeOpenRouterModel,
  probeQgisBridge,
} from "../lib/model-diagnostics";

import { safeLog } from "../lib/security";

interface SettingsModalProps {
  localSettings: AppSettings;
  onClose: () => void;
  onPasteApiKey: (target: "google" | "openrouter") => void | Promise<void>;
  onReset: () => void;
  onSave: () => void;
  setLocalSettings: Dispatch<SetStateAction<AppSettings>>;
}

const GOOGLE_AI_STUDIO_URL = "https://aistudio.google.com/app/apikey";
const OPENROUTER_KEYS_URL = "https://openrouter.ai/keys";

function maskSecret(value: string): string {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "•".repeat(value.length);
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function SecretInput({
  value,
  placeholder,
  visible,
  onChange,
  onPaste,
  onToggle,
}: {
  value: string;
  placeholder: string;
  visible: boolean;
  onChange: (value: string) => void;
  onPaste: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-12 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-blue-500/35"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <button
        type="button"
        onClick={onPaste}
        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 transition-all hover:bg-white/10 hover:text-white"
      >
        Coller
      </button>
    </div>
  );
}

function Toggle({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-start justify-between gap-4 rounded-2xl border p-4 text-left transition-all",
        checked
          ? "border-emerald-500/35 bg-emerald-500/10 text-white"
          : "border-white/10 bg-white/5 text-white/65 hover:bg-white/8",
      )}
    >
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{description}</p>
      </div>
      <div
        className={cn(
          "mt-0.5 flex h-6 w-11 items-center rounded-full px-1 transition-all",
          checked ? "bg-emerald-500" : "bg-white/10",
        )}
      >
        <div
          className={cn(
            "h-4 w-4 rounded-full bg-white transition-all",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </div>
    </button>
  );
}

function RoleModelSection({
  description,
  onChange,
  presets,
  title,
  value,
}: {
  description: string;
  onChange: (value: string) => void;
  presets: Array<{ id: string; label: string; description: string }>;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Sparkles size={15} className="text-blue-300" />
        {title}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-white/45">{description}</p>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-4 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-blue-500/35"
      />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={cn(
              "rounded-2xl border p-3 text-left transition-all",
              value === preset.id
                ? "border-blue-500/35 bg-blue-500/12 text-white"
                : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
            )}
          >
            <p className="text-sm font-semibold">{preset.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              {preset.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SettingsModal({
  localSettings,
  onClose,
  onPasteApiKey,
  onReset,
  onSave,
  setLocalSettings,
}: SettingsModalProps) {
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [activeTab, setActiveTab] = useState<"provider" | "config" | "execution" | "diagnostics">("provider");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["provider", "basic"]));
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [openRouterKeyInfo, setOpenRouterKeyInfo] = useState<OpenRouterKeyInfo | null>(null);
  const [isLoadingOpenRouterKeyInfo, setIsLoadingOpenRouterKeyInfo] = useState(false);
  const [openRouterKeyInfoError, setOpenRouterKeyInfoError] = useState<string | null>(null);
  const [openRouterKeyInfoUpdatedAt, setOpenRouterKeyInfoUpdatedAt] = useState<string | null>(
    null,
  );
  const [debugEvents, setDebugEvents] = useState<DebugEvent[]>(() => loadDebugEvents());
  const [probeResults, setProbeResults] = useState<Record<string, ModelProbeResult>>({});
  const [activeProbeId, setActiveProbeId] = useState<string | null>(null);
  const [showOllamaWizard, setShowOllamaWizard] = useState(false);

  const handleOllamaWizardComplete = (model: string) => {
    safeLog("[SettingsModal] Ollama wizard completed with model:", model);
    setLocalSettings((current) => ({
      ...current,
      localModel: model,
    }));
    setShowOllamaWizard(false);
    toast.success(`Modèle ${model} configuré avec succès`);
  };

  const normalizedLocalSettings = useMemo(
    () => normalizeSettings(localSettings),
    [localSettings],
  );
  const envGeminiApiKey = getConfiguredGeminiApiKey();
  const envOpenRouterApiKey = getConfiguredOpenRouterApiKey();
  const hasEnvGeminiApiKey = hasConfiguredGeminiApiKey();
  const hasEnvOpenRouterApiKey = hasConfiguredOpenRouterApiKey();

  // Charger les modèles OpenRouter disponibles
  const loadOpenRouterModels = useCallback(async () => {
    if (!normalizedLocalSettings.openrouterApiKey) {
      return;
    }

    setIsLoadingModels(true);
    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Authorization": `Bearer ${normalizedLocalSettings.openrouterApiKey}`,
          "HTTP-Referer": "https://geosylva.ai",
          "X-Title": "GeoSylva AI",
        },
      });

      const data = await response.json();
      if (data.data) {
        setOpenRouterModels(data.data);
      }
    } catch (error) {
      console.error("Erreur lors du chargement des modèles OpenRouter:", error);
    } finally {
      setIsLoadingModels(false);
    }
  }, [normalizedLocalSettings.openrouterApiKey]);
  const settingsIssues = validateSettings(normalizedLocalSettings, {
    hasGeminiEnvKey: hasEnvGeminiApiKey,
    hasOpenRouterEnvKey: hasEnvOpenRouterApiKey,
  });
  const canSaveSettings = settingsIssues.length === 0;
  const activeOpenRouterPresetId = getOpenRouterStackPresetId(normalizedLocalSettings);

  // Charger les modèles OpenRouter quand la clé est disponible
  useEffect(() => {
    if (normalizedLocalSettings.openrouterApiKey && openRouterModels.length === 0) {
      void loadOpenRouterModels();
    }
  }, [normalizedLocalSettings.openrouterApiKey, openRouterModels.length, loadOpenRouterModels]);

  const googleKeySource = normalizedLocalSettings.googleApiKey
    ? "local"
    : hasEnvGeminiApiKey
      ? "env"
      : "missing";
  const openRouterKeySource = normalizedLocalSettings.openrouterApiKey
    ? "local"
    : hasEnvOpenRouterApiKey
      ? "env"
      : "missing";

  const canLoadOpenRouterKeyInfo =
    normalizedLocalSettings.provider === "openrouter" &&
    (normalizedLocalSettings.openrouterApiKey.trim().length > 0 ||
      hasEnvOpenRouterApiKey);

  const refreshOpenRouterKeyInfo = useCallback(
    async (options?: { signal?: AbortSignal; silent?: boolean }) => {
      if (!canLoadOpenRouterKeyInfo) {
        setOpenRouterKeyInfo(null);
        setOpenRouterKeyInfoError(null);
        setOpenRouterKeyInfoUpdatedAt(null);
        setIsLoadingOpenRouterKeyInfo(false);
        return;
      }

      setIsLoadingOpenRouterKeyInfo(true);
      setOpenRouterKeyInfoError(null);

      try {
        const info = await fetchOpenRouterKeyInfo(
          normalizedLocalSettings,
          options?.signal,
        );
        setOpenRouterKeyInfo(info);
        setOpenRouterKeyInfoUpdatedAt(new Date().toISOString());
      } catch (error) {
        if (options?.signal?.aborted) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Impossible de lire l'état de la clé.";
        setOpenRouterKeyInfo(null);
        setOpenRouterKeyInfoError(message);
        if (!options?.silent) {
          appendDebugEvent({
            level: "error",
            source: "settings",
            title: "Lecture etat OpenRouter echouee",
            message,
          });
        }
      } finally {
        if (!options?.signal?.aborted) {
          setIsLoadingOpenRouterKeyInfo(false);
        }
      }
    },
    [canLoadOpenRouterKeyInfo, normalizedLocalSettings],
  );

  // Render functions for modular organization
  const renderProviderSection = () => (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/35">
        <Cpu size={12} />
        Fournisseur principal
      </label>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {renderProviderButton("local", "Local", "Ollama", "Exécution locale sans cloud.", "emerald")}
        {renderProviderButton("google", "Google", "Gemini", "IA générative Google.", "blue")}
        {renderProviderButton("openrouter", "OpenRouter", "Multi", "Stack multi-agent avancée.", "purple")}
      </div>
    </div>
  );

  const renderProviderButton = (id: string, label: string, badge: string, description: string, color: string) => (
    <button
      type="button"
      onClick={() => setLocalSettings((current) => ({ ...current, provider: id as any }))}
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300",
        normalizedLocalSettings.provider === id
          ? `border-${color}-500/50 bg-gradient-to-br from-${color}-500/20 to-${color}-600/10 text-white shadow-lg shadow-${color}-500/20`
          : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8 hover:border-white/20",
      )}
    >
      {normalizedLocalSettings.provider === id && (
        <div className={`absolute inset-0 bg-gradient-to-r from-${color}-500/10 via-transparent to-transparent animate-pulse`} />
      )}
      <div className="relative flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className={cn(
          "text-[10px] uppercase tracking-[0.18em]",
          normalizedLocalSettings.provider === id ? `text-${color}-300` : `${color}-200/50`,
        )}>
          {badge}
        </span>
      </div>
      <p className="relative mt-2 text-xs leading-relaxed text-white/45">
        {description}
      </p>
      {normalizedLocalSettings.provider === id && (
        <div className="relative mt-3 flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full bg-${color}-400 animate-pulse`} />
          <span className={`text-[10px] font-medium text-${color}-300`}>Actif</span>
        </div>
      )}
    </button>
  );

  const renderSettingsSection = (title: string, icon: React.ReactNode, children: React.ReactNode, className?: string) => (
    <div className={cn("rounded-3xl border border-white/10 bg-white/5 p-5", className)}>
      <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/35">
        {icon}
        {title}
      </label>
      <div className="mt-4 space-y-4">
        {children}
      </div>
    </div>
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const renderAccordionSection = (
    sectionId: string,
    title: string,
    icon: React.ReactNode,
    children: React.ReactNode,
    color: string = "white"
  ) => {
    const isExpanded = expandedSections.has(sectionId);
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(sectionId)}
          className="flex w-full items-center justify-between p-5 text-left transition-all hover:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-xl bg-${color}-500/20 p-2 text-${color}-300`}>
              {icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-0.5 text-xs text-white/50">
                {isExpanded ? "Cliquez pour masquer" : "Cliquez pour développer"}
              </p>
            </div>
          </div>
          <div className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}>
            <ChevronDown size={20} className="text-white/40" />
          </div>
        </button>
        {isExpanded && (
          <div className="border-t border-white/10 p-5 space-y-4">
            {children}
          </div>
        )}
      </div>
    );
  };

  const renderModelSelector = (
    currentValue: string,
    onChange: (value: string) => void,
    label: string,
    description: string,
    color: string,
  ) => {
    // Filtrer les modèles pour ne garder que ceux qui supportent le text-to-text
    const availableModels = openRouterModels.filter((m: any) =>
      m.architecture?.modality?.includes("text-to-text") || m.architecture?.modality?.includes("text")
    );

    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full bg-${color}-400`} />
          <p className="text-xs font-semibold text-white/90 uppercase tracking-wider">{label}</p>
        </div>
        <p className="mb-3 text-xs text-white/55">{description}</p>
        
        {isLoadingModels ? (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Loader2 size={14} className="animate-spin" />
            Chargement des modèles...
          </div>
        ) : availableModels.length > 0 ? (
          <select
            value={currentValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all focus:border-fuchsia-500/40"
          >
            {availableModels.map((model: any) => (
              <option key={model.id} value={model.id} className="bg-white dark:bg-[#131314]">
                {model.name} {model.pricing?.prompt === 0 && model.pricing?.completion === 0 ? "(Gratuit)" : ""}
              </option>
            ))}
          </select>
        ) : (
          <div className="text-xs text-white/50">
            Aucun modèle disponible. Vérifiez votre clé API.
          </div>
        )}
      </div>
    );
  };

  const renderGoogleApiKeySection = () => (
    <div className="rounded-3xl border border-blue-500/20 bg-blue-500/6 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <KeyRound size={16} className="text-blue-300" />
            Clé Gemini
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Source actuelle:{" "}
            <strong className="text-white">
              {googleKeySource === "local"
                ? "clé locale"
                : googleKeySource === "env"
                  ? "variable d'environnement"
                  : "non configurée"}
            </strong>
            .
          </p>
        </div>
        <a
          href={GOOGLE_AI_STUDIO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-100 transition-all hover:bg-blue-500/16"
        >
          AI Studio
          <ExternalLink size={13} />
        </a>
      </div>
      <div className="mt-4">
        <SecretInput
          value={normalizedLocalSettings.googleApiKey}
          placeholder={
            googleKeySource === "env"
              ? maskSecret(envGeminiApiKey)
              : "Saisir une clé API Gemini"
          }
          visible={showGoogleKey}
          onChange={(value) =>
            setLocalSettings((current) => ({
              ...current,
              googleApiKey: value,
            }))
          }
          onPaste={() => void onPasteApiKey("google")}
          onToggle={() => setShowGoogleKey((current) => !current)}
        />
      </div>
      <div className="mt-4">
        <label className="mb-2 block text-xs font-medium text-white/70">
          Modèle Gemini
        </label>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {GEMINI_MODEL_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() =>
                setLocalSettings((current) => ({
                  ...current,
                  googleModel: preset.id,
                  model:
                    normalizeSettings({
                      ...current,
                      googleModel: preset.id,
                    }).provider === "google"
                      ? preset.id
                      : current.model,
                }))
              }
              className={cn(
                "rounded-2xl border p-4 text-left transition-all",
                normalizedLocalSettings.googleModel === preset.id
                  ? "border-blue-500/35 bg-blue-500/12 text-white"
                  : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
              )}
            >
              <p className="text-sm font-semibold">{preset.label}</p>
              <p className="mt-1 text-xs text-white/45">{preset.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSidebarNavigation = () => (
    <nav className="flex w-52 flex-col gap-1 border-r border-white/5 bg-white dark:bg-[#131314] p-3">
      {[
        { id: "provider" as const, label: "Provider", icon: Cpu, description: "Choisir le fournisseur IA" },
        { id: "config" as const, label: "Configuration", icon: SettingsIcon, description: "Stack et modèles" },
        { id: "execution" as const, label: "Exécution", icon: Workflow, description: "Options d'exécution" },
        { id: "diagnostics" as const, label: "Diagnostics", icon: FlaskConical, description: "Logs et tests" },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "flex items-start gap-3 rounded-xl p-3 text-left transition-all",
            activeTab === tab.id
              ? "bg-blue-500/15 text-white border border-blue-500/25"
              : "text-white/50 hover:bg-white/5 hover:text-white/70 border border-transparent",
          )}
          title={tab.description}
        >
          <tab.icon size={18} className={cn("mt-0.5", activeTab === tab.id ? "text-blue-300" : "")} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider">{tab.label}</p>
            <p className="mt-0.5 text-[10px] opacity-60 line-clamp-2">{tab.description}</p>
          </div>
          {activeTab === tab.id && (
            <div className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_8px_theme(colors.blue.400)]" />
          )}
        </button>
      ))}
    </nav>
  );

  const runProbe = useCallback(
    async (probeId: string, label: string, runner: () => Promise<ModelProbeResult>) => {
      setActiveProbeId(probeId);

      try {
        const result = await runner();
        setProbeResults((current) => ({
          ...current,
          [probeId]: result,
        }));

        appendDebugEvent({
          level: result.ok ? "success" : "warning",
          source: "diagnostic",
          title: label,
          message: `${result.provider} / ${result.model} en ${result.latencyMs} ms`,
          details: [result.preview, result.details].filter(Boolean).join("\n"),
        });

        if (result.ok) {
          toast.success(`${label} OK en ${result.latencyMs} ms`);
        } else {
          toast.error(result.preview);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Diagnostic indisponible.";
        const failureResult: ModelProbeResult = {
          checkedAt: new Date().toISOString(),
          endpoint:
            normalizedLocalSettings.provider === "openrouter"
              ? normalizedLocalSettings.openrouterEndpoint
              : normalizedLocalSettings.provider === "google"
                ? "https://generativelanguage.googleapis.com"
                : normalizedLocalSettings.localEndpoint,
          latencyMs: 0,
          model:
            normalizedLocalSettings.provider === "openrouter"
              ? normalizedLocalSettings.openrouterExecutorModel
              : normalizedLocalSettings.provider === "google"
                ? normalizedLocalSettings.googleModel
                : normalizedLocalSettings.localModel,
          ok: false,
          preview: message,
          provider: normalizedLocalSettings.provider,
        };

        setProbeResults((current) => ({
          ...current,
          [probeId]: failureResult,
        }));
        appendDebugEvent({
          level: "error",
          source: "diagnostic",
          title: label,
          message,
        });
        toast.error(message);
      } finally {
        setActiveProbeId(null);
      }
    },
    [normalizedLocalSettings],
  );

  useEffect(() => {
    const abortController = new AbortController();
    void refreshOpenRouterKeyInfo({
      signal: abortController.signal,
      silent: true,
    });

    const interval = window.setInterval(() => {
      void refreshOpenRouterKeyInfo({ silent: true });
    }, 60_000);

    return () => {
      abortController.abort();
      window.clearInterval(interval);
    };
  }, [refreshOpenRouterKeyInfo]);

  useEffect(() => {
    const syncDebugEvents = () => {
      setDebugEvents(loadDebugEvents());
    };

    syncDebugEvents();
    window.addEventListener(getDebugUpdateEventName(), syncDebugEvents);

    return () => {
      window.removeEventListener(getDebugUpdateEventName(), syncDebugEvents);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 20 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-[#17181a] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/10 to-emerald-500/10 blur-md" />
              <div className="relative rounded-2xl bg-blue-500/20 p-2.5 text-blue-300">
                <SettingsIcon size={20} />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Paramètres IA</h3>
              <p className="text-xs text-white/45">
                Provider principal, stack multi-agent OpenRouter et exécution locale.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/45 transition-all hover:bg-white/10 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex">
          {renderSidebarNavigation()}
          <div className="flex-1 max-h-[78vh] overflow-y-auto p-6 chat-scrollbar">
          {activeTab === "provider" && (
            <div className="space-y-4">
              {/* Section Provider - Toujours visible */}
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <label className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/35">
                  <Cpu size={12} />
                  Fournisseur principal
                </label>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {renderProviderButton("local", "Local", "Ollama", "Exécution locale sans cloud.", "emerald")}
                  {renderProviderButton("google", "Google", "Gemini", "IA générative Google.", "blue")}
                  {renderProviderButton("openrouter", "OpenRouter", "Multi", "Stack multi-agent avancée.", "purple")}
                </div>
              </div>

              {/* Sections accordéons pour la configuration détaillée */}
              {normalizedLocalSettings.provider === "google" && renderAccordionSection(
                "google-config",
                "Configuration Google Gemini",
                <KeyRound size={20} />,
                renderGoogleApiKeySection(),
                "blue"
              )}

              {normalizedLocalSettings.provider === "local" && renderAccordionSection(
                "local-config",
                "Configuration Local (Ollama)",
                <Server size={20} />,
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-white/70">
                      Endpoint Ollama
                    </label>
                    <input
                      type="text"
                      value={normalizedLocalSettings.localEndpoint}
                      onChange={(e) => setLocalSettings((current) => ({ ...current, localEndpoint: e.target.value }))}
                      placeholder="http://localhost:11434/api/generate"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-emerald-500/40"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-white/70">
                      Modèle
                    </label>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {LOCAL_MODEL_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setLocalSettings((current) => ({ ...current, localModel: preset.id }))}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-all",
                            normalizedLocalSettings.localModel === preset.id
                              ? "border-emerald-500/35 bg-emerald-500/12 text-white"
                              : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
                          )}
                        >
                          <p className="text-sm font-semibold">{preset.label}</p>
                          <p className="mt-1 text-xs text-white/45">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        safeLog("[SettingsModal] Ollama auto-config button clicked");
                        safeLog("[SettingsModal] Opening Ollama wizard...");
                        setShowOllamaWizard(true);
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition-all"
                    >
                      <Cpu size={16} />
                      Détecter et configurer automatiquement
                    </button>
                  </div>
                </div>,
                "emerald"
              )}

              {normalizedLocalSettings.provider === "openrouter" && renderAccordionSection(
                "openrouter-config",
                "Configuration OpenRouter",
                <Sparkles size={20} />,
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <KeyRound size={16} className="text-purple-300" />
                        Clé API
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-white/50">
                        Source actuelle:{" "}
                        <strong className="text-white">
                          {openRouterKeySource === "local"
                            ? "clé locale"
                            : openRouterKeySource === "env"
                              ? "variable d'environnement"
                              : "non configurée"}
                        </strong>
                      </p>
                    </div>
                    <a
                      href={OPENROUTER_KEYS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-100 transition-all hover:bg-purple-500/16"
                    >
                      OpenRouter Keys
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div>
                    <SecretInput
                      value={normalizedLocalSettings.openrouterApiKey}
                      placeholder={
                        openRouterKeySource === "env"
                          ? maskSecret(envOpenRouterApiKey)
                          : "Saisir une clé API OpenRouter"
                      }
                      visible={showOpenRouterKey}
                      onChange={(value) =>
                        setLocalSettings((current) => ({
                          ...current,
                          openrouterApiKey: value,
                        }))
                      }
                      onPaste={() => void onPasteApiKey("openrouter")}
                      onToggle={() => setShowOpenRouterKey((current) => !current)}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-white/70">
                      Endpoint OpenRouter
                    </label>
                    <input
                      type="text"
                      value={normalizedLocalSettings.openrouterEndpoint}
                      onChange={(e) => setLocalSettings((current) => ({ ...current, openrouterEndpoint: e.target.value }))}
                      placeholder="https://openrouter.ai/api/v1"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-purple-500/40"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-white/70">
                      Nom de l'application
                    </label>
                    <input
                      type="text"
                      value={normalizedLocalSettings.openrouterAppName}
                      onChange={(e) => setLocalSettings((current) => ({ ...current, openrouterAppName: e.target.value }))}
                      placeholder="GeoAI QGIS"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-purple-500/40"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-medium text-white/70">
                      Referer HTTP
                    </label>
                    <input
                      type="text"
                      value={normalizedLocalSettings.openrouterReferer}
                      onChange={(e) => setLocalSettings((current) => ({ ...current, openrouterReferer: e.target.value }))}
                      placeholder="https://votre-app.example"
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-purple-500/40"
                    />
                  </div>
                </div>,
                "purple"
              )}
            </div>
          )}
          {activeTab === "config" && (
            <div className="space-y-4">
              {normalizedLocalSettings.provider === "openrouter" && renderAccordionSection(
                "openrouter-stack",
                "Stack OpenRouter Multi-Agent",
                <Workflow size={20} />,
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {OPENROUTER_STACK_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setLocalSettings((current) => {
                            const newSettings = {
                              ...current,
                              openrouterPlannerModel: preset.plannerModel,
                              openrouterDeepPlannerModel: preset.deepPlannerModel,
                              openrouterReviewerModel: preset.reviewerModel,
                              openrouterRetrieverModel: preset.retrieverModel,
                              openrouterExecutorModel: preset.executorModel,
                            };
                            return newSettings;
                          })
                        }
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-all",
                          OPENROUTER_STACK_PRESETS.find(
                            (p) =>
                              p.plannerModel ===
                                normalizedLocalSettings.openrouterPlannerModel,
                          )?.id === preset.id
                            ? "border-fuchsia-500/35 bg-fuchsia-500/12 text-white"
                            : "border-white/10 bg-black/15 text-white/60 hover:bg-white/8",
                        )}
                      >
                        <p className="text-sm font-semibold">{preset.label}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-fuchsia-200/70">
                          {preset.badge}
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-white/45">
                          {preset.description}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-fuchsia-200/70">
                          {preset.priceHint}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">Mode multi-agent</p>
                          <p className="mt-1 text-xs text-white/55">Planner rapide, planner profond, reviewer et executor travaillent en chaîne.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalSettings((current) => ({
                              ...current,
                              openrouterAgentMode: current.openrouterAgentMode === "multi" ? "single" : "multi",
                            }))
                          }
                          className={cn(
                            "mt-1 h-6 w-11 flex-shrink-0 rounded-full p-1 transition-colors",
                            normalizedLocalSettings.openrouterAgentMode === "multi"
                              ? "bg-emerald-500"
                              : "bg-white/10",
                          )}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                              normalizedLocalSettings.openrouterAgentMode === "multi"
                                ? "translate-x-5"
                                : "translate-x-0",
                            )}
                          />
                        </button>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-white">Autoriser les outils QGIS</p>
                          <p className="mt-1 text-xs text-white/55">L'agent executeur peut appeler les outils de couche, filtres, stats et scripts PyQGIS.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalSettings((current) => ({
                              ...current,
                              openrouterExecutionMode: current.openrouterExecutionMode === "tools" ? "draft" : "tools",
                            }))
                          }
                          className={cn(
                            "mt-1 h-6 w-11 flex-shrink-0 rounded-full p-1 transition-colors",
                            normalizedLocalSettings.openrouterExecutionMode === "tools"
                              ? "bg-emerald-500"
                              : "bg-white/10",
                          )}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                              normalizedLocalSettings.openrouterExecutionMode === "tools"
                                ? "translate-x-5"
                                : "translate-x-0",
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {renderModelSelector(
                      normalizedLocalSettings.openrouterPlannerModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterPlannerModel: value })),
                      "Planner",
                      "Premier niveau de planification, rapide et léger.",
                      "fuchsia"
                    )}

                    {normalizedLocalSettings.openrouterAgentMode === "multi" && renderModelSelector(
                      normalizedLocalSettings.openrouterDeepPlannerModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterDeepPlannerModel: value })),
                      "Planner profond",
                      "Reprend le premier plan et renforce CRS, préconditions, sorties et risques.",
                      "blue"
                    )}

                    {normalizedLocalSettings.openrouterAgentMode === "multi" && renderModelSelector(
                      normalizedLocalSettings.openrouterReviewerModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterReviewerModel: value })),
                      "Reviewer",
                      "Passe en revue la stratégie avant restitution ou avant exécution.",
                      "emerald"
                    )}

                    {normalizedLocalSettings.openrouterUseRetriever && renderModelSelector(
                      normalizedLocalSettings.openrouterRetrieverModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterRetrieverModel: value })),
                      "Retriever",
                      "Modèle d'embeddings pour la recherche sémantique dans le contexte.",
                      "cyan"
                    )}

                    {renderModelSelector(
                      normalizedLocalSettings.openrouterExecutorModel,
                      (value) => setLocalSettings((current) => ({ ...current, openrouterExecutorModel: value })),
                      "Executor",
                      "Modèle qui génère les scripts PyQGIS et réponses opérationnelles.",
                      "orange"
                    )}
                  </div>
                </div>,
                "fuchsia"
              )}

              {normalizedLocalSettings.provider !== "openrouter" && (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                  <Info size={32} className="mx-auto text-white/30 mb-3" />
                  <p className="text-sm text-white/50">Sélectionnez OpenRouter comme provider pour accéder à la configuration multi-agent.</p>
                </div>
              )}
            </div>
          )}
          {activeTab === "execution" && (
            <div className="space-y-4">
              {renderAccordionSection(
                "pyqgis-auto",
                "Scripts PyQGIS Automatiques",
                <Workflow size={20} />,
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-white/55">
                    Contrôle l'exécution automatique et la réparation des scripts PyQGIS générés par l'IA.
                  </p>
                  
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <label className="mb-3 block text-xs font-medium text-white/70">
                      Exécution automatique
                    </label>
                    <select
                      value={normalizedLocalSettings.autoExecutePythonScripts ? "true" : "false"}
                      onChange={(e) =>
                        setLocalSettings((current) => ({
                          ...current,
                          autoExecutePythonScripts: e.target.value === "true",
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all focus:border-indigo-500/40"
                    >
                      <option value="false">Désactivé (validation requise)</option>
                      <option value="true">Activé (exécution immédiate)</option>
                    </select>
                  </div>

                  {normalizedLocalSettings.autoExecutePythonScripts && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <label className="mb-3 block text-xs font-medium text-white/70">
                        Auto-réparation
                      </label>
                      <select
                        value={normalizedLocalSettings.autoRepairPythonScripts ? "true" : "false"}
                        onChange={(e) =>
                          setLocalSettings((current) => ({
                            ...current,
                            autoRepairPythonScripts: e.target.value === "true",
                          }))
                        }
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all focus:border-indigo-500/40"
                      >
                        <option value="false">Désactivée</option>
                        <option value="true">Activée (répare automatiquement)</option>
                      </select>
                      {normalizedLocalSettings.autoRepairPythonScripts && (
                        <div className="mt-3">
                          <label className="mb-2 block text-xs font-medium text-white/70">
                            Tentatives max
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            value={normalizedLocalSettings.autoRepairMaxAttempts}
                            onChange={(e) =>
                              setLocalSettings((current) => ({
                                ...current,
                                autoRepairMaxAttempts: parseInt(e.target.value, 10),
                              }))
                            }
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-indigo-500/40"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>,
                "indigo"
              )}
            </div>
          )}
          {activeTab === "diagnostics" && (
            <div className="space-y-4">
              {renderAccordionSection(
                "config-summary",
                "Résumé de Configuration",
                <Info size={20} />,
                <div className="space-y-3 text-sm text-white/60">
                  <div className="flex items-center justify-between gap-3">
                    <span>Provider</span>
                    <strong className="text-white">
                      {normalizedLocalSettings.provider === "local"
                        ? "Local"
                        : normalizedLocalSettings.provider === "google"
                          ? "Google Gemini"
                          : "OpenRouter"}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Modèle actif</span>
                    <strong className="text-white">
                      {getActiveModel(normalizedLocalSettings)}
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Mode agent</span>
                    <strong className="text-white">
                      {normalizedLocalSettings.provider === "openrouter"
                        ? normalizedLocalSettings.openrouterAgentMode === "multi"
                          ? "Multi-agent"
                          : "Single agent"
                        : "Natif"}
                    </strong>
                  </div>
                  {normalizedLocalSettings.provider === "openrouter" && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span>Profil coût</span>
                        <strong className="text-white">
                          {OPENROUTER_STACK_PRESETS.find(
                            (p) =>
                              p.plannerModel ===
                              normalizedLocalSettings.openrouterPlannerModel,
                          )?.label || "Personnalisé"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Exécution</span>
                        <strong className="text-white">
                          {normalizedLocalSettings.openrouterExecutionMode === "tools"
                            ? "Outils QGIS autorisés"
                            : "Draft only"}
                        </strong>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs text-white/65">
                        <div className="font-semibold text-white/85">Chaîne actuelle</div>
                        <div className="mt-2 space-y-1">
                          <div>planner: {normalizedLocalSettings.openrouterPlannerModel}</div>
                          {normalizedLocalSettings.openrouterAgentMode === "multi" && (
                            <div>
                              planner deep: {normalizedLocalSettings.openrouterDeepPlannerModel}
                            </div>
                          )}
                          {normalizedLocalSettings.openrouterAgentMode === "multi" && (
                            <div>reviewer: {normalizedLocalSettings.openrouterReviewerModel}</div>
                          )}
                          {normalizedLocalSettings.openrouterUseRetriever && (
                            <div>retriever: {normalizedLocalSettings.openrouterRetrieverModel}</div>
                          )}
                          <div>executor: {normalizedLocalSettings.openrouterExecutorModel}</div>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span>Exécution PyQGIS</span>
                    <strong className="text-white">
                      {normalizedLocalSettings.autoExecutePythonScripts
                        ? "Automatique"
                        : "Manuelle"}
                    </strong>
                  </div>
                </div>,
                "blue"
              )}

              {normalizedLocalSettings.provider === "openrouter" && renderAccordionSection(
                "openrouter-key-status",
                "État de la clé OpenRouter",
                <Activity size={20} />,
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <Activity size={16} />
                      État de la clé
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshOpenRouterKeyInfo()}
                      disabled={isLoadingOpenRouterKeyInfo}
                      className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold text-fuchsia-100 transition-all hover:bg-fuchsia-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isLoadingOpenRouterKeyInfo ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}
                      Rafraîchir
                    </button>
                  </div>
                  {openRouterKeyInfoUpdatedAt && (
                    <p className="text-[11px] text-fuchsia-200/70">
                      Mis à jour: {new Date(openRouterKeyInfoUpdatedAt).toLocaleTimeString()}
                    </p>
                  )}
                  {openRouterKeyInfoError ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-100">
                      <p className="font-semibold">Erreur de lecture</p>
                      <p className="mt-1 text-red-100/80">{openRouterKeyInfoError}</p>
                    </div>
                  ) : openRouterKeyInfo ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-fuchsia-200/80">Limite</span>
                        <strong className="text-white">
                          ${openRouterKeyInfo.limit?.toFixed(2) || "N/A"}
                        </strong>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-fuchsia-200/80">Utilisé</span>
                        <strong className="text-white">
                          ${openRouterKeyInfo.usage?.toFixed(2) || "N/A"}
                        </strong>
                      </div>
                      {openRouterKeyInfo.usage !== undefined && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-fuchsia-200/80">Utilisé</span>
                          <strong className="text-white">
                            ${openRouterKeyInfo.usage?.toFixed(2) || "N/A"}
                          </strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-fuchsia-200/70">
                      Cliquez sur Rafraîchir pour lire l'état de la clé.
                    </p>
                  )}
                </div>,
                "fuchsia"
              )}

              {renderAccordionSection(
                "diagnostics-tests",
                "Diagnostics et Tests",
                <FlaskConical size={20} />,
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-cyan-100/75">
                    Teste la connexion du provider actif, les modèles OpenRouter choisis et le bridge QGIS pour mesurer latence et erreurs réelles.
                  </p>
                  {normalizedLocalSettings.provider === "openrouter" && (
                    <p className="text-[11px] leading-relaxed text-cyan-100/60">
                      Si tu vois <code>free-models-per-day</code>, le blocage vient du quota journalier OpenRouter sur les modèles gratuits, pas de QGIS.
                    </p>
                  )}
                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        void runProbe("provider-active", "Test provider actif", () =>
                          probeActiveProvider(normalizedLocalSettings),
                        )
                      }
                      disabled={activeProbeId !== null}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-cyan-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Activity size={14} />
                      Tester le provider actif
                    </button>
                    {normalizedLocalSettings.provider === "openrouter" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            void runProbe("openrouter-planner", "Test planner OpenRouter", () =>
                              probeOpenRouterModel(normalizedLocalSettings, normalizedLocalSettings.openrouterPlannerModel),
                            )
                          }
                          disabled={activeProbeId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-fuchsia-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Activity size={14} />
                          Planner
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runProbe("openrouter-executor", "Test executor OpenRouter", () =>
                              probeOpenRouterModel(normalizedLocalSettings, normalizedLocalSettings.openrouterExecutorModel),
                            )
                          }
                          disabled={activeProbeId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-all hover:bg-fuchsia-500/16 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Activity size={14} />
                          Executor
                        </button>
                      </div>
                    )}
                    {Object.keys(probeResults).length > 0 && (
                      <div className="space-y-2">
                        {Object.entries(probeResults).map(([probeId, result]) => (
                          <div
                            key={probeId}
                            className={cn(
                              "rounded-2xl border p-3 text-xs",
                              result.ok
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                                : "border-red-500/30 bg-red-500/10 text-red-100",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{result.provider}</span>
                              <span className="text-[10px] uppercase tracking-[0.18em]">
                                {result.latencyMs}ms
                              </span>
                            </div>
                            <p className="mt-1 text-white/80">{result.preview}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>,
                "cyan"
              )}

              {settingsIssues.length > 0 && (
                <div className="rounded-3xl border border-red-500/20 bg-red-500/8 p-5 text-sm text-red-100">
                  <p className="font-semibold">Configuration incomplète</p>
                  <ul className="mt-3 space-y-2 text-xs text-red-100/80">
                    {settingsIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {settingsIssues.length === 0 && (
                <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/8 p-5 text-sm text-emerald-50/90">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 size={16} />
                    Configuration exploitable
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">
                    Le provider et les rôles sélectionnés ont les champs minimums pour être utilisés.
                  </p>
                </div>
              )}

              {renderAccordionSection(
                "debug-logs",
                "Logs de Debug",
                <Activity size={20} />,
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-cyan-100/75">
                    Affiche les événements de debug récents pour aider à identifier les problèmes.
                  </p>
                  
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold text-white">
                      <Activity size={16} />
                      {debugEvents.length} événements
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const formatted = formatDebugEventsForClipboard(debugEvents);
                          void navigator.clipboard.writeText(formatted);
                          toast.success("Logs copiés dans le presse-papier");
                        }}
                        className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-all hover:bg-cyan-500/16"
                      >
                        <Copy size={14} className="inline mr-1" />
                        Copier
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearDebugEvents();
                          setDebugEvents([]);
                          toast.success("Logs effacés");
                        }}
                        className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 transition-all hover:bg-red-500/16"
                      >
                        <Trash2 size={14} className="inline mr-1" />
                        Effacer
                      </button>
                    </div>
                  </div>

                  {debugEvents.length === 0 ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
                      <Activity size={32} className="mx-auto text-white/20 mb-3" />
                      <p className="text-xs text-white/50">Aucun événement de debug disponible.</p>
                    </div>
                  ) : (
                    <div className="max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-3">
                      {debugEvents.slice(-50).reverse().map((event, index) => (
                        <div
                          key={index}
                          className={`rounded-xl border p-3 text-xs ${
                            event.level === "error"
                              ? "border-red-500/30 bg-red-500/10 text-red-100"
                              : event.level === "warning"
                                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-100"
                                : "border-white/10 bg-white/5 text-white/80"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold uppercase tracking-wider opacity-70">
                              {event.level}
                            </span>
                            <span className="text-[10px] opacity-50">
                              {new Date(event.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="font-medium">{event.message}</p>
                          {event.details && (
                            <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-black/30 p-2 text-[10px] font-mono opacity-80">
                              {event.details}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>,
                "cyan"
              )}
            </div>
          )}
        </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-white dark:bg-[#131314] px-6 py-4">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
          >
            Réinitialiser
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!canSaveSettings}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all",
                canSaveSettings
                  ? "border-emerald-500/30 bg-emerald-500 text-white shadow-lg shadow-emerald-950/25 hover:bg-emerald-400 hover:border-emerald-500/50"
                  : "cursor-not-allowed border-white/10 bg-white/10 text-white/35",
              )}
            >
              <Save size={16} />
              Enregistrer
            </button>
          </div>
        </div>
      </motion.div>

      {showOllamaWizard && (
        <OllamaSetupWizard
          onComplete={handleOllamaWizardComplete}
          onClose={() => setShowOllamaWizard(false)}
        />
      )}
    </motion.div>
  );
}
