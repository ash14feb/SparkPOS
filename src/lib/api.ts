//export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'https://intelli-posapi.vercel.app';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
export const getAuthToken = () => localStorage.getItem('scannex-pos-auth');
export const setAuthToken = (token: string) => localStorage.setItem('scannex-pos-auth', token);
export const removeAuthToken = () => localStorage.removeItem('scannex-pos-auth');

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      removeAuthToken();
      window.dispatchEvent(new Event('auth-expired'));
    }

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        // Ignore JSON parse error on non-ok response
      }
      throw new Error(errorMessage);
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}

export const api = {
  // Auth
  login: (data: any) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data: any) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/api/auth/me'),
  getUsers: () => request('/api/auth/users'),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request('/api/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),
  forgotPassword: (data: { email: string }) =>
    request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify(data) }),
  resetPassword: (data: { token: string; newPassword: string }) =>
    request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(data) }),

  // User management (admin)
  createUser: (data: any) => request('/api/auth/create-user', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string | number, data: any) => request(`/api/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string | number) => request(`/api/auth/users/${id}`, { method: 'DELETE' }),
  resendCredentials: (id: string | number) => request(`/api/auth/users/${id}/resend-credentials`, { method: 'POST' }),
  
  // POS
  bootstrap: () => request('/api/pos/bootstrap'),
  saveSettings: (settings: any) => request('/api/pos/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  createOrder: (data: any) => request('/api/pos/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateOrder: (code: string, data: any) => request(`/api/pos/orders/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify(data) }),
  getTableActiveOrder: (tableId: string | number) => request(`/api/pos/tables/${tableId}/active-order`),
  deletePosOrder: (id: string) => request(`/api/pos/orders/${id}`, { method: 'DELETE' }),
  
  // Menu
  createMenuItem: (data: any) => request('/api/pos/menu-items', { method: 'POST', body: JSON.stringify(data) }),
  updateMenuItem: (id: string | number, data: any) => request(`/api/pos/menu-items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMenuItem: (id: string | number) => request(`/api/pos/menu-items/${id}`, { method: 'DELETE' }),
  getCategories: () => request('/api/pos/categories'),
  
  // Categories
  createCategory: (data: any) => request('/api/pos/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string | number, data: any) => request(`/api/pos/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string | number) => request(`/api/pos/categories/${id}`, { method: 'DELETE' }),
  
  // Tables
  getTables: () => request('/api/tables'),
  createTable: (data: any) => request('/api/tables', { method: 'POST', body: JSON.stringify(data) }),
  updateTableStatus: (id: number, status: string, current_order_code?: string) => request(`/api/tables/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, current_order_code }) }),
  deleteTable: (id: number) => request(`/api/tables/${id}`, { method: 'DELETE' }),
  getPublicMenu: (code: string) => fetch(`${API_BASE_URL}/api/tables/menu/${code}`, { cache: 'no-store' }).then(res => res.json()),
  placeTableOrder: (code: string, data: any) =>
    fetch(`${API_BASE_URL}/api/tables/order/${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Could not place order');
      return body;
    }),
  submitTableReview: (code: string, data: any) =>
    fetch(`${API_BASE_URL}/api/tables/review/${code}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Could not save review');
      return body;
    }),
  
  // KOT
  getKot: (status?: string) => request(`/api/kot${status ? `?status=${status}` : ''}`),
  
  // Orders
  getDineOrders: (status?: string) => request(`/api/dineorders${status ? `?status=${status}` : ''}`),
  updateDineOrderStatus: (code: string, status: string) => request(`/api/dineorders/${encodeURIComponent(code)}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  
  // Reviews (staff)
  getReviews: (date?: string) => request(`/api/reviews${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getReview: (id: string | number) => request(`/api/reviews/${id}`),

  // Customers
  getCustomers: () => request('/api/customers'),

  // Public bill fetch (no auth — opened on the customer's phone).
  // Requires backend: GET /api/pos/bills/:orderId -> { success, data: bill }
  getPublicBill: (orderId: string) =>
    fetch(`${API_BASE_URL}/api/pos/bills/${encodeURIComponent(orderId)}`, { cache: 'no-store' }).then(async (res) => {
      if (!res.ok) throw new Error('Bill not found');
      return res.json();
    }),
  
  // Expenses
  getExpenses: () => request('/api/posexpenses'),
  addExpense: (data: { expense_date: string; category?: string; amount: number; notes?: string }) =>
    request('/api/posexpenses', { method: 'POST', body: JSON.stringify(data) }),
};
