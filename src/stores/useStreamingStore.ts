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

  // Tampon interne pour le batching (non exposé dans l'UI)
  _pendingChunks: string;
  _rafId: number | null;

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
  _pendingChunks: "",
  _rafId: null,

  startStreaming: (messageId: string) => {
    // Annuler tout RAF en attente
    const prev = get()._rafId;
    if (prev !== null) cancelAnimationFrame(prev);
    set({
      isStreaming: true,
      streamedText: "",
      currentMessageId: messageId,
      startTime: Date.now(),
      chunkCount: 0,
      tokensPerSecond: 0,
      _pendingChunks: "",
      _rafId: null,
    });
  },

  /**
   * Accumule les deltas entrants et les applique en un seul setState par
   * frame d'animation (≈16ms / 60fps) pour éviter un re-render par token.
   */
  addChunk: (chunk: string) => {
    const state = get();
    // Accumuler dans le tampon interne sans déclencher de re-render
    const newPending = state._pendingChunks + chunk;

    if (state._rafId !== null) {
      // Un flush est déjà planifié : on met juste à jour le tampon
      // (pas de set → pas de re-render)
      // On passe par une ref interne pour éviter la closure stale
      useStreamingStore.setState({ _pendingChunks: newPending });
      return;
    }

    // Planifier un flush au prochain frame
    const rafId = requestAnimationFrame(() => {
      const s = get();
      const pending = s._pendingChunks;
      if (!pending) {
        useStreamingStore.setState({ _rafId: null });
        return;
      }
      const newText = s.streamedText + pending;
      const newChunkCount = s.chunkCount + 1;
      const duration = (Date.now() - s.startTime) / 1000;
      const tokens = newText.length / 4;
      const tps = duration > 0 ? tokens / duration : 0;
      set({
        streamedText: newText,
        chunkCount: newChunkCount,
        tokensPerSecond: Math.round(tps * 10) / 10,
        _pendingChunks: "",
        _rafId: null,
      });
    });

    useStreamingStore.setState({ _pendingChunks: newPending, _rafId: rafId as unknown as number });
  },

  appendText: (text: string) => {
    set((state) => ({
      streamedText: state.streamedText + text,
    }));
  },

  completeStreaming: () => {
    // Flush immédiat des chunks en attente avant de clore
    const state = get();
    if (state._rafId !== null) cancelAnimationFrame(state._rafId);
    if (state._pendingChunks) {
      set((s) => ({
        streamedText: s.streamedText + s._pendingChunks,
        _pendingChunks: "",
        _rafId: null,
        isStreaming: false,
      }));
    } else {
      set({ isStreaming: false, _rafId: null });
    }
  },

  cancelStreaming: () => {
    const state = get();
    if (state._rafId !== null) cancelAnimationFrame(state._rafId);
    set({
      isStreaming: false,
      streamedText: "",
      currentMessageId: null,
      _pendingChunks: "",
      _rafId: null,
    });
  },

  reset: () => {
    const state = get();
    if (state._rafId !== null) cancelAnimationFrame(state._rafId);
    set({
      isStreaming: false,
      streamedText: "",
      currentMessageId: null,
      startTime: 0,
      chunkCount: 0,
      tokensPerSecond: 0,
      _pendingChunks: "",
      _rafId: null,
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
