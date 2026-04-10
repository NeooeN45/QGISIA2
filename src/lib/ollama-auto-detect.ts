import { toast } from "sonner";

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  details: {
    parameter_size: string;
    quantization: string;
    family: string;
    families: string[];
    format: string;
  };
}

interface SystemSpecs {
  ram: number; // in GB
  cores: number;
  gpu: boolean;
  vram?: number;
}

export async function detectOllama(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export interface OllamaEnsureResult {
  status: "running" | "started" | "not_installed" | "not_running" | "start_failed" | "error";
  installed: boolean;
  message: string;
  can_proceed: boolean;
  error_code?: string;
  installation?: {
    platform: string;
    download_url: string;
    install_command: string;
    manual_steps: string[];
  };
}

/**
 * Vérifie qu'Ollama est en cours d'exécution et tente de le démarrer automatiquement via le backend QGIS
 * 
 * @param auto_start Si true, tente de démarrer Ollama automatiquement
 * @returns Le statut d'Ollama et les informations d'installation si nécessaire
 */
export async function ensureOllamaRunning(auto_start = true): Promise<OllamaEnsureResult> {
  // Essayer d'abord via l'API QGIS si disponible
  try {
    const baseUrl = window.location.origin;
    const url = new URL("/api/qgis/ensureOllamaRunning", baseUrl);
    
    const response = await fetch(url.toString() + `?auto_start=${auto_start}`, {
      method: "GET",
      signal: AbortSignal.timeout(15000), // 15 secondes max pour le démarrage
    });
    
    if (response.ok) {
      const data = await response.json() as OllamaEnsureResult;
      return data;
    }
  } catch {
    // Fallback: détection directe
  }
  
  // Fallback: détection directe via l'API Ollama
  const isRunning = await detectOllama();
  
  if (isRunning) {
    return {
      status: "running",
      installed: true,
      message: "Ollama est en cours d'exécution",
      can_proceed: true,
    };
  }
  
  // Ollama n'est pas accessible
  return {
    status: "not_running",
    installed: false, // On ne sait pas s'il est installé depuis le navigateur
    message: "Ollama n'est pas accessible. Vérifiez qu'il est installé et en cours d'exécution.",
    can_proceed: false,
    error_code: "NOT_RUNNING",
    installation: getInstallationInstructions(),
  };
}

function getInstallationInstructions() {
  const platform = navigator.platform.toLowerCase();
  
  if (platform.includes("win")) {
    return {
      platform: "Windows",
      download_url: "https://ollama.com/download/windows",
      install_command: "winget install Ollama.Ollama",
      manual_steps: [
        "1. Téléchargez Ollama depuis https://ollama.com/download/windows",
        "2. Exécutez le fichier d'installation",
        "3. Suivez les instructions de l'installateur",
        "4. Redémarrez QGIS après l'installation",
      ],
    };
  } else if (platform.includes("mac")) {
    return {
      platform: "macOS",
      download_url: "https://ollama.com/download/mac",
      install_command: "brew install ollama",
      manual_steps: [
        "1. Installez Homebrew si ce n'est pas déjà fait",
        "2. Exécutez: brew install ollama",
        "3. Ou téléchargez depuis https://ollama.com/download/mac",
        "4. Redémarrez QGIS après l'installation",
      ],
    };
  } else {
    return {
      platform: "Linux",
      download_url: "https://ollama.com/download/linux",
      install_command: "curl -fsSL https://ollama.com/install.sh | sh",
      manual_steps: [
        "1. Exécutez: curl -fsSL https://ollama.com/install.sh | sh",
        "2. Ou téléchargez depuis https://ollama.com/download/linux",
        "3. Redémarrez QGIS après l'installation",
      ],
    };
  }
}

export async function getOllamaModels(): Promise<OllamaModel[]> {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) return [];
    const data = await response.json();
    return data.models || [];
  } catch {
    return [];
  }
}

