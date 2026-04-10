/**
 * Store pour le streaming de réponses LLM
 * Gère l'affichage temps réel des chunks de texte
 */

import { create } from "zustand";

interface StreamingState {
  // État du streaming
  isStreaming: boolean;
  streamedText: string;
  currentMessageId: string | null;
  
  // Métadonnées
  startTime: number;
  chunkCount: number;
  tokensPerSecond: number;
  
  // Actions
  startStreaming: (messageId: string) => void;
  addChunk: (chunk: string) => void;
  appendText: (text: string) => void;
  completeStreaming: () => void;
  cancelStreaming: () => void;
  reset: () => void;
  
  // Getters
  getStats: () => {
    duration: number;
    totalChars: number;
    chunkCount: number;
    tokensPerSecond: number;
  };
}

export const useStreamingStore = create<StreamingState>()((set, get) => ({
  isStreaming: false,
  streamedText: "",
  currentMessageId: null,
  startTime: 0,
  chunkCount: 0,
  tokensPerSecond: 0,

  startStreaming: (messageId: string) => {
    set({
      isStreaming: true,
      streamedText: "",
      currentMessageId: messageId,
      startTime: Date.now(),
      chunkCount: 0,
      tokensPerSecond: 0,
    });
  },

  addChunk: (chunk: string) => {
    const state = get();
    const newChunkCount = state.chunkCount + 1;
    const newText = state.streamedText + chunk;
    
    // Calculer les tokens par seconde (approximation: 4 chars = 1 token)
    const duration = (Date.now() - state.startTime) / 1000;
    const tokens = newText.length / 4;
    const tps = duration > 0 ? tokens / duration : 0;
    
    set({
      streamedText: newText,
      chunkCount: newChunkCount,
      tokensPerSecond: Math.round(tps * 10) / 10,
    });
  },

  appendText: (text: string) => {
    set(state => ({
      streamedText: state.streamedText + text,
    }));
  },

  completeStreaming: () => {
    set({ isStreaming: false });
  },

  cancelStreaming: () => {
    set({
      isStreaming: false,
      streamedText: "",
      currentMessageId: null,
    });
  },

  reset: () => {
    set({
      isStreaming: false,
      streamedText: "",
      currentMessageId: null,
      startTime: 0,
      chunkCount: 0,
      tokensPerSecond: 0,
    });
  },

  getStats: () => {
    const state = get();
    const duration = (Date.now() - state.startTime) / 1000;
    return {
      duration: Math.round(duration * 10) / 10,
      totalChars: state.streamedText.length,
      chunkCount: state.chunkCount,
      tokensPerSecond: state.tokensPerSecond,
    };
  },
}));

// Helper pour créer un ID unique de message
export const createMessageId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
