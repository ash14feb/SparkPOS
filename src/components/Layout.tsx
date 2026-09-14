import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  ListOrdered, 
  UtensilsCrossed, 
  ChefHat,
  Package,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bluetooth,
  Printer
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePosStore } from '../store/usePosStore';
import { usePrinterStore } from '../store/usePrinterStore';
import { connectBtPrinter } from '../lib/bluetoothPrinter';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ShoppingCart, label: 'POS', path: '/pos' },
  { icon: ListOrdered, label: 'Orders', path: '/orders' },
  { icon: UtensilsCrossed, label: 'Tables', path: '/tables' },
  { icon: ChefHat, label: 'Kitchen (KDS)', path: '/kds' },
  { icon: Package, label: 'Menu & Stock', path: '/menu' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: CreditCard, label: 'Expenses', path: '/expenses' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Layout() {
  const { logout, user } = useAuthStore();
  const { settings } = usePosStore();
  const { btConnected, setBt } = usePrinterStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-[100dvh] bg-gray-50 overflow-hidden font-sans overscroll-none">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center px-4 z-40 shadow-sm">
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -ml-2 mr-2 text-gray-600 hover:text-gray-900 focus:outline-none"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <NavLink to="/dashboard" className="flex items-center">
          <div className="h-8 w-8 bg-brand-500 rounded-lg flex items-center justify-center mr-3 shadow-sm">
            <span className="text-white font-display font-bold text-xl leading-none">S</span>
          </div>
          <h1 className="font-display font-bold text-xl tracking-tight text-dark-900">SPARKPOS</h1>
        </NavLink>
        {/* Bluetooth printer shortcut — only on POS, saves the old title row */}
        {location.pathname === '/pos' && (
          <div className="ml-auto flex items-center">
            {settings?.printerConnectionType === 'usb' ? (
              <div className="flex items-center px-2.5 py-1.5 rounded-full text-[11px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                <Printer className="w-3.5 h-3.5 mr-1" />
                USB
              </div>
            ) : (
              <button
                onClick={async () => {
                  if (btConnected) return;
                  try {
                    const p = await connectBtPrinter(() => {
                      setBt(false, '');
                      toast.error('Bluetooth printer disconnected');
                    });
                    setBt(true, p.device?.name || 'Printer');
                    toast.success(`Connected to ${p.device?.name || 'Printer'}`);
                  } catch (err: any) {
                    if (err?.name === 'NotFoundError') return;
                    toast.error(err?.message || 'Bluetooth connection failed');
                  }
                }}
                title={btConnected ? 'Bluetooth Printer Connected' : 'Connect Bluetooth Printer'}
                className={cn(
                  'flex items-center p-2 rounded-full text-xs font-bold border transition-colors',
                  btConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                )}
              >
                <Bluetooth className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:relative inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-100 flex flex-col shadow-xl md:shadow-sm transform transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <NavLink to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
            <div className="h-8 w-8 bg-brand-500 rounded-lg flex items-center justify-center mr-3 shadow-sm">
              <span className="text-white font-display font-bold text-xl leading-none">S</span>
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-dark-900">SPARKPOS</h1>
          </NavLink>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 -mr-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-brand-50 text-brand-600 shadow-sm shadow-brand-100/50" 
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn("w-5 h-5 mr-3", "opacity-80")} />
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center px-3 py-2 mb-2 rounded-lg bg-gray-50">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold font-display text-sm mr-3">
              {user?.full_name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name || 'Admin User'}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{user?.user_type || 'Super Admin'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3 opacity-80" />
            Sign Out
          </button>
        </div>
      </aside>
      
      <main className={cn(
        "flex-1 flex flex-col relative overflow-hidden min-h-0 pt-16 md:pt-0 md:pb-0",
        location.pathname !== '/pos' ? "pb-16" : "pb-0"
      )}>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}
      {location.pathname !== '/pos' && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] h-16">
          <NavLink to="/dashboard" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <LayoutDashboard className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Home</span>
          </NavLink>
          <NavLink to="/tables" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <UtensilsCrossed className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Table</span>
          </NavLink>
          <NavLink to="/pos" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <ShoppingCart className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">POS</span>
          </NavLink>
          <NavLink to="/orders" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <ListOrdered className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Orders</span>
          </NavLink>
          <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center justify-center w-1/5 h-full text-gray-500 hover:text-gray-900">
            <Menu className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      )}
    </div>
  );
}