export async function getSystemSpecs(): Promise<SystemSpecs> {
  // Estimation basique via navigator.hardwareConcurrency
  const cores = navigator.hardwareConcurrency || 4;
  
  // Estimation RAM via navigator.deviceMemory (Chrome only)
  let ram = (navigator as any).deviceMemory || 8;
  if (ram === 8) {
    if (cores >= 16) ram = 32;
    else if (cores >= 8) ram = 16;
  }
  
  // Détection GPU basique via WebGL
  const gpuInfo = detectGPU();
  
  return { ram, cores, gpu: gpuInfo.gpu, vram: gpuInfo.vram };
}

function detectGPU(): { gpu: boolean; vram: number } {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { powerPreference: "high-performance" }) || 
               canvas.getContext("webgl", { powerPreference: "high-performance" }) ||
               canvas.getContext("experimental-webgl", { powerPreference: "high-performance" });
    if (!gl) return { gpu: false, vram: 0 };

    const debugInfo = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    if (debugInfo) {
      const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
      
      const isDedicated = renderer.includes("nvidia") || 
            renderer.includes("amd") || 
            renderer.includes("radeon") || 
            renderer.includes("geforce") || 
            renderer.includes("rtx") ||
            renderer.includes("apple m");
            
      let vram = 0;
      const vramMatch = /(\d+)\s*(?:gb|go)/i.exec(renderer);
      if (vramMatch) vram = parseInt(vramMatch[1], 10);
      else {
        const r = renderer.toUpperCase();
        if (r.includes("RTX 4090") || r.includes("RTX 3090") || r.includes("RX 7900 XTX")) vram = 24;
        else if (r.includes("RX 7900 XT")) vram = 20;
        else if (r.includes("RTX 4080") || r.includes("RTX 3080") || r.includes("RX 6800 XT") || r.includes("RX 7800")) vram = 16;
        else if (r.includes("RTX 4070") || r.includes("RTX 3060") || r.includes("RX 6700 XT")) vram = 12;
        else if (r.includes("RTX 3080")) vram = 10;
        else if (r.includes("RTX 4060") || r.includes("RTX 3070") || r.includes("RX 6600") || r.includes("RX 7600")) vram = 8;
        else if (r.includes("RTX 3050 TI") || r.includes("RTX 3050 LAPTOP") || r.includes("RTX 3050 MOBILE")) vram = 4;
        else if (r.includes("RTX 3050") || r.includes("RTX 2060") || r.includes("GTX 1660") || r.includes("GTX 1060")) vram = 6;
        else if (r.includes("GTX 1650") || r.includes("GTX 1050 TI")) vram = 4;
        else if (r.includes("RADEON 7") || r.includes("VEGA 20")) vram = 16;
        else if (r.includes("APPLE M3 MAX") || r.includes("APPLE M2 MAX")) vram = 36;
        else if (r.includes("APPLE M3 PRO") || r.includes("APPLE M2 PRO")) vram = 18;
        else if (r.includes("APPLE M3") || r.includes("APPLE M2") || r.includes("APPLE M1")) vram = 8;
        else if (r.includes("INTEL") || r.includes("UHD") || r.includes("IRIS")) vram = 0;
        else if (isDedicated) vram = 4; // fallback dédié
      }
            
      return { gpu: isDedicated, vram };
    }
    return { gpu: false, vram: 0 };
  } catch {
    return { gpu: false, vram: 0 };
  }
}

