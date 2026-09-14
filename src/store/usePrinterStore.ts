import { create } from 'zustand';

interface PrinterState {
  btConnected: boolean;
  btName: string;
  setBt: (connected: boolean, name?: string) => void;
}

export const usePrinterStore = create<PrinterState>((set) => ({
  btConnected: false,
  btName: '',
  setBt: (connected, name = '') => set({ btConnected: connected, btName: name }),
}));
