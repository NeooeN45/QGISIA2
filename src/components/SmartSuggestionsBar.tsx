/**
 * Barre de suggestions contextuelles intelligentes
 * S'affiche au-dessus du champ de saisie avec des suggestions basées sur le contexte
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers,
  Zap,
  Trees,
  MapPin,
  Download,
  Grid3X3,
  ArrowRight,
  FileText,
  ChevronRight,
  Sparkles,
  X,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useSmartSuggestionsStore, SmartSuggestion, SuggestionType } from "../stores/useSmartSuggestionsStore";

interface SmartSuggestionsBarProps {
  input: string;
  onSuggestionClick: (suggestion: string) => void;
  layers: string[];
  selectedLayers: string[];
  lastIntent?: string;
  className?: string;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Layers,
  Zap,
  Trees,
  MapPin,
  Download,
  Grid3X3,
  ArrowRight,
  FileText,
  Sparkles,
  TrendingUp,
};

const typeColors: Record<SuggestionType, string> = {
  layer: "from-blue-500 to-cyan-500",
  action: "from-emerald-500 to-teal-500",
  parameter: "from-amber-500 to-orange-500",
  "follow-up": "from-violet-500 to-purple-500",
  template: "from-gray-500 to-slate-500",
};

const typeBgColors: Record<SuggestionType, string> = {
  layer: "bg-blue-500/10 border-blue-500/20",
  action: "bg-emerald-500/10 border-emerald-500/20",
  parameter: "bg-amber-500/10 border-amber-500/20",
  "follow-up": "bg-violet-500/10 border-violet-500/20",
  template: "bg-slate-500/10 border-slate-500/20",
};

export default function SmartSuggestionsBar({
  input,
  onSuggestionClick,
  layers,
  selectedLayers,
  lastIntent,
  className,
}: SmartSuggestionsBarProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    suggestions,
    isVisible,
    generateSuggestions,
    acceptSuggestion,
    dismissSuggestion,
    updateContext,
  } = useSmartSuggestionsStore();

  // Mettre à jour le contexte et générer les suggestions
  useEffect(() => {
    updateContext({
      layers,
      selectedLayers,
      lastIntent,
    });
    generateSuggestions(input, {
      layers,
      selectedLayers,
      lastIntent,
      lastActions: [],
      conversationCount: 0,
      userPreferences: {},
    });
  }, [input, layers, selectedLayers, lastIntent]);

  // Gestion du clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % suggestions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
          break;
        case "Tab":
          if (!e.shiftKey) {
            e.preventDefault();
            const suggestion = suggestions[selectedIndex];
            if (suggestion) {
              handleSuggestionClick(suggestion);
            }
          }
          break;
        case "Enter":
          if (isVisible) {
            e.preventDefault();
            const suggestion = suggestions[selectedIndex];
            if (suggestion) {
              handleSuggestionClick(suggestion);
            }
          }
          break;
        case "Escape":
          dismissSuggestion(suggestions[selectedIndex]?.id || "");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, suggestions, selectedIndex]);

  const handleSuggestionClick = (suggestion: SmartSuggestion) => {
    acceptSuggestion(suggestion.id);
    onSuggestionClick(suggestion.text);
  };

  // Grouper les suggestions par catégorie
  const groupedSuggestions = suggestions.reduce((acc, suggestion) => {
    const category = suggestion.category || "Autres";
    if (!acc[category]) acc[category] = [];
    acc[category].push(suggestion);
    return acc;
  }, {} as Record<string, SmartSuggestion[]>);

  const categories = Object.keys(groupedSuggestions);

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className={cn(
        "absolute bottom-full left-0 right-0 mb-2 z-50",
        className
      )}
    >
      <div className="mx-4 mb-2">
        {/* Header avec compteur et bouton expand */}
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-gray-900/95 to-gray-800/95 backdrop-blur-xl rounded-t-xl border border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-emerald-400" />
            <span className="text-xs font-medium text-white/70">
              Suggestions intelligentes
            </span>
            <span className="text-xs text-white/40">
              ({suggestions.length})
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={isExpanded ? "Réduire" : "Étendre"}
            >
              <ChevronRight
                size={14}
                className={cn(
                  "text-white/50 transition-transform",
                  isExpanded && "rotate-90"
                )}
              />
            </button>
            <button
              onClick={() => useSmartSuggestionsStore.getState().setVisibility(false)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title="Fermer"
            >
              <X size={14} className="text-white/50" />
            </button>
          </div>
        </div>

        {/* Liste des suggestions */}
        <div className={cn(
          "bg-gray-900/95 backdrop-blur-xl border-x border-b border-white/10 rounded-b-xl overflow-hidden",
          isExpanded ? "max-h-80 overflow-y-auto" : "max-h-48"
        )}>
          {categories.map((category, catIdx) => (
            <div key={category} className="border-b border-white/5 last:border-0">
              {/* Titre de catégorie */}
              <div className="px-3 py-1.5 bg-white/5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {category}
                </span>
              </div>

              {/* Suggestions de cette catégorie */}
              <div className="p-1">
                {groupedSuggestions[category].map((suggestion, idx) => {
                  const globalIndex = suggestions.indexOf(suggestion);
                  const isSelected = globalIndex === selectedIndex;
                  const Icon = iconMap[suggestion.icon || "Zap"] || Zap;

                  return (
                    <motion.button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all group",
                        isSelected
                          ? cn("bg-gradient-to-r", typeBgColors[suggestion.type], "border")
                          : "hover:bg-white/5"
                      )}
                    >
                      {/* Icône avec gradient */}
                      <div className={cn(
                        "flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center",
                        typeColors[suggestion.type]
                      )}>
                        <Icon size={14} className="text-white" />
                      </div>

                      {/* Texte */}
                      <div className="flex-1 text-left">
                        <p className={cn(
                          "text-sm font-medium truncate",
                          isSelected ? "text-white" : "text-white/80 group-hover:text-white"
                        )}>
                          {suggestion.text}
                        </p>
                        {suggestion.context && (
                          <p className="text-[10px] text-white/40 truncate">
                            {suggestion.context}
                          </p>
                        )}
                      </div>

                      {/* Confiance et shortcut */}
                      <div className="flex items-center gap-2">
                        {suggestion.confidence > 0.8 && (
                          <span className="text-[10px] text-emerald-400/70 font-medium">
                            {(suggestion.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] text-white/30 px-1.5 py-0.5 bg-white/10 rounded">
                            Tab
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Footer avec info */}
          <div className="px-3 py-2 bg-white/5 border-t border-white/10 flex items-center justify-between">
            <span className="text-[10px] text-white/30">
              ↑↓ pour naviguer • Tab pour sélectionner
            </span>
            <span className="text-[10px] text-white/30">
              Apprenez à QGISAI+ avec vos choix
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
