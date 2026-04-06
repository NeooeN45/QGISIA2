import { X, Download, Terminal, CheckCircle2, AlertTriangle, Cpu, RefreshCw, Zap, ExternalLink, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  detectOllama,
  getOllamaModels,
  getRecommendedModelDownload,
  pullOllamaModel,
  isSystemCompatibleWithLLM,
  selectBestModel,
  getSystemSpecs,
  type PullProgress,
} from "../lib/ollama-auto-detect";

type WizardStep = "scanning" | "install" | "no_models" | "downloading" | "done" | "incompatible";

interface OllamaSetupWizardProps {
  onComplete: (model: string) => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

export default function OllamaSetupWizard({ onComplete, onClose }: OllamaSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>("scanning");
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("");
  const [copiedCmd, setCopiedCmd] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sysCheck = isSystemCompatibleWithLLM();
  const recommendation = getRecommendedModelDownload();

  const runScan = useCallback(async () => {
    setStep("scanning");
    setPullError(null);

    if (!sysCheck.compatible) {
      setStep("incompatible");
      return;
    }

    const ollamaRunning = await detectOllama();
    if (!ollamaRunning) {
      setStep("install");
      return;
    }

    const [models, specs] = await Promise.all([getOllamaModels(), getSystemSpecs()]);

    if (models.length > 0) {
      const best = selectBestModel(models, specs);
      const model = best?.name || models[0].name;
      setSelectedModel(model);
      setStep("done");
      onComplete(model);
      return;
    }

    setStep("no_models");
  }, [sysCheck.compatible, onComplete]);

  useEffect(() => {
    void runScan();
  }, []);

  const handleDownload = useCallback(async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStep("downloading");
    setPullProgress({ status: "Démarrage du téléchargement..." });
    setPullError(null);

    const result = await pullOllamaModel(
      recommendation.model,
      (p) => setPullProgress(p),
      ctrl.signal
    );

    abortRef.current = null;

    if (result.success) {
      setSelectedModel(recommendation.model);
      setStep("done");
      onComplete(recommendation.model);
      toast.success(`Modèle ${recommendation.model} prêt !`);
    } else {
      setPullError(result.error || "Erreur inconnue");
      setStep("no_models");
    }
  }, [recommendation.model, onComplete]);

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(recommendation.command).then(() => {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    });
  };

  const handleCancelDownload = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep("no_models");
  };

  const levelColor = {
    high: "emerald",
    medium: "blue",
    low: "amber",
  }[sysCheck.level];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-gray-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <Terminal size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Assistant IA Local</h3>
              <p className="text-xs text-white/40">Configuration Ollama</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-white/40 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* System badge */}
        <div className={cn(
          "mx-6 mt-4 flex items-center gap-2 rounded-xl border px-3 py-2",
          sysCheck.level === "high" ? "border-emerald-500/20 bg-emerald-500/8" :
          sysCheck.level === "medium" ? "border-blue-500/20 bg-blue-500/8" :
          "border-amber-500/20 bg-amber-500/8"
        )}>
          <Cpu size={14} className={cn(
            sysCheck.level === "high" ? "text-emerald-400" :
            sysCheck.level === "medium" ? "text-blue-400" : "text-amber-400"
          )} />
          <span className="text-xs text-white/60">{sysCheck.reason}</span>
        </div>

        <div className="p-6">
          {/* SCANNING */}
          {step === "scanning" && (
            <div className="flex flex-col items-center py-10 text-center gap-4">
              <Loader2 size={40} className="animate-spin text-emerald-400" />
              <div>
                <p className="text-base font-semibold text-white">Détection d'Ollama...</p>
                <p className="text-sm text-white/50 mt-1">Scan du système en cours</p>
              </div>
            </div>
          )}

          {/* INCOMPATIBLE */}
          {step === "incompatible" && (
            <div className="flex flex-col items-center py-8 text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
                <AlertTriangle size={32} className="text-red-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Système incompatible</p>
                <p className="text-sm text-white/50 mt-1">{sysCheck.reason}</p>
                <p className="text-xs text-white/40 mt-3">Vous pouvez utiliser OpenRouter ou Gemini à la place.</p>
              </div>
              <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm text-white/70 hover:text-white transition-colors">
                Continuer sans Ollama
              </button>
            </div>
          )}

          {/* INSTALL */}
          {step === "install" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6 text-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10">
                  <Download size={32} className="text-orange-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">Ollama non détecté</p>
                  <p className="text-sm text-white/50 mt-1">Installez Ollama pour utiliser l'IA en local</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
                <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Étapes</p>
                {[
                  { n: 1, label: "Téléchargez Ollama", sub: "ollama.com", href: "https://ollama.com/download" },
                  { n: 2, label: "Installez et lancez Ollama", sub: "Il démarre automatiquement" },
                  { n: 3, label: "Cliquez sur Réessayer", sub: "Le modèle sera téléchargé automatiquement" },
                ].map(({ n, label, sub, href }) => (
                  <div key={n} className="flex items-start gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-[10px] font-bold text-white/60">{n}</span>
                    <div className="flex-1">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-orange-300 hover:text-orange-200 flex items-center gap-1 transition-colors">
                          {label} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <p className="text-sm text-white/70">{label}</p>
                      )}
                      <p className="text-xs text-white/35 mt-0.5">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 rounded-xl border border-white/8 bg-white/4 py-2.5 text-sm text-white/50 hover:text-white transition-colors">
                  Plus tard
                </button>
                <button
                  onClick={() => void runScan()}
                  className="flex-1 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/15 transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} />
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {/* NO MODELS */}
          {step === "no_models" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4 text-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10">
                  <Zap size={28} className="text-violet-400" />
                </div>
                <p className="text-base font-semibold text-white">Ollama actif — aucun modèle</p>
                <p className="text-sm text-white/50">Téléchargez le modèle recommandé pour votre PC</p>
              </div>

              {pullError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2.5 text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle size={13} />
                  {pullError}
                </div>
              )}

              <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">{recommendation.model}</p>
                  <span className="text-xs text-white/40">{recommendation.size}</span>
                </div>
                <p className="text-xs text-white/50">{recommendation.reason}</p>
                <div className="flex items-center gap-2 pt-1">
                  <code className="flex-1 rounded-lg bg-black/30 px-2 py-1.5 text-xs text-white/60 font-mono truncate">
                    {recommendation.command}
                  </code>
                  <button
                    onClick={handleCopyCmd}
                    className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/50 hover:text-white transition-colors"
                  >
                    {copiedCmd ? "✓" : "Copier"}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 rounded-xl border border-white/8 bg-white/4 py-2.5 text-sm text-white/50 hover:text-white transition-colors">
                  Plus tard
                </button>
                <button
                  onClick={() => void handleDownload()}
                  className="flex-1 rounded-xl border border-violet-500/30 bg-violet-500/10 py-2.5 text-sm font-semibold text-violet-200 hover:bg-violet-500/15 transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Télécharger
                </button>
              </div>
            </div>
          )}

          {/* DOWNLOADING */}
          {step === "downloading" && (
            <div className="space-y-5">
              <div className="flex flex-col items-center py-4 text-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10">
                  <Loader2 size={28} className="animate-spin text-violet-400" />
                </div>
                <p className="text-base font-semibold text-white">Téléchargement en cours</p>
                <p className="text-sm text-white/50">{recommendation.model}</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/50">
                  <span>{pullProgress?.status || "Initialisation..."}</span>
                  {pullProgress?.percent != null && (
                    <span>{pullProgress.percent}%</span>
                  )}
                </div>
                <div className="h-2 w-full rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${pullProgress?.percent ?? 0}%` }}
                  />
                </div>
                {pullProgress?.completed != null && pullProgress?.total != null && (
                  <p className="text-center text-xs text-white/30">
                    {formatBytes(pullProgress.completed)} / {formatBytes(pullProgress.total)}
                  </p>
                )}
              </div>

              <button
                onClick={handleCancelDownload}
                className="w-full rounded-xl border border-white/8 bg-white/4 py-2.5 text-sm text-white/50 hover:text-white transition-colors"
              >
                Annuler
              </button>
            </div>
          )}

          {/* DONE */}
          {step === "done" && (
            <div className="flex flex-col items-center py-8 text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">Prêt !</p>
                <p className="text-sm text-white/50 mt-1">
                  Modèle actif : <span className="text-white/80 font-mono text-xs">{selectedModel}</span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-8 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15 transition-colors flex items-center gap-2"
              >
                Commencer <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
