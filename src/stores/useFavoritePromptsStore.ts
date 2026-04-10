/**
 * Store pour les prompts favoris
 * Permet de sauvegarder et réutiliser les prompts les plus utiles
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FavoritePrompt {
  id: string;
  prompt: string;
  title: string;
  description?: string;
  category: string;
  tags: string[];
  usageCount: number;
  lastUsed: number;
  createdAt: number;
  isBuiltIn: boolean;
}

interface FavoritePromptsState {
  favorites: FavoritePrompt[];
  categories: string[];
  recentPrompts: string[];
  
  // Actions
  addFavorite: (prompt: Omit<FavoritePrompt, "id" | "usageCount" | "lastUsed" | "createdAt">) => void;
  removeFavorite: (id: string) => void;
  updateFavorite: (id: string, updates: Partial<FavoritePrompt>) => void;
  incrementUsage: (id: string) => void;
  addRecent: (prompt: string) => void;
  searchFavorites: (query: string) => FavoritePrompt[];
  getFavoritesByCategory: (category: string) => FavoritePrompt[];
  getMostUsed: (limit?: number) => FavoritePrompt[];
  getRecentFavorites: (limit?: number) => FavoritePrompt[];
  reorderFavorites: (orderedIds: string[]) => void;
  exportFavorites: () => string;
  importFavorites: (json: string) => void;
  addCategory: (category: string) => void;
  removeCategory: (category: string) => void;
}

const BUILTIN_PROMPTS: Omit<FavoritePrompt, "id" | "usageCount" | "lastUsed" | "createdAt">[] = [
  {
    prompt: "Charge le cadastre de la commune [nom]",
    title: "Charger cadastre",
    description: "Charge les données cadastrales d'une commune",
    category: "Données",
    tags: ["cadastre", "import", " données officielles"],
    isBuiltIn: true,
  },
  {
    prompt: "Crée un buffer de [distance]m autour de la couche [nom]",
    title: "Buffer personnalisable",
    description: "Crée une zone tampon autour d'une couche",
    category: "Analyse",
    tags: ["buffer", "tampon", "proximité"],
    isBuiltIn: true,
  },
  {
    prompt: "Calcule la surface totale et le périmètre de [couche]",
    title: "Calcul surface/périmètre",
    description: "Ajoute les attributs de surface et périmètre",
    category: "Analyse",
    tags: ["calcul", "surface", "périmètre", "géométrie"],
    isBuiltIn: true,
  },
  {
    prompt: "Exporte la couche [nom] en GeoJSON avec le CRS [EPSG]",
    title: "Export GeoJSON",
    description: "Exporte une couche au format GeoJSON",
    category: "Export",
    tags: ["export", "geojson", "format"],
    isBuiltIn: true,
  },
  {
    prompt: "Crée une grille d'inventaire forestier de [taille]m avec placettes de [rayon]m",
    title: "Grille forestière",
    description: "Génère une grille d'inventaire avec placettes",
    category: "Forêt",
    tags: ["inventaire", "forêt", "placettes", "grille"],
    isBuiltIn: true,
  },
  {
    prompt: "Analyse le NDVI et identifie les zones de stress végétal",
    title: "Analyse NDVI",
    description: "Analyse la santé de la végétation",
    category: "Forêt",
    tags: ["ndvi", "télédétection", "forêt", "santé"],
    isBuiltIn: true,
  },
  {
    prompt: "Fusionne les couches [couche1] et [couche2] en une seule",
    title: "Fusion couches",
    description: "Fusionne deux couches vectorielles",
    category: "Traitement",
    tags: ["fusion", "merge", "union"],
    isBuiltIn: true,
  },
  {
    prompt: "Applique une symbologie catégorisée sur [couche] selon [champ]",
    title: "Symbologie catégorisée",
    description: "Applique un style avec couleurs par catégorie",
    category: "Visualisation",
    tags: ["style", "symbologie", "couleurs", "catégories"],
    isBuiltIn: true,
  },
  {
    prompt: "Calcule les statistiques zonales de [raster] sur [zones]",
    title: "Statistiques zonales",
    description: "Calcule des stats raster par zone",
    category: "Analyse",
    tags: ["statistiques", "zonales", "raster", "analyse"],
    isBuiltIn: true,
  },
  {
    prompt: "Reprojète toutes les couches en EPSG:2154 (Lambert 93)",
    title: "Reprojection L93",
    description: "Reprojette les couches en Lambert 93",
    category: "Traitement",
    tags: ["reprojection", "crs", "lambert93", "epsg:2154"],
    isBuiltIn: true,
  },
];

export const useFavoritePromptsStore = create<FavoritePromptsState>()(
  persist(
    (set, get) => ({
      favorites: BUILTIN_PROMPTS.map((p, idx) => ({
        ...p,
        id: `builtin_${idx}`,
        usageCount: 0,
        lastUsed: 0,
        createdAt: Date.now(),
      })),
      categories: ["Données", "Analyse", "Traitement", "Export", "Import", "Visualisation", "Forêt"],
      recentPrompts: [],

      addFavorite: (prompt) => {
        const now = Date.now();
        const newFavorite: FavoritePrompt = {
          ...prompt,
          id: `fav_${now}_${Math.random().toString(36).substr(2, 9)}`,
          usageCount: 0,
          lastUsed: 0,
          createdAt: now,
        };

        set(state => ({
          favorites: [...state.favorites, newFavorite],
        }));
      },

      removeFavorite: (id) => {
        set(state => ({
          favorites: state.favorites.filter(f => f.id !== id || f.isBuiltIn),
        }));
      },

      updateFavorite: (id, updates) => {
        set(state => ({
          favorites: state.favorites.map(f =>
            f.id === id ? { ...f, ...updates } : f
          ),
        }));
      },

      incrementUsage: (id) => {
        const now = Date.now();
        set(state => ({
          favorites: state.favorites.map(f =>
            f.id === id
              ? { ...f, usageCount: f.usageCount + 1, lastUsed: now }
              : f
          ),
        }));
      },

      addRecent: (prompt) => {
        set(state => ({
          recentPrompts: [prompt, ...state.recentPrompts.filter(p => p !== prompt)].slice(0, 20),
        }));
      },

      searchFavorites: (query) => {
        const { favorites } = get();
        const queryLower = query.toLowerCase();
        
        return favorites.filter(f =>
          f.title.toLowerCase().includes(queryLower) ||
          f.prompt.toLowerCase().includes(queryLower) ||
          f.description?.toLowerCase().includes(queryLower) ||
          f.tags.some(t => t.toLowerCase().includes(queryLower))
        );
      },

      getFavoritesByCategory: (category) => {
        return get().favorites.filter(f => f.category === category);
      },

      getMostUsed: (limit = 10) => {
        return [...get().favorites]
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, limit);
      },

      getRecentFavorites: (limit = 10) => {
        return [...get().favorites]
          .filter(f => f.lastUsed > 0)
          .sort((a, b) => b.lastUsed - a.lastUsed)
          .slice(0, limit);
      },

      reorderFavorites: (orderedIds) => {
        set(state => {
          const orderedMap = new Map(orderedIds.map((id, idx) => [id, idx]));
          return {
            favorites: [...state.favorites].sort(
              (a, b) => (orderedMap.get(a.id) ?? 0) - (orderedMap.get(b.id) ?? 0)
            ),
          };
        });
      },

      exportFavorites: () => {
        const { favorites } = get();
        const exportData = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          favorites: favorites.filter(f => !f.isBuiltIn),
        };
        return JSON.stringify(exportData, null, 2);
      },

      importFavorites: (json) => {
        try {
          const data = JSON.parse(json);
          if (data.favorites && Array.isArray(data.favorites)) {
            const now = Date.now();
            const imported = data.favorites.map((f: any, idx: number) => ({
              ...f,
              id: `imported_${now}_${idx}`,
              isBuiltIn: false,
              usageCount: 0,
              lastUsed: 0,
              createdAt: now,
            }));
            
            set(state => ({
              favorites: [...state.favorites, ...imported],
            }));
          }
        } catch (e) {
          console.error("[FavoritePrompts] Erreur import:", e);
        }
      },

      addCategory: (category) => {
        set(state => ({
          categories: [...new Set([...state.categories, category])],
        }));
      },

      removeCategory: (category) => {
        set(state => ({
          categories: state.categories.filter(c => c !== category),
          // Réassigner les favoris de cette catégorie
          favorites: state.favorites.map(f =>
            f.category === category ? { ...f, category: "Autre" } : f
          ),
        }));
      },
    }),
    {
      name: "qgisai-favorite-prompts",
      partialize: (state) => ({
        favorites: state.favorites,
        categories: state.categories,
        recentPrompts: state.recentPrompts,
      }),
    }
  )
);
