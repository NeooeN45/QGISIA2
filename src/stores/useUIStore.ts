import { create } from "zustand";

interface QuestionModalData {
  sessionId: string;
  question: string;
  options: string[];
}

interface UIState {
  sidebarOpen: boolean;
  showSettings: boolean;
  showPluginSetup: boolean;
  showQuestionModal: boolean;
  questionModalData: QuestionModalData | null;
  isLoading: boolean;
  isQgisConnected: boolean;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowPluginSetup: (show: boolean) => void;
  setShowQuestionModal: (show: boolean) => void;
  setQuestionModalData: (data: QuestionModalData | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsQgisConnected: (connected: boolean) => void;
}

function loadSidebarState(): boolean {
  try {
    return localStorage.getItem("geoai-sidebar-open") !== "0";
  } catch {
    return true;
  }
}

function persistSidebarState(open: boolean): void {
  try {
    localStorage.setItem("geoai-sidebar-open", open ? "1" : "0");
  } catch {
    // silent fail
  }
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: loadSidebarState(),
  showSettings: false,
  showPluginSetup: false,
  showQuestionModal: false,
  questionModalData: null,
  isLoading: false,
  isQgisConnected: false,

  toggleSidebar: () =>
    set((state) => {
      const next = !state.sidebarOpen;
      persistSidebarState(next);
      return { sidebarOpen: next };
    }),

  setSidebarOpen: (open) => {
    persistSidebarState(open);
    set({ sidebarOpen: open });
  },

  setShowSettings: (show) => set({ showSettings: show }),
  setShowPluginSetup: (show) => set({ showPluginSetup: show }),
  setShowQuestionModal: (show) => set({ showQuestionModal: show }),
  setQuestionModalData: (data) => set({ questionModalData: data }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsQgisConnected: (connected) => set({ isQgisConnected: connected }),
}));
