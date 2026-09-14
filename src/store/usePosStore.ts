import { create } from 'zustand';
import { api } from '../lib/api';
import toast from 'react-hot-toast';

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  image?: string;
  category: string;
  barcode?: string;
  stock?: number;
}

export interface CartItem extends MenuItem {
  cartId: string;
  quantity: number;
  notes?: string;
}

interface PosState {
  menuItems: MenuItem[];
  categories: any[];
  orders: any[];
  cart: CartItem[];
  settings: any;
  isLoading: boolean;
  fetchBootstrap: () => Promise<void>;
  addToCart: (item: MenuItem, quantity?: number) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotal: () => number;
}

export const usePosStore = create<PosState>((set, get) => ({
  menuItems: [],
  categories: [],
  orders: [],
  cart: [],
  settings: {},
  isLoading: false,

  fetchBootstrap: async () => {
    set({ isLoading: true });
    try {
      const response = await api.bootstrap();
      // The API returns a nested data object: { success: true, data: { settings, menuItems, ... } }
      const data = response.data || response; 
      
      set({ 
        menuItems: data.menuItems || [], 
        categories: data.categories || [],
        orders: data.orders || [],
        settings: data.settings || {},
        isLoading: false 
      });
    } catch (error: any) {
      set({ isLoading: false });
      console.error('Failed to fetch bootstrap data', error);
      toast.error(error.message || 'Failed to load POS data from server');
      // Let it fail loudly so we can debug API issues instead of silently showing mock data
    }
  },

  addToCart: (item, quantity = 1) => {
    set((state) => {
      const existing = state.cart.find(c => c.id === item.id);
      if (existing) {
        return {
          cart: state.cart.map(c => 
            c.id === item.id ? { ...c, quantity: c.quantity + quantity } : c
          )
        };
      }
      return {
        cart: [...state.cart, { ...item, cartId: Math.random().toString(36).substring(7), quantity }]
      };
    });
  },

  removeFromCart: (cartId) => {
    set((state) => ({ cart: state.cart.filter(c => c.cartId !== cartId) }));
  },

  updateQuantity: (cartId, quantity) => {
    if (quantity <= 0) return get().removeFromCart(cartId);
    set((state) => ({
      cart: state.cart.map(c => c.cartId === cartId ? { ...c, quantity } : c)
    }));
  },

  clearCart: () => set({ cart: [] }),
  
  cartTotal: () => {
    return get().cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}));
