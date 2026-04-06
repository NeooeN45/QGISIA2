import { create } from "zustand";

import {
  ChatConversation,
  ChatMessage,
  ConversationMode,
  LayerContextScope,
  createConversation,
  createMessage,
  finalizeConversation,
  loadConversationHistory,
  saveConversationHistory,
  sortConversations,
} from "../lib/chat-history";

interface ConversationState {
  conversations: ChatConversation[];
  activeConversationId: string | null;

  // Derived
  activeConversation: () => ChatConversation | null;
  activeMessages: () => ChatMessage[];

  // Actions
  initialize: (welcomeMessage: ChatMessage) => void;
  createNew: (firstMessage: ChatMessage) => void;
  select: (conversationId: string) => void;
  remove: (conversationId: string, fallbackMessage: ChatMessage) => void;
  addUserMessage: (message: ChatMessage) => void;
  addAssistantMessage: (conversationId: string, message: ChatMessage) => void;
  setMode: (mode: ConversationMode) => void;
  toggleLayerSelection: (layerId: string) => void;
  setLayerContextScope: (layerId: string, scope: LayerContextScope) => void;
  setMessageFeedback: (messageId: string, feedback: "like" | "dislike" | null) => void;
  pruneInvalidLayers: (validLayerIds: Set<string>) => void;
  persist: () => void;
}

function updateCollection(
  conversations: ChatConversation[],
  conversationId: string,
  updater: (c: ChatConversation) => ChatConversation,
  options?: { touch?: boolean },
): ChatConversation[] {
  return sortConversations(
    conversations.map((c) =>
      c.id === conversationId ? finalizeConversation(updater(c), options) : c,
    ),
  );
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,

  activeConversation: () => {
    const { conversations, activeConversationId } = get();
    return (
      conversations.find((c) => c.id === activeConversationId) ||
      conversations[0] ||
      null
    );
  },

  activeMessages: () => {
    const conv = get().activeConversation();
    return conv?.messages || [];
  },

  initialize: (welcomeMessage) => {
    const stored = loadConversationHistory();
    if (stored.conversations.length > 0) {
      set({
        conversations: stored.conversations,
        activeConversationId:
          stored.activeConversationId || stored.conversations[0].id,
      });
      return;
    }

    const first = createConversation(welcomeMessage);
    set({ conversations: [first], activeConversationId: first.id });
  },

  createNew: (firstMessage) => {
    const conv = createConversation(firstMessage);
    set((state) => ({
      conversations: [conv, ...state.conversations],
      activeConversationId: conv.id,
    }));
  },

  select: (conversationId) => set({ activeConversationId: conversationId }),

  remove: (conversationId, fallbackMessage) => {
    const { conversations, activeConversationId } = get();
    const remaining = conversations.filter((c) => c.id !== conversationId);

    if (remaining.length === 0) {
      const fresh = createConversation(fallbackMessage);
      set({ conversations: [fresh], activeConversationId: fresh.id });
      return;
    }

    set({
      conversations: sortConversations(remaining),
      activeConversationId:
        activeConversationId === conversationId
          ? remaining[0].id
          : activeConversationId,
    });
  },

  addUserMessage: (message) => {
    const conv = get().activeConversation();
    if (!conv) return;

    set((state) => ({
      conversations: updateCollection(
        state.conversations,
        conv.id,
        (c) => ({ ...c, messages: [...c.messages, message] }),
      ),
    }));
  },

  addAssistantMessage: (conversationId, message) =>
    set((state) => ({
      conversations: updateCollection(
        state.conversations,
        conversationId,
        (c) => ({ ...c, messages: [...c.messages, message] }),
      ),
    })),

  setMode: (mode) => {
    const { activeConversationId: id } = get();
    if (!id) return;

    set((state) => ({
      conversations: updateCollection(
        state.conversations,
        id,
        (c) => ({ ...c, mode }),
        { touch: false },
      ),
    }));
  },

  toggleLayerSelection: (layerId) => {
    const { activeConversationId: id } = get();
    if (!id) return;

    set((state) => ({
      conversations: updateCollection(state.conversations, id, (c) => {
        const already = c.selectedLayerIds.includes(layerId);
        return {
          ...c,
          selectedLayerIds: already
            ? c.selectedLayerIds.filter((i) => i !== layerId)
            : [...c.selectedLayerIds, layerId],
          layerContextById: already
            ? Object.fromEntries(
                Object.entries(c.layerContextById).filter(
                  ([i]) => i !== layerId,
                ),
              )
            : { ...c.layerContextById, [layerId]: "layer" as const },
        };
      }),
    }));
  },

  setLayerContextScope: (layerId, scope) => {
    const { activeConversationId: id } = get();
    if (!id) return;

    set((state) => ({
      conversations: updateCollection(
        state.conversations,
        id,
        (c) => ({
          ...c,
          layerContextById: { ...c.layerContextById, [layerId]: scope },
        }),
        { touch: false },
      ),
    }));
  },

  pruneInvalidLayers: (validLayerIds) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        const nextSelected = c.selectedLayerIds.filter((id) =>
          validLayerIds.has(id),
        );
        const nextContext = Object.fromEntries(
          Object.entries(c.layerContextById).filter(([id]) =>
            validLayerIds.has(id),
          ),
        );

        if (
          nextSelected.length === c.selectedLayerIds.length &&
          Object.keys(nextContext).length ===
            Object.keys(c.layerContextById).length
        ) {
          return c;
        }

        return {
          ...c,
          selectedLayerIds: nextSelected,
          layerContextById: nextContext,
        };
      }),
    })),

  setMessageFeedback: (messageId, feedback) => {
    const { activeConversationId: id } = get();
    if (!id) return;

    set((state) => ({
      conversations: updateCollection(
        state.conversations,
        id,
        (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, feedback } : m,
          ),
        }),
        { touch: true },
      ),
    }));
  },

  persist: () => {
    const { conversations, activeConversationId } = get();
    if (conversations.length > 0) {
      saveConversationHistory(conversations, activeConversationId);
    }
  },
}));
