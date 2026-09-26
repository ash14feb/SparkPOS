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
import { canAccessPath, landingPath, normRole } from './lib/roles';
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
import { UpsellView } from './views/UpsellView';
import { OnlineOrdersView } from './views/OnlineOrdersView';
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

// Role gate: kitchen staff get bounced to /kds, non-admins away from
// admin-only pages (settings/staff). Applied per route below.
function RoleRoute({ children }: { children: React.ReactElement }) {
  const { user } = useAuthStore();
  const location = useLocation();
  if (!canAccessPath(user, location.pathname)) {
    return <Navigate to={landingPath(normRole(user))} replace />;
  }
  return children;
}

// Role-aware landing for `/` (kitchen staff start at the KDS).
function Landing() {
  const { user } = useAuthStore();
  return <Navigate to={landingPath(normRole(user))} replace />;
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
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<RoleRoute><DashboardView /></RoleRoute>} />
          <Route path="/pos" element={<RoleRoute><POSView /></RoleRoute>} />
          <Route path="/orders" element={<RoleRoute><OrdersView /></RoleRoute>} />
          <Route path="/tables" element={<RoleRoute><TablesView /></RoleRoute>} />
          <Route path="/kds" element={<RoleRoute><KDSView /></RoleRoute>} />
          <Route path="/menu" element={<RoleRoute><InventoryView /></RoleRoute>} />
          <Route path="/customers" element={<RoleRoute><CustomersView /></RoleRoute>} />
          <Route path="/reviews" element={<RoleRoute><ReviewsView /></RoleRoute>} />
          <Route path="/expenses" element={<RoleRoute><ExpensesView /></RoleRoute>} />
          <Route path="/reports" element={<RoleRoute><ReportsView /></RoleRoute>} />
          <Route path="/settings" element={<RoleRoute><SettingsView /></RoleRoute>} />
          <Route path="/staff" element={<RoleRoute><StaffView /></RoleRoute>} />
          <Route path="/upsell" element={<RoleRoute><UpsellView /></RoleRoute>} />
          <Route path="/online-orders" element={<RoleRoute><OnlineOrdersView /></RoleRoute>} />
          <Route path="/profile" element={<ProfileView />} />
          <Route path="/subscribe" element={<SubscribeView />} />
          <Route path="*" element={<Landing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
