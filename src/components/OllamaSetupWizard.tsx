import {
  X, Download, Terminal, AlertTriangle, Cpu, RefreshCw, Zap,
  ExternalLink, ChevronRight, Loader2, Trash2, ArrowUpDown, HardDrive,
  SortAsc, Search, Plus,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "sonner";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  detectOllama,
  getOllamaModels,
  getRecommendedModelDownload,
  pullOllamaModel,
  deleteOllamaModel,
  isSystemCompatibleWithLLM,
  selectBestModel,
  getSystemSpecs,
  type PullProgress,
} from "../lib/ollama-auto-detect";

type WizardStep = "scanning" | "install" | "models" | "downloading" | "incompatible";
type SortKey = "name" | "size" | "family";
type SortDir = "asc" | "desc";

interface InstalledModel {
  name: string;
  size: number;
  family: string;
  quantization: string;
  paramSize: string;
}

interface OllamaSetupWizardProps {
  onComplete: (model: string) => void;
  onClose: () => void;
}

const DOWNLOADABLE_MODELS = [
  { id: "gemma4:2b",       label: "Gemma 4 2B",        size: "~1.7 Go", family: "google",    desc: "Ultra-léger, multimodal" },
  { id: "gemma4:4b",       label: "Gemma 4 4B",        size: "~3.3 Go", family: "google",    desc: "Excellent rapport qualité/taille" },
  { id: "gemma4:9b",       label: "Gemma 4 9B",        size: "~6.5 Go", family: "google",    desc: "Très bon compromis, multimodal" },
  { id: "gemma4:12b",      label: "Gemma 4 12B",       size: "~9 Go",   family: "google",    desc: "Puissant, pour workstations 16Go+" },
  { id: "gemma4:27b",      label: "Gemma 4 27B",       size: "~20 Go",  family: "google",    desc: "Haute qualité, 32Go+ requis" },
  { id: "qwen3:1.7b",      label: "Qwen3 1.7B",        size: "~1.2 Go", family: "alibaba",   desc: "Très rapide, multilingue" },
  { id: "qwen3:4b",        label: "Qwen3 4B",          size: "~2.8 Go", family: "alibaba",   desc: "Léger et performant" },
  { id: "qwen3:8b",        label: "Qwen3 8B",          size: "~5.2 Go", family: "alibaba",   desc: "Excellent suivi d'instructions" },
  { id: "qwen3:14b",       label: "Qwen3 14B",         size: "~9.5 Go", family: "alibaba",   desc: "Très performant, 16Go+" },
  { id: "qwen3:30b-a3b",   label: "Qwen3 30B MoE",     size: "~19 Go",  family: "alibaba",   desc: "Architecture MoE efficace" },
  { id: "llama3.2:3b",     label: "Llama 3.2 3B",      size: "~2 Go",   family: "meta",      desc: "Rapide, bon pour le code" },
  { id: "llama3.1:8b",     label: "Llama 3.1 8B",      size: "~4.7 Go", family: "meta",      desc: "Polyvalent, populaire" },
  { id: "mistral:7b",      label: "Mistral 7B",        size: "~4.1 Go", family: "mistral",   desc: "Solide pour le code et le texte" },
  { id: "phi4:14b",        label: "Phi-4 14B",         size: "~8.9 Go", family: "microsoft", desc: "Excellent raisonnement" },
  { id: "deepseek-r1:8b",  label: "DeepSeek R1 8B",    size: "~5.2 Go", family: "deepseek",  desc: "Modèle de raisonnement" },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} Go`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} Mo`;
  return `${bytes} o`;
}

