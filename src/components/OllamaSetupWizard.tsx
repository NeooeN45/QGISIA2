import { X, Download, Terminal, CheckCircle2, AlertTriangle, Cpu, HardDrive, RefreshCw } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { detectOllama, getRecommendedModelDownload, autoConfigureOllama } from "../lib/ollama-auto-detect";
import { safeLog } from "../lib/security";

interface OllamaSetupWizardProps {
  onComplete: (model: string) => void;
  onClose: () => void;
  onOpenTerminal?: () => void;
}

export default function OllamaSetupWizard({ onComplete, onClose, onOpenTerminal }: OllamaSetupWizardProps) {
  const [step, setStep] = useState<"detect" | "install" | "configure" | "done">("detect");
  const [isChecking, setIsChecking] = useState(false);
  const [ollamaDetected, setOllamaDetected] = useState(false);
  const [selectedModel, setSelectedModel] = useState("");
  const [autoConfigResult, setAutoConfigResult] = useState<{ success: boolean; model?: string; error?: string } | null>(null);

  // Log when component mounts
  useEffect(() => {
    safeLog("[OllamaWizard] Component mounted");
    safeLog("[OllamaWizard] Current step:", step);
  }, [step]);

  const handleDetect = async () => {
    safeLog("[OllamaWizard] Starting detection...");
    setIsChecking(true);
    try {
      const detected = await detectOllama();
      safeLog("[OllamaWizard] Detection result:", detected);
      setOllamaDetected(detected);
      
      if (detected) {
        safeLog("[OllamaWizard] Ollama detected, moving to configure step");
        setStep("configure");
        toast.success("Ollama détecté !");
        
        // Auto-configure
        const result = await autoConfigureOllama();
        safeLog("[OllamaWizard] Auto-config result:", result);
        setAutoConfigResult(result);
        
        if (result.success && result.model) {
          setSelectedModel(result.model);
          setTimeout(() => {
            safeLog("[OllamaWizard] Calling onComplete with model:", result.model);
            onComplete(result.model!);
            setStep("done");
          }, 1500);
        }
      } else {
        safeLog("[OllamaWizard] Ollama not detected, moving to install step");
        setStep("install");
      }
    } catch (error) {
      safeLog("[OllamaWizard] Detection error:", error);
      toast.error("Erreur lors de la détection d'Ollama");
      setStep("install");
    } finally {
      setIsChecking(false);
    }
  };

  const handleManualConfigure = async () => {
    setIsChecking(true);
    try {
      const result = await autoConfigureOllama();
      setAutoConfigResult(result);
      
      if (result.success && result.model) {
        setSelectedModel(result.model);
        setTimeout(() => {
          onComplete(result.model!);
          setStep("done");
        }, 1500);
      }
    } catch (error) {
      toast.error("Erreur lors de la configuration");
    } finally {
      setIsChecking(false);
    }
  };

  const recommendation = getRecommendedModelDownload();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#17181a] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Configuration Ollama</h3>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          {step === "detect" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                  <Terminal size={40} className="text-emerald-400" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">Configuration automatique d'Ollama</h4>
                <p className="text-sm text-white/60 max-w-md">
                  Nous allons détecter si Ollama est installé sur votre ordinateur et configurer automatiquement le meilleur modèle LLM adapté à votre système.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    safeLog("[OllamaWizard] Detect button clicked");
                    handleDetect();
                  }}
                  disabled={isChecking}
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-6 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isChecking ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                      Détection en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Détecter Ollama
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "install" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10">
                  <Download size={40} className="text-orange-400" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">Ollama non détecté</h4>
                <p className="text-sm text-white/60 max-w-md mb-4">
                  Ollama n'est pas installé ou n'est pas en cours d'exécution sur votre ordinateur.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <h5 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Terminal size={16} className="text-orange-400" />
                  Étapes d'installation :
                </h5>
                <ol className="space-y-3 text-sm text-white/70">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-white">1</span>
                    <span>Téléchargez Ollama depuis <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">ollama.com</a></span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-white">2</span>
                    <span>Installez Ollama sur votre ordinateur</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-white">3</span>
                    <span>Lancez Ollama (il démarrera automatiquement au démarrage)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[10px] font-semibold text-white">4</span>
                    <span className="font-mono text-xs bg-black/30 px-2 py-1 rounded">{recommendation.command}</span>
                  </li>
                </ol>

                <div className="mt-4 p-3 rounded-xl border border-blue-500/20 bg-blue-500/10">
                  <p className="text-xs text-blue-100 flex items-start gap-2">
                    <Cpu size={14} className="mt-0.5 shrink-0" />
                    <span>
                      <strong>Recommandé pour votre système :</strong> {recommendation.model}
                      <br />
                      <span className="text-blue-100/70">{recommendation.reason}</span>
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setStep("detect");
                    handleDetect();
                  }}
                  className="rounded-2xl border border-blue-500/30 bg-blue-500/12 px-6 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/16 transition-all flex items-center gap-2"
                >
                  <RefreshCw size={18} />
                  Réessayer la détection
                </button>
              </div>
            </div>
          )}

          {step === "configure" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-500/10">
                  <Cpu size={40} className="text-blue-400" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">Configuration automatique</h4>
                <p className="text-sm text-white/60 max-w-md">
                  Ollama est détecté ! Nous allons configurer automatiquement le meilleur modèle pour votre système.
                </p>
              </div>

              {autoConfigResult && (
                <div className={cn(
                  "rounded-2xl border p-4",
                  autoConfigResult.success 
                    ? "border-emerald-500/30 bg-emerald-500/10" 
                    : "border-red-500/30 bg-red-500/10"
                )}>
                  {autoConfigResult.success ? (
                    <p className="text-sm text-emerald-100 flex items-center gap-2">
                      <CheckCircle2 size={18} />
                      Modèle sélectionné : <strong>{autoConfigResult.model}</strong>
                    </p>
                  ) : (
                    <p className="text-sm text-red-100 flex items-center gap-2">
                      <AlertTriangle size={18} />
                      {autoConfigResult.error}
                    </p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleManualConfigure}
                  disabled={isChecking}
                  className="rounded-2xl border border-blue-500/30 bg-blue-500/12 px-6 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/16 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isChecking ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                      Configuration...
                    </>
                  ) : (
                    <>
                      <Cpu size={18} />
                      Configurer automatiquement
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
                  <CheckCircle2 size={40} className="text-emerald-400" />
                </div>
                <h4 className="text-xl font-semibold text-white mb-2">Configuration terminée !</h4>
                <p className="text-sm text-white/60 max-w-md">
                  Ollama est configuré avec le modèle <strong>{selectedModel}</strong>. Vous pouvez maintenant discuter avec l'IA.
                </p>
              </div>

              <div className="flex items-center justify-center">
                <button
                  onClick={onClose}
                  className="rounded-2xl border border-emerald-500/30 bg-emerald-500/12 px-8 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/16 transition-all"
                >
                  Commencer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
