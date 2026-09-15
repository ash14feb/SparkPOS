import { create } from 'zustand';

export const DEFAULT_MOBILE_COLS = 3;
export const DEFAULT_DESKTOP_COLS = 5;
export const MOBILE_MIN = 2;
export const MOBILE_MAX = 4;
export const DESKTOP_MIN = 3;
export const DESKTOP_MAX = 10;

const KEY = 'sparkpos-pos-grid-cols';

interface PosGridState {
  /** null = empty field => fall back to default */
  mobileCols: number | null;
  desktopCols: number | null;
  setMobileCols: (v: number | null) => void;
  setDesktopCols: (v: number | null) => void;
}

function load(): { mobileCols: number | null; desktopCols: number | null } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { mobileCols: null, desktopCols: null };
    const p = JSON.parse(raw);
    return {
      mobileCols: typeof p.mobileCols === 'number' ? p.mobileCols : null,
      desktopCols: typeof p.desktopCols === 'number' ? p.desktopCols : null,
    };
  } catch {
    return { mobileCols: null, desktopCols: null };
  }
}

function save(s: { mobileCols: number | null; desktopCols: number | null }) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

const initial = load();

export const usePosGridStore = create<PosGridState>((set) => ({
  mobileCols: initial.mobileCols,
  desktopCols: initial.desktopCols,
  setMobileCols: (mobileCols) => {
    set((s) => {
      const next = { mobileCols, desktopCols: s.desktopCols };
      save(next);
      return { mobileCols };
    });
  },
  setDesktopCols: (desktopCols) => {
    set((s) => {
      const next = { mobileCols: s.mobileCols, desktopCols };
      save(next);
      return { desktopCols };
    });
  },
}));

export const effectiveMobileCols = (v: number | null) => v ?? DEFAULT_MOBILE_COLS;
export const effectiveDesktopCols = (v: number | null) => v ?? DEFAULT_DESKTOP_COLS;
