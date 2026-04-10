/**
 * Store pour le système de feedback utilisateur post-action
 * Collecte les retours pour améliorer l'IA
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FeedbackRating = "helpful" | "not-helpful" | "needs-improvement";

export interface ActionFeedback {
  id: string;
  timestamp: number;
  userMessage: string;
  aiResponse: string;
  intent?: string;
  codeGenerated?: string;
  codeExecuted?: boolean;
  executionSuccess?: boolean;
  rating?: FeedbackRating;
  comment?: string;
  suggestedCorrection?: string;
  duration: number; // Durée de l'action en ms
}

interface FeedbackState {
  // Historique des feedbacks
  feedbacks: ActionFeedback[];
  
  // Statistiques agrégées
  stats: {
    totalActions: number;
    helpfulCount: number;
    notHelpfulCount: number;
    needsImprovementCount: number;
    averageDuration: number;
    successRate: number;
  };
  
  // Actions
  startAction: (userMessage: string, aiResponse: string) => string;
  endAction: (actionId: string, success: boolean) => void;
  submitFeedback: (actionId: string, rating: FeedbackRating, comment?: string, correction?: string) => void;
  getRecentFeedbacks: (limit?: number) => ActionFeedback[];
  getFeedbackStats: () => FeedbackState["stats"];
  exportFeedbacks: () => string;
  clearFeedbacks: () => void;
}

export const useFeedbackStore = create<FeedbackState>()(
  persist(
    (set, get) => ({
      feedbacks: [],
      stats: {
        totalActions: 0,
        helpfulCount: 0,
        notHelpfulCount: 0,
        needsImprovementCount: 0,
        averageDuration: 0,
        successRate: 0,
      },

      startAction: (userMessage, aiResponse) => {
        const actionId = `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const newFeedback: ActionFeedback = {
          id: actionId,
          timestamp: Date.now(),
          userMessage,
          aiResponse,
          duration: 0,
        };

        set(state => ({
          feedbacks: [newFeedback, ...state.feedbacks],
          stats: {
            ...state.stats,
            totalActions: state.stats.totalActions + 1,
          },
        }));

        return actionId;
      },

      endAction: (actionId, success) => {
        set(state => {
          const feedback = state.feedbacks.find(f => f.id === actionId);
          if (!feedback) return state;

          const duration = Date.now() - feedback.timestamp;
          
          const updatedFeedbacks = state.feedbacks.map(f =>
            f.id === actionId
              ? { ...f, codeExecuted: true, executionSuccess: success, duration }
              : f
          );

          // Recalculer les stats
          const executedFeedbacks = updatedFeedbacks.filter(f => f.codeExecuted);
          const successCount = executedFeedbacks.filter(f => f.executionSuccess).length;
          
          return {
            feedbacks: updatedFeedbacks,
            stats: {
              ...state.stats,
              successRate: executedFeedbacks.length > 0
                ? successCount / executedFeedbacks.length
                : 0,
              averageDuration: executedFeedbacks.length > 0
                ? executedFeedbacks.reduce((acc, f) => acc + f.duration, 0) / executedFeedbacks.length
                : 0,
            },
          };
        });
      },

      submitFeedback: (actionId, rating, comment, correction) => {
        set(state => {
          const updatedFeedbacks = state.feedbacks.map(f =>
            f.id === actionId
              ? { ...f, rating, comment, suggestedCorrection: correction }
              : f
          );

          // Mettre à jour les stats
          const ratedFeedbacks = updatedFeedbacks.filter(f => f.rating);
          
          return {
            feedbacks: updatedFeedbacks,
            stats: {
              ...state.stats,
              helpfulCount: ratedFeedbacks.filter(f => f.rating === "helpful").length,
              notHelpfulCount: ratedFeedbacks.filter(f => f.rating === "not-helpful").length,
              needsImprovementCount: ratedFeedbacks.filter(f => f.rating === "needs-improvement").length,
            },
          };
        });
      },

      getRecentFeedbacks: (limit = 10) => {
        return get().feedbacks
          .filter(f => f.rating !== undefined)
          .slice(0, limit);
      },

      getFeedbackStats: () => {
        return get().stats;
      },

      exportFeedbacks: () => {
        const data = {
          exportDate: new Date().toISOString(),
          stats: get().stats,
          feedbacks: get().feedbacks,
        };
        return JSON.stringify(data, null, 2);
      },

      clearFeedbacks: () => {
        set({
          feedbacks: [],
          stats: {
            totalActions: 0,
            helpfulCount: 0,
            notHelpfulCount: 0,
            needsImprovementCount: 0,
            averageDuration: 0,
            successRate: 0,
          },
        });
      },
    }),
    {
      name: "qgisai-feedback",
      partialize: (state) => ({
        feedbacks: state.feedbacks.slice(0, 100), // Garder seulement les 100 derniers
        stats: state.stats,
      }),
    }
  )
);
