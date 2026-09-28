import { useState, useEffect, useCallback, useRef } from 'react';
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
  Printer,
  UserRound,
  ContactRound,
  Crown,
  Star,
  Sparkles,
  Globe
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePosStore } from '../store/usePosStore';
import { usePrinterStore } from '../store/usePrinterStore';
import { useSubscriptionStore } from '../store/useSubscriptionStore';
import { connectBtPrinter } from '../lib/bluetoothPrinter';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { canAccessPath, normRole } from '../lib/roles';
import alarmUrl from '../alarm.mp3';
import dinoscanLogo from '../dinoscan.png';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ShoppingCart, label: 'POS', path: '/pos' },
  { icon: ListOrdered, label: 'Orders', path: '/orders' },
  { icon: UtensilsCrossed, label: 'Table Settings', path: '/tables?tab=settings' },
  { icon: ChefHat, label: 'Kitchen (KDS)', path: '/kds' },
  { icon: Package, label: 'Menu & Stock', path: '/menu' },
  { icon: Users, label: 'Customers', path: '/customers' },
  { icon: Star, label: 'Customer Reviews', path: '/reviews' },
  { icon: Sparkles, label: 'AI Upselling', path: '/upsell' },
  { icon: Globe, label: 'Online Ordering', path: '/online-orders' },
  { icon: CreditCard, label: 'Expenses', path: '/expenses' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: ContactRound, label: 'Staff', path: '/staff' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: UserRound, label: 'Profile', path: '/profile' },
];

