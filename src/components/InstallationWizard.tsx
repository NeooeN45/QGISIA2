import { useState, useEffect } from "react";
import { Download, Cpu, MemoryStick, Zap, Check, X, Loader2, AlertCircle } from "lucide-react";

interface SystemInfo {
  platform: string;
  ram_total_gb: number;
  cpu_count: number;
  gpu: {
    has_gpu: boolean;
    gpu_name: string | null;
    gpu_memory_gb: number | null;
  };
}

interface Model {
  name: string;
  size_gb: number;
  description: string;
  recommended?: boolean;
  category: string;
  requires_gpu?: boolean;
  min_ram_gb?: number;
}

interface InstallationWizardProps {
  onComplete: (selectedModel: string) => void;
  onCancel: () => void;
}

export function InstallationWizard({ onComplete, onCancel }: InstallationWizardProps) {
  const [step, setStep] = useState<"check" | "install-ollama" | "select-model" | "install-model" | "complete">("check");
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [ollamaInstalled, setOllamaInstalled] = useState(false);
  const [ollamaRunning, setOllamaRunning] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [installProgress, setInstallProgress] = useState<string>("");
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    checkSystem();
  }, []);

  const checkSystem = async () => {
    try {
      // Appeler le bridge QGIS pour obtenir les infos système
      const response = await (window as any).bridge?.getSystemCapabilities?.();
      if (response) {
        setSystemInfo(response.system_info);
        setAvailableModels(response.available_models);
        setOllamaInstalled(response.ollama_installed);
        setOllamaRunning(response.ollama_running);
        setInstalledModels(response.installed_models || []);
        
        if (response.ollama_installed && response.ollama_running) {
          setStep("select-model");
        } else if (response.ollama_installed) {
          setStep("select-model");
        } else {
          setStep("install-ollama");
        }
      }
    } catch (e) {
      console.error("Erreur lors de la vérification du système:", e);
      setError("Impossible de vérifier le système");
    }
  };

  const installOllama = async () => {
    // Sur Windows, on ne peut pas installer automatiquement Ollama
    // On affiche les instructions
    window.open("https://ollama.com/download/windows", "_blank");
    setError("Veuillez installer Ollama manuellement et redémarrer QGIS");
  };

  const installModel = async (modelName: string) => {
    setSelectedModel(modelName);
    setStep("install-model");
    setInstalling(true);
    setInstallProgress("Initialisation de l'installation...");
    setError("");

    try {
      const response = await (window as any).bridge?.installOllamaModel?.(modelName, (progress: string) => {
        setInstallProgress(progress);
      });

      if (response?.success) {
        setInstalling(false);
        setStep("complete");
        setTimeout(() => onComplete(modelName), 2000);
      } else {
        throw new Error(response?.error || "Installation échouée");
      }
    } catch (e: any) {
      setInstalling(false);
      setError(e.message || "Erreur lors de l'installation");
    }
  };

  const renderCheckStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-400" />
        <h3 className="mt-4 text-lg font-semibold text-white">Vérification du système...</h3>
      </div>
    </div>
  );

  const renderInstallOllamaStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Download className="mx-auto h-12 w-12 text-orange-400" />
        <h3 className="mt-4 text-lg font-semibold text-white">Ollama n'est pas installé</h3>
        <p className="mt-2 text-sm text-white/60">
          Pour utiliser des LLM locaux, vous devez installer Ollama
        </p>
      </div>

      {systemInfo && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white">Configuration système détectée :</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-center gap-2 text-white/70">
              <MemoryStick size={14} />
              <span>RAM: {systemInfo.ram_total_gb} GB</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <Cpu size={14} />
              <span>CPU: {systemInfo.cpu_count} cœurs</span>
            </div>
            {systemInfo.gpu.has_gpu && (
              <div className="flex items-center gap-2 text-white/70">
                <Zap size={14} />
                <span>GPU: {systemInfo.gpu.gpu_name}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={installOllama}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-orange-500/25 bg-orange-500/12 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-orange-500/18"
        >
          <Download size={16} />
          Télécharger Ollama
        </button>

        <button
          onClick={onCancel}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/60 transition-all hover:bg-white/[0.08]"
        >
          Annuler
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-red-400" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
    </div>
  );

  const renderSelectModelStep = () => {
    const recommended = availableModels.filter((m) => m.recommended);
    const others = availableModels.filter((m) => !m.recommended);

    return (
      <div className="space-y-6">
        <div className="text-center">
          <Check className="mx-auto h-12 w-12 text-green-400" />
          <h3 className="mt-4 text-lg font-semibold text-white">Ollama est installé !</h3>
          <p className="mt-2 text-sm text-white/60">
            Sélectionnez le modèle LLM à installer
          </p>
        </div>

        {systemInfo && (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Configuration système :</h4>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-white/70">
                <MemoryStick size={14} />
                <span>RAM: {systemInfo.ram_total_gb} GB</span>
              </div>
              <div className="flex items-center gap-2 text-white/70">
                <Cpu size={14} />
                <span>CPU: {systemInfo.cpu_count} cœurs</span>
              </div>
              {systemInfo.gpu.has_gpu && (
                <div className="flex items-center gap-2 text-white/70">
                  <Zap size={14} />
                  <span>GPU: {systemInfo.gpu.gpu_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {recommended.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-cyan-300 mb-3">Recommandé pour votre système</h4>
            <div className="space-y-2">
              {recommended.map((model) => (
                <ModelCard
                  key={model.name}
                  model={model}
                  installed={installedModels.includes(model.name)}
                  onSelect={() => installModel(model.name)}
                />
              ))}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-white/70 mb-3">Autres modèles disponibles</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {others.map((model) => (
                <ModelCard
                  key={model.name}
                  model={model}
                  installed={installedModels.includes(model.name)}
                  onSelect={() => installModel(model.name)}
                />
              ))}
            </div>
          </div>
        )}

        {installedModels.length > 0 && (
          <button
            onClick={() => onComplete(installedModels[0])}
            className="w-full rounded-2xl border border-green-500/25 bg-green-500/12 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-green-500/18"
          >
            Utiliser {installedModels[0]}
          </button>
        )}

        <button
          onClick={onCancel}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/60 transition-all hover:bg-white/[0.08]"
        >
          Annuler
        </button>
      </div>
    );
  };

  const renderInstallModelStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-cyan-400" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          Installation de {selectedModel}...
        </h3>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs text-white/60 font-mono">{installProgress}</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 text-red-400" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Check className="mx-auto h-12 w-12 text-green-400" />
        <h3 className="mt-4 text-lg font-semibold text-white">Installation terminée !</h3>
        <p className="mt-2 text-sm text-white/60">
          Le modèle {selectedModel} est prêt à être utilisé
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {step === "check" && renderCheckStep()}
      {step === "install-ollama" && renderInstallOllamaStep()}
      {step === "select-model" && renderSelectModelStep()}
      {step === "install-model" && renderInstallModelStep()}
      {step === "complete" && renderCompleteStep()}
    </div>
  );
}

function ModelCard({ model, installed, onSelect }: { model: Model; installed: boolean; onSelect: () => void }) {
  return (
    <div
      className={`rounded-2xl border p-3 transition-all ${
        installed
          ? "border-green-500/20 bg-green-500/10"
          : "border-white/8 bg-black/20 hover:border-cyan-500/30"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{model.name}</p>
            {model.recommended && (
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
                Recommandé
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-white/40">{model.description}</p>
          <p className="mt-1 text-xs text-white/30">Taille: {model.size_gb} GB</p>
        </div>
        <div className="flex items-center gap-2">
          {installed ? (
            <Check className="h-5 w-5 text-green-400" />
          ) : (
            <button
              onClick={onSelect}
              className="rounded-xl border border-cyan-500/25 bg-cyan-500/12 px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:bg-cyan-500/18"
            >
              Installer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
