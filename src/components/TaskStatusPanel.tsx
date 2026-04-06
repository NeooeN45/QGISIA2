import { useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  X,
  XCircle,
  Activity,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useTaskStore } from "../stores/useTaskStore";

export default function TaskStatusPanel() {
  const { tasks, activeTaskId, removeTask, clearCompleted } = useTaskStore();

  const runningTasks = tasks.filter((t) => t.status === "running");
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const failedTasks = tasks.filter((t) => t.status === "failed");

  // Auto-remove completed tasks after 5 seconds
  useEffect(() => {
    const now = Date.now();
    tasks.forEach((task) => {
      if (
        task.status === "completed" &&
        task.completedAt &&
        now - task.completedAt > 5000
      ) {
        removeTask(task.id);
      }
    });
  }, [tasks, removeTask]);

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-w-sm flex-col gap-2">
      {/* Tâche active */}
      {activeTaskId && (
        (() => {
          const task = tasks.find((t) => t.id === activeTaskId);
          if (!task) return null;
          return (
            <div className="rounded-2xl border border-emerald-500/30 bg-[#17181a]/95 p-4 shadow-xl backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {task.status === "running" && (
                    <Loader2 size={16} className="animate-spin text-emerald-400" />
                  )}
                  {task.status === "pending" && (
                    <Clock size={16} className="text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {task.title}
                  </p>
                  <p className="text-xs text-white/55 truncate">{task.description}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-white/70">
                      {Math.round(task.progress)}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeTask(task.id)}
                  className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* Tâches en attente */}
      {pendingTasks.length > 0 && pendingTasks.length < 3 && (
        <div className="rounded-2xl border border-blue-500/20 bg-[#17181a]/90 p-3 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-white/55">
            <Clock size={12} className="text-blue-400" />
            <span>
              {pendingTasks.length} tâche{pendingTasks.length > 1 ? "s" : ""} en attente
            </span>
          </div>
        </div>
      )}

      {/* Tâches échouées */}
      {failedTasks.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-[#17181a]/95 p-4 shadow-xl backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <XCircle size={16} className="mt-0.5 text-red-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                Échec : {failedTasks[0].title}
              </p>
              <p className="mt-1 text-xs text-white/55">{failedTasks[0].error}</p>
            </div>
            <button
              onClick={() => removeTask(failedTasks[0].id)}
              className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bouton pour effacer les terminées */}
      {completedTasks.length > 0 && (
        <button
          onClick={clearCompleted}
          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/55 hover:bg-white/10 hover:text-white transition-all"
        >
          Effacer {completedTasks.length} terminée{completedTasks.length > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
