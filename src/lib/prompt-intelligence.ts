/**
 * Système d'intelligence de prompt utilisant un modèle local ultra-léger
 * pour analyser la demande utilisateur et la décomposer en plan d'action
 */

import { detectOllama, getOllamaModels } from "./ollama-auto-detect";
import { AppSettings } from "./settings";
import { toast } from "sonner";

export type UserIntent =
  | "DATA_QUERY"           // Requête de données (cadastre, communes, etc.)
  | "ANALYSIS"             // Analyse spatiale ou statistique
  | "VISUALIZATION"        // Création/Modification de carte, styles
  | "PROCESSING"           // Traitement de données (raster, vectoriel)
  | "WORKFLOW"             // Workflow complexe multi-étapes
  | "CODE_GENERATION"      // Génération de code PyQGIS
  | "EXPLANATION"          // Explication, documentation
  | "DEBUG"                // Diagnostic, débogage
  | "FREE_CHAT";           // Discussion libre

export type ActionComplexity = "SIMPLE" | "MODERATE" | "COMPLEX" | "VERY_COMPLEX";

export interface IntentAnalysis {
  intent: UserIntent;
  complexity: ActionComplexity;
  confidence: number;           // 0-1
  needsQgisContext: boolean;    // Nécessite le contexte QGIS
  needsTools: boolean;          // Nécessite l'appel d'outils
  estimatedSteps: number;       // Nombre d'étapes estimées
  suggestedApproach: "LOCAL_ROUTER" | "TOOL_CALLING" | "CODE_GENERATION" | "HYBRID";
  keywords: string[];           // Mots-clés extraits
  entities: {                  // Entités géographiques détectées
    communes?: string[];
    layers?: string[];
    dataSources?: string[];
    operations?: string[];
  };
  requiresLargeContext: boolean; // Nécessite une fenêtre de contexte large
  suggestedModelTier: "ULTRA_LIGHT" | "LIGHT" | "MEDIUM" | "HEAVY";
}

const INTENT_ANALYSIS_PROMPT = `Tu es un analyseur d'intentions SIG. Analyse la demande utilisateur et réponds UNIQUEMENT en JSON valide.

Règles:
1. Détecte l'intention principale parmi: DATA_QUERY, ANALYSIS, VISUALIZATION, PROCESSING, WORKFLOW, CODE_GENERATION, EXPLANATION, DEBUG, FREE_CHAT
2. Évalue la complexité: SIMPLE (1 étape), MODERATE (2-3 étapes), COMPLEX (4-6 étapes), VERY_COMPLEX (7+ étapes)
3. Identifie les entités: communes, couches, sources de données, opérations
4. Détermine l'approche: LOCAL_ROUTER (actions directes), TOOL_CALLING (outils structurés), CODE_GENERATION (PyQGIS), HYBRID (combinaison)

Réponds EXACTEMENT dans ce format JSON:
{
  "intent": "...",
  "complexity": "...",
  "confidence": 0.0-1.0,
  "needsQgisContext": true/false,
  "needsTools": true/false,
  "estimatedSteps": number,
  "suggestedApproach": "...",
  "keywords": ["..."],
  "entities": {
    "communes": ["..."],
    "layers": ["..."],
    "dataSources": ["..."],
    "operations": ["..."]
  },
  "requiresLargeContext": true/false,
  "suggestedModelTier": "ULTRA_LIGHT|LIGHT|MEDIUM|HEAVY"
}

Exemple 1 - "Charge le cadastre de Lyon et zoom dessus":
{
  "intent": "DATA_QUERY",
  "complexity": "SIMPLE",
  "confidence": 0.95,
  "needsQgisContext": false,
  "needsTools": true,
  "estimatedSteps": 2,
  "suggestedApproach": "LOCAL_ROUTER",
  "keywords": ["cadastre", "Lyon", "zoom"],
  "entities": {
    "communes": ["Lyon"],
    "layers": [],
    "dataSources": ["cadastre"],
    "operations": ["charger", "zoom"]
  },
  "requiresLargeContext": false,
  "suggestedModelTier": "ULTRA_LIGHT"
}

Exemple 2 - "Analyse la corrélation entre le NDVI 2020 et 2023 sur toutes les communes de mon projet, puis crée une carte choroplèthe avec légende personnalisée":
{
  "intent": "ANALYSIS",
  "complexity": "VERY_COMPLEX",
  "confidence": 0.88,
  "needsQgisContext": true,
  "needsTools": true,
  "estimatedSteps": 8,
  "suggestedApproach": "HYBRID",
  "keywords": ["NDVI", "corrélation", "analyse", "carte", "choroplèthe", "légende"],
  "entities": {
    "communes": [],
    "layers": ["NDVI 2020", "NDVI 2023"],
    "dataSources": [],
    "operations": ["analyse corrélation", "carte choroplèthe", "légende personnalisée"]
  },
  "requiresLargeContext": true,
  "suggestedModelTier": "MEDIUM"
}

Analyse cette demande:`;

