import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { 
  ListOrdered, 
  UtensilsCrossed, 
  ChefHat,
  Package,
  Users,
  CreditCard,
  BarChart3,
  Settings
} from 'lucide-react';
import { useAuthStore } from './store/useAuthStore';
import { useEffect } from 'react';

import { AuthView } from './views/AuthView';
import { Layout } from './components/Layout';
import { InstallPrompt } from './components/InstallPrompt';
import { DashboardView } from './views/DashboardView';
import { POSView } from './views/POSView';
import { GenericView } from './views/GenericView';
import { CustomersView } from './views/CustomersView';
import { ExpensesView } from './views/ExpensesView';
import { TablesView } from './views/TablesView';
import { OrdersView } from './views/OrdersView';
import { KDSView } from './views/KDSView';
import { SettingsView } from './views/SettingsView';
import { PublicMenuView } from './views/PublicMenuView';
import { InventoryView } from './views/InventoryView';
import { BillView } from './views/BillView';
import { StaffView } from './views/StaffView';
import { ProfileView } from './views/ProfileView';
import { ReviewsView } from './views/ReviewsView';
import { ReportsView } from './views/ReportsView';
import { SubscribeView } from './views/SubscribeView';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Toaster position="bottom-center" />
      <InstallPrompt />
      <Routes>
        <Route path="/login" element={<AuthView />} />
        <Route path="/menu/:code" element={<PublicMenuView />} />
        <Route path="/bill" element={<BillView />} />
        <Route path="/bill/:orderId" element={<BillView />} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/pos" element={<POSView />} />
          <Route path="/orders" element={<OrdersView />} />
          <Route path="/tables" element={<TablesView />} />
          <Route path="/kds" element={<KDSView />} />
          <Route path="/menu" element={<InventoryView />} />
          <Route path="/customers" element={<CustomersView />} />
          <Route path="/reviews" element={<ReviewsView />} />
          <Route path="/expenses" element={<ExpensesView />} />
          <Route path="/reports" element={<ReportsView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/staff" element={<StaffView />} />
          <Route path="/profile" element={<ProfileView />} />
          <Route path="/subscribe" element={<SubscribeView />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
