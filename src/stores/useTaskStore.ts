import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number; // 0-100
  createdAt: number;
  completedAt?: number;
  error?: string;
}

interface TaskStore {
  tasks: Task[];
  activeTaskId: string | null;
  addTask: (task: Omit<Task, "id" | "createdAt">) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
  setActiveTask: (id: string | null) => void;
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,

      addTask: (task) => {
        const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newTask: Task = {
          ...task,
          id,
          createdAt: Date.now(),
        };
        set((state) => ({ tasks: [...state.tasks, newTask], activeTaskId: id }));
        return id;
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task,
          ),
        }));
      },

      removeTask: (id) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
        }));
      },

      clearCompleted: () => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.status !== "completed"),
        }));
      },

      setActiveTask: (id) => {
        set({ activeTaskId: id });
      },
    }),
    {
      name: "geoai-task-store",
      partialize: (state) => ({ tasks: state.tasks }),
    },
  ),
);

// Helper pour créer et gérer une tâche
export async function runTask<T>(
  title: string,
  description: string,
  fn: (updateProgress: (progress: number) => void) => Promise<T>,
): Promise<T> {
  const { addTask, updateTask, setActiveTask } = useTaskStore.getState();

  const taskId = addTask({
    title,
    description,
    status: "pending",
    progress: 0,
  });

  setActiveTask(taskId);

  try {
    updateTask(taskId, { status: "running", progress: 0 });

    const result = await fn((progress) => {
      updateTask(taskId, { progress: Math.min(100, Math.max(0, progress)) });
    });

    updateTask(taskId, {
      status: "completed",
      progress: 100,
      completedAt: Date.now(),
    });

    return result;
  } catch (error) {
    updateTask(taskId, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    setActiveTask(null);
  }
}