export function selectBestModel(
  models: OllamaModel[],
  specs: SystemSpecs
): OllamaModel | null {
  if (models.length === 0) return null;

  // Priorité par famille (modèles récents et performants en premier)
  const modelPriority = [
    "gemma4",    // Google Gemma 4 — meilleur rapport qualité/taille 2025
    "qwen3",     // Qwen3 — excellent suivi instructions, multilingue
    "qwen2.5",
    "gemma3",
    "llama3.3",
    "llama3.2",
    "llama3.1",
    "llama3",
    "phi4",
    "phi3.5",
    "phi3",
    "mistral",
    "qwen2",
    "deepseek",
    "gemma2",
  ];

  // Filtrer les modèles trop lourds pour la RAM disponible
  const suitableModels = models.filter((model) => {
    const sizeGb = model.size / 1e9;
    // Garder une marge de 2 Go pour le système
    const maxSizeGb = Math.max(1, specs.ram - 2);
    return sizeGb <= maxSizeGb;
  });

  const pool = suitableModels.length > 0 ? suitableModels : models;

  const sorted = [...pool].sort((a, b) => {
    const aPriority = modelPriority.findIndex((p) => a.name.toLowerCase().includes(p));
    const bPriority = modelPriority.findIndex((p) => b.name.toLowerCase().includes(p));
    if (aPriority === -1 && bPriority === -1) return 0;
    if (aPriority === -1) return 1;
    if (bPriority === -1) return -1;
    return aPriority - bPriority;
  });

  return sorted[0] || null;
}

export async function autoConfigureOllama(): Promise<{
  success: boolean;
  model?: string;
  error?: string;
  status?: OllamaEnsureResult["status"];
  installation?: OllamaEnsureResult["installation"];
}> {
  // Tenter de démarrer Ollama automatiquement si nécessaire
  const ollamaStatus = await ensureOllamaRunning(true);
  
  if (!ollamaStatus.can_proceed) {
    // Ollama n'est pas installé ou le démarrage a échoué
    let errorMsg = ollamaStatus.message;
    
    if (ollamaStatus.status === "not_installed") {
      errorMsg = "Ollama n'est pas installé. Cliquez sur le bouton d'installation ci-dessous.";
    } else if (ollamaStatus.status === "start_failed") {
      errorMsg = "Impossible de démarrer Ollama automatiquement. Veuillez le lancer manuellement.";
    }
    
    return {
      success: false,
      error: errorMsg,
      status: ollamaStatus.status,
      installation: ollamaStatus.installation,
    };
  }
  
  // Ollama est en cours d'exécution (soit déjà, soit on vient de le démarrer)
  if (ollamaStatus.status === "started") {
    toast.success("Ollama a été démarré automatiquement !");
  }

  toast.info("Ollama détecté, recherche du meilleur modèle...");

  const [models, specs] = await Promise.all([getOllamaModels(), getSystemSpecs()]);

  if (models.length === 0) {
    return {
      success: false,
      error: "Aucun modèle Ollama disponible. Veuillez en télécharger un.",
      status: ollamaStatus.status,
    };
  }

  toast.info(
    `Système: ${specs.ram} Go RAM, ${specs.cores} cœurs${specs.gpu ? ", GPU" : ""}`
  );

  const bestModel = selectBestModel(models, specs);
  if (!bestModel) {
    return {
      success: false,
      error: "Aucun modèle adapté à votre système trouvé.",
      status: ollamaStatus.status,
    };
  }

  toast.success(`Modèle sélectionné : ${bestModel.name}`);
  return { success: true, model: bestModel.name, status: ollamaStatus.status };
}

export function getRecommendedModelDownload(): {
  model: string;
  reason: string;
  command: string;
  size: string;
} {
  const ram = (navigator as any).deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;

  if (ram < 5) {
    return {
      model: "gemma4:2b",
      reason: "Gemma 4 ultra-léger (Google) — idéal pour PC avec moins de 5 Go RAM",
      command: "ollama pull gemma4:2b",
      size: "~1.7 Go",
    };
  }

  if (ram < 9 || cores < 6) {
    return {
      model: "gemma4:4b",
      reason: "Gemma 4 4B (Google) — excellent rapport qualité/taille pour 6-8 Go RAM",
      command: "ollama pull gemma4:4b",
      size: "~3.3 Go",
    };
  }

  if (ram < 16) {
    return {
      model: "qwen3:8b",
      reason: "Qwen3 8B — très bon suivi d'instructions, multilingue, pour 10-16 Go RAM",
      command: "ollama pull qwen3:8b",
      size: "~5.2 Go",
    };
  }

  if (ram < 28) {
    return {
      model: "gemma4:12b",
      reason: "Gemma 4 12B (Google) — multimodal et puissant pour les workstations 16-28 Go",
      command: "ollama pull gemma4:12b",
      size: "~9 Go",
    };
  }

  return {
    model: "qwen3:30b-a3b",
    reason: "Qwen3 30B MoE — qualité maximale avec architecture MoE efficace, pour 32 Go+",
    command: "ollama pull qwen3:30b-a3b",
    size: "~19 Go",
  };
}

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
  speedBps?: number;
  etaSeconds?: number;
}

