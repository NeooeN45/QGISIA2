/**
 * Store pour la mémoire de conversation multi-tours
 * Maintient le contexte entre les messages pour des conversations naturelles
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserIntent } from "../lib/prompt-intelligence";

export interface ConversationContext {
  // Contexte de la session
  sessionId: string;
  startedAt: number;
  lastMessageAt: number;
  messageCount: number;

  // Contexte métier
  lastIntent?: UserIntent;
  lastSuccessIntent?: UserIntent;
  lastFailedIntent?: UserIntent;
  
  // Données QGIS
  activeLayers: string[];
  lastModifiedLayer?: string;
  lastCreatedLayer?: string;
  lastExportedFormat?: string;
  
  // Paramètres récurrents
  lastDistance?: number;
  lastBufferRadius?: number;
  lastCRS?: string;
  lastExportPath?: string;
  
  // Questions en attente
  pendingQuestions: string[];
  
  // Historique des actions
  recentActions: {
    action: string;
    timestamp: number;
    success: boolean;
    layer?: string;
  }[];
}

export interface MemoryEntry {
  id: string;
  timestamp: number;
  userMessage: string;
  aiResponse: string;
  intent?: UserIntent;
  entities?: Record<string, any>;
  codeGenerated?: string;
  codeExecuted?: boolean;
  executionResult?: "success" | "error" | "pending";
}

interface ConversationMemoryState {
  // Contexte actuel
  currentContext: ConversationContext;
  
  // Historique de la conversation courante
  currentThread: MemoryEntry[];
  
  // Threads précédents (sessions passées)
  savedThreads: {
    id: string;
    title: string;
    startedAt: number;
    endedAt: number;
    messageCount: number;
    preview: string;
  }[];
  
  // Mémoire à long terme (patterns utilisateur)
  learnedPatterns: {
    pattern: string;
    intent: UserIntent;
    frequency: number;
    lastUsed: number;
  }[];
  
  // Actions
  initializeSession: () => void;
  addMessage: (entry: Omit<MemoryEntry, "id" | "timestamp">) => void;
  updateContext: (update: Partial<ConversationContext>) => void;
  addAction: (action: string, success: boolean, layer?: string) => void;
  getRelevantContext: (currentMessage: string) => string;
  resolvePendingQuestion: (question: string, answer: string) => void;
  saveCurrentThread: (title: string) => void;
  loadThread: (threadId: string) => void;
  learnPattern: (pattern: string, intent: UserIntent) => void;
  clearMemory: () => void;
}

const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const createDefaultContext = (): ConversationContext => ({
  sessionId: generateSessionId(),
  startedAt: Date.now(),
  lastMessageAt: Date.now(),
  messageCount: 0,
  pendingQuestions: [],
  activeLayers: [],
  recentActions: [],
});

export const useConversationMemoryStore = create<ConversationMemoryState>()(
  persist(
    (set, get) => ({
      currentContext: createDefaultContext(),
      currentThread: [],
      savedThreads: [],
      learnedPatterns: [],

      initializeSession: () => {
        set({
          currentContext: createDefaultContext(),
          currentThread: [],
        });
      },

      addMessage: (entry) => {
        const newEntry: MemoryEntry = {
          ...entry,
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
        };

        set(state => ({
          currentThread: [...state.currentThread, newEntry],
          currentContext: {
            ...state.currentContext,
            lastMessageAt: Date.now(),
            messageCount: state.currentContext.messageCount + 1,
            lastIntent: entry.intent || state.currentContext.lastIntent,
            ...(entry.executionResult === "success" && { lastSuccessIntent: entry.intent }),
            ...(entry.executionResult === "error" && { lastFailedIntent: entry.intent }),
          },
        }));
      },

      updateContext: (update) => {
        set(state => ({
          currentContext: { ...state.currentContext, ...update },
        }));
      },

      addAction: (action: string, success: boolean, layer?: string) => {
        set(state => ({
          currentContext: {
            ...state.currentContext,
            recentActions: [
              { action, timestamp: Date.now(), success, layer },
              ...state.currentContext.recentActions,
            ].slice(0, 20), // Garder les 20 dernières actions
            ...(layer && { lastModifiedLayer: layer }),
          },
        }));
      },

      getRelevantContext: (currentMessage: string) => {
        const state = get();
        const context = state.currentContext;
        const recentMessages = state.currentThread.slice(-5);

        // Construire un résumé contextuel
        const contextParts: string[] = [];

        // Contexte temporel
        const messageCount = context.messageCount;
        if (messageCount > 0) {
          contextParts.push(`Ceci est le message #${messageCount + 1} de cette conversation.`);
        }

        // Intent précédent
        if (context.lastIntent) {
          contextParts.push(`L'intention précédente était: ${context.lastIntent}.`);
        }

        // Couches actives
        if (context.activeLayers.length > 0) {
          contextParts.push(`Couches actuellement actives: ${context.activeLayers.join(", ")}.`);
        }

        // Dernière couche modifiée
        if (context.lastModifiedLayer) {
          contextParts.push(`Dernière couche modifiée: "${context.lastModifiedLayer}".`);
        }

        // Paramètres récurrents
        if (context.lastBufferRadius && currentMessage.toLowerCase().includes("buffer")) {
          contextParts.push(`Dernier rayon de buffer utilisé: ${context.lastBufferRadius}m.`);
        }

        if (context.lastCRS && (currentMessage.toLowerCase().includes("projection") || currentMessage.toLowerCase().includes("crs"))) {
          contextParts.push(`Dernier CRS utilisé: ${context.lastCRS}.`);
        }

        // Questions en attente
        if (context.pendingQuestions.length > 0) {
          contextParts.push(`Questions en attente de réponse: ${context.pendingQuestions.join("; ")}.`);
        }

        // Messages récents pertinents
        const relevantHistory = recentMessages
          .filter(msg => {
            // Vérifier si le message est pertinent pour la demande actuelle
            const msgText = msg.userMessage.toLowerCase();
            const currentText = currentMessage.toLowerCase();
            
            // Même intention ou sujet similaire
            const hasCommonTerms = msgText.split(" ").some(word => 
              word.length > 3 && currentText.includes(word)
            );
            
            return hasCommonTerms;
          })
          .slice(-2);

        if (relevantHistory.length > 0) {
          contextParts.push("Messages précédents pertinents:");
          relevantHistory.forEach(msg => {
            contextParts.push(`- Utilisateur: "${msg.userMessage}"`);
            if (msg.executionResult) {
              contextParts.push(`  Résultat: ${msg.executionResult}`);
            }
          });
        }

        // Patterns appris
        const learnedPattern = state.learnedPatterns.find(p => 
          currentMessage.toLowerCase().includes(p.pattern.toLowerCase())
        );
        if (learnedPattern) {
          contextParts.push(`Pattern reconnu: "${learnedPattern.pattern}" → intention ${learnedPattern.intent} (utilisé ${learnedPattern.frequency} fois).`);
        }

        return contextParts.join("\n");
      },

      resolvePendingQuestion: (question: string, answer: string) => {
        set(state => ({
          currentContext: {
            ...state.currentContext,
            pendingQuestions: state.currentContext.pendingQuestions.filter(
              q => q !== question
            ),
          },
        }));
      },

      saveCurrentThread: (title: string) => {
        const state = get();
        const threadId = `thread_${Date.now()}`;
        
        const newSavedThread = {
          id: threadId,
          title,
          startedAt: state.currentContext.startedAt,
          endedAt: Date.now(),
          messageCount: state.currentThread.length,
          preview: state.currentThread[0]?.userMessage.slice(0, 100) || "",
        };

        set(state => ({
          savedThreads: [newSavedThread, ...state.savedThreads].slice(0, 20),
        }));
      },

      loadThread: (threadId: string) => {
        // Dans une vraie implémentation, chargerait depuis une base de données
        console.log(`Chargement du thread ${threadId}`);
      },

      learnPattern: (pattern: string, intent: UserIntent) => {
        set(state => {
          const existingPattern = state.learnedPatterns.find(
            p => p.pattern === pattern
          );

          if (existingPattern) {
            return {
              learnedPatterns: state.learnedPatterns.map(p =>
                p.pattern === pattern
                  ? { ...p, frequency: p.frequency + 1, lastUsed: Date.now() }
                  : p
              ),
            };
          }

          return {
            learnedPatterns: [
              ...state.learnedPatterns,
              { pattern, intent, frequency: 1, lastUsed: Date.now() },
            ],
          };
        });
      },

      clearMemory: () => {
        set({
          currentContext: createDefaultContext(),
          currentThread: [],
        });
      },
    }),
    {
      name: "qgisai-conversation-memory",
      partialize: (state) => ({
        savedThreads: state.savedThreads,
        learnedPatterns: state.learnedPatterns,
      }),
    }
  )
);

// Hook pour accéder facilement au contexte
export const useConversationContext = () => {
  const store = useConversationMemoryStore();
  return {
    context: store.currentContext,
    thread: store.currentThread,
    addMessage: store.addMessage,
    updateContext: store.updateContext,
    getRelevantContext: store.getRelevantContext,
  };
};
