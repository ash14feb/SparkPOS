import { create } from 'zustand';
import { api, removeAuthToken, setAuthToken } from '../lib/api';
import { usePosStore } from './usePosStore';
import { useSubscriptionStore } from './useSubscriptionStore';

interface User {
  id: number;
  user_id?: number;
  username: string;
  email: string;
  full_name: string;
  user_type: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  googleLogin: (idToken: string, extra?: { businessName?: string; name?: string }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (data: { full_name?: string; username?: string }) => Promise<void>;
}

// Backend key names vary (user_id vs id, user_type vs userType/role) —
// normalize once so every role check sees a consistent shape.
function normalizeUser(raw: any): User | null {
  if (!raw) return null;
  const u = raw.user || raw.data?.user || raw;
  if (!u || typeof u !== 'object') return null;
  const id = u.id ?? u.user_id ?? 0;
  return {
    id,
    user_id: u.user_id ?? u.id ?? id,
    username: u.username ?? '',
    email: u.email ?? '',
    full_name: u.full_name ?? u.fullName ?? u.name ?? '',
    user_type: String(u.user_type ?? u.userType ?? u.role ?? u.type ?? '').toLowerCase(),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (credentials) => {
    try {
      const response = await api.login(credentials);
      // The API might return { token, user } or { success: true, data: { token, user } }
      const data = response.data || response;
      if (data.token) {
        setAuthToken(data.token);
      }
      set({ user: normalizeUser(data), isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  googleLogin: async (idToken, extra) => {
    const response = await api.googleLogin(idToken, extra);
    const data = response.data || response;
    if (data.token) setAuthToken(data.token);
    set({ user: normalizeUser(data), isAuthenticated: true });
  },

  logout: () => {
    removeAuthToken();
    // Reset cached POS data so the next login fetches fresh items.
    usePosStore.setState({ bootstrapped: false, menuItems: [], settings: {} });
    useSubscriptionStore.getState().reset();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const response = await api.me();
      const user = normalizeUser(response.data || response);
      set({ user, isAuthenticated: !!user, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    await api.changePassword({ currentPassword, newPassword });
  },

  updateProfile: async (data) => {
    const user = get().user;
    if (!user) throw new Error('Not logged in');
    const id = user.user_id ?? user.id;
    const response = await api.updateUser(id, data);
    const updated = response.data?.user || response.user || response.data || null;
    if (updated) set({ user: { ...user, ...updated } });
    else set({ user: { ...user, ...data } });
  },
}));
