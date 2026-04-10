/**
 * Indicateur de réflexion animé style ChatGPT
 * Affiche les phases de l'orchestrateur avec phrases dynamiques
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Brain, Cpu, Map, Code2, Layers, Terminal, Zap } from "lucide-react";
import { useThinkingStore, ThinkingPhase, getAnimatedPhrases } from "../stores/useThinkingStore";

interface ThinkingIndicatorProps {
  isLoading: boolean;
  onStop?: () => void;
}

const phaseIcons: Record<ThinkingPhase, React.ReactNode> = {
  IDLE: null,
  ANALYZING_INTENT: <Brain className="w-4 h-4 text-amber-400" />,
  PLANNING: <Map className="w-4 h-4 text-purple-400" />,
  SELECTING_MODEL: <Cpu className="w-4 h-4 text-cyan-400" />,
  RETRIEVING_CONTEXT: <Layers className="w-4 h-4 text-emerald-400" />,
  EXECUTING_TOOLS: <Zap className="w-4 h-4 text-yellow-400" />,
  GENERATING_CODE: <Code2 className="w-4 h-4 text-blue-400" />,
  WAITING_FOR_LLM: <Sparkles className="w-4 h-4 text-violet-400" />,
  PROCESSING_RESPONSE: <Terminal className="w-4 h-4 text-gray-400" />,
  STREAMING_RESPONSE: <Sparkles className="w-4 h-4 text-green-400" />,
};

const phaseColors: Record<ThinkingPhase, string> = {
  IDLE: "",
  ANALYZING_INTENT: "from-amber-500 to-orange-500",
  PLANNING: "from-purple-500 to-pink-500",
  SELECTING_MODEL: "from-cyan-500 to-blue-500",
  RETRIEVING_CONTEXT: "from-emerald-500 to-teal-500",
  EXECUTING_TOOLS: "from-yellow-500 to-orange-500",
  GENERATING_CODE: "from-blue-500 to-indigo-500",
  WAITING_FOR_LLM: "from-violet-500 to-purple-500",
  PROCESSING_RESPONSE: "from-gray-500 to-slate-500",
  STREAMING_RESPONSE: "from-green-500 to-emerald-500",
};

export default function ThinkingIndicator({ isLoading, onStop }: ThinkingIndicatorProps) {
  const { phase, message, subMessage, modelName, estimatedTime, progress } = useThinkingStore();
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [phrases, setPhrases] = useState<string[]>([]);

  // Mettre à jour les phrases selon la phase
  useEffect(() => {
    if (phase !== "IDLE") {
      const newPhrases = getAnimatedPhrases(phase);
      setPhrases(newPhrases);
      setCurrentPhraseIndex(0);
    }
  }, [phase]);

  // Rotation des phrases
  useEffect(() => {
    if (!isLoading || phrases.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
    }, 2500); // Change toutes les 2.5 secondes

    return () => clearInterval(interval);
  }, [isLoading, phrases]);

  if (!isLoading || phase === "IDLE") return null;

  const currentIcon = phaseIcons[phase];
  const gradientClass = phaseColors[phase];

  return (
    <div className="flex gap-4 md:gap-6">
      {/* Avatar avec animation */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200 dark:border-[#333537] bg-gray-100 dark:bg-[#1e1f20] shadow-lg relative overflow-hidden">
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${gradientClass} opacity-20`}
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {currentIcon || <Sparkles size={20} className="text-blue-400" />}
        </motion.div>
      </div>

      {/* Contenu principal */}
      <div className="flex flex-col gap-3 min-w-0 flex-1">
        {/* Bulle de statut avec animation de typing */}
        <div className="flex items-center gap-2 rounded-[28px] border border-gray-200 dark:border-[#333537]/40 bg-white dark:bg-[#1e1f20]/60 p-5 shadow-sm dark:backdrop-blur-sm">
          {/* Animation de typing style ChatGPT */}
          <div className="flex items-center gap-1.5">
            <motion.div
              className="h-2 w-2 rounded-full"
              animate={{
                backgroundColor: ["#60a5fa", "#34d399", "#a78bfa", "#60a5fa"],
                scale: [1, 1.2, 1, 1.2, 1],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            />
            <motion.div
              className="h-2 w-2 rounded-full"
              animate={{
                backgroundColor: ["#34d399", "#a78bfa", "#60a5fa", "#34d399"],
                scale: [1, 1.2, 1, 1.2, 1],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            />
            <motion.div
              className="h-2 w-2 rounded-full"
              animate={{
                backgroundColor: ["#a78bfa", "#60a5fa", "#34d399", "#a78bfa"],
                scale: [1, 1.2, 1, 1.2, 1],
              }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            />
          </div>

          {/* Phrase animée */}
          <div className="ml-3 flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.p
                key={`${phase}-${currentPhraseIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-gray-600 dark:text-gray-300 truncate"
              >
                {phrases[currentPhraseIndex] || message}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Détails de la phase */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="flex flex-col gap-2 pl-2"
        >
          {/* Badge de phase */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent border border-gray-200 dark:border-gray-700`}>
              {currentIcon && <span className="opacity-60">{currentIcon}</span>}
              {subMessage}
            </span>
            
            {modelName && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
                <Cpu className="w-3 h-3" />
                {modelName}
              </span>
            )}
            
            {estimatedTime && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs text-gray-500 dark:text-gray-400">
                ~{estimatedTime}
              </span>
            )}
          </div>

          {/* Barre de progression améliorée */}
          {progress > 0 && (
            <div className="w-full max-w-md">
              {/* Container avec glow effect */}
              <div className="relative">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                  {/* Barre principale avec gradient animé */}
                  <motion.div
                    className={`h-full bg-gradient-to-r ${gradientClass} relative`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ 
                      duration: 0.3,
                      ease: "easeOut"
                    }}
                  >
                    {/* Effet shimmer */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ 
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                    />
                    {/* Pointe brillante */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg shadow-white/50" />
                  </motion.div>
                </div>
                
                {/* Glow sous la barre */}
                <motion.div
                  className={`absolute -inset-1 bg-gradient-to-r ${gradientClass} rounded-full opacity-20 blur-sm -z-10`}
                  animate={{ opacity: [0.1, 0.3, 0.1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              
              {/* Info sous la barre */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {progress < 15 && "Analyse en cours..."}
                  {progress >= 15 && progress < 35 && "Planification..."}
                  {progress >= 35 && progress < 60 && "Préparation..."}
                  {progress >= 60 && progress < 85 && "Génération..."}
                  {progress >= 85 && progress < 100 && "Finalisation..."}
                  {progress >= 100 && "Terminé !"}
                </p>
                <p className="text-xs font-bold bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent">
                  {Math.round(progress)}%
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Bouton d'arrêt */}
        {onStop && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={onStop}
            className="flex w-fit items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-600 dark:text-red-300 transition-all hover:bg-red-500/16"
          >
            <div className="h-2 w-2 rounded-sm bg-red-500" />
            Arrêter la génération
          </motion.button>
        )}
      </div>
    </div>
  );
}
