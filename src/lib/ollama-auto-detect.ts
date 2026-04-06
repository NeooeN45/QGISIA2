import { toast } from "sonner";
import { safeLog } from "./security";

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
}

export async function detectOllama(): Promise<boolean> {
  safeLog("[Ollama Detect] ===========================================");
  safeLog("[Ollama Detect] Starting detection...");
  safeLog("[Ollama Detect] Target URL: http://localhost:11434/api/tags");
  safeLog("[Ollama Detect] Timeout: 2000ms");
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    safeLog("[Ollama Detect] Fetching...");
    const response = await fetch("http://localhost:11434/api/tags", {
      method: "GET",
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    safeLog("[Ollama Detect] Response received");
    safeLog("[Ollama Detect] Status:", response.status);
    safeLog("[Ollama Detect] OK:", response.ok);
    safeLog("[Ollama Detect] StatusText:", response.statusText);
    safeLog("[Ollama Detect] Headers:", Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      safeLog("[Ollama Detect] ✅ SUCCESS - Ollama is running!");
    } else {
      safeLog("[Ollama Detect] ❌ FAILED - Response not OK");
    }
    
    return response.ok;
  } catch (error) {
    safeLog("[Ollama Detect] ❌ ERROR - Exception caught");
    safeLog("[Ollama Detect] Error type:", error?.constructor?.name);
    safeLog("[Ollama Detect] Error message:", error?.message);
    safeLog("[Ollama Detect] Error details:", error);
    
    if (error?.name === 'AbortError') {
      safeLog("[Ollama Detect] Request timed out (2s)");
    }
    
    return false;
  }
}

export async function getOllamaModels(): Promise<OllamaModel[]> {
  safeLog("[Ollama Models] ===========================================");
  safeLog("[Ollama Models] Fetching available models...");
  safeLog("[Ollama Models] Target URL: http://localhost:11434/api/tags");
  
  try {
    safeLog("[Ollama Models] Fetching...");
    const response = await fetch("http://localhost:11434/api/tags");
    
    safeLog("[Ollama Models] Response received");
    safeLog("[Ollama Models] Status:", response.status);
    safeLog("[Ollama Models] OK:", response.ok);
    
    if (!response.ok) {
      safeLog("[Ollama Models] ❌ FAILED - Response not OK:", response.statusText);
      return [];
    }
    
    safeLog("[Ollama Models] Parsing JSON...");
    const data = await response.json();
    safeLog("[Ollama Models] Raw data received:", JSON.stringify(data).substring(0, 200) + "...");
    
    const models = data.models || [];
    safeLog("[Ollama Models] Number of models found:", models.length);
    
    if (models.length > 0) {
      safeLog("[Ollama Models] Model details:");
      models.forEach((m, i) => {
        safeLog(`[Ollama Models]   ${i + 1}. ${m.name} | Size: ${m.size} | Quant: ${m.details.quantization}`);
      });
    } else {
      safeLog("[Ollama Models] ⚠️ No models found - Ollama might be running but no models downloaded");
    }
    
    return models;
  } catch (error) {
    safeLog("[Ollama Models] ❌ ERROR - Exception caught");
    safeLog("[Ollama Models] Error type:", error?.constructor?.name);
    safeLog("[Ollama Models] Error message:", error?.message);
    safeLog("[Ollama Models] Error details:", error);
    return [];
  }
}

export async function getSystemSpecs(): Promise<SystemSpecs> {
  // Estimation basique via navigator.hardwareConcurrency
  const cores = navigator.hardwareConcurrency || 4;
  
  // Estimation RAM via navigator.deviceMemory (Chrome only)
  // Valeur en GB, typiquement 2, 4, 8
  const ram = (navigator as any).deviceMemory || 8;
  
  // Détection GPU basique via WebGL
  const gpu = detectGPU();
  
  return { ram, cores, gpu };
}

function detectGPU(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!gl;
  } catch {
    return false;
  }
}

export function selectBestModel(
  models: OllamaModel[],
  specs: SystemSpecs
): OllamaModel | null {
  if (models.length === 0) return null;

  // Priorité des modèles par ordre de préférence
  const modelPriority = [
    "qwen2.5", // Meilleur rapport qualité/performances
    "qwen2",
    "llama3.2",
    "llama3.1",
    "llama3",
    "mistral",
    "phi3",
    "gemma2",
    "deepseek",
  ];

  // Filtrer par quantization selon la RAM
  const suitableModels = models.filter((model) => {
    const quant = model.details.quantization;
    
    // Handle undefined quantization
    if (!quant) {
      console.log("[Ollama Select] Model has no quantization, accepting:", model.name);
      return true;
    }
    
    // Pour PC avec moins de 8GB RAM, préférer Q4_K_M ou Q4_K_S
    if (specs.ram < 8) {
      return quant.includes("Q4") || quant.includes("q4");
    }
    
    // Pour 8-16GB, Q4 ou Q5
    if (specs.ram < 16) {
      return quant.includes("Q4") || quant.includes("Q5") || 
             quant.includes("q4") || quant.includes("q5");
    }
    
    // Pour 16GB+, tout est OK
    return true;
  });

  // Trier par priorité
  const sortedModels = [...suitableModels].sort((a, b) => {
    const aPriority = modelPriority.findIndex((p) => a.name.includes(p));
    const bPriority = modelPriority.findIndex((p) => b.name.includes(p));
    
    // Si aucun n'est dans la liste, garder l'ordre original
    if (aPriority === -1 && bPriority === -1) return 0;
    if (aPriority === -1) return 1;
    if (bPriority === -1) return -1;
    
    return aPriority - bPriority;
  });

  // Préférer les modèles plus petits pour les PCs moins puissants
  if (specs.ram < 8 || specs.cores < 4) {
    sortedModels.sort((a, b) => a.size - b.size);
  }

  return sortedModels[0] || null;
}

