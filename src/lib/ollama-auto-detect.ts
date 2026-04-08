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
}> {
  const ollamaAvailable = await detectOllama();
  if (!ollamaAvailable) {
    return {
      success: false,
      error: "Ollama n'est pas détecté. Veuillez l'installer et le lancer.",
    };
  }

  toast.info("Ollama détecté, recherche du meilleur modèle...");

  const [models, specs] = await Promise.all([getOllamaModels(), getSystemSpecs()]);

  if (models.length === 0) {
    return {
      success: false,
      error: "Aucun modèle Ollama disponible. Veuillez en télécharger un.",
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
    };
  }

  toast.success(`Modèle sélectionné : ${bestModel.name}`);
  return { success: true, model: bestModel.name };
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
