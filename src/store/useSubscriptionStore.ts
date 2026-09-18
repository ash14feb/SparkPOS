import { create } from 'zustand';
import { api } from '../lib/api';

export interface SubscriptionStatus {
  access: boolean;
  subscribed: boolean;
  trial: boolean;
  expired: boolean;
  superAdmin?: boolean;
  trialEndsAt?: string;
  trialHoursLeft?: number;
  trialDaysLeft?: number;
  plan?: string | null;
  subscriptionEndsAt?: string | null;
}

interface SubscriptionState {
  status: SubscriptionStatus | null;
  isLoading: boolean;
  fetchStatus: () => Promise<void>;
  subscribe: (plan: '1YR' | '3YR') => Promise<void>;
  reset: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  status: null,
  isLoading: false,

  fetchStatus: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const res = await api.getSubscriptionStatus();
      const s = res?.data || res;
      set({ status: s?.success === false ? { access: true, subscribed: false, trial: false, expired: false } : s, isLoading: false });
    } catch {
      // Fail open so a network blip never locks a paying user out.
      set({ status: { access: true, subscribed: false, trial: false, expired: false }, isLoading: false });
    }
  },

  subscribe: async (plan) => {
    const res = await api.subscribe(plan);
    const s = res?.data || res;
    set({ status: s });
  },

  reset: () => set({ status: null, isLoading: false }),
}));