export async function pullOllamaModel(
  modelName: string,
  onProgress: (progress: PullProgress) => void,
  signal?: AbortSignal
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("http://localhost:11434/api/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, stream: true }),
      signal,
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { success: false, error: "No response body" };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let lastCompleted = 0;
    let lastTimestamp = Date.now();
    // Fenêtre glissante pour lisser le calcul de vitesse
    const speedSamples: number[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          const progress: PullProgress = { status: data.status || "" };

          if (data.total && data.completed) {
            const now = Date.now();
            const deltaSec = (now - lastTimestamp) / 1000;
            const deltaBytes = data.completed - lastCompleted;

            if (deltaSec > 0.2 && deltaBytes > 0) {
              const instantSpeed = deltaBytes / deltaSec;
              speedSamples.push(instantSpeed);
              if (speedSamples.length > 5) speedSamples.shift();
              const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
              progress.speedBps = avgSpeed;
              const remaining = data.total - data.completed;
              progress.etaSeconds = avgSpeed > 0 ? Math.round(remaining / avgSpeed) : undefined;
              lastCompleted = data.completed;
              lastTimestamp = now;
            }

            progress.total = data.total;
            progress.completed = data.completed;
            progress.percent = Math.round((data.completed / data.total) * 100);
          }

          if (data.digest) progress.digest = data.digest;

          // Ollama peut envoyer un champ "error" dans le stream
          if (data.error) {
            return { success: false, error: String(data.error) };
          }

          onProgress(progress);

          // "success" ou fin de vérification de digest = téléchargement terminé
          if (
            data.status === "success" ||
            data.status === "verifying sha256 digest" ||
            data.status === "writing manifest" ||
            data.status === "removing any unused layers"
          ) {
            // On attend la fin du stream pour confirmer
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }

    // Stream terminé proprement = succès (même sans "success" explicite)
    return { success: true };
  } catch (error: unknown) {
    if ((error as Error)?.name === "AbortError") {
      return { success: false, error: "Téléchargement annulé" };
    }
    return { success: false, error: (error as Error)?.message || "Erreur inconnue" };
  }
}

export async function deleteOllamaModel(
  modelName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("http://localhost:11434/api/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
    });
    if (response.status === 200 || response.status === 204) {
      return { success: true };
    }
    const text = await response.text().catch(() => "");
    return { success: false, error: `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  } catch (error: unknown) {
    return { success: false, error: (error as Error)?.message || "Erreur inconnue" };
  }
}

export function isSystemCompatibleWithLLM(): { compatible: boolean; reason: string; level: "high" | "medium" | "low" } {
  const ram = (navigator as any).deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;

  if (ram >= 16 && cores >= 8) {
    return { compatible: true, reason: `${ram}GB RAM, ${cores} cœurs — Excellent`, level: "high" };
  }
  if (ram >= 8 && cores >= 4) {
    return { compatible: true, reason: `${ram}GB RAM, ${cores} cœurs — Compatible`, level: "medium" };
  }
  if (ram >= 4) {
    return { compatible: true, reason: `${ram}GB RAM, ${cores} cœurs — Utilisation limitée aux petits modèles`, level: "low" };
  }
  return { compatible: false, reason: `${ram}GB RAM insuffisant (minimum 4GB requis)`, level: "low" };
}
