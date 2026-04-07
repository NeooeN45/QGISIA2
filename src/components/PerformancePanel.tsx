import { Activity, Clock, Zap, X } from "lucide-react";
import { usePerformanceStore } from "../stores/usePerformanceStore";

export default function PerformancePanel() {
  const metrics = usePerformanceStore((s) => s.metrics);
  const clearMetrics = usePerformanceStore((s) => s.clearMetrics);
  const getAverageResponseTime = usePerformanceStore((s) => s.getAverageResponseTime);
  
  const avgLlmTime = getAverageResponseTime("llm_response");
  const avgQgisTime = getAverageResponseTime("qgis_operation");
  const recentMetrics = metrics.slice(0, 10);
  
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case "llm_response":
        return "text-blue-500 dark:text-blue-300";
      case "qgis_operation":
        return "text-emerald-500 dark:text-emerald-300";
      case "layer_refresh":
        return "text-amber-500 dark:text-amber-300";
      default:
        return "text-gray-500 dark:text-white/70";
    }
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "llm_response":
        return <Zap size={12} />;
      case "qgis_operation":
        return <Activity size={12} />;
      case "layer_refresh":
        return <Clock size={12} />;
      default:
        return <Clock size={12} />;
    }
  };
  
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.04] p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-white/55">
          Performance
        </h3>
        <button
          onClick={clearMetrics}
          className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-[10px] font-medium text-gray-500 dark:text-white/40 transition-all hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white/60"
        >
          Effacer
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-blue-300" />
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-200/70">LLM moyen</span>
          </div>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-200">
            {avgLlmTime > 0 ? formatDuration(avgLlmTime) : "-"}
          </p>
        </div>
        
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} className="text-emerald-300" />
            <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-200/70">QGIS moyen</span>
          </div>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-200">
            {avgQgisTime > 0 ? formatDuration(avgQgisTime) : "-"}
          </p>
        </div>
      </div>
      
      {recentMetrics.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-gray-400 dark:text-white/35">Opérations récentes</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {recentMetrics.map((metric) => (
              <div
                key={metric.id}
                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.02] px-2.5 py-1.5"
              >
                <span className={getTypeColor(metric.type)}>
                  {getTypeIcon(metric.type)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-gray-600 dark:text-white/70">
                  {metric.name}
                </span>
                <span className="text-[10px] font-mono text-gray-400 dark:text-white/50">
                  {formatDuration(metric.duration)}
                </span>
                {!metric.success && (
                  <X size={10} className="text-red-400" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {metrics.length === 0 && (
        <p className="text-[10px] text-gray-400 dark:text-white/35 text-center py-4">
          Aucune métrique disponible
        </p>
      )}
    </div>
  );
}
