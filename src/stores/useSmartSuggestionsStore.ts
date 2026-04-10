/**
 * Store pour le système de suggestions contextuelles intelligentes
 * Génère des suggestions basées sur le contexte QGIS, l'historique et les couches chargées
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SuggestionType = "layer" | "action" | "parameter" | "follow-up" | "template";

export interface SmartSuggestion {
  id: string;
  type: SuggestionType;
  text: string;
  confidence: number;
  context: string;
  icon?: string;
  shortcut?: string;
  category?: string;
}

export interface SuggestionContext {
  layers: string[];
  selectedLayers: string[];
  lastIntent?: string;
  lastActions: string[];
  conversationCount: number;
  userPreferences: Record<string, number>;
}

interface SmartSuggestionsState {
  suggestions: SmartSuggestion[];
  isVisible: boolean;
  context: SuggestionContext;
  recentPrompts: string[];
  userPatterns: Record<string, number>;

  // Actions
  generateSuggestions: (input: string, context: SuggestionContext) => void;
  setVisibility: (visible: boolean) => void;
  updateContext: (context: Partial<SuggestionContext>) => void;
  acceptSuggestion: (suggestionId: string) => void;
  dismissSuggestion: (suggestionId: string) => void;
  learnFromPrompt: (prompt: string, wasSuccessful: boolean) => void;
}

const generateContextualSuggestions = (
  input: string,
  context: SuggestionContext
): SmartSuggestion[] => {
  const suggestions: SmartSuggestion[] = [];
  const inputLower = input.toLowerCase().trim();

  // Suggestions basées sur les couches chargées
  if (context.layers.length > 0) {
    context.layers.forEach((layer, idx) => {
      const layerLower = layer.toLowerCase();
      
      // Si l'utilisateur tape quelque chose qui ressemble au nom de la couche
      if (inputLower.length > 0 && layerLower.includes(inputLower)) {
        suggestions.push({
          id: `layer-${idx}`,
          type: "layer",
          text: `Travailler avec "${layer}"`,
          confidence: 0.9,
          context: "Couche disponible",
          icon: "Layers",
          category: "Couches",
        });
      }
    });

    // Suggestions d'analyse si couches sont présentes
    if (context.layers.some(l => l.toLowerCase().includes("foret") || l.toLowerCase().includes("forest"))) {
      suggestions.push({
        id: "forest-analysis",
        type: "action",
        text: "Analyser les peuplements forestiers",
        confidence: 0.85,
        context: "Couche forestière détectée",
        icon: "Trees",
        category: "Analyse",
      });
      suggestions.push({
        id: "forest-grid",
        type: "action",
        text: "Créer une grille d'inventaire forestier",
        confidence: 0.8,
        context: "Outil forestier",
        icon: "Grid3X3",
        category: "Outils",
      });
    }

    if (context.layers.some(l => l.toLowerCase().includes("parcelle") || l.toLowerCase().includes("cadastre"))) {
      suggestions.push({
        id: "cadastre-analysis",
        type: "action",
        text: "Analyser les parcelles cadastrales",
        confidence: 0.85,
        context: "Données cadastrales disponibles",
        icon: "MapPin",
        category: "Analyse",
      });
    }

    // Suggestion d'export si plusieurs couches
    if (context.layers.length > 1) {
      suggestions.push({
        id: "export-all",
        type: "action",
        text: `Exporter les ${context.layers.length} couches en GeoPackage`,
        confidence: 0.75,
        context: "Export multiple",
        icon: "Download",
        category: "Export",
      });
    }
  }

  // Suggestions basées sur l'input partiel
  if (inputLower.length > 0) {
    const actionPatterns = [
      { pattern: "calcul", suggestions: ["Calculer la surface", "Calculer le périmètre", "Calculer la distance"] },
      { pattern: "affiche", suggestions: ["Afficher les couches", "Afficher la légende", "Afficher les étiquettes"] },
      { pattern: "export", suggestions: ["Exporter en GeoJSON", "Exporter en Shapefile", "Exporter en CSV"] },
      { pattern: "buffer", suggestions: ["Créer un buffer de 100m", "Créer un buffer de 500m", "Créer un buffer autour de la sélection"] },
      { pattern: "zoom", suggestions: ["Zoomer sur la couche", "Zoomer sur la sélection", "Zoomer sur l'étendue"] },
      { pattern: "style", suggestions: ["Appliquer un style", "Changer la symbologie", "Modifier les couleurs"] },
      { pattern: "inventaire", suggestions: ["Créer un inventaire forestier", "Placettes d'inventaire", "Grille d'inventaire"] },
    ];

    actionPatterns.forEach(({ pattern, suggestions: texts }) => {
      if (inputLower.includes(pattern)) {
        texts.forEach((text, idx) => {
          suggestions.push({
            id: `action-${pattern}-${idx}`,
            type: "action",
            text,
            confidence: 0.8,
            context: `Action: ${pattern}`,
            icon: "Zap",
            category: "Actions",
          });
        });
      }
    });
  }

  // Suggestions de suivi basées sur le dernier intent
  if (context.lastIntent) {
    const followUps: Record<string, string[]> = {
      "FOREST_INVENTORY": ["Exporter les résultats", "Créer une carte de synthèse", "Analyser les essences"],
      "EXPORT": ["Vérifier le fichier exporté", "Ouvrir le dossier", "Partager le fichier"],
      "ANALYSIS": ["Visualiser les résultats", "Exporter les statistiques", "Créer un graphique"],
      "DATA_QUERY": ["Filtrer les résultats", "Sauvegarder la sélection", "Analyser les données"],
    };

    const followUpTexts = followUps[context.lastIntent] || [];
    followUpTexts.forEach((text, idx) => {
      suggestions.push({
        id: `follow-up-${idx}`,
        type: "follow-up",
        text,
        confidence: 0.7,
        context: `Suite à: ${context.lastIntent}`,
        icon: "ArrowRight",
        category: "Continuer",
      });
    });
  }

  // Templates fréquemment utilisés
  const commonTemplates = [
    { text: "Charge le cadastre de [commune]", category: "Templates" },
    { text: "Crée un buffer de [distance]m autour de [couche]", category: "Templates" },
    { text: "Calcule la surface totale de [couche]", category: "Templates" },
    { text: "Exporte [couche] en [format]", category: "Templates" },
  ];

  if (inputLower.length === 0) {
    commonTemplates.forEach((template, idx) => {
      suggestions.push({
        id: `template-${idx}`,
        type: "template",
        text: template.text,
        confidence: 0.6,
        context: "Template réutilisable",
        icon: "FileText",
        category: template.category,
      });
    });
  }

  // Trier par confiance et limiter
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
};

export const useSmartSuggestionsStore = create<SmartSuggestionsState>()(
  persist(
    (set, get) => ({
      suggestions: [],
      isVisible: false,
      context: {
        layers: [],
        selectedLayers: [],
        lastActions: [],
        conversationCount: 0,
        userPreferences: {},
      },
      recentPrompts: [],
      userPatterns: {},

      generateSuggestions: (input: string, context: SuggestionContext) => {
        const suggestions = generateContextualSuggestions(input, context);
        set({ 
          suggestions,
          isVisible: suggestions.length > 0 && input.length > 0,
          context: { ...get().context, ...context },
        });
      },

      setVisibility: (visible: boolean) => {
        set({ isVisible: visible });
      },

      updateContext: (contextUpdate: Partial<SuggestionContext>) => {
        set({ 
          context: { ...get().context, ...contextUpdate },
        });
      },

      acceptSuggestion: (suggestionId: string) => {
        const suggestion = get().suggestions.find(s => s.id === suggestionId);
        if (suggestion) {
          // Augmenter le poids de cette suggestion
          set(state => ({
            userPatterns: {
              ...state.userPatterns,
              [suggestion.text]: (state.userPatterns[suggestion.text] || 0) + 1,
            },
            suggestions: state.suggestions.filter(s => s.id !== suggestionId),
            isVisible: false,
          }));
        }
      },

      dismissSuggestion: (suggestionId: string) => {
        set(state => ({
          suggestions: state.suggestions.filter(s => s.id !== suggestionId),
        }));
      },

      learnFromPrompt: (prompt: string, wasSuccessful: boolean) => {
        set(state => ({
          recentPrompts: [prompt, ...state.recentPrompts].slice(0, 50),
          userPatterns: wasSuccessful 
            ? { ...state.userPatterns, [prompt]: (state.userPatterns[prompt] || 0) + 1 }
            : state.userPatterns,
        }));
      },
    }),
    {
      name: "qgisai-smart-suggestions",
      partialize: (state) => ({ 
        userPatterns: state.userPatterns,
        recentPrompts: state.recentPrompts,
      }),
    }
  )
);
