/**
 * Store pour le cache intelligent des réponses
 * Mémorise les réponses aux prompts fréquents pour réponse instantanée
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CachedResponse {
  id: string;
  // Clé de cache (hash du prompt normalisé)
  key: string;
  // Prompt original
  prompt: string;
  // Prompt normalisé utilisé pour la clé
  normalizedPrompt: string;
  // Réponse mémorisée
  response: string;
  // Intent détecté
  intent?: string;
  // Timestamp de création
  createdAt: number;
  // Dernière utilisation
  lastUsed: number;
  // Nombre d'utilisations
  hitCount: number;
  // TTL en millisecondes (défaut: 24h)
  ttl: number;
  // Taille de la réponse (pour gestion mémoire)
  size: number;
}

interface SmartCacheState {
  // Cache stocké (Record pour compatibilité persist)
  cache: Record<string, CachedResponse>;
  
  // Statistiques
  stats: {
    totalCached: number;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    averageResponseTime: number;
    memoryUsed: number; // en bytes
  };
  
  // Configuration
  config: {
    maxCacheSize: number; // Nombre max d'entrées
    defaultTTL: number; // TTL par défaut en ms
    maxResponseSize: number; // Taille max d'une réponse en bytes
    enabled: boolean;
  };
  
  // Actions
  getCachedResponse: (prompt: string) => CachedResponse | null;
  setCachedResponse: (prompt: string, response: string, intent?: string, ttl?: number) => void;
  invalidateCache: (key?: string) => void;
  invalidateByIntent: (intent: string) => void;
  clearExpired: () => number;
  getStats: () => SmartCacheState["stats"];
  updateConfig: (config: Partial<SmartCacheState["config"]>) => void;
  normalizePrompt: (prompt: string) => string;
  generateCacheKey: (normalizedPrompt: string) => string;
}

// Fonction de normalisation du prompt pour la clé de cache
const normalizePrompt = (prompt: string): string => {
  return prompt
    .toLowerCase()
    .trim()
    // Supprimer la ponctuation
    .replace(/[.,!?;:'"()\[\]{}]/g, "")
    // Normaliser les espaces
    .replace(/\s+/g, " ")
    // Supprimer les articles
    .replace(/\b(le|la|les|un|une|des|du|de|la|à|au|aux)\b/g, "")
    .trim();
};

// Générer une clé de cache simple (hash-like)
const generateCacheKey = (normalizedPrompt: string): string => {
  let hash = 0;
  for (let i = 0; i < normalizedPrompt.length; i++) {
    const char = normalizedPrompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir en 32bit entier
  }
  return `cache_${Math.abs(hash).toString(36)}`;
};

// Estimer la taille d'une chaîne en bytes (approximatif)
const estimateSize = (str: string): number => {
  return new Blob([str]).size;
};

export const useSmartCacheStore = create<SmartCacheState>()(
  persist(
    (set, get) => ({
      cache: {},
      stats: {
        totalCached: 0,
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        averageResponseTime: 0,
        memoryUsed: 0,
      },
      config: {
        maxCacheSize: 100,
        defaultTTL: 24 * 60 * 60 * 1000, // 24h
        maxResponseSize: 100 * 1024, // 100KB
        enabled: true,
      },

      normalizePrompt,
      generateCacheKey,

      getCachedResponse: (prompt: string) => {
        const { cache, config } = get();
        
        if (!config.enabled) return null;
        
        const normalizedPrompt = normalizePrompt(prompt);
        const key = generateCacheKey(normalizedPrompt);
        const cached = cache[key];
        
        if (!cached) {
          set(state => ({
            stats: {
              ...state.stats,
              totalMisses: state.stats.totalMisses + 1,
              hitRate: state.stats.totalHits / (state.stats.totalHits + state.stats.totalMisses + 1),
            },
          }));
          return null;
        }
        
        // Vérifier si expiré
        if (Date.now() - cached.createdAt > cached.ttl) {
          const { [key]: _, ...restCache } = cache;
          set(state => ({
            cache: restCache,
            stats: {
              ...state.stats,
              totalMisses: state.stats.totalMisses + 1,
              memoryUsed: state.stats.memoryUsed - cached.size,
            },
          }));
          return null;
        }
        
        // Mettre à jour les stats
        const updatedCache = { ...cache, [key]: { ...cached, hitCount: cached.hitCount + 1, lastUsed: Date.now() } };
        
        set(state => ({
          cache: updatedCache,
          stats: {
            ...state.stats,
            totalHits: state.stats.totalHits + 1,
            hitRate: (state.stats.totalHits + 1) / (state.stats.totalHits + state.stats.totalMisses + 1),
          },
        }));
        
        return updatedCache[key];
      },

      setCachedResponse: (prompt: string, response: string, intent?: string, ttl?: number) => {
        const { cache, config } = get();
        
        if (!config.enabled) return;
        
        // Vérifier la taille
        const size = estimateSize(response);
        if (size > config.maxResponseSize) {
          console.warn(`[SmartCache] Réponse trop grande pour être mise en cache (${size} bytes)`);
          return;
        }
        
        const normalizedPrompt = normalizePrompt(prompt);
        const key = generateCacheKey(normalizedPrompt);
        
        const cachedResponse: CachedResponse = {
          id: `cache_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          key,
          prompt,
          normalizedPrompt,
          response,
          intent,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          hitCount: 0,
          ttl: ttl || config.defaultTTL,
          size,
        };
        
        let newCache = { ...cache, [key]: cachedResponse };
        
        // Limiter la taille du cache (LRU)
        const entries = Object.entries(newCache);
        if (entries.length >= config.maxCacheSize) {
          // Trier par lastUsed et garder les plus récents
          const sorted = entries.sort(([, a], [, b]) => b.lastUsed - a.lastUsed);
          const toKeep = sorted.slice(0, config.maxCacheSize);
          newCache = Object.fromEntries(toKeep);
        }
        
        set(state => ({
          cache: newCache,
          stats: {
            ...state.stats,
            totalCached: Object.keys(newCache).length,
            memoryUsed: Object.values(newCache).reduce((acc, c) => acc + c.size, 0),
          },
        }));
      },

      invalidateCache: (key?: string) => {
        const { cache } = get();
        
        if (key) {
          const cached = cache[key];
          if (cached) {
            const { [key]: _, ...restCache } = cache;
            set(state => ({
              cache: restCache,
              stats: {
                ...state.stats,
                totalCached: Object.keys(restCache).length,
                memoryUsed: state.stats.memoryUsed - cached.size,
              },
            }));
          }
        } else {
          // Vider tout le cache
          const totalSize = Object.values(cache).reduce((acc, c) => acc + c.size, 0);
          set({
            cache: {},
            stats: {
              totalCached: 0,
              totalHits: 0,
              totalMisses: 0,
              hitRate: 0,
              averageResponseTime: 0,
              memoryUsed: 0,
            },
          });
        }
      },

      invalidateByIntent: (intent: string) => {
        const { cache } = get();
        let freedMemory = 0;
        const newCache: Record<string, CachedResponse> = {};
        
        for (const [key, cached] of Object.entries(cache)) {
          if (cached.intent === intent) {
            freedMemory += cached.size;
          } else {
            newCache[key] = cached;
          }
        }
        
        set(state => ({
          cache: newCache,
          stats: {
            ...state.stats,
            totalCached: Object.keys(newCache).length,
            memoryUsed: state.stats.memoryUsed - freedMemory,
          },
        }));
      },

      clearExpired: () => {
        const { cache } = get();
        const now = Date.now();
        let cleared = 0;
        let freedMemory = 0;
        const newCache: Record<string, CachedResponse> = {};
        
        for (const [key, cached] of Object.entries(cache)) {
          if (now - cached.createdAt > cached.ttl) {
            freedMemory += cached.size;
            cleared++;
          } else {
            newCache[key] = cached;
          }
        }
        
        if (cleared > 0) {
          set(state => ({
            cache: newCache,
            stats: {
              ...state.stats,
              totalCached: Object.keys(newCache).length,
              memoryUsed: state.stats.memoryUsed - freedMemory,
            },
          }));
        }
        
        return cleared;
      },

      getStats: () => {
        return get().stats;
      },

      updateConfig: (configUpdate) => {
        set(state => ({
          config: { ...state.config, ...configUpdate },
        }));
      },
    }),
    {
      name: "qgisai-smart-cache",
      partialize: (state) => ({
        // Le cache est déjà un Record, pas besoin de conversion
        cache: state.cache,
        stats: state.stats,
        config: state.config,
      }),
    }
  )
);

// Hook pour utiliser le cache facilement
export const useSmartCache = () => {
  const store = useSmartCacheStore();
  
  const getCachedOrFetch = async (
    prompt: string,
    fetchFn: () => Promise<string>,
    intent?: string
  ): Promise<{ response: string; fromCache: boolean }> => {
    // Vérifier le cache
    const cached = store.getCachedResponse(prompt);
    if (cached) {
      return { response: cached.response, fromCache: true };
    }
    
    // Fetch et mettre en cache
    const startTime = performance.now();
    const response = await fetchFn();
    const duration = performance.now() - startTime;
    
    store.setCachedResponse(prompt, response, intent);
    
    // Mettre à jour le temps moyen
    const stats = store.getStats();
    const newAvg = (stats.averageResponseTime * stats.totalMisses + duration) / (stats.totalMisses + 1);
    store.updateConfig({});
    
    return { response, fromCache: false };
  };
  
  return {
    getCached: store.getCachedResponse,
    setCached: store.setCachedResponse,
    getCachedOrFetch,
    invalidate: store.invalidateCache,
    stats: store.getStats(),
  };
};
