/**
 * Widget de feedback post-action
 * Demande à l'utilisateur d'évaluer la réponse de l'IA
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  Send,
  X,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useFeedbackStore, FeedbackRating } from "../stores/useFeedbackStore";

interface FeedbackWidgetProps {
  actionId?: string;
  onDismiss?: () => void;
}

export default function FeedbackWidget({ actionId, onDismiss }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");
  const [correction, setCorrection] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const { submitFeedback } = useFeedbackStore();

  const handleSubmit = () => {
    if (!actionId || !rating) return;
    
    submitFeedback(actionId, rating, comment || undefined, correction || undefined);
    setIsSubmitted(true);
    
    setTimeout(() => {
      onDismiss?.();
    }, 2000);
  };

  const handleRating = (r: FeedbackRating) => {
    setRating(r);
    if (r === "not-helpful" || r === "needs-improvement") {
      setShowDetails(true);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
      >
        <CheckCircle size={16} className="text-emerald-400" />
        <span className="text-sm text-emerald-400">Merci pour votre retour !</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-xl"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/30">
            <MessageSquare size={16} className="text-emerald-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">Cette réponse vous a-t-elle aidé ?</h4>
            <p className="text-xs text-white/50">Votre retour améliore QGISAI+</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 hover:bg-white/10 rounded transition-colors"
        >
          <X size={16} className="text-white/40" />
        </button>
      </div>

      {/* Rating buttons */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => handleRating("helpful")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all",
            rating === "helpful"
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          )}
        >
          <ThumbsUp size={16} />
          <span className="text-sm">Utile</span>
        </button>
        
        <button
          onClick={() => handleRating("needs-improvement")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all",
            rating === "needs-improvement"
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          )}
        >
          <AlertCircle size={16} />
          <span className="text-sm">À améliorer</span>
        </button>
        
        <button
          onClick={() => handleRating("not-helpful")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all",
            rating === "not-helpful"
              ? "bg-red-500/20 text-red-400 border border-red-500/40"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          )}
        >
          <ThumbsDown size={16} />
          <span className="text-sm">Pas utile</span>
        </button>
      </div>

      {/* Details form */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3 mb-4"
          >
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Que s'est-il passé ? (optionnel)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Décrivez le problème..."
                className="w-full h-16 px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
            
            <div>
              <label className="block text-xs text-white/60 mb-1">
                Que vouliez-vous vraiment ? (optionnel)
              </label>
              <textarea
                value={correction}
                onChange={(e) => setCorrection(e.target.value)}
                placeholder="Décrivez ce que vous attendiez..."
                className="w-full h-16 px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit button */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!rating}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            rating
              ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
              : "bg-white/10 text-white/40 cursor-not-allowed"
          )}
        >
          <Send size={14} />
          Envoyer
        </button>
      </div>
    </motion.div>
  );
}

// Hook pour utiliser le feedback
export const useActionFeedback = () => {
  const { startAction, endAction } = useFeedbackStore();
  const [currentActionId, setCurrentActionId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const beginAction = (userMessage: string, aiResponse: string) => {
    const actionId = startAction(userMessage, aiResponse);
    setCurrentActionId(actionId);
    setShowFeedback(false);
    return actionId;
  };

  const completeAction = (success: boolean) => {
    if (currentActionId) {
      endAction(currentActionId, success);
      setShowFeedback(true);
    }
  };

  const dismissFeedback = () => {
    setShowFeedback(false);
    setCurrentActionId(null);
  };

  return {
    beginAction,
    completeAction,
    showFeedback,
    currentActionId,
    dismissFeedback,
    FeedbackComponent: showFeedback ? (
      <FeedbackWidget
        actionId={currentActionId || undefined}
        onDismiss={dismissFeedback}
      />
    ) : null,
  };
};