function formatSpeed(bps: number): string {
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mo/s`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(0)} Ko/s`;
  return `${bps.toFixed(0)} o/s`;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default function OllamaSetupWizard({ onComplete, onClose }: OllamaSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>("scanning");
  const [installedModels, setInstalledModels] = useState<InstalledModel[]>([]);
  const [activeModel, setActiveModel] = useState("");
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);
  const [downloadingModel, setDownloadingModel] = useState("");
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [search, setSearch] = useState("");
  const [showDownloadPanel, setShowDownloadPanel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState("");
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
    const mapped: InstalledModel[] = models.map((m) => ({
      name: m.name,
      size: m.size,
      family: m.details?.family || m.name.split(":")[0],
      quantization: m.details?.quantization || "",
      paramSize: m.details?.parameter_size || "",
    }));
    setInstalledModels(mapped);

    const best = selectBestModel(models, specs);
    const model = best?.name || models[0]?.name || "";
    setActiveModel(model);
    setStep("models");

    if (model) onComplete(model);
  }, [sysCheck.compatible, onComplete]);

  useEffect(() => { void runScan(); }, []);

  const sortedModels = useMemo(() => {
    const filtered = installedModels.filter((m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.family.toLowerCase().includes(search.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "size") cmp = a.size - b.size;
      else if (sortKey === "family") cmp = a.family.localeCompare(b.family);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [installedModels, sortKey, sortDir, search]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleDownload = useCallback(async (modelId: string) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setDownloadingModel(modelId);
    setStep("downloading");
    setPullProgress({ status: "Connexion à Ollama..." });
    setPullError(null);

    const result = await pullOllamaModel(modelId, (p) => setPullProgress(p), ctrl.signal);
    abortRef.current = null;

    if (result.success) {
      toast.success(`Modèle ${modelId} installé !`);
      await runScan();
      setShowDownloadPanel(false);
    } else {
      setPullError(result.error || "Erreur inconnue");
      setStep("models");
    }
    setDownloadingModel("");
  }, [runScan]);

  const handleDelete = async (modelName: string) => {
    setDeletingModel(modelName);
    const result = await deleteOllamaModel(modelName);
    setDeletingModel(null);
    if (result.success) {
      toast.success(`Modèle ${modelName} supprimé`);
      setInstalledModels((prev) => prev.filter((m) => m.name !== modelName));
      if (activeModel === modelName) {
        const remaining = installedModels.filter((m) => m.name !== modelName);
        setActiveModel(remaining[0]?.name || "");
      }
    } else {
      toast.error(`Erreur : ${result.error}`);
    }
  };

  const handleSelectModel = (modelName: string) => {
    setActiveModel(modelName);
    onComplete(modelName);
    toast.success(`Modèle actif : ${modelName}`);
  };

  const handleCancelDownload = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep("models");
    setDownloadingModel("");
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={cn(
        "flex items-center gap-1 text-xs transition-colors",
        sortKey === k ? "text-violet-300" : "text-white/40 hover:text-white/70"
      )}
    >
      {label}
      <ArrowUpDown size={10} className={sortKey === k ? "opacity-100" : "opacity-40"} />
      {sortKey === k && <span className="text-[9px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-gray-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/20">
              <Terminal size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Modèles IA Locaux</h3>
              <p className="text-xs text-white/40">Ollama — {installedModels.length} modèle{installedModels.length !== 1 ? "s" : ""} installé{installedModels.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-white/40 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* System badge */}
        <div className={cn(
          "mx-6 mt-4 shrink-0 flex items-center gap-2 rounded-xl border px-3 py-2",
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

        <div className="p-6 overflow-y-auto flex-1">

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
                <p className="text-xs text-white/40 mt-3">Utilisez OpenRouter ou Gemini à la place.</p>
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
                  { n: 3, label: "Cliquez sur Réessayer", sub: "Les modèles seront listés automatiquement" },
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
                <button onClick={() => void runScan()} className="flex-1 rounded-xl border border-blue-500/30 bg-blue-500/10 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/15 transition-colors flex items-center justify-center gap-2">
                  <RefreshCw size={14} /> Réessayer
                </button>
              </div>
            </div>
          )}

          {/* MODELS — liste installés + téléchargement */}
          {step === "models" && (
            <div className="space-y-4">
              {pullError && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2.5 text-xs text-red-300 flex items-center gap-2">
                  <AlertTriangle size={13} />{pullError}
                </div>
              )}

              {/* Modèles installés */}
              {installedModels.length > 0 ? (
                <div className="space-y-2">
                  {/* Barre de recherche + tri */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                      <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filtrer les modèles..."
                        className="w-full rounded-lg bg-white/5 border border-white/8 pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500/40"
                      />
                    </div>
                    <div className="flex items-center gap-1 rounded-lg bg-white/5 border border-white/8 px-2 py-1.5">
                      <SortAsc size={11} className="text-white/30" />
                      <SortBtn k="name" label="Nom" />
                      <span className="text-white/20">·</span>
                      <SortBtn k="size" label="Taille" />
                      <span className="text-white/20">·</span>
                      <SortBtn k="family" label="Famille" />
                    </div>
                  </div>

                  {/* Liste */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {sortedModels.map((m) => (
                      <div
                        key={m.name}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all cursor-pointer",
                          activeModel === m.name
                            ? "border-emerald-500/30 bg-emerald-500/8"
                            : "border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5"
                        )}
                        onClick={() => handleSelectModel(m.name)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                            {activeModel === m.name && (
                              <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 uppercase">actif</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-white/35">{m.family}</span>
                            {m.paramSize && <span className="text-[10px] text-white/25">· {m.paramSize}</span>}
                            {m.quantization && <span className="text-[10px] text-white/25">· {m.quantization}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 text-[10px] text-white/35">
                            <HardDrive size={9} />
                            {formatBytes(m.size)}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); void handleDelete(m.name); }}
                            disabled={deletingModel === m.name}
                            className="rounded-lg border border-transparent bg-transparent p-1 text-white/20 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                            title="Désinstaller"
                          >
                            {deletingModel === m.name
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Trash2 size={12} />
                            }
                          </button>
                        </div>
                      </div>
                    ))}
                    {sortedModels.length === 0 && (
                      <p className="text-center text-xs text-white/30 py-4">Aucun modèle ne correspond à la recherche</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-4 text-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-500/10">
                    <Zap size={24} className="text-violet-400" />
                  </div>
                  <p className="text-sm font-semibold text-white">Aucun modèle installé</p>
                  <p className="text-xs text-white/50">Téléchargez un modèle ci-dessous</p>
                </div>
              )}

              {/* Panel téléchargement */}
              <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                <button
                  onClick={() => setShowDownloadPanel((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-white/70 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-2"><Plus size={14} /> Télécharger un modèle</span>
                  <span className="text-xs text-white/30">{showDownloadPanel ? "−" : "+"}</span>
                </button>

                {showDownloadPanel && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                    {/* Recommandé */}
                    <div className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-violet-200">⭐ Recommandé pour votre PC</p>
                        <p className="text-xs text-white/50 mt-0.5">{recommendation.model} · {recommendation.size}</p>
                        <p className="text-[10px] text-white/35 mt-0.5">{recommendation.reason}</p>
                      </div>
                      <button
                        onClick={() => void handleDownload(recommendation.model)}
                        className="shrink-0 rounded-lg border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 transition-colors flex items-center gap-1.5"
                      >
                        <Download size={11} /> Installer
                      </button>
                    </div>

                    {/* Grille modèles */}
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {DOWNLOADABLE_MODELS.map((m) => {
                        const isInstalled = installedModels.some((im) => im.name === m.id);
                        return (
                          <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-white/4 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-white/80">{m.label}</span>
                                <span className="text-[10px] text-white/30">{m.size}</span>
                              </div>
                              <p className="text-[10px] text-white/40 mt-0.5">{m.desc}</p>
                            </div>
                            {isInstalled ? (
                              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">✓ Installé</span>
                            ) : (
                              <button
                                onClick={() => void handleDownload(m.id)}
                                className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50 hover:border-violet-500/30 hover:text-violet-300 transition-colors flex items-center gap-1"
                              >
                                <Download size={9} /> Installer
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Modèle personnalisé */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && customModelInput.trim()) void handleDownload(customModelInput.trim()); }}
                        placeholder="Modèle personnalisé (ex: codellama:7b)"
                        className="flex-1 rounded-lg bg-white/5 border border-white/8 px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-violet-500/40"
                      />
                      <button
                        onClick={() => { if (customModelInput.trim()) void handleDownload(customModelInput.trim()); }}
                        disabled={!customModelInput.trim()}
                        className="shrink-0 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions bas */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => void runScan()} className="flex-1 rounded-xl border border-white/8 bg-white/4 py-2.5 text-sm text-white/50 hover:text-white transition-colors flex items-center justify-center gap-2">
                  <RefreshCw size={13} /> Actualiser
                </button>
                {activeModel && (
                  <button onClick={onClose} className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/15 transition-colors flex items-center justify-center gap-2">
                    Commencer <ChevronRight size={14} />
                  </button>
                )}
                {!activeModel && (
                  <button onClick={onClose} className="flex-1 rounded-xl border border-white/8 bg-white/4 py-2.5 text-sm text-white/50 hover:text-white transition-colors">
                    Plus tard
                  </button>
                )}
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
                <p className="text-sm text-white/50 font-mono">{downloadingModel}</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/50">
                  <span>{pullProgress?.status || "Initialisation..."}</span>
                  {pullProgress?.percent != null && <span>{pullProgress.percent}%</span>}
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
                    {pullProgress.speedBps != null && (
                      <span className="ml-2 text-white/40">· {formatSpeed(pullProgress.speedBps)}</span>
                    )}
                    {pullProgress.etaSeconds != null && (
                      <span className="ml-2 text-white/40">· ETA {formatEta(pullProgress.etaSeconds)}</span>
                    )}
                  </p>
                )}
              </div>
              <button onClick={handleCancelDownload} className="w-full rounded-xl border border-white/8 bg-white/4 py-2.5 text-sm text-white/50 hover:text-white transition-colors">
                Annuler
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
