import { create } from 'zustand';

export type ThemeId = 'teal' | 'ocean' | 'sunset' | 'plum';

export const THEMES: { id: ThemeId; label: string; preview: string }[] = [
  { id: 'teal', label: 'Teal', preview: 'linear-gradient(90deg, #0f766e, #14b8a6)' },
  { id: 'ocean', label: 'Ocean', preview: 'linear-gradient(90deg, #1d4ed8, #60a5fa)' },
  { id: 'sunset', label: 'Sunset', preview: 'linear-gradient(90deg, #c2410c, #fb923c)' },
  { id: 'plum', label: 'Plum', preview: 'linear-gradient(90deg, #7e22ce, #d8b4fe)' },
];

const KEY = 'sparkpos-theme';

export function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
}

interface ThemeState {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'teal',
  setTheme: (theme) => {
    try { localStorage.setItem(KEY, theme); } catch {}
    applyTheme(theme);
    set({ theme });
  },
}));

export function initTheme() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  const theme = (THEMES.some((t) => t.id === saved) ? saved : 'teal') as ThemeId;
  applyTheme(theme);
  useThemeStore.setState({ theme });
}