export function Layout() {
  const { logout, user, isAuthenticated } = useAuthStore();
  const { settings } = usePosStore();
  const { btConnected, setBt } = usePrinterStore();
  const { status: subStatus, fetchStatus: fetchSubStatus } = useSubscriptionStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Online-order alarm: unacknowledged (ACTIVE) ONLINE orders ring alarm.mp3
  // on loop until each is Accepted or Rejected — on any screen.
  const [unackedOnline, setUnackedOnline] = useState<any[]>([]);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const seenOnlineRef = useRef<Set<string>>(new Set());
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [attentionCount, setAttentionCount] = useState(0);
  const [posMobileView, setPosMobileView] = useState<'menu' | 'cart'>('menu');

  useEffect(() => {
    const onView = (e: Event) => setPosMobileView((e as CustomEvent).detail === 'cart' ? 'cart' : 'menu');
    window.addEventListener('sparkpos:mobile-view', onView);
    return () => window.removeEventListener('sparkpos:mobile-view', onView);
  }, []);
  const isPosCart = location.pathname === '/pos' && posMobileView === 'cart';

  // Dine-in is opt-in: FOOD + "Dine-In Available? YES" (default NO => takeaway only,
  // no Tables entry points anywhere).
  const dineInEnabled =
    String(settings?.businessType || '').toUpperCase().includes('FOOD') &&
    (settings?.dineInEnabled === true || settings?.dineInEnabled === 1);

  const fetchOccupied = useCallback(async () => {
    if (!dineInEnabled) { setOccupiedCount(0); setAttentionCount(0); return; }
    try {
      const res = await api.getTables();
      const list = res?.data || [];
      setOccupiedCount(list.filter((t: any) => ['OCCUPIED', 'HAVING_FOOD', 'CUSTOMER_ORDERED'].includes(t.status)).length);
      // CUSTOMER_ORDERED = needs staff attention (new / updated customer order).
      setAttentionCount(list.filter((t: any) => t.status === 'CUSTOMER_ORDERED').length);
    } catch {
      // silent
    }
  }, [dineInEnabled]);

  useEffect(() => {
    fetchOccupied();
    if (!dineInEnabled) return;
    // Fast poll + refetch on focus/visibility so a customer re-order
    // (CUSTOMER_ORDERED) bumps the footer badge without manual refresh.
    const id = setInterval(fetchOccupied, 10000);
    const onFocus = () => fetchOccupied();
    const onVis = () => { if (document.visibilityState === 'visible') fetchOccupied(); };
    const onTablesChanged = () => fetchOccupied();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('sparkpos:tables-changed', onTablesChanged);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('sparkpos:tables-changed', onTablesChanged);
    };
  }, [fetchOccupied, dineInEnabled]);

  useEffect(() => {
    fetchOccupied();
  }, [location.pathname, fetchOccupied]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // ---- Online order alarm loop ----
  useEffect(() => {
    const audio = new Audio(alarmUrl);
    audio.loop = true;
    alarmRef.current = audio;
    // Browsers block audio before first user gesture — unlock on first tap.
    const unlock = () => {
      audio.load();
      // If orders are already waiting, start ringing now.
      setUnackedOnline((cur) => {
        if (cur.length) audio.play().catch(() => {});
        return cur;
      });
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      audio.pause();
      alarmRef.current = null;
    };
  }, []);

  const checkOnlineOrders = useCallback(async (silent = true) => {
    try {
      const res = await api.getDineOrders();
      const pending = (res.data || []).filter(
        (o: any) => String(o.order_type || '').toUpperCase() === 'ONLINE' && String(o.order_status || '').toUpperCase() === 'ACTIVE'
      );
      setUnackedOnline((prev) => {
        for (const o of pending) {
          const code = String(o.order_code || o.id);
          if (!seenOnlineRef.current.has(code)) {
            seenOnlineRef.current.add(code);
            if (prev.some((p: any) => String(p.order_code || p.id) === code)) continue;
            toast(`🛵 New online order ${code}!`, { icon: '🔔', duration: 6000 });
          }
        }
        return pending;
      });
      const audio = alarmRef.current;
      if (audio) {
        if (pending.length) audio.play().catch(() => {});
        else {
          audio.pause();
          try { audio.currentTime = 0; } catch {}
        }
      }
    } catch {
      // silent — alarm polling must never break the shell
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    checkOnlineOrders();
    const id = setInterval(() => checkOnlineOrders(), 15000);
    const onFocus = () => checkOnlineOrders();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated, checkOnlineOrders]);

  const acknowledgeOrder = async (orderCode: string, accept: boolean) => {
    try {
      await api.acknowledgeOnlineOrder(orderCode, accept);
      toast.success(accept ? `Order ${orderCode} accepted!` : `Order ${orderCode} rejected`);
      seenOnlineRef.current.add(String(orderCode));
      checkOnlineOrders();
      window.dispatchEvent(new CustomEvent('sparkpos:online-ack'));
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update order');
    }
  };

  // Trial / subscription status — refreshed on login and route change.
  useEffect(() => {
    if (isAuthenticated) fetchSubStatus();
  }, [isAuthenticated, fetchSubStatus]);
  useEffect(() => {
    if (isAuthenticated && location.pathname !== '/subscribe') fetchSubStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const trialBlocked = !!subStatus?.expired && location.pathname !== '/subscribe';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const myRole = normRole(user);
  // Sidebar: hide dine-in tables when disabled AND any page the role
  // may not open (kitchen => KDS + Profile only, non-admins => no
  // Settings/Staff). Profile stays visible to every role.
  const visibleNav = navItems
    .filter((i) => (dineInEnabled ? true : i.path !== '/tables'))
    .filter((i) => canAccessPath(myRole, i.path));

  return (
    <div className="flex h-[100dvh] bg-gray-50 overflow-hidden font-sans overscroll-none">
      {/* 🔔 Online-order alarm banner — rings until every order is accepted/rejected */}
      {unackedOnline.length > 0 && (
        <div className="fixed top-0 inset-x-0 z-[80] animate-pulse">
          <div className="bg-red-600 text-white shadow-2xl">
            <div className="max-w-3xl mx-auto px-4 py-2.5 space-y-2 max-h-[45vh] overflow-y-auto">
              <p className="text-center text-sm font-black tracking-wide">
                🔔 {unackedOnline.length} NEW ONLINE ORDER{unackedOnline.length > 1 ? 'S' : ''} — ACCEPT OR REJECT TO STOP THE ALARM
              </p>
              {unackedOnline.map((o: any) => (
                <div key={o.order_code || o.id} className="flex items-center gap-2 bg-white/15 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{o.order_code} · {o.customer_name || 'Customer'}</p>
                    <p className="text-xs text-white/85 truncate">
                      {(o.items || []).reduce((n: number, it: any) => n + Number(it.qty ?? it.quantity ?? 1), 0)} item(s) · Rs.{Number(o.total_amount ?? o.total ?? 0).toFixed(0)}
                    </p>
                  </div>
                  <button
                    onClick={() => acknowledgeOrder(String(o.order_code), true)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black rounded-lg shrink-0"
                  >
                    ✓ ACCEPT
                  </button>
                  <button
                    onClick={() => acknowledgeOrder(String(o.order_code), false)}
                    className="px-4 py-2 bg-slate-900/70 hover:bg-slate-900 text-white text-xs font-black rounded-lg shrink-0"
                  >
                    ✕ REJECT
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center px-4 z-40 shadow-sm">
        {isPosCart ? (
          <span className="font-display font-bold text-lg text-dark-900">Current Order</span>
        ) : (
        <>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -ml-2 mr-2 text-gray-600 hover:text-gray-900 focus:outline-none"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <NavLink to="/dashboard" className="flex items-center">
          <img src={dinoscanLogo} alt="DinoScan" className="h-8 w-8 rounded-lg mr-3 shadow-sm object-cover" />
          <h1 className="font-display font-bold text-xl tracking-tight text-dark-900">DinoScan</h1>
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
        </>
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
            <img src={dinoscanLogo} alt="DinoScan" className="h-8 w-8 rounded-lg mr-3 shadow-sm object-cover" />
            <h1 className="font-display font-bold text-xl tracking-tight text-dark-900">DinoScan</h1>
          </NavLink>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 -mr-2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          {subStatus?.subscribed ? (
            <div className="flex items-center px-3 py-2.5 mb-1 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
              <Crown className="w-4 h-4 mr-2 text-amber-600 shrink-0" />
              <p className="text-xs font-bold text-amber-800">PRO{subStatus?.plan ? ` · ${subStatus.plan === '3YR' ? '3-YEAR' : 'YEARLY'}` : ''}</p>
            </div>
          ) : subStatus?.trial ? (
            <NavLink
              to="/subscribe"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block px-3 py-2.5 mb-1 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/20 hover:opacity-95 transition-all"
            >
              <div className="flex items-center">
                <Crown className="w-4 h-4 mr-2 shrink-0" />
                <p className="text-xs font-bold leading-tight">
                  {subStatus.trialDaysLeft <= 1 ? 'Trial ends today!' : `Trial ends in ${subStatus.trialDaysLeft} day${subStatus.trialDaysLeft === 1 ? '' : 's'}`}
                </p>
              </div>
              <p className="text-[11px] mt-0.5 ml-6 opacity-90 underline underline-offset-2">Subscribe to keep billing →</p>
            </NavLink>
          ) : null}
          {visibleNav.map((item) => (
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
        "flex-1 flex flex-col relative overflow-hidden min-h-0 pt-16 md:pt-0 pb-16"
      )}>
        {trialBlocked ? (
          <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center bg-gray-50 p-6 no-chain-scroll">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 max-w-sm w-full p-8 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg mb-4">
                <Crown className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-display font-bold text-gray-900">Your free trial is over</h2>
              <p className="text-gray-500 mt-2 mb-6 text-sm leading-relaxed">
                Please subscribe to continue using DinoScan — billing, KDS, reports and everything else picks up right where you left off.
              </p>
              <button
                onClick={() => navigate('/subscribe')}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-display font-bold text-lg shadow-xl shadow-brand-500/30 hover:opacity-95 active:scale-[0.99] transition-all"
              >
                Subscribe
              </button>
              <button onClick={handleLogout} className="mt-3 text-sm font-medium text-gray-400 hover:text-gray-600">
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Bottom Navigation (mobile + desktop) — role filtered so
          kitchen staff only get Kitchen + More, everyone keeps Profile. */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex items-center justify-around z-40 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] h-16">
          {myRole === 'kitchen' ? (
          <NavLink to="/kds" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <ChefHat className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Kitchen</span>
          </NavLink>
          ) : (
          <NavLink to="/dashboard" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <LayoutDashboard className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Home</span>
          </NavLink>
          )}
          {myRole !== 'kitchen' && dineInEnabled && (
          <NavLink to="/tables" className={({isActive}) => cn("relative flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <UtensilsCrossed className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{attentionCount > 0 ? `🟡 ${attentionCount} Ordered` : occupiedCount > 0 ? `🔴 ${occupiedCount} Tables` : 'Tables'}</span>
            {(attentionCount > 0 || occupiedCount > 0) && (
              <span className="absolute top-1.5 right-1/2 translate-x-6 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 animate-pulse text-white text-[10px] font-bold flex items-center justify-center">
                {attentionCount > 0 ? attentionCount : occupiedCount}
              </span>
            )}
          </NavLink>
          )}
          {myRole !== 'kitchen' && (
          <NavLink to="/pos" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <ShoppingCart className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">POS</span>
          </NavLink>
          )}
          {myRole !== 'kitchen' && (
          <NavLink to="/orders" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <ListOrdered className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">Transactions</span>
          </NavLink>
          )}
          <NavLink to="/profile" className={({isActive}) => cn("flex flex-col items-center justify-center w-1/5 h-full", isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900")}>
            <UserRound className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">More</span>
          </NavLink>
        </div>
    </div>
  );
}
