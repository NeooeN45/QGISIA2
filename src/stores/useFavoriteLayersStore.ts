import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface FavoriteLayer {
  id: string;
  name: string;
  type: string;
  geometryType?: string;
  crs?: string;
  addedAt: number;
}

interface FavoriteLayersStore {
  favoriteLayerIds: Set<string>;
  toggleFavorite: (layerId: string) => void;
  isFavorite: (layerId: string) => boolean;
  clearFavorites: () => void;
}

export const useFavoriteLayersStore = create<FavoriteLayersStore>()(
  persist(
    (set, get) => ({
      favoriteLayerIds: new Set<string>(),
      
      toggleFavorite: (layerId) => {
        const { favoriteLayerIds } = get();
        const newFavorites = new Set(favoriteLayerIds);
        
        if (newFavorites.has(layerId)) {
          newFavorites.delete(layerId);
        } else {
          newFavorites.add(layerId);
        }
        
        set({ favoriteLayerIds: newFavorites });
      },
      
      isFavorite: (layerId) => {
        const { favoriteLayerIds } = get();
        return favoriteLayerIds.has(layerId);
      },
      
      clearFavorites: () => set({ favoriteLayerIds: new Set<string>() }),
    }),
    {
      name: "geoai-favorite-layers-store",
      partialize: (state) => ({ favoriteLayerIds: Array.from(state.favoriteLayerIds) }),
      merge: (persistedState: unknown, currentState) => ({
        ...currentState,
        favoriteLayerIds: new Set((persistedState as FavoriteLayersStore)?.favoriteLayerIds || []),
      }),
    },
  ),
);
