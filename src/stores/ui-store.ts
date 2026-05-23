import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

type UiState = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
};

export const useUiStore = create<UiState>()(
  immer((set) => ({
    sidebarCollapsed: false,
    toggleSidebar: () =>
      set((state) => {
        state.sidebarCollapsed = !state.sidebarCollapsed;
      }),
    setSidebarCollapsed: (value) =>
      set((state) => {
        state.sidebarCollapsed = value;
      }),
  })),
);
