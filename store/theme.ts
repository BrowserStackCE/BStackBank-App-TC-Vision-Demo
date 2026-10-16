// Theme store — Zustand-based green mode toggle
import { create } from 'zustand';

interface ThemeState {
  greenMode: boolean;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  greenMode: false,
  toggle: () => set((state) => ({ greenMode: !state.greenMode })),
}));

// ── Backward-compat shim ──────────────────────────────────────────────────────
// All existing code that imports ThemeStore continues to work unchanged.
export const ThemeStore = {
  isGreenMode: () => useThemeStore.getState().greenMode,
  toggle: () => useThemeStore.getState().toggle(),
  subscribe: (fn: () => void) => useThemeStore.subscribe(fn),
  primaryColor: () => (useThemeStore.getState().greenMode ? '#059669' : '#4F46E5'),
};