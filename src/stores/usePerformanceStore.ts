import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PerformanceMetric {
  id: string;
  type: "llm_response" | "qgis_operation" | "layer_refresh";
  name: string;
  duration: number; // in ms
  timestamp: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

interface PerformanceStore {
  metrics: PerformanceMetric[];
  addMetric: (metric: Omit<PerformanceMetric, "id" | "timestamp">) => void;
  clearMetrics: () => void;
  getAverageResponseTime: (type?: PerformanceMetric["type"]) => number;
  getMetricsByType: (type: PerformanceMetric["type"]) => PerformanceMetric[];
}

export const usePerformanceStore = create<PerformanceStore>()(
  persist(
    (set, get) => ({
      metrics: [],
      
      addMetric: (metric) => {
        const id = `metric-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newMetric: PerformanceMetric = {
          ...metric,
          id,
          timestamp: Date.now(),
        };
        
        set((state) => ({
          metrics: [newMetric, ...state.metrics].slice(0, 100), // Keep last 100 metrics
        }));
      },
      
      clearMetrics: () => set({ metrics: [] }),
      
      getAverageResponseTime: (type) => {
        const { metrics } = get();
        const filtered = type 
          ? metrics.filter((m) => m.type === type)
          : metrics;
        
        if (filtered.length === 0) return 0;
        
        const sum = filtered.reduce((acc, m) => acc + m.duration, 0);
        return Math.round(sum / filtered.length);
      },
      
      getMetricsByType: (type) => {
        const { metrics } = get();
        return metrics.filter((m) => m.type === type);
      },
    }),
    {
      name: "geoai-performance-store",
      partialize: (state) => ({ metrics: state.metrics }),
    },
  ),
);

// Helper pour mesurer le temps d'exécution d'une fonction
export async function measurePerformance<T>(
  type: PerformanceMetric["type"],
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const { addMetric } = usePerformanceStore.getState();
  const startTime = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    
    addMetric({
      type,
      name,
      duration: Math.round(duration),
      success: true,
      metadata,
    });
    
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    
    addMetric({
      type,
      name,
      duration: Math.round(duration),
      success: false,
      metadata: { ...metadata, error: error instanceof Error ? error.message : String(error) },
    });
    
    throw error;
  }
}
