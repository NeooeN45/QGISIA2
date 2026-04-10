/**
 * Composant pour afficher un message en streaming temps réel
 * Affiche le texte au fur et à mesure qu'il arrive du LLM
 * S'intègre parfaitement avec le design du Chat
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStreamingStore } from "../stores/useStreamingStore";
import { useThinkingStore } from "../stores/useThinkingStore";
import { cn } from "@/src/lib/utils";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

interface StreamingMessageProps {
  className?: string;
}

export default function StreamingMessage({ className }: StreamingMessageProps) {
  const { isStreaming, streamedText, tokensPerSecond, chunkCount } = useStreamingStore();
  const { progress: thinkingProgress, phase: thinkingPhase } = useThinkingStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand le texte augmente
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    // Scroll global du chat aussi
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [streamedText]);

  // Afficher dès qu'on est en streaming (même sans texte encore) ou qu'il y a du texte
  const shouldRender = isStreaming || streamedText.length > 0;
  
  // Si on ne devrait pas rendre, retourner une div vide pour permettre les animations
  if (!shouldRender) {
    return <div />;
  }

  // Calculer la progression combinée (thinking + streaming)
  const combinedProgress = isStreaming 
    ? Math.min(95 + (streamedText.length / 100), 99) // Progression basée sur taille texte
    : thinkingProgress;

  // Déterminer si on vient juste de commencer le streaming (transition)
  const isTransitioning = isStreaming && thinkingPhase === "STREAMING_RESPONSE";

  return (
    <motion.div
      ref={contentRef}
      layout
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.99 }}
      transition={{ 
        duration: 0.15, 
        ease: "easeOut",
        layout: { duration: 0.2 }
      }}
      className={cn(
        "w-full max-w-3xl mx-auto",
        className
      )}
    >
      <div className="flex gap-4 md:gap-6">
        {/* Avatar QGISAI+ avec animation de transition */}
        <motion.div 
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gray-200 dark:border-[#333537] bg-gray-100 dark:bg-[#1e1f20] shadow-lg relative overflow-hidden"
          animate={isStreaming ? {
            boxShadow: [
              "0 0 0 0 rgba(16, 185, 129, 0)",
              "0 0 0 4px rgba(16, 185, 129, 0.2)",
              "0 0 0 0 rgba(16, 185, 129, 0)",
            ]
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 opacity-20"
            animate={{ opacity: isStreaming ? [0.2, 0.4, 0.2] : 0.2 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            animate={{ 
              scale: isStreaming ? [1, 1.1, 1] : 1,
              rotate: isStreaming ? [0, 5, -5, 0] : 0,
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {isStreaming ? (
              <Sparkles size={20} className="text-emerald-400" />
            ) : (
              <CheckCircle2 size={20} className="text-emerald-400" />
            )}
          </motion.div>
        </motion.div>

        {/* Contenu du message */}
        <div className="flex-1 min-w-0">
          <div className="rounded-[28px] border border-gray-200 dark:border-[#333537]/40 bg-white dark:bg-[#1e1f20]/60 p-5 shadow-sm dark:backdrop-blur-sm">
            {/* Header avec statut et métriques */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <>
                    <Loader2 size={14} className="text-emerald-400 animate-spin" />
                    <span className="text-xs font-medium text-emerald-500">
                      Génération en cours...
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-500">
                      Réponse complète
                    </span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {tokensPerSecond > 0 && isStreaming && (
                  <span className="text-xs text-gray-400 font-mono">
                    {tokensPerSecond} tok/s
                  </span>
                )}
                {chunkCount > 0 && (
                  <span className="text-xs text-gray-400">
                    {streamedText.length} caractères
                  </span>
                )}
              </div>
            </div>

            {/* Barre de progression du streaming */}
            <AnimatePresence>
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-3"
                >
                  <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 relative"
                      initial={{ width: "95%" }}
                      animate={{ width: `${combinedProgress}%` }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                        animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Texte streaming avec curseur */}
            <div
              ref={scrollRef}
              className="prose prose-invert prose-sm max-w-none overflow-y-auto max-h-[60vh] scrollbar-thin"
            >
              <div className="text-gray-700 dark:text-gray-200 whitespace-pre-wrap leading-relaxed font-light">
                {streamedText}
                {isStreaming && (
                  <motion.span 
                    className="inline-block w-2 h-5 bg-emerald-400 ml-0.5 align-middle"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </div>
            </div>

            {/* Footer avec animation pulse */}
            <AnimatePresence>
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-white/5"
                >
                  <div className="flex gap-1">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [0.4, 1, 0.4],
                        }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    QGISAI+ écrit...
                  </span>
                  {chunkCount > 0 && (
                    <span className="text-xs text-gray-400 ml-auto">
                      {chunkCount} chunks reçus
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
