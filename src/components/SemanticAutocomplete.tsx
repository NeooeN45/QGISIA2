/**
 * Auto-complétion sémantique pour le chat input
 * Style GitHub Copilot avec suggestions grisées
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Command, CornerDownLeft } from "lucide-react";
import { cn } from "@/src/lib/utils";

// Base de connaissances sémantique pour l'auto-complétion
const SEMANTIC_PATTERNS = [
  // Patterns d'analyse
  { prefix: ["calcul", "calcule"], completion: " la surface de ", context: "analysis" },
  { prefix: ["mesur", "mesure"], completion: " la distance entre ", context: "analysis" },
  { prefix: ["comp", "compte"], completion: " le nombre de ", context: "analysis" },
  { prefix: ["analy"], completion: " la couche ", context: "analysis" },
  { prefix: ["stat", "stats"], completion: " istiques sur ", context: "analysis" },
  
  // Patterns de visualisation
  { prefix: ["affiche", "affich"], completion: " la couche ", context: "visualization" },
  { prefix: ["zoom"], completion: " sur la couche ", context: "visualization" },
  { prefix: ["style"], completion: " la symbologie de ", context: "visualization" },
  { prefix: ["couleu", "couleur"], completion: " de la couche ", context: "visualization" },
  { prefix: ["legend"], completion: " de la carte ", context: "visualization" },
  
  // Patterns de processing
  { prefix: ["buff", "buffer", "tampon"], completion: " de 100m autour de ", context: "processing" },
  { prefix: ["intersect"], completion: " ion entre ", context: "processing" },
  { prefix: ["union", "fusion"], completion: " des couches ", context: "processing" },
  { prefix: ["clip", "decoup"], completion: " e selon ", context: "processing" },
  { prefix: ["reproj", "reprojection"], completion: " en EPSG:2154 ", context: "processing" },
  { prefix: ["convert"], completion: " ir en ", context: "processing" },
  
  // Patterns de données
  { prefix: ["charg", "charge"], completion: " er la couche ", context: "data" },
  { prefix: ["import"], completion: " er le fichier ", context: "data" },
  { prefix: ["export", "exporte"], completion: " en GeoJSON ", context: "data" },
  { prefix: ["sauve", "sauvegarde"], completion: " rder sous ", context: "data" },
  { prefix: ["ouvr", "ouvre"], completion: " ir le projet ", context: "data" },
  
  // Patterns forestiers
  { prefix: ["inventair", "inventaire"], completion: " forestier sur ", context: "forest" },
  { prefix: ["placett"], completion: " es d'inventaire ", context: "forest" },
  { prefix: ["essenc"], completion: " es présentes ", context: "forest" },
  { prefix: ["grill"], completion: " e d'inventaire ", context: "forest" },
  { prefix: ["ndvi"], completion: " et analyse de ", context: "forest" },
  { prefix: ["surfac", "surface"], completion: " terrière de ", context: "forest" },
  
  // Patterns cadastre
  { prefix: ["cadastr"], completion: " e de la commune ", context: "cadastre" },
  { prefix: ["parcell"], completion: " e sélectionnée ", context: "cadastre" },
  { prefix: ["propri"], completion: " étaire ", context: "cadastre" },
  { prefix: ["section"], completion: " cadastrale ", context: "cadastre" },
  
  // Patterns filtres
  { prefix: ["filtr", "filtre"], completion: " les entités où ", context: "filter" },
  { prefix: ["select", "selecti"], completion: " onner les ", context: "filter" },
  { prefix: ["cherch", "recherch"], completion: " er les ", context: "filter" },
  
  // Patterns aide
  { prefix: ["aide", "help"], completion: " moi à ", context: "help" },
  { prefix: ["commen"], completion: " t faire un ", context: "help" },
  { prefix: ["expl", "explique"], completion: " comment ", context: "help" },
];

// Templates contextuels
const CONTEXTUAL_TEMPLATES: Record<string, string[]> = {
  buffer: ["buffer de 100m", "buffer de 500m", "buffer de 1km", "buffer autour de la sélection"],
  export: ["export en GeoJSON", "export en Shapefile", "export en GeoPackage", "export en CSV"],
  calcul: ["calcul de la surface", "calcul du périmètre", "calcul de la distance", "calcul de la densité"],
  forest: ["inventaire forestier", "placettes d'inventaire", "essences forestières", "surface terrière"],
  ndvi: ["analyse NDVI", "comparaison NDVI 2023/2024", "carte de santé forestière", "zones de stress"],
};

interface SemanticAutocompleteProps {
  input: string;
  onAccept: (completion: string) => void;
  layerNames?: string[];
  className?: string;
}

export default function SemanticAutocomplete({
  input,
  onAccept,
  layerNames = [],
  className,
}: SemanticAutocompleteProps) {
  const [suggestion, setSuggestion] = useState<string>("");
  const [fullSuggestion, setFullSuggestion] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef(input);

  // Mettre à jour la référence
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  // Trouver une suggestion basée sur l'input
  const findSuggestion = useCallback(() => {
    if (!input || input.length < 2) {
      setSuggestion("");
      setFullSuggestion("");
      setIsVisible(false);
      return;
    }

    const inputLower = input.toLowerCase().trim();
    const words = inputLower.split(/\s+/);
    const lastWord = words[words.length - 1];
    const lastTwoWords = words.slice(-2).join(" ");

    // Chercher dans les patterns
    let match = null;
    
    for (const pattern of SEMANTIC_PATTERNS) {
      for (const prefix of pattern.prefix) {
        // Match sur le dernier mot
        if (lastWord.startsWith(prefix) && lastWord !== prefix) {
          const partial = lastWord.substring(prefix.length);
          match = {
            completion: pattern.completion,
            remaining: partial,
            context: pattern.context,
          };
          break;
        }
        // Match sur les 2 derniers mots
        if (lastTwoWords.startsWith(prefix) && lastTwoWords !== prefix) {
          const partial = lastTwoWords.substring(prefix.length);
          match = {
            completion: pattern.completion,
            remaining: partial,
            context: pattern.context,
          };
          break;
        }
      }
      if (match) break;
    }

    // Si on a un match complet, générer la suggestion complète
    if (match && lastWord.length >= 2) {
      // Construire la suggestion complète
      const baseSuggestion = match.completion.trim();
      
      // Ajouter un nom de couche si pertinent
      let finalSuggestion = baseSuggestion;
      if (
        (match.context === "analysis" || 
         match.context === "visualization" || 
         match.context === "processing") && 
        layerNames.length > 0
      ) {
        // Prendre la première couche comme suggestion
        finalSuggestion += `"${layerNames[0]}"`;
      }

      setSuggestion(finalSuggestion);
      setFullSuggestion(input + finalSuggestion.substring(match.remaining.length));
      setIsVisible(true);
    } else {
      // Vérifier les templates contextuels
      let templateMatch = null;
      for (const [key, templates] of Object.entries(CONTEXTUAL_TEMPLATES)) {
        if (inputLower.includes(key)) {
          // Trouver le template le plus approprié
          templateMatch = templates.find(t => !inputLower.includes(t.toLowerCase()));
          if (templateMatch) break;
        }
      }

      if (templateMatch && input.length > 3) {
        setSuggestion(templateMatch);
        setFullSuggestion(templateMatch);
        setIsVisible(true);
      } else {
        setSuggestion("");
        setFullSuggestion("");
        setIsVisible(false);
      }
    }
  }, [input, layerNames]);

  // Mettre à jour la suggestion quand l'input change
  useEffect(() => {
    findSuggestion();
  }, [findSuggestion]);

  // Gestion du raccourci Tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;

      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        onAccept(suggestion);
        setIsVisible(false);
      } else if (e.key === "Escape") {
        setIsVisible(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, suggestion, onAccept]);

  if (!isVisible || !suggestion) {
    return null;
  }

  // Calculer la partie grise (ghost text)
  const inputWithoutPartial = input;
  const ghostText = suggestion;

  return (
    <div className={cn("relative", className)}>
      {/* Suggestion overlay - style Copilot */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          className="absolute left-0 right-0 bottom-full mb-1"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-gray-800/90 to-gray-900/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl">
            {/* Icône */}
            <div className="flex-shrink-0 w-5 h-5 rounded bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/30">
              <Sparkles size={12} className="text-emerald-400" />
            </div>

            {/* Texte suggéré */}
            <div className="flex-1 flex items-center min-w-0">
              <span className="text-sm text-white/60 truncate">
                {inputWithoutPartial}
              </span>
              <span className="text-sm text-white/30 truncate">
                {ghostText}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => {
                  onAccept(suggestion);
                  setIsVisible(false);
                }}
                className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] text-white/70 transition-colors"
              >
                <CornerDownLeft size={10} />
                Tab
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-white/10 rounded text-white/40 hover:text-white/70 transition-colors"
              >
                <Command size={10} />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Hook pour utiliser l'auto-complétion
export const useSemanticAutocomplete = (layerNames: string[] = []) => {
  const [input, setInput] = useState("");
  const [suggestion, setSuggestion] = useState("");

  const updateInput = (newInput: string) => {
    setInput(newInput);
    // La suggestion est calculée dans le composant
  };

  const acceptSuggestion = (completion: string) => {
    setInput(prev => prev + completion);
    setSuggestion("");
  };

  return {
    input,
    setInput: updateInput,
    suggestion,
    acceptSuggestion,
    SemanticAutocompleteComponent: (
      <SemanticAutocomplete
        input={input}
        onAccept={acceptSuggestion}
        layerNames={layerNames}
      />
    ),
  };
};
