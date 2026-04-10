/**
 * Store pour le statut de réflexion du LLM
 * Affiche les étapes de l'orchestrateur multi-modèles
 */

import { create } from "zustand";

// Progression dynamique par phase (début, fin)
const phaseProgressRanges: Record<ThinkingPhase, [number, number]> = {
  IDLE: [0, 0],
  ANALYZING_INTENT: [5, 15],
  PLANNING: [15, 25],
  SELECTING_MODEL: [25, 35],
  RETRIEVING_CONTEXT: [35, 45],
  EXECUTING_TOOLS: [45, 60],
  GENERATING_CODE: [60, 75],
  WAITING_FOR_LLM: [75, 85],
  PROCESSING_RESPONSE: [85, 95],
  STREAMING_RESPONSE: [95, 100],
};

// Ordre des phases pour la progression
const phaseOrder: ThinkingPhase[] = [
  "IDLE",
  "ANALYZING_INTENT",
  "PLANNING", 
  "SELECTING_MODEL",
  "RETRIEVING_CONTEXT",
  "EXECUTING_TOOLS",
  "GENERATING_CODE",
  "WAITING_FOR_LLM",
  "PROCESSING_RESPONSE",
  "STREAMING_RESPONSE",
];

export type ThinkingPhase =
  | "IDLE"
  | "ANALYZING_INTENT"      // Analyse de l'intention utilisateur
  | "PLANNING"               // Planification du workflow
  | "SELECTING_MODEL"        // Sélection du modèle approprié
  | "RETRIEVING_CONTEXT"     // Récupération du contexte QGIS
  | "EXECUTING_TOOLS"        // Exécution des outils
  | "GENERATING_CODE"        // Génération de code PyQGIS
  | "WAITING_FOR_LLM"        // Attente réponse LLM
  | "PROCESSING_RESPONSE"    // Traitement de la réponse
  | "STREAMING_RESPONSE";    // Réception streaming

interface ThinkingState {
  phase: ThinkingPhase;
  message: string;
  subMessage: string;
  progress: number; // 0-100
  modelName: string | null;
  estimatedTime: string | null;
  progressInterval: number | null;
  
  // Actions
  setPhase: (phase: ThinkingPhase, details?: { message?: string; subMessage?: string; modelName?: string; estimatedTime?: string; progress?: number }) => void;
  setProgress: (progress: number) => void;
  updateSubMessage: (subMessage: string) => void;
  reset: () => void;
}

const phaseMessages: Record<ThinkingPhase, { message: string; subMessage: string }> = {
  IDLE: { message: "", subMessage: "" },
  ANALYZING_INTENT: { 
    message: "Analyse de votre demande...", 
    subMessage: "Compréhension de l'intention et de la complexité de la tâche" 
  },
  PLANNING: { 
    message: "Planification du workflow...", 
    subMessage: "Décomposition en étapes exécutables" 
  },
  SELECTING_MODEL: { 
    message: "Sélection du modèle optimal...", 
    subMessage: "Choix du modèle adapté à la complexité de la tâche" 
  },
  RETRIEVING_CONTEXT: { 
    message: "Analyse du contexte QGIS...", 
    subMessage: "Récupération des couches et données disponibles" 
  },
  EXECUTING_TOOLS: { 
    message: "Exécution des outils...", 
    subMessage: "Traitement spatial en cours" 
  },
  GENERATING_CODE: { 
    message: "Génération du code PyQGIS...", 
    subMessage: "Création du script pour QGIS" 
  },
  WAITING_FOR_LLM: { 
    message: "Le modèle réfléchit...", 
    subMessage: "Traitement par le modèle de langage" 
  },
  PROCESSING_RESPONSE: { 
    message: "Analyse de la réponse...", 
    subMessage: "Extraction et formatage des résultats" 
  },
  STREAMING_RESPONSE: { 
    message: "Génération de la réponse...", 
    subMessage: "Construction de la réponse en temps réel" 
  },
};

