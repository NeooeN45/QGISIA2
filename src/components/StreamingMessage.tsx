/**
 * Composant pour afficher un message en streaming temps réel
 * Affiche le texte au fur et à mesure qu'il arrive du LLM
 */

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useStreamingStore } from "../stores/useStreamingStore";
import { cn } from "@/src/lib/utils";
import { Loader2, Zap } from "lucide-react";

interface StreamingMessageProps {
  className?: string;
}

export default function StreamingMessage({ className }: StreamingMessageProps) {
  const { isStreaming, streamedText, tokensPerSecond } = useStreamingStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand le texte augmente
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamedText]);

  if (!isStreaming && !streamedText) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "w-full max-w-3xl mx-auto",
        className
      )}
    >
      <div className="flex gap-4">
        {/* Avatar QGISAI+ */}
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <span className="text-white font-bold text-sm">AI</span>
        </div>

        {/* Contenu du message */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-800/80 backdrop-blur rounded-2xl rounded-tl-none px-5 py-4 border border-white/10 shadow-xl">
            {/* Header avec statut */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
              <Loader2 size={14} className="text-emerald-400 animate-spin" />
              <span className="text-xs font-medium text-emerald-400">
                Génération en cours...
              </span>
              {tokensPerSecond > 0 && (
                <span className="text-xs text-white/40 ml-auto">
                  {tokensPerSecond} tokens/s
                </span>
              )}
            </div>

            {/* Texte streaming avec effet curseur */}
            <div
              ref={scrollRef}
              className="prose prose-invert prose-sm max-w-none overflow-y-auto max-h-96"
            >
              <p className="text-white/90 whitespace-pre-wrap leading-relaxed">
                {streamedText}
                {isStreaming && (
                  <span className="inline-block w-2 h-4 bg-emerald-400 animate-pulse ml-1 align-middle" />
                )}
              </p>
            </div>

            {/* Footer avec animation */}
            {isStreaming && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5">
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-white/40">
                  QGISAI+ réfléchit...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
