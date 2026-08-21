import { create } from "zustand";
import { persist } from "zustand/middleware";

type SelectorState = {
  orgId: string | null;
  projectId: string | null;
  setOrg: (id: string | null) => void;
  setProject: (id: string | null) => void;
};

/**
 * Shared org/project selector store. Survives navigation within a session
 * and (when permitted by the browser) across sessions via localStorage.
 */
export const useSelectorStore = create<SelectorState>()(
  persist(
    (set) => ({
      orgId: null,
      projectId: null,
      setOrg: (id) => set({ orgId: id }),
      setProject: (id) => set({ projectId: id }),
    }),
    {
      name: "devobservatory-selector",
      partialize: (state) => ({ orgId: state.orgId, projectId: state.projectId }),
    },
  ),
);