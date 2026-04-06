import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PyQGISScript {
  id: string;
  name: string;
  code: string;
  createdAt: number;
  lastUsedAt: number;
  tags: string[];
  description?: string;
}

interface ScriptHistoryStore {
  scripts: PyQGISScript[];
  addScript: (script: Omit<PyQGISScript, "id" | "createdAt" | "lastUsedAt">) => void;
  updateScript: (id: string, updates: Partial<PyQGISScript>) => void;
  deleteScript: (id: string) => void;
  useScript: (id: string) => void;
  clearHistory: () => void;
  searchScripts: (query: string) => PyQGISScript[];
}

export const useScriptHistoryStore = create<ScriptHistoryStore>()(
  persist(
    (set, get) => ({
      scripts: [],
      
      addScript: (script) => {
        const id = `script-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const now = Date.now();
        const newScript: PyQGISScript = {
          ...script,
          id,
          createdAt: now,
          lastUsedAt: now,
        };
        
        set((state) => ({
          scripts: [newScript, ...state.scripts].slice(0, 50),
        }));
      },
      
      updateScript: (id, updates) => {
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === id ? { ...s, ...updates } : s,
          ),
        }));
      },
      
      deleteScript: (id) => {
        set((state) => ({
          scripts: state.scripts.filter((s) => s.id !== id),
        }));
      },
      
      useScript: (id) => {
        set((state) => ({
          scripts: state.scripts.map((s) =>
            s.id === id ? { ...s, lastUsedAt: Date.now() } : s,
          ),
        }));
      },
      
      clearHistory: () => set({ scripts: [] }),
      
      searchScripts: (query) => {
        const { scripts } = get();
        const lowerQuery = query.toLowerCase();
        return scripts.filter((s) =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.code.toLowerCase().includes(lowerQuery) ||
          s.tags.some((t) => t.toLowerCase().includes(lowerQuery)) ||
          (s.description && s.description.toLowerCase().includes(lowerQuery))
        );
      },
    }),
    {
      name: "geoai-script-history-store",
      partialize: (state) => ({ scripts: state.scripts }),
    }
  ),
);
