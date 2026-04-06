import { AppSettings, getConfiguredOpenRouterApiKey } from "./settings";

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
  architecture: {
    modality: string[];
    tokenizer: string;
    instruct_mode?: boolean;
  };
  top_provider?: {
    context_length: number;
    max_completion_tokens: number;
  };
}

export interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
  error?: {
    message?: string;
  };
}

/**
 * Récupère la liste des modèles disponibles depuis OpenRouter
 */
export async function fetchOpenRouterModels(
  signal?: AbortSignal,
): Promise<OpenRouterModel[]> {
  const apiKey = getConfiguredOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("Aucune clé API OpenRouter n'est configurée.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://geosylva.ai",
      "X-Title": "GeoSylva AI",
    },
    signal,
  });

  const payload = (await response.json()) as OpenRouterModelsResponse;

  if (payload.error) {
    throw new Error(payload.error.message || "Erreur lors de la récupération des modèles.");
  }

  if (!payload.data) {
    throw new Error("Réponse invalide depuis OpenRouter.");
  }

  return payload.data;
}

/**
 * Calcule le max_tokens approprié en fonction des crédits disponibles
 * et du contexte du modèle
 */
export function calculateMaxTokens(
  model: OpenRouterModel,
  isFreeTier: boolean,
  estimatedInputTokens: number = 1000,
): number {
  // Pour le free tier, limiter à 25000 tokens max
  if (isFreeTier) {
    const freeTierLimit = 25000;
    const contextLimit = model.context_length || 4000;
    const maxCompletion = Math.min(freeTierLimit - estimatedInputTokens, contextLimit - estimatedInputTokens);
    
    // Limiter à 4000 tokens de complétion pour le free tier
    return Math.min(Math.max(maxCompletion, 500), 4000);
  }

  // Pour les comptes payants, utiliser le contexte du modèle
  const contextLimit = model.context_length || 4000;
  const maxCompletion = contextLimit - estimatedInputTokens;
  
  // Limiter à 8192 tokens de complétion par défaut pour les modèles payants
  return Math.min(Math.max(maxCompletion, 1000), 8192);
}

/**
 * Filtre les modèles selon des critères (gratuits, support outils, etc.)
 */
export function filterOpenRouterModels(
  models: OpenRouterModel[],
  criteria: {
    freeOnly?: boolean;
    requiresTools?: boolean;
    requiresJsonMode?: boolean;
    minContextLength?: number;
  } = {},
): OpenRouterModel[] {
  return models.filter((model) => {
    // Vérifier si le modèle est gratuit
    if (criteria.freeOnly) {
      const isFree = model.pricing.prompt === 0 && model.pricing.completion === 0;
      if (!isFree) return false;
    }

    // Vérifier le support des outils (function calling)
    if (criteria.requiresTools) {
      const supportsTools = model.architecture.modality.includes("text-to-text") ||
                          model.architecture.modality.includes("text");
      if (!supportsTools) return false;
    }

    // Vérifier la longueur du contexte
    if (criteria.minContextLength) {
      const contextLength = model.top_provider?.context_length || model.context_length || 4000;
      if (contextLength < criteria.minContextLength) return false;
    }

    return true;
  });
}

/**
 * Trie les modèles par prix (du moins cher au plus cher)
 */
export function sortModelsByPrice(models: OpenRouterModel[]): OpenRouterModel[] {
  return [...models].sort((a, b) => {
    const priceA = a.pricing.prompt + a.pricing.completion;
    const priceB = b.pricing.prompt + b.pricing.completion;
    return priceA - priceB;
  });
}

/**
 * Retourne les modèles recommandés pour chaque rôle
 */
export function getRecommendedModels(
  models: OpenRouterModel[],
  isFreeTier: boolean,
): {
  planner: OpenRouterModel[];
  executor: OpenRouterModel[];
  retriever: OpenRouterModel[];
} {
  const filtered = isFreeTier 
    ? filterOpenRouterModels(models, { freeOnly: true, minContextLength: 8000 })
    : filterOpenRouterModels(models, { minContextLength: 16000 });

  const sorted = sortModelsByPrice(filtered);

  // Pour le planner: modèles légers et rapides
  const planner = sorted.filter(m => m.context_length >= 8000).slice(0, 10);

  // Pour l'executor: modèles qui supportent bien les outils
  const executor = sorted.filter(m => m.context_length >= 16000).slice(0, 15);

  // Pour le retriever: modèles d'embeddings
  const retriever = sorted.filter(m => 
    m.name.toLowerCase().includes("embedding") || 
    m.id.toLowerCase().includes("embedding")
  ).slice(0, 5);

  return { planner, executor, retriever };
}
