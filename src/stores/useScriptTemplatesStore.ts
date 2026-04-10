/**
 * Store pour les templates de scripts personnalisés
 * Gère les templates utilisateur en plus des templates intégrés
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ScriptTemplate, BUILTIN_TEMPLATES } from "../lib/script-templates";

interface ScriptTemplatesState {
  // Templates personnalisés créés par l'utilisateur
  customTemplates: ScriptTemplate[];
  
  // Templates favoris (IDs)
  favoriteTemplateIds: string[];
  
  // Historique d'utilisation
  usageHistory: {
    templateId: string;
    usedAt: number;
    success: boolean;
  }[];
  
  // Actions
  addCustomTemplate: (template: Omit<ScriptTemplate, "id" | "createdAt" | "updatedAt">) => void;
  updateCustomTemplate: (id: string, updates: Partial<ScriptTemplate>) => void;
  deleteCustomTemplate: (id: string) => void;
  toggleFavorite: (templateId: string) => void;
  recordUsage: (templateId: string, success: boolean) => void;
  getAllTemplates: () => ScriptTemplate[];
  getFavoriteTemplates: () => ScriptTemplate[];
  getRecentTemplates: (limit?: number) => ScriptTemplate[];
  getMostUsedTemplates: (limit?: number) => ScriptTemplate[];
  duplicateTemplate: (templateId: string, newName: string) => void;
  importTemplate: (template: ScriptTemplate) => void;
  exportTemplate: (templateId: string) => string;
}

export const useScriptTemplatesStore = create<ScriptTemplatesState>()(
  persist(
    (set, get) => ({
      customTemplates: [],
      favoriteTemplateIds: [],
      usageHistory: [],

      addCustomTemplate: (template) => {
        const now = Date.now();
        const newTemplate: ScriptTemplate = {
          ...template,
          id: `custom_${now}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
          category: "custom",
        };

        set(state => ({
          customTemplates: [...state.customTemplates, newTemplate],
        }));
      },

      updateCustomTemplate: (id, updates) => {
        set(state => ({
          customTemplates: state.customTemplates.map(t =>
            t.id === id
              ? { ...t, ...updates, updatedAt: Date.now() }
              : t
          ),
        }));
      },

      deleteCustomTemplate: (id) => {
        set(state => ({
          customTemplates: state.customTemplates.filter(t => t.id !== id),
          favoriteTemplateIds: state.favoriteTemplateIds.filter(fid => fid !== id),
        }));
      },

      toggleFavorite: (templateId) => {
        set(state => {
          const isFav = state.favoriteTemplateIds.includes(templateId);
          return {
            favoriteTemplateIds: isFav
              ? state.favoriteTemplateIds.filter(id => id !== templateId)
              : [...state.favoriteTemplateIds, templateId],
          };
        });
      },

      recordUsage: (templateId, success) => {
        set(state => ({
          usageHistory: [
            { templateId, usedAt: Date.now(), success },
            ...state.usageHistory,
          ].slice(0, 100), // Garder les 100 derniers
        }));
      },

      getAllTemplates: () => {
        const { customTemplates } = get();
        return [...BUILTIN_TEMPLATES, ...customTemplates];
      },

      getFavoriteTemplates: () => {
        const { favoriteTemplateIds } = get();
        const allTemplates = get().getAllTemplates();
        return allTemplates.filter(t => favoriteTemplateIds.includes(t.id));
      },

      getRecentTemplates: (limit = 10) => {
        const { usageHistory } = get();
        const allTemplates = get().getAllTemplates();
        
        // Récupérer les IDs uniques par ordre d'utilisation récent
        const recentIds = [...new Set(usageHistory.map(h => h.templateId))].slice(0, limit);
        
        return recentIds
          .map(id => allTemplates.find(t => t.id === id))
          .filter((t): t is ScriptTemplate => t !== undefined);
      },

      getMostUsedTemplates: (limit = 10) => {
        const { usageHistory } = get();
        const allTemplates = get().getAllTemplates();
        
        // Compter les utilisations par template
        const usageCounts: Record<string, number> = {};
        usageHistory.forEach(h => {
          usageCounts[h.templateId] = (usageCounts[h.templateId] || 0) + 1;
        });
        
        // Trier par nombre d'utilisations
        const sortedIds = Object.entries(usageCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, limit)
          .map(([id]) => id);
        
        return sortedIds
          .map(id => allTemplates.find(t => t.id === id))
          .filter((t): t is ScriptTemplate => t !== undefined);
      },

      duplicateTemplate: (templateId, newName) => {
        const allTemplates = get().getAllTemplates();
        const original = allTemplates.find(t => t.id === templateId);
        if (!original) return;

        const now = Date.now();
        const duplicated: ScriptTemplate = {
          ...original,
          id: `custom_${now}_${Math.random().toString(36).substr(2, 9)}`,
          name: newName,
          createdAt: now,
          updatedAt: now,
          category: "custom",
        };

        set(state => ({
          customTemplates: [...state.customTemplates, duplicated],
        }));
      },

      importTemplate: (template) => {
        const now = Date.now();
        const imported: ScriptTemplate = {
          ...template,
          id: `imported_${now}_${Math.random().toString(36).substr(2, 9)}`,
          createdAt: now,
          updatedAt: now,
        };

        set(state => ({
          customTemplates: [...state.customTemplates, imported],
        }));
      },

      exportTemplate: (templateId) => {
        const allTemplates = get().getAllTemplates();
        const template = allTemplates.find(t => t.id === templateId);
        if (!template) return "";
        
        return JSON.stringify(template, null, 2);
      },
    }),
    {
      name: "qgisai-script-templates",
      partialize: (state) => ({
        customTemplates: state.customTemplates,
        favoriteTemplateIds: state.favoriteTemplateIds,
        usageHistory: state.usageHistory,
      }),
    }
  )
);