export const useThinkingStore = create<ThinkingState>((set, get) => ({
  phase: "IDLE",
  message: "",
  subMessage: "",
  progress: 0,
  modelName: null,
  estimatedTime: null,
  progressInterval: null as number | null,

  setPhase: (phase, details = {}) => {
    const defaultMessages = phaseMessages[phase];
    const [minProgress, maxProgress] = phaseProgressRanges[phase];
    
    // Arrêter l'animation précédente
    if (get().progressInterval) {
      clearInterval(get().progressInterval);
    }
    
    // Si on a un progress explicite, l'utiliser, sinon démarrer depuis min
    const targetProgress = details.progress ?? minProgress;
    
    set({
      phase,
      message: details.message ?? defaultMessages.message,
      subMessage: details.subMessage ?? defaultMessages.subMessage,
      modelName: details.modelName ?? null,
      estimatedTime: details.estimatedTime ?? null,
      progress: targetProgress,
      progressInterval: null,
    });
    
    // Animer la progression jusqu'à maxProgress si ce n'est pas IDLE
    if (phase !== "IDLE" && !details.progress) {
      const interval = window.setInterval(() => {
        const current = get().progress;
        if (current < maxProgress) {
          // Incrément lent et aléatoire pour effet naturel
          const increment = Math.random() * 0.5 + 0.1;
          set({ progress: Math.min(current + increment, maxProgress) });
        } else {
          clearInterval(interval);
          set({ progressInterval: null });
        }
      }, 100);
      set({ progressInterval: interval });
    }
  },

  setProgress: (progress) => set({ progress }),
  
  updateSubMessage: (subMessage) => set({ subMessage }),

  reset: () => {
    // Nettoyer l'intervalle avant reset
    const interval = get().progressInterval;
    if (interval) clearInterval(interval);
    
    set({
      phase: "IDLE",
      message: "",
      subMessage: "",
      progress: 0,
      modelName: null,
      estimatedTime: null,
      progressInterval: null,
    });
  },
}));

// Helper pour calculer la progression basée sur l'ordre des phases
export const calculateProgressFromPhase = (phase: ThinkingPhase): number => {
  const index = phaseOrder.indexOf(phase);
  if (index === -1) return 0;
  return Math.round((index / (phaseOrder.length - 1)) * 100);
};

/**
 * Obtient une phrase descriptive animée selon la phase
 */
export function getAnimatedPhrases(phase: ThinkingPhase): string[] {
  const phrases: Record<ThinkingPhase, string[]> = {
    IDLE: [],
    ANALYZING_INTENT: [
      "Je lis votre demande...",
      "J'identifie les mots-clés...",
      "Je détecte les entités géographiques...",
      "J'évalue la complexité...",
      "Je détermine l'approche optimale...",
    ],
    PLANNING: [
      "Je décompose la tâche en étapes...",
      "J'identifie les dépendances...",
      "Je planifie l'ordre d'exécution...",
      "Je vérifie les prérequis...",
      "J'optimise le workflow...",
    ],
    SELECTING_MODEL: [
      "J'analyse les modèles disponibles...",
      "Je compare les capacités...",
      "Je sélectionne le meilleur modèle...",
      "Je vérifie la mémoire disponible...",
    ],
    RETRIEVING_CONTEXT: [
      "Je scanne les couches QGIS...",
      "J'analyse les attributs disponibles...",
      "Je vérifie le système de coordonnées...",
      "J'évalue la qualité des données...",
      "Je récupère les métadonnées...",
    ],
    EXECUTING_TOOLS: [
      "Je prépare les données...",
      "J'exécute l'algorithme...",
      "Je traite les géométries...",
      "Je calcule les résultats...",
      "Je finalise l'opération...",
    ],
    GENERATING_CODE: [
      "J'écris le script Python...",
      "J'ajoute les imports nécessaires...",
      "Je structure le code...",
      "J'ajoute la gestion des erreurs...",
      "Je vérifie la syntaxe...",
    ],
    WAITING_FOR_LLM: [
      "Je réfléchis à votre demande...",
      "J'explore différentes approches...",
      "Je consulte mes connaissances QGIS...",
      "J'optimise la solution...",
      "Je structure ma réponse...",
    ],
    PROCESSING_RESPONSE: [
      "J'analyse la réponse reçue...",
      "J'extrais les résultats...",
      "Je formate les données...",
      "Je vérifie la cohérence...",
    ],
    STREAMING_RESPONSE: [
      "Je génère votre réponse...",
      "J'ajoute les détails techniques...",
      "Je formate pour la lisibilité...",
      "Presque terminé...",
    ],
  };

  return phrases[phase] || phrases.WAITING_FOR_LLM;
}