// Modèles recommandés par tier pour l'analyse d'intention
const ULTRA_LIGHT_MODELS = ["smollm2:360m", "smollm2:1.7b", "gemma4:2b", "llama3.2:1b"];
const FALLBACK_MODEL = "gemma4:2b";

/**
 * Analyse la demande utilisateur avec un modèle local ultra-léger
 */
export async function analyzeUserIntent(
  userMessage: string,
  settings: AppSettings
): Promise<IntentAnalysis | null> {
  // Vérifier si Ollama est disponible
  const ollamaAvailable = await detectOllama();
  if (!ollamaAvailable) {
    // Fallback: analyse heuristique simple sans LLM
    return heuristicIntentAnalysis(userMessage);
  }

  // Récupérer les modèles disponibles
  const models = await getOllamaModels();
  
  // Trouver le meilleur modèle ultra-léger disponible
  const availableUltraLight = models
    .map(m => m.name)
    .filter(name => ULTRA_LIGHT_MODELS.some(ul => name.includes(ul)));
  
  const modelToUse = availableUltraLight[0] || 
                     models.find(m => m.name.includes("2b") || m.name.includes("1b"))?.name || 
                     models[0]?.name || 
                     FALLBACK_MODEL;

  try {
    const prompt = `${INTENT_ANALYSIS_PROMPT}\n\n"${userMessage}"`;
    
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelToUse,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1,  // Très faible pour du JSON fiable
          num_predict: 800,
          stop: ["\n\n", "User:", "Assistant:"],
        },
      }),
      signal: AbortSignal.timeout(5000), // 5 secondes max pour l'analyse
    });

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.response?.trim() || "";
    
    // Extraire le JSON de la réponse
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("[IntentAnalyzer] Pas de JSON trouvé dans la réponse:", rawResponse);
      return heuristicIntentAnalysis(userMessage);
    }

    const analysis: IntentAnalysis = JSON.parse(jsonMatch[0]);
    
    // Validation et valeurs par défaut
    return {
      intent: analysis.intent || "FREE_CHAT",
      complexity: analysis.complexity || "SIMPLE",
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
      needsQgisContext: analysis.needsQgisContext ?? true,
      needsTools: analysis.needsTools ?? false,
      estimatedSteps: Math.max(1, analysis.estimatedSteps || 1),
      suggestedApproach: analysis.suggestedApproach || "CODE_GENERATION",
      keywords: analysis.keywords || [],
      entities: {
        communes: analysis.entities?.communes || [],
        layers: analysis.entities?.layers || [],
        dataSources: analysis.entities?.dataSources || [],
        operations: analysis.entities?.operations || [],
      },
      requiresLargeContext: analysis.requiresLargeContext ?? false,
      suggestedModelTier: analysis.suggestedModelTier || "LIGHT",
    };

  } catch (error) {
    console.warn("[IntentAnalyzer] Erreur analyse LLM:", error);
    return heuristicIntentAnalysis(userMessage);
  }
}

/**
 * Analyse heuristique fallback quand le LLM n'est pas disponible
 */
