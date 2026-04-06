import { create } from "zustand";

import {
  getLayersCatalog,
  isQgisAvailable,
  LayerSummary,
  LayerDiagnostics,
  getLayerDiagnostics,
  setLayerVisibility,
  setLayerOpacity,
  zoomToLayer,
} from "../lib/qgis";
import { useConversationStore } from "./useConversationStore";

interface LayerState {
  layers: LayerSummary[];
  isRefreshing: boolean;
  diagnosticsById: Record<string, LayerDiagnostics>;
  activeDiagnosticsLayerId: string | null;
  isDiagnosticsLoading: boolean;

  // Actions
  refresh: () => Promise<void>;
  setVisibility: (layerId: string, visible: boolean) => Promise<string | null>;
  setOpacity: (layerId: string, opacity: number) => Promise<string | null>;
  zoom: (layerId: string) => Promise<string | null>;
  inspect: (layerId: string) => Promise<void>;
  closeDiagnostics: () => void;
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: [],
  isRefreshing: false,
  diagnosticsById: {},
  activeDiagnosticsLayerId: null,
  isDiagnosticsLoading: false,

  refresh: async () => {
    if (!isQgisAvailable()) {
      set({ layers: [] });
      useConversationStore.getState().pruneInvalidLayers(new Set());
      return;
    }

    set({ isRefreshing: true });
    try {
      const nextLayers = await getLayersCatalog();
      const validIds = new Set(nextLayers.map((l) => l.id));
      set((state) => ({
        layers: nextLayers,
        diagnosticsById: Object.fromEntries(
          Object.entries(state.diagnosticsById).filter(([id]) =>
            validIds.has(id),
          ),
        ),
        activeDiagnosticsLayerId:
          state.activeDiagnosticsLayerId &&
          validIds.has(state.activeDiagnosticsLayerId)
            ? state.activeDiagnosticsLayerId
            : null,
      }));
      useConversationStore.getState().pruneInvalidLayers(validIds);
    } finally {
      set({ isRefreshing: false });
    }
  },

  setVisibility: async (layerId, visible) => {
    const status = await setLayerVisibility(layerId, visible);
    await get().refresh();
    return status;
  },

  setOpacity: async (layerId, opacity) => {
    const status = await setLayerOpacity(layerId, opacity);
    await get().refresh();
    return status;
  },

  zoom: async (layerId) => {
    return await zoomToLayer(layerId);
  },

  inspect: async (layerId) => {
    set({ activeDiagnosticsLayerId: layerId });
    const { diagnosticsById } = get();
    if (diagnosticsById[layerId]) return;

    set({ isDiagnosticsLoading: true });
    try {
      const diag = await getLayerDiagnostics(layerId);
      if (diag) {
        set((state) => ({
          diagnosticsById: { ...state.diagnosticsById, [layerId]: diag },
        }));
      }
    } finally {
      set({ isDiagnosticsLoading: false });
    }
  },

  closeDiagnostics: () => set({ activeDiagnosticsLayerId: null }),
}));