export async function autoConfigureOllama(): Promise<{
  success: boolean;
  model?: string;
  error?: string;
}> {
  safeLog("[Ollama Auto-Config] ===========================================");
  safeLog("[Ollama Auto-Config] Starting auto-configuration...");
  safeLog("[Ollama Auto-Config] Step 1/4: Detecting Ollama...");
  
  // 1. Détecter Ollama
  const ollamaAvailable = await detectOllama();
  safeLog("[Ollama Auto-Config] Step 1 result - Ollama available:", ollamaAvailable);
  
  if (!ollamaAvailable) {
    safeLog("[Ollama Auto-Config] ❌ FAILED - Ollama not detected");
    return {
      success: false,
      error: "Ollama n'est pas détecté. Veuillez l'installer et le lancer.",
    };
  }

  toast.info("Ollama détecté, recherche du meilleur modèle...");
  safeLog("[Ollama Auto-Config] Step 2/4: Fetching available models...");

  // 2. Récupérer les modèles disponibles
  const models = await getOllamaModels();
  safeLog("[Ollama Auto-Config] Step 2 result - Models count:", models.length);
  
  if (models.length === 0) {
    safeLog("[Ollama Auto-Config] ❌ FAILED - No models available");
    return {
      success: false,
      error: "Aucun modèle Ollama disponible. Veuillez en télécharger un.",
    };
  }

  // 3. Détecter les specs du système
  safeLog("[Ollama Auto-Config] Step 3/4: Detecting system specs...");
  const specs = await getSystemSpecs();
  safeLog("[Ollama Auto-Config] Step 3 result - System specs:", specs);
  
  toast.info(
    `Système détecté: ${specs.ram}GB RAM, ${specs.cores} cœurs${specs.gpu ? ", GPU disponible" : ""}`
  );

  // 4. Sélectionner le meilleur modèle
  safeLog("[Ollama Auto-Config] Step 4/4: Selecting best model...");
  const bestModel = selectBestModel(models, specs);
  safeLog("[Ollama Auto-Config] Step 4 result - Best model:", bestModel?.name);
  
  if (!bestModel) {
    safeLog("[Ollama Auto-Config] ❌ FAILED - No suitable model found");
    return {
      success: false,
      error: "Aucun modèle adapté à votre système trouvé.",
    };
  }

  toast.success(`Modèle sélectionné: ${bestModel.name}`);
  safeLog("[Ollama Auto-Config] ✅ SUCCESS - Configuration complete!");
  safeLog("[Ollama Auto-Config] Selected model:", bestModel.name);

  return {
    success: true,
    model: bestModel.name,
  };
}

export function getRecommendedModelDownload(): {
  model: string;
  reason: string;
  command: string;
  size: string;
} {
  const specs = {
    ram: (navigator as any).deviceMemory || 8,
    cores: navigator.hardwareConcurrency || 4,
    gpu: detectGPU(),
  };

  if (specs.ram < 6) {
    return {
      model: "qwen2.5:3b",
      reason: "Modèle ultra-léger adapté aux PC avec moins de 6GB RAM",
      command: "ollama pull qwen2.5:3b",
      size: "~2 GB",
    };
  }

  if (specs.ram < 12 || specs.cores < 6) {
    return {
      model: "qwen2.5:7b",
      reason: "Modèle équilibré pour les PC standards (8-12GB RAM)",
      command: "ollama pull qwen2.5:7b",
      size: "~4.7 GB",
    };
  }

  if (specs.ram < 24) {
    return {
      model: "qwen2.5:14b",
      reason: "Modèle performant pour les PC avec 16GB+ RAM",
      command: "ollama pull qwen2.5:14b",
      size: "~9 GB",
    };
  }

  return {
    model: "qwen2.5:32b",
    reason: "Modèle haute qualité pour les workstations puissantes (32GB+ RAM)",
    command: "ollama pull qwen2.5:32b",
    size: "~20 GB",
  };
}

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
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
            progress.total = data.total;
            progress.completed = data.completed;
            progress.percent = Math.round((data.completed / data.total) * 100);
          }
          if (data.digest) progress.digest = data.digest;
          onProgress(progress);

          if (data.status === "success") {
            return { success: true };
          }
        } catch {
          // skip malformed JSON lines
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return { success: false, error: "Téléchargement annulé" };
    }
    return { success: false, error: error?.message || "Erreur inconnue" };
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
