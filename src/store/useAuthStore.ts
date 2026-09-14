import { create } from 'zustand';
import { api, removeAuthToken, setAuthToken } from '../lib/api';

interface User {
  id: number;
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
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
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
      set({ user: data.user, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },

  logout: () => {
    removeAuthToken();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const response = await api.me();
      const user = response.data || response;
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