function heuristicIntentAnalysis(userMessage: string): IntentAnalysis {
  const normalized = userMessage.toLowerCase();
  
  // Détection d'intention par mots-clés
  const hasCadastre = /cadastre|parcelle|section/i.test(normalized);
  const hasCommune = /commune|ville|département|région/i.test(normalized);
  const hasAnalysis = /analyse|calcul|statistique|corrélation|moyenne|somme/i.test(normalized);
  const hasVisualization = /style|symbologie|couleur|carte|légende|étiquette/i.test(normalized);
  const hasProcessing = /traitement|fusion|découpe|buffer|intersection|union/i.test(normalized);
  const hasCode = /python|script|code|pyqgis|plugin/i.test(normalized);
  const hasDebug = /debug|erreur|problème|bug|diagnostic/i.test(normalized);
  const hasNDVI = /ndvi|sentinel|landsat|raster|ortho/i.test(normalized);
  
  // Compter les étapes (approximation par les connecteurs)
  const stepIndicators = (normalized.match(/\b(et|puis|ensuite|après|enfin|d'abord)\b/g) || []).length;
  const estimatedSteps = stepIndicators + 1;
  
  // Déterminer l'intention
  let intent: UserIntent = "FREE_CHAT";
  if (hasCadastre || hasCommune) intent = "DATA_QUERY";
  else if (hasAnalysis) intent = "ANALYSIS";
  else if (hasVisualization) intent = "VISUALIZATION";
  else if (hasProcessing || hasNDVI) intent = "PROCESSING";
  else if (hasCode) intent = "CODE_GENERATION";
  else if (hasDebug) intent = "DEBUG";
  
  // Déterminer la complexité
  let complexity: ActionComplexity = "SIMPLE";
  if (estimatedSteps >= 7) complexity = "VERY_COMPLEX";
  else if (estimatedSteps >= 4) complexity = "COMPLEX";
  else if (estimatedSteps >= 2) complexity = "MODERATE";
  
  // Déterminer l'approche
  let approach: IntentAnalysis["suggestedApproach"] = "CODE_GENERATION";
  if ((hasCadastre || hasCommune) && estimatedSteps <= 2) approach = "LOCAL_ROUTER";
  else if (estimatedSteps <= 3 && !hasCode) approach = "TOOL_CALLING";
  else if (estimatedSteps > 3 && (hasAnalysis || hasProcessing)) approach = "HYBRID";
  
  // Extraire les entités simples
  const communeMatches = normalized.match(/(?:commune|ville|de|d')\s+([A-Za-zÀ-ÿ\s'-]+?)(?:\s+(?:et|avec|sans|pour|dans|sur|,|\.|$))/i);
  const layerMatches = normalized.match(/couche[s]?\s+["']?([\w\s_-]+)["']?/gi);
  
  return {
    intent,
    complexity,
    confidence: 0.6, // Confiance moyenne pour l'heuristique
    needsQgisContext: !["FREE_CHAT", "EXPLANATION"].includes(intent),
    needsTools: !["FREE_CHAT", "EXPLANATION", "CODE_GENERATION"].includes(intent),
    estimatedSteps,
    suggestedApproach: approach,
    keywords: normalized.split(/\s+/).filter(w => w.length > 3),
    entities: {
      communes: communeMatches ? [communeMatches[1].trim()] : [],
      layers: layerMatches ? layerMatches.map(m => m.replace(/couche[s]?\s+["']?/i, "").replace(/["']?$/, "")) : [],
      dataSources: hasCadastre ? ["cadastre"] : hasNDVI ? ["raster"] : [],
      operations: [],
    },
    requiresLargeContext: estimatedSteps > 5 || normalized.length > 500,
    suggestedModelTier: complexity === "VERY_COMPLEX" ? "HEAVY" : complexity === "COMPLEX" ? "MEDIUM" : "LIGHT",
  };
}

/**
 * Sélectionne le modèle approprié selon l'analyse d'intention
 */
export function selectModelForIntent(
  analysis: IntentAnalysis,
  availableModels: string[],
  settings: AppSettings
): { model: string; reason: string } {
  const tier = analysis.suggestedModelTier;
  
  // Mapping des tiers vers les modèles
  const tierMapping: Record<string, string[]> = {
    "ULTRA_LIGHT": ["smollm2:360m", "smollm2:1.7b", "gemma4:2b", "llama3.2:1b", "qwen3:1.7b"],
    "LIGHT": ["gemma4:4b", "qwen3:4b", "llama3.2:3b", "phi4:3b", "gemma4:2b"],
    "MEDIUM": ["gemma4:9b", "qwen3:8b", "llama3.3:8b", "mistral:7b", "gemma4:4b"],
    "HEAVY": ["gemma4:27b", "qwen3:30b-a3b", "llama3.3:70b", "qwen3:14b", "gemma4:12b"],
  };
  
  const candidates = tierMapping[tier] || tierMapping["LIGHT"];
  
  // Trouver le premier modèle disponible
  for (const candidate of candidates) {
    const found = availableModels.find(m => 
      m.toLowerCase().includes(candidate.toLowerCase().split(":")[0]) &&
      m.toLowerCase().includes(candidate.toLowerCase().split(":")[1] || "")
    );
    if (found) {
      return { 
        model: found, 
        reason: `Modèle ${tier} sélectionné pour ${analysis.intent} (${analysis.complexity})` 
      };
    }
  }
  
  // Fallback sur le premier modèle disponible
  return { 
    model: availableModels[0] || "gemma4:4b", 
    reason: `Fallback: premier modèle disponible (tier ${tier} non trouvé)` 
  };
}

/**
 * Détermine si on peut utiliser le local router basé sur l'analyse
 */
export function canUseLocalRouter(analysis: IntentAnalysis): boolean {
  return analysis.suggestedApproach === "LOCAL_ROUTER" && 
         analysis.confidence > 0.8 && 
         analysis.complexity === "SIMPLE";
}

/**
 * Détermine si on doit utiliser le streaming pour la réponse
 */
export function shouldUseStreaming(analysis: IntentAnalysis): boolean {
  return analysis.complexity !== "SIMPLE" || analysis.estimatedSteps > 3;
}
