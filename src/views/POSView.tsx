import { useEffect, useState, useMemo, useRef } from 'react';
import { usePosStore, MenuItem } from '../store/usePosStore';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, QrCode, ShoppingCart, ListCollapse, X, Package, Printer, CheckCircle2, Loader2, Bluetooth, Share2, FileText, ArrowLeft, UtensilsCrossed, ShoppingBag, Armchair, Check, ScanLine } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { toBlob } from 'html-to-image';
import { buildBillLink, buildShortBillLink, normalizePhone } from '../lib/billLink';
import { connectBtPrinter, printReceiptBle, getBtPrinter, disconnectBtPrinter } from '../lib/bluetoothPrinter';
import { usePrinterStore } from '../store/usePrinterStore';
import { formatDateTime } from '../lib/datetime';
import { BarcodeScannerModal } from '../components/BarcodeScanner';
import { usePosGridStore, effectiveMobileCols, effectiveDesktopCols } from '../store/usePosGridStore';
import { useNavigate } from 'react-router-dom';

export function POSView() {
  const navigate = useNavigate();
  const { menuItems, categories, fetchBootstrap, cart, addToCart, removeFromCart, updateQuantity, clearCart, isLoading, settings } = usePosStore();
  const { mobileCols, desktopCols } = usePosGridStore();
  // Items-per-row follows Profile settings (lg breakpoint = desktop).
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const gridCols = isDesktop ? effectiveDesktopCols(desktopCols) : effectiveMobileCols(mobileCols);
  // E-Bill mode: no physical printing — Pay & Print is hidden, Pay Only is the full flow.
  const isEbill = settings?.printerConnectionType === 'ebill';
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'menu' | 'cart'>('menu');
  
  // Tell Layout whether the mobile cart is open so it can hide the
  // hamburger + logo on the cart screen.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('sparkpos:mobile-view', { detail: mobileView }));
  }, [mobileView]);

  // Pay buttons stay enabled so a missing payment mode can toast.
  const guardPay = (skipPrint: boolean) => {
    if (cart.length === 0) return toast.error('Cart is empty');
    if (!paymentMode) return toast.error('Please select a payment mode');
    setPendingPay({ skipPrint });
  };
  const billRef = useRef<HTMLDivElement>(null);

  // Checkout State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [discount, setDiscount] = useState<number | string>('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPay, setPendingPay] = useState<{ skipPrint: boolean } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState(false);
  const { btConnected, btName, setBt } = usePrinterStore();
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  useEffect(() => { if (pendingPay) setPaySwipe(0); }, [pendingPay]);

  // Dine-in / Takeaway (default FOOD: DB default is FOOD; only RETAIL hides it,
  // so a failed settings fetch never silently disables the workflow).
  // API tables use snake_case `table_no` — normalize once for all labels/payloads.
  const tableLabel = (t: any) => t?.table_no ?? t?.tableNo ?? t?.no ?? t?.name ?? (t?.id ?? '—');
  const tableIdOf = (t: any) => t?.id ?? t?.tableId ?? t?.table_id;
  const tableStatusOf = (t: any) => String(t?.status || t?.tableStatus || (t?.isOccupied ? 'OCCUPIED' : 'FREE')).toUpperCase();
  // OCCUPIED (saved), HAVING_FOOD (served) and CUSTOMER_ORDERED (self-ordered)
  // all mean "active table".
  const isTableActive = (t: any) => ['OCCUPIED', 'HAVING_FOOD', 'CUSTOMER_ORDERED'].includes(tableStatusOf(t));
  const tableStatusLabel = (t: any) => tableStatusOf(t) === 'HAVING_FOOD' ? 'HAVING FOOD' : tableStatusOf(t) === 'CUSTOMER_ORDERED' ? 'CUSTOMER ORDERED' : tableStatusOf(t);
  const businessType = String(settings?.businessType || '').toUpperCase();
  // Dine-in is a strict opt-in: FOOD + "Dine-In Available? YES". Default NO.
  const dineInEnabled = settings?.dineInEnabled === true || settings?.dineInEnabled === 1;
  const isFood = businessType.includes('FOOD') && dineInEnabled;
  const [orderType, setOrderType] = useState<'DINEIN' | 'TAKEAWAY'>('TAKEAWAY');
  const isDineInFlow = isFood && orderType === 'DINEIN';
  const [tables, setTables] = useState<any[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [activeOrderCode, setActiveOrderCode] = useState<string | null>(null);
  const [served, setServed] = useState(false);
  const [serveProgress, setServeProgress] = useState(0);
  const serveDragging = useRef(false);
  const serveTrackRef = useRef<HTMLDivElement>(null);
  const [paySwipe, setPaySwipe] = useState(0);
  const payDragging = useRef(false);
  const payTrackRef = useRef<HTMLDivElement>(null);

  const fetchTables = async () => {
    try {
      setTablesLoading(true);
      const res = await api.getTables();
      const list = res?.data || res?.tables || res || [];
      setTables(Array.isArray(list) ? list : []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load tables');
    } finally {
      setTablesLoading(false);
    }
  };

  useEffect(() => {
    if (isFood && orderType === 'DINEIN') fetchTables();
  }, [isFood, orderType]);

  // Auto-refresh tables + live order while in DINEIN so a customer re-order
  // (table flips back to CUSTOMER_ORDERED, order ACTIVE) re-enables
  // swipe-to-serve without manual refresh.
  useEffect(() => {
    if (!isFood || orderType !== 'DINEIN') return;
    const id = setInterval(async () => {
      try {
        const res = await api.getTables();
        const list = res?.data || res?.tables || res || [];
        if (Array.isArray(list)) {
          setTables(list);
          window.dispatchEvent(new Event('sparkpos:tables-changed'));
        }
      } catch { /* silent */ }
      try {
        if (activeOrderCode && selectedTable) {
          const tid = tableIdOf(selectedTable);
          if (tid) {
            const ord = (await api.getTableActiveOrder(tid))?.data || null;
            if (ord) {
              const isServed = String(ord.orderStatus || '').toUpperCase() === 'SERVED';
              setServed(isServed);
              if (!isServed) setServeProgress(0);
              setSelectedTable((prev: any) => (prev ? { ...prev, status: isServed ? 'HAVING_FOOD' : 'CUSTOMER_ORDERED' } : prev));
            }
          }
        }
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFood, orderType, activeOrderCode, selectedTable?.id]);

  // Deep link from Tables screen: /pos?table=<id> opens that table's flow.
  useEffect(() => {
    if (!isFood) return;
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('table');
    if (!tid) return;
    (async () => {
      try {
        const res = await api.getTables();
        const list = res?.data || res?.tables || res || [];
        const arr = Array.isArray(list) ? list : [];
        const t = arr.find((x: any) => String(x.id) === String(tid));
        if (t) {
          setOrderType('DINEIN');
          await handleSelectTable(t);
          window.history.replaceState(null, '', window.location.pathname + '#/pos');
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFood]);

  const resetDineState = () => {
    setSelectedTable(null);
    setActiveOrderCode(null);
    setServed(false);
    setServeProgress(0);
    fetchTables();
  };

  const connectBluetooth = async () => {
    try {
      const p = await connectBtPrinter(() => {
        setBt(false, '');
        toast.error('Bluetooth printer disconnected');
      });
      setBt(true, p.device?.name || 'Printer');
      setShowPrinterModal(false);
      toast.success(`Connected to ${p.device?.name || 'Printer'}`);
    } catch (err: any) {
      // User cancelling the picker throws NotFoundError — don't show scary error
      if (err?.name === 'NotFoundError') return;
      toast.error(err?.message || 'Bluetooth connection failed or cancelled');
    }
  };

  useEffect(() => {
    // Bootstrap cached in store — only hits the server once per login.
    if (!usePosStore.getState().bootstrapped) fetchBootstrap();
  }, []);

  const derivedCategories = ['All', ...new Set(menuItems.map(m => m.category || 'Uncategorized'))];

  const filteredItems = menuItems.filter(item => {
    const matchesCat = activeCategory === 'All' || item.category === activeCategory || (!item.category && activeCategory === 'Uncategorized');
    const query = searchQuery.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(query) || 
                          (item.barcode && item.barcode.includes(query));
    return matchesCat && matchesSearch;
  });

  // Bill Math
  const { subtotal, discountVal, taxable, cgst, sgst, total } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const d = Number(discount) || 0;
    const taxb = Math.max(0, sub - d);
    
    let c = 0;
    let s = 0;
    let t = 0;
    
    const cp = settings?.cgstPercent || 0;
    const sp = settings?.sgstPercent || 0;
    
    if (settings?.taxInclusive) {
      const taxPercent = cp + sp;
      if (taxPercent > 0) {
        const base = taxb / (1 + taxPercent / 100);
        const totalTax = taxb - base;
        c = totalTax * (cp / taxPercent);
        s = totalTax * (sp / taxPercent);
      }
      t = taxb;
    } else {
      c = taxb * (cp / 100);
      s = taxb * (sp / 100);
      t = taxb + c + s;
    }
    
    return {
      subtotal: sub,
      discountVal: d,
      taxable: taxb,
      cgst: c,
      sgst: s,
      total: t
    };
  }, [cart, discount, settings]);

  const handleAddToCart = (item: MenuItem, qty: number = 1) => {
    if (settings?.enableStock && !settings?.allowSaleWhenOutOfStock && (item.stock || 0) <= 0) {
      return toast.error(`${item.name} is out of stock`);
    }
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      updateQuantity(existing.cartId, existing.quantity + qty);
    } else {
      addToCart(item);
      if (qty > 1) {
        // Find the newly added item (it's the last one)
        const newItem = usePosStore.getState().cart.find(c => c.id === item.id);
        if (newItem) updateQuantity(newItem.cartId, qty);
      }
    }
  };

  const processOrder = async (skipPrint: boolean = false) => {
    if (cart.length === 0) return toast.error('Cart is empty');
    const dinePayFlow = isFood && orderType === 'DINEIN' && activeOrderCode;
    
    // Printer checks
    if (settings?.printerConnectionType === 'bluetooth' && !btConnected && !skipPrint) {
      setShowPrinterModal(true);
      return;
    }
    
    if (settings?.orderAfterBill && skipPrint) {
      return toast.error('Printing is mandatory according to settings');
    }

    try {
      setIsSubmitting(true);
      
      const orderPayload: any = {
        id: `INV-${Date.now()}`,
        timestamp: Date.now(),
        items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, image: c.image, category: c.category, qty: c.quantity })),
        subtotal,
        discount: discountVal,
        cgst,
        sgst,
        total,
        paymentMode,
        customerName,
        customerPhone,
        store: settings?.businessName || settings?.restaurantName || 'Intelli POS',
        receiptHeader: settings?.receiptHeader || '',
        receiptFooter: settings?.receiptFooter || '',
        currency: settings?.currencySymbol || 'Rs.',
        orderType: isFood ? orderType : undefined,
        tableId: isFood && orderType === 'DINEIN' && selectedTable ? tableIdOf(selectedTable) : undefined,
        tableNo: isFood && orderType === 'DINEIN' && selectedTable ? tableLabel(selectedTable) : undefined,
      };
      
      if (dinePayFlow && activeOrderCode) {
        await api.updateOrder(activeOrderCode, { ...orderPayload, orderStatus: 'PAID', paymentMode });
        try {
          const tid = selectedTable?.id ?? selectedTable?.tableId;
          if (tid !== undefined) await api.updateTableStatus(Number(tid), 'FREE');
        } catch {}
      } else {
        await api.createOrder(orderPayload);
      }
      
      setCompletedOrder(orderPayload);
      
      if (!skipPrint) {
        try {
          await printReceiptBle({
            store: settings?.restaurantName || 'Intelli POS',
            header: settings?.receiptHeader,
            footer: settings?.receiptFooter,
            orderId: orderPayload.id,
            date: formatDateTime(orderPayload.timestamp, settings),
            items: cart.map(c => ({ name: c.name, qty: c.quantity, price: Number(c.price) || 0 })),
            subtotal, discount: discountVal, total,
            currency: settings?.currencySymbol || 'Rs.',
          });
          toast.success('Receipt sent to printer');
        } catch (printErr: any) {
          console.error('BLE print failed', printErr);
          // Fall back to system print dialog so the sale isn't blocked
          toast.error(printErr?.message || 'Print failed — showing system print dialog instead');
          window.print();
        }
      }
      
      setShowSuccess(true);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to save order');
    } finally {
      setIsSubmitting(false);
      setShowPrinterModal(false);
    }
  };

  const handleUpdateDineIn = async () => {
    if (!activeOrderCode) return toast.error('No active table order');
    if (cart.length === 0) return toast.error('Cart is empty');
    try {
      setIsSubmitting(true);
      await api.updateOrder(activeOrderCode, {
        items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, image: c.image, category: c.category, qty: c.quantity })),
        subtotal, discount: discountVal, cgst, sgst, total,
        paymentMode,
        orderStatus: 'ACTIVE',
      });
      // Order changed after serve => must swipe to serve again; table back to OCCUPIED.
      const tid = tableIdOf(selectedTable);
      if (tid) {
        try { await api.updateTableStatus(Number(tid), 'OCCUPIED', activeOrderCode); } catch {}
        setSelectedTable((prev: any) => (prev ? { ...prev, status: 'OCCUPIED' } : prev));
      }
      setServed(false);
      setServeProgress(0);
      toast.success(`Order ${activeOrderCode} updated for Table ${tableLabel(selectedTable)} — swipe to serve again`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDineIn = async () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    if (!selectedTable) return toast.error('Select a table first');
    try {
      setIsSubmitting(true);
      const tid = tableIdOf(selectedTable);
      const payload: any = {
        id: `INV-${Date.now()}`,
        timestamp: Date.now(),
        items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, image: c.image, category: c.category, qty: c.quantity })),
        subtotal, discount: discountVal, cgst, sgst, total,
        paymentMode, customerName, customerPhone,
        store: settings?.businessName || settings?.restaurantName || 'Intelli POS',
        currency: settings?.currencySymbol || 'Rs.',
        orderType: 'DINEIN', tableId: tid,
        tableNo: tableLabel(selectedTable),
        orderStatus: 'ACTIVE',
      };
      const res = await api.createOrder(payload);
      const orderId = res?.data?.orderCode || res?.data?.id || res?.orderCode || payload.id;
      try { await api.updateTableStatus(Number(tid), 'OCCUPIED', orderId); } catch {}
      setCompletedOrder({ ...payload, id: orderId });
      toast.success(`Order saved for Table ${payload.tableNo}`);
      clearCart();
      setCustomerName(''); setCustomerPhone(''); setDiscount('');
      resetDineState();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectTable = async (t: any) => {
    const status = tableStatusOf(t);
    const tid = t.id ?? t.tableId;
    if (!isTableActive(t)) {
      setSelectedTable(t);
      setActiveOrderCode(null);
      setServed(false);
      setServeProgress(0);
      setCustomerName('');
      setCustomerPhone('');
      clearCart();
      return;
    }
    // Occupied-table resume
    try {
      setIsSubmitting(true);
      const res = await api.getTableActiveOrder(tid);
      const ord = res?.data;
      setSelectedTable(t);
      if (!ord) {
        toast('No active order on this table — starting fresh', { icon: '🍽️' });
        setActiveOrderCode(null);
        setServed(false);
        setCustomerName('');
        setCustomerPhone('');
        clearCart();
        return;
      }
      const code = ord.orderCode || ord.id || ord.code;
      setActiveOrderCode(code || null);
      setServed(String(ord.orderStatus || '').toUpperCase() === 'SERVED');
      // Customer self-ordered via public menu — carry name/phone into POS.
      setCustomerName(ord.customerName || ord.customer_name || '');
      setCustomerPhone(ord.customerPhone || ord.customer_phone || ord.phone || '');
      // Populate cart
      clearCart();
      const rawItems: any[] = ord.items || [];
      rawItems.forEach((ri: any) => {
        const qty = Number(ri.qty ?? ri.quantity ?? 1);
        const match = menuItems.find(m => String(m.id) === String(ri.id) || m.name?.toLowerCase() === String(ri.name || '').toLowerCase());
        if (match) {
          addToCart(match);
          const added = usePosStore.getState().cart.find(c => c.id === match.id);
          if (added && qty > 1) updateQuantity(added.cartId, qty);
          else if (added && qty <= 0) removeFromCart(added.cartId);
        } else {
          addToCart({ id: Number(ri.id) || Date.now(), name: ri.name || 'Item', price: Number(ri.price) || 0, category: ri.category || 'Uncategorized', image: ri.image } as MenuItem, qty);
        }
      });
      toast.success(`Resumed order ${code}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load table order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleServeComplete = async () => {
    if (!activeOrderCode) return;
    try {
      try { await api.updateDineOrderStatus(activeOrderCode, 'SERVED'); }
      catch { await api.updateOrder(activeOrderCode, { orderStatus: 'SERVED' }); }
      // Table lifecycle: served order => Having Food.
      const tid = tableIdOf(selectedTable);
      if (tid) {
        try { await api.updateTableStatus(Number(tid), 'HAVING_FOOD', activeOrderCode); } catch {}
        setSelectedTable((prev: any) => (prev ? { ...prev, status: 'HAVING_FOOD' } : prev));
      }
      setServed(true);
      setServeProgress(100);
      toast.success('Order Served');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to mark served');
      setServeProgress(0);
    }
  };

  const handleResetAfterSuccess = () => {
    setShowSuccess(false);
    setCompletedOrder(null);
    clearCart();
    setCustomerName('');
    setCustomerPhone('');
    setDiscount('');
    setPaymentMode('');
    setMobileView('menu');
    if (isFood && orderType === 'DINEIN') {
      resetDineState();
    }
    // No refetch — just close the popup so POS stays instant
  };

  const handlePrintKOT = () => {
    if (cart.length === 0) return toast.error('Cart is empty');
    toast.success('KOT printed successfully');
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full min-h-0 overflow-hidden bg-gray-50 relative overscroll-none">
      {/* Full-screen blocking loader while order is processing */}
      {isSubmitting && (
        <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-gray-900/60 backdrop-blur-sm">
          <div className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
          <p className="mt-4 text-white font-bold">Processing order...</p>
          <p className="mt-1 text-white/70 text-sm">Please wait, do not press anything</p>
        </div>
      )}
      {/* Printer Modal */}
      {showPrinterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bluetooth className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Bluetooth Printer Disconnected</h3>
            <p className="text-gray-500 mb-6 text-sm">Cannot print receipt. Connect printer or proceed without printing if allowed.</p>
            
            <div className="space-y-3">
              <button onClick={connectBluetooth} className="w-full py-2.5 bg-brand-600 text-white rounded-xl font-medium flex items-center justify-center">
                <Bluetooth className="w-5 h-5 mr-2" /> Connect Bluetooth Printer
              </button>
              {!settings?.orderAfterBill && (
                <button onClick={() => processOrder(true)} className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200">
                  Sale Without Print
                </button>
              )}
              <button onClick={() => setShowPrinterModal(false)} className="w-full py-2.5 text-gray-500 font-medium hover:bg-gray-50 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pay confirmation (amount + mode) */}
      {pendingPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Confirm Payment</h3>
            <p className="text-sm text-gray-500 mb-4">
              {pendingPay.skipPrint ? (isEbill ? 'Pay' : 'Pay Only') : 'Pay & Print'}
              {isDineInFlow && selectedTable ? ` · Table ${tableLabel(selectedTable)}` : ''}
            </p>
            <div className="bg-gray-50 border border-gray-100 rounded-xl py-4 mb-4">
              <div className="font-display text-3xl font-bold text-brand-600">
                {settings?.currencySymbol || 'Rs.'}{total.toFixed(2)}
              </div>
              <div className="mt-1">
                <span className={cn(
                  'inline-block px-3 py-0.5 text-xs font-bold rounded-full uppercase',
                  paymentMode === 'CASH' ? 'bg-emerald-100 text-emerald-700' :
                  paymentMode === 'UPI' ? 'bg-purple-100 text-purple-700' :
                  'bg-blue-100 text-blue-700'
                )}>
                  {paymentMode}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{cart.reduce((n, c) => n + c.quantity, 0)} item(s)</p>
            </div>
            <div
              ref={payTrackRef}
              className="relative h-14 bg-gray-100 rounded-xl overflow-hidden select-none touch-none border border-gray-200 mb-3"
              onPointerMove={(e) => {
                if (!payDragging.current || !payTrackRef.current) return;
                const rect = payTrackRef.current.getBoundingClientRect();
                const pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                setPaySwipe(pct);
              }}
              onPointerUp={() => {
                payDragging.current = false;
                if (paySwipe > 85) {
                  const p = pendingPay;
                  setPendingPay(null);
                  setPaySwipe(0);
                  processOrder(p.skipPrint);
                } else {
                  setPaySwipe(0);
                }
              }}
              onPointerLeave={() => { if (payDragging.current) { payDragging.current = false; setPaySwipe(0); } }}
            >
              <div className="absolute inset-0 bg-brand-600 transition-all" style={{ width: `${paySwipe}%` }} />
              <span className={cn('absolute inset-0 flex items-center justify-center text-sm font-bold', paySwipe > 40 ? 'text-white' : 'text-gray-600')}>
                Swipe to Confirm →
              </span>
              <div
                className="absolute top-1 bottom-1 w-14 bg-white rounded-lg shadow flex items-center justify-center cursor-grab font-bold text-brand-700"
                style={{ left: `calc(${paySwipe}% - ${paySwipe * 0.56}px + 4px)` }}
                onPointerDown={(e) => { payDragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
              >→</div>
            </div>
            <button
              onClick={() => { setPendingPay(null); setPaySwipe(0); }}
              disabled={isSubmitting}
              className="w-full py-2.5 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {/* Barcode Scanner (fills search on scan, with beep) */}
      {showScanner && (
        <BarcodeScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={(code) => {
            setSearchQuery(code);
            toast.success(`Scanned: ${code}`);
          }}
        />
      )}

      {/* Success Modal */}
      {showSuccess && completedOrder && !showWhatsAppPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col items-center">
            <CheckCircle2 className="w-20 h-20 text-green-500 mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-gray-900">Order Success!</h2>
            <p className="text-gray-500 mt-1 mb-1">Payment: <span className="font-bold text-gray-900">{completedOrder.paymentMode}</span></p>
            {completedOrder.orderType && (
              <p className="text-gray-500 mb-5 text-sm">Order Type: <span className="font-bold text-gray-900">{completedOrder.orderType === 'DINEIN' ? 'DINE IN' : 'TAKE AWAY'}</span>{completedOrder.tableNo ? ` • Table ${completedOrder.tableNo}` : ''}</p>
            )}
            
            <div className="grid grid-cols-3 gap-3 w-full mb-6">
              <button onClick={() => toast.success('Printing bill...')} className="flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 p-3 rounded-xl border border-gray-200 transition-colors">
                <Printer className="w-6 h-6 text-gray-700 mb-2" />
                <span className="text-xs font-bold text-gray-700">Bill</span>
              </button>
              <button onClick={handlePrintKOT} className="flex flex-col items-center justify-center bg-amber-50 hover:bg-amber-100 p-3 rounded-xl border border-amber-200 transition-colors">
                <FileText className="w-6 h-6 text-amber-700 mb-2" />
                <span className="text-xs font-bold text-amber-700">KOT</span>
              </button>
              <button onClick={() => setShowWhatsAppPreview(true)} className="flex flex-col items-center justify-center bg-green-50 hover:bg-green-100 p-3 rounded-xl border border-green-200 transition-colors">
                <Share2 className="w-6 h-6 text-green-600 mb-2" />
                <span className="text-xs font-bold text-green-700">Share</span>
              </button>
            </div>

            <button onClick={handleResetAfterSuccess} className="w-full py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors">
              New Order
            </button>
            <button onClick={() => { handleResetAfterSuccess(); navigate('/dashboard'); }} className="w-full mt-2 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">
              Dashboard
            </button>
          </div>
        </div>
      )}

      {/* WhatsApp Full Screen Preview */}
      {showWhatsAppPreview && completedOrder && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-gray-50 animate-in slide-in-from-bottom">
          <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-sm shrink-0">
            <button onClick={() => setShowWhatsAppPreview(false)} className="p-2 -ml-2 text-gray-500 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="font-bold text-lg text-gray-900">Bill Preview</h2>
            <div className="w-10"></div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex justify-center custom-scrollbar">
            {/* Mock Bill Receipt */}
            <div ref={billRef} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 max-w-sm w-full font-mono text-sm h-fit">
              <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
                <h3 className="font-bold text-lg">{settings?.restaurantName || 'Intelli POS'}</h3>
                <p className="text-xs text-gray-500">Order: {completedOrder.id}</p>
                {completedOrder.orderType && <p className="text-xs text-gray-500">Order Type: {completedOrder.orderType === 'DINEIN' ? 'DINE IN' : 'TAKE AWAY'}{completedOrder.tableNo ? ` • Table ${completedOrder.tableNo}` : ''}</p>}
                <p className="text-xs text-gray-500">{formatDateTime(completedOrder.timestamp, settings)}</p>
              </div>
              <div className="space-y-2 mb-4">
                {completedOrder.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.qty}x {item.name}</span>
                    <span>{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-300 pt-4 space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{completedOrder.subtotal.toFixed(2)}</span>
                </div>
                {completedOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Discount</span>
                    <span>-{completedOrder.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base mt-2">
                  <span>Total</span>
                  <span>{completedOrder.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white border-t border-gray-200 shrink-0 flex gap-3">
            <button onClick={() => toast.success('Printing bill...')} className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center">
              <Printer className="w-5 h-5 mr-2" /> Print Bill
            </button>
            <button 
              onClick={async () => {
                if (billRef.current) {
                  const loadingToast = toast.loading('Preparing image...');
                  try {
                    const blob = await toBlob(billRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
                    if (!blob) {
                      toast.dismiss(loadingToast);
                      toast.error('Failed to generate bill image');
                      return;
                    }

                    const storeName = settings?.restaurantName || 'Intelli POS';
                    const billData = {
                      s: storeName,
                      h: settings?.receiptHeader,
                      f: settings?.receiptFooter,
                      id: completedOrder.id,
                      ts: completedOrder.timestamp,
                      items: completedOrder.items.map((i: any) => ({ n: i.name, q: i.qty, p: Number(i.price) || 0 })),
                      sub: completedOrder.subtotal,
                      disc: completedOrder.discount,
                      tot: completedOrder.total,
                      cur: settings?.currencySymbol || 'Rs.',
                      pm: completedOrder.paymentMode,
                    };
                    // Short link by order id — verify the backend can serve it
                    // publicly; otherwise fall back to the self-contained link.
                    let link = buildShortBillLink(completedOrder.id);
                    try {
                      await api.getPublicBill(completedOrder.id);
                    } catch {
                      link = await buildBillLink(billData);
                    }
                    const text = `Thank you for visiting ${storeName}!\nOrder: ${completedOrder.id}\nTotal: ${settings?.currencySymbol || 'Rs.'}${completedOrder.total.toFixed(2)}\nClick on the link to download your bill:\n${link}`;

                    // Copy bill image to clipboard so it can be pasted in the chat.
                    let copied = false;
                    try {
                      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                      copied = true;
                    } catch {}
                    toast.dismiss(loadingToast);

                    if (copied) {
                      toast.success('Bill image copied — paste it in WhatsApp chat', { duration: 4000 });
                    }

                    const phone = normalizePhone(completedOrder.customerPhone);
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
                  } catch (err) {
                    toast.dismiss(loadingToast);
                    console.error('Error generating image', err);
                    toast.error('Error generating bill image');
                  }
                }
              }} 
              className="flex-1 py-3.5 bg-[#25D366] text-white rounded-xl font-bold hover:bg-[#20b858] transition-colors flex items-center justify-center shadow-sm shadow-[#25D366]/30"
            >
              <Share2 className="w-5 h-5 mr-2" /> Share Bill
            </button>
          </div>
        </div>
      )}

      {/* Left side - Menu */}
      <div className={cn(
        "flex-1 flex-col h-full overflow-hidden",
        mobileView === 'menu' ? "flex" : "hidden lg:flex"
      )}>
        {/* Header & Search */}
        <div className="bg-white px-3 py-2 sm:p-4 border-b border-gray-100 flex flex-col shadow-sm z-10 gap-2 sm:gap-3 shrink-0">
          {/* Title row: desktop only — on mobile the BT icon lives in the top header */}
          <div className="hidden lg:flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              Point of Sale <span className="text-gray-400 font-normal text-sm ml-2 hidden sm:inline">- {settings?.restaurantName || 'Intelli POS'}</span>
            </h1>
            <div className="flex items-center space-x-2">
              {isEbill ? (
                <div className="flex items-center px-3 py-1.5 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  E-Bill
                </div>
              ) : settings?.printerConnectionType === 'usb' ? (
                <div className="flex items-center px-3 py-1.5 rounded-full text-xs font-bold border bg-blue-50 text-blue-700 border-blue-200">
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  USB Ready
                </div>
              ) : (
                <button 
                  onClick={!btConnected ? connectBluetooth : undefined}
                  title={btConnected ? "Bluetooth Printer Connected" : "Connect Bluetooth Printer"}
                  className={cn(
                    "flex items-center p-2 rounded-full text-xs font-bold border transition-colors",
                    btConnected 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100 cursor-pointer"
                  )}
                >
                  <Bluetooth className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {isFood && (
            <>
            <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => { setOrderType('DINEIN'); clearCart(); setServed(false); setActiveOrderCode(null); setServeProgress(0); }}
                className={cn("flex items-center justify-center py-2.5 rounded-lg font-bold text-sm transition-all", orderType === 'DINEIN' ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700")}
              >
                <UtensilsCrossed className="w-4 h-4 mr-2" /> DINE IN
              </button>
              <button
                onClick={() => { setOrderType('TAKEAWAY'); setSelectedTable(null); setActiveOrderCode(null); setServed(false); }}
                className={cn("flex items-center justify-center py-2.5 rounded-lg font-bold text-sm transition-all", orderType === 'TAKEAWAY' ? "bg-white text-gray-900 shadow" : "text-gray-500 hover:text-gray-700")}
              >
                <ShoppingBag className="w-4 h-4 mr-2" /> TAKE AWAY
              </button>
            </div>
            {orderType === 'DINEIN' && selectedTable && (
              <div className="flex items-center justify-between bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-xl text-sm font-bold">
                <span>DINE IN — TABLE {tableLabel(selectedTable)}{activeOrderCode ? ` • ${activeOrderCode}` : ''}</span>
                <button onClick={() => { setSelectedTable(null); setActiveOrderCode(null); setServed(false); clearCart(); fetchTables(); }} className="text-xs underline font-medium">Change</button>
              </div>
            )}
            </>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search items by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-16 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:bg-white focus:border-brand-500 transition-all text-gray-900 placeholder-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-10 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setShowScanner(true)}
                title="Scan barcode"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              >
                <ScanLine className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1 flex-1">
              {derivedCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl whitespace-nowrap font-medium text-sm transition-all border",
                    activeCategory === cat 
                      ? "bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-500/20" 
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2 sm:p-4 pb-24 lg:pb-4 custom-scrollbar no-chain-scroll">
          {isFood && orderType === 'DINEIN' && !selectedTable ? (
            <div>
              <h3 className="font-bold text-gray-900 mb-3 flex items-center"><Armchair className="w-5 h-5 mr-2" /> Select a Table</h3>
              {tablesLoading ? (
                <p className="text-gray-500 text-sm">Loading tables...</p>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {tables.map((t: any) => {
                    const st = tableStatusOf(t);
                    const havingFood = st === 'HAVING_FOOD';
                    const customerOrdered = st === 'CUSTOMER_ORDERED';
                    const occupied = st === 'OCCUPIED' || havingFood || customerOrdered;
                    const no = tableLabel(t);
                    return (
                      <button
                        key={t.id ?? no}
                        onClick={() => handleSelectTable(t)}
                        className={cn(
                          "p-4 rounded-xl border-2 font-bold text-center transition-all",
                          customerOrdered ? "bg-yellow-50 border-yellow-400 text-yellow-800 hover:bg-yellow-100"
                          : havingFood ? "bg-orange-50 border-orange-400 text-orange-700 hover:bg-orange-100"
                            : occupied ? "bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                            : "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                        )}
                      >
                        <div className="text-2xl mb-1">{customerOrdered ? '🟡' : occupied ? (havingFood ? '🟠' : '🔴') : '🟢'}</div>
                        <div className="text-sm">Table {no}</div>
                        <div className="text-[11px] font-medium">{customerOrdered ? 'CUSTOMER ORDERED' : havingFood ? 'HAVING FOOD' : occupied ? 'OCCUPIED' : 'FREE'}</div>
                      </button>
                    );
                  })}
                  {tables.length === 0 && <p className="text-gray-500 text-sm col-span-full">No tables found.</p>}
                </div>
              )}
            </div>
          ) : (
          <div className={cn(isFood && orderType === 'DINEIN' && !selectedTable && "pointer-events-none opacity-40")}>
          <div className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}>
            {isLoading ? (
              Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-start animate-pulse">
                  <div className="w-full aspect-square bg-gray-200 rounded-xl mb-3"></div>
                  <div className="w-3/4 h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="w-1/2 h-5 bg-gray-200 rounded mt-auto"></div>
                </div>
              ))
            ) : filteredItems.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-dashed border-gray-200">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-base font-medium text-gray-900">No items found</p>
                <p className="text-sm">Try a different category or search term.</p>
              </div>
            ) : (
              filteredItems.map(item => {
                const outOfStock = settings?.enableStock && !settings?.allowSaleWhenOutOfStock && (item.stock || 0) <= 0;
                const cartItem = cart.find(c => c.id === item.id);
                const displayName = item.name ? item.name.charAt(0).toUpperCase() + item.name.slice(1) : item.name;
                const dec = (cartId: string, qty: number) => {
                  if (qty > 1) updateQuantity(cartId, qty - 1);
                  else removeFromCart(cartId);
                };

                return (
                  <div
                    key={item.id}
                    onClick={() => { if (!outOfStock) handleAddToCart(item, 1); }}
                    className={cn(
                      "bg-white p-1.5 sm:p-3 rounded-xl border shadow-sm transition-all flex flex-col items-stretch text-left relative group select-none",
                      outOfStock ? "opacity-50 grayscale border-gray-200" : "border-gray-100 hover:shadow-md hover:border-brand-300 active:scale-[0.97] cursor-pointer"
                    )}
                  >
                    <div className="w-full aspect-square bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center relative">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-9 h-9 sm:w-12 sm:h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-display font-bold text-lg">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Qty badge top-right + minus top-left when in cart */}
                      {cartItem && !outOfStock && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); dec(cartItem.cartId, cartItem.quantity); }}
                            className="absolute top-1 left-1 w-5 h-5 flex items-center justify-center rounded-md bg-black/70 text-white backdrop-blur-sm hover:bg-black/90 z-10"
                            aria-label="Decrease"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="absolute top-1 right-1 min-w-[20px] h-5 px-1 rounded-md bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shadow z-10">
                            {cartItem.quantity}
                          </span>
                        </>
                      )}

                      {/* Small + button on thumbnail */}
                      {!outOfStock && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddToCart(item, 1); }}
                          className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-brand-600 text-white flex items-center justify-center shadow-md hover:bg-brand-700 active:scale-90 z-10"
                          aria-label={`Add ${item.name}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}

                      {/* Price overlay */}
                      <div className="absolute bottom-1 left-1 bg-black/75 text-white text-xs sm:text-sm font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm z-10 shadow-sm">
                        {settings?.currencySymbol || '₹'}{Number(item.price || 0).toFixed(0)}
                      </div>

                      {outOfStock && (
                        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="bg-red-600 text-white px-2 py-0.5 text-[10px] font-bold rounded-full shadow-sm">
                            OUT OF STOCK
                          </span>
                        </div>
                      )}
                    </div>

                    <h3 className="font-medium text-gray-900 text-[11px] sm:text-sm leading-tight mt-1 line-clamp-1 px-0.5">{displayName}</h3>
                    <p className="hidden sm:block font-display font-bold text-brand-600 text-sm px-0.5">
                      {settings?.currencySymbol || 'Rs.'} {Number(item.price || 0).toFixed(2)}
                    </p>
                  </div>
                )
              })
            )}
          </div>
          </div>
          )}
        </div>
      </div>

      {/* Right side - Cart */}
      <div className={cn(
        "w-full lg:w-[420px] xl:w-[480px] bg-white lg:border-l border-gray-200 flex-col shadow-2xl z-20 shrink-0 min-h-0",
        // Mobile: fixed below the top bar and sized to the *dynamic* viewport
        // so Pay buttons are never hidden behind Chrome's URL bar.
        // Desktop: normal flex column filling parent height.
        mobileView === 'cart' ? "flex fixed inset-x-0 top-16 bottom-16 h-[calc(100dvh-8rem)] lg:static lg:h-full lg:top-auto lg:bottom-auto" : "hidden lg:flex lg:h-full"
      )}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 pt-safe">
          <div className="flex items-center">
            <button onClick={() => setMobileView('menu')} className="lg:hidden mr-3 p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="font-display font-bold text-lg text-gray-900 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2 text-brand-600 hidden sm:block" /> Current Order
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {!isEbill && settings?.printerConnectionType !== 'usb' && (
              <button
                onClick={!btConnected ? connectBluetooth : undefined}
                title={btConnected ? 'Bluetooth Printer Connected' : 'Connect Bluetooth Printer'}
                className={cn(
                  'p-2 rounded-full border transition-colors',
                  btConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                )}
              >
                <Bluetooth className="w-5 h-5" />
              </button>
            )}
            <button 
              onClick={clearCart}
              disabled={cart.length === 0}
              className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Customer Details */}
        <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex gap-2 shrink-0">
          <input 
            type="text" 
            placeholder="Customer Name (Optional)" 
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          />
          <input 
            type="tel" 
            placeholder="Phone" 
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            className="w-1/3 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4 custom-scrollbar no-chain-scroll">
          <div className="space-y-2">
            {cart.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-4">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center">
                  <ShoppingCart className="w-10 h-10 opacity-30" />
                </div>
                <p className="font-medium text-sm text-gray-500">Your cart is empty</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.cartId} className="flex p-3 bg-white border border-gray-100 rounded-xl hover:border-gray-200 shadow-sm transition-colors group items-center justify-between">
                  <div className="flex-1 pr-2">
                    <h4 className="font-bold text-sm text-gray-900 leading-tight mb-1.5">{item.name}</h4>
                    <div className="flex items-center gap-3">
                      <p className="text-xs font-medium text-gray-500 w-12">{settings?.currencySymbol || 'Rs.'}{Number(item.price || 0).toFixed(2)}</p>
                      
                      <div className="flex items-center bg-gray-50 rounded p-0.5 border border-gray-200">
                        <button 
                          onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white text-gray-600 hover:text-red-600 shadow-sm border border-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-xs w-6 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white text-gray-600 hover:text-brand-600 shadow-sm border border-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button 
                        onClick={() => removeFromCart(item.cartId)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-sm text-gray-900">
                      {settings?.currencySymbol || 'Rs.'}{(Number(item.price || 0) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bill Math Inside Scroll Area */}
          {cart.length > 0 && (
            <div className="border-t border-gray-100 pt-4 pb-2 space-y-4">
              {/* Discount Bar */}
              <div className="bg-gray-50 p-2 rounded-xl border border-gray-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Discount:</span>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={discount}
                  onChange={e => setDiscount(e.target.value ? Number(e.target.value) : '')}
                  className="w-20 px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-500 outline-none"
                />
                <button onClick={() => setDiscount((Number(discount)||0) + 10)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-brand-600 hover:bg-brand-50 whitespace-nowrap">
                  +10
                </button>
                <button onClick={() => setDiscount((Number(discount)||0) + 50)} className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-bold text-brand-600 hover:bg-brand-50 whitespace-nowrap">
                  +50
                </button>
              </div>

              {/* Subtotal & Taxes */}
              <div className="space-y-2 text-sm px-1">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{settings?.currencySymbol || 'Rs.'}{subtotal.toFixed(2)}</span>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-medium">-{settings?.currencySymbol || 'Rs.'}{discountVal.toFixed(2)}</span>
                  </div>
                )}
                
                {cgst > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>CGST ({settings?.cgstPercent}%) {settings?.taxInclusive && '(Included)'}</span>
                    <span>{settings?.currencySymbol || 'Rs.'}{cgst.toFixed(2)}</span>
                  </div>
                )}
                {sgst > 0 && (
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>SGST ({settings?.sgstPercent}%) {settings?.taxInclusive && '(Included)'}</span>
                    <span>{settings?.currencySymbol || 'Rs.'}{sgst.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Checkout Bottom — always visible above browser chrome */}
        <div className="sticky bottom-0 border-t border-gray-200 bg-white shrink-0 pb-safe">
          <div className="p-4 pb-3">
            <div className="flex justify-between items-end border-b border-gray-100 pb-3 mb-3">
              <span className="text-gray-900 font-bold">Total Amount</span>
              <span className="font-display text-2xl font-bold text-brand-600 leading-none">
                {settings?.currencySymbol || 'Rs.'}{total.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3 bg-gray-100 p-1 rounded-xl">
              {[
                { mode: 'CASH', active: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' },
                { mode: 'UPI', active: 'bg-purple-600 text-white shadow-md shadow-purple-600/30' },
                { mode: 'CARD', active: 'bg-blue-600 text-white shadow-md shadow-blue-600/30' },
              ].map(({ mode, active }) => (
                <button
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={cn(
                    "flex items-center justify-center py-2 rounded-lg text-xs sm:text-sm font-bold transition-all",
                    paymentMode === mode
                      ? active
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent"
                  )}
                >
                  {mode === 'CASH' && <Banknote className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />}
                  {mode === 'UPI' && <QrCode className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />}
                  {mode === 'CARD' && <CreditCard className="w-3.5 h-3.5 mr-1 sm:mr-1.5" />}
                  <span>{mode}</span>
                </button>
              ))}
            </div>
            
            {isFood && orderType === 'DINEIN' && (
              <div className="mb-3 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs font-bold text-orange-800">
                DINE IN — TABLE {tableLabel(selectedTable)}{activeOrderCode ? ` • ${activeOrderCode}` : ''}
              </div>
            )}
            {isFood && orderType === 'DINEIN' && activeOrderCode && !served && (
              <div className="mb-3">
                <div
                  ref={serveTrackRef}
                  className="relative h-12 bg-gray-100 rounded-xl overflow-hidden select-none touch-none border border-gray-200"
                  onPointerMove={(e) => {
                    if (!serveDragging.current || !serveTrackRef.current) return;
                    const rect = serveTrackRef.current.getBoundingClientRect();
                    const pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                    setServeProgress(pct);
                  }}
                  onPointerUp={() => {
                    serveDragging.current = false;
                    if (serveProgress > 85) handleServeComplete();
                    else setServeProgress(0);
                  }}
                  onPointerLeave={() => { if (serveDragging.current) { serveDragging.current = false; setServeProgress(0); } }}
                >
                  <div className="absolute inset-0 bg-emerald-500 transition-all" style={{ width: `${serveProgress}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-600">Swipe to Serve →</span>
                  <div
                    className="absolute top-1 bottom-1 w-12 bg-white rounded-lg shadow flex items-center justify-center cursor-grab font-bold"
                    style={{ left: `calc(${serveProgress}% - ${serveProgress * 0.48}px + 4px)` }}
                    onPointerDown={(e) => { serveDragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
                  >→</div>
                </div>
              </div>
            )}
            {isFood && orderType === 'DINEIN' && served && (
              <div className="mb-3 flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 border border-emerald-200 rounded-xl py-2">
                <Check className="w-4 h-4" /> ✓ Order Served
              </div>
            )}
            {isFood && orderType === 'DINEIN' && activeOrderCode && (
              <div className="flex gap-2 mb-3">
                <button
                  onClick={handleUpdateDineIn}
                  disabled={cart.length === 0 || isSubmitting}
                  className="flex-1 flex items-center justify-center py-2.5 px-2 rounded-xl bg-white border border-brand-300 text-brand-700 font-bold hover:bg-brand-50 transition-all text-sm disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update Order (Save)'}
                </button>
              </div>
            )}
            <div className="flex gap-2">
              {settings?.enableKot && (
                <button 
                  onClick={handlePrintKOT}
                  disabled={cart.length === 0 || isSubmitting}
                  className="flex items-center justify-center px-3 sm:px-4 rounded-xl bg-amber-100 text-amber-800 font-bold hover:bg-amber-200 transition-all disabled:opacity-50"
                  title="Print KOT"
                >
                  <Printer className="w-5 h-5 sm:mr-1.5" /> 
                  <span className="hidden sm:inline">KOT</span>
                </button>
              )}
              
              {!settings?.orderAfterBill && (!isDineInFlow || isEbill) && (
              <button
                onClick={() => guardPay(true)}
                disabled={cart.length === 0 || isSubmitting || (isDineInFlow && (!selectedTable || !activeOrderCode || !served))}
                className={cn(
                  "flex items-center justify-center py-3.5 px-2 rounded-xl font-bold transition-all text-sm sm:text-base",
                  isEbill
                    ? "flex-[1.5] bg-brand-600 text-white hover:bg-brand-700 shadow-md shadow-brand-500/20"
                    : "flex-1 bg-white border border-brand-200 text-brand-700 hover:bg-brand-50"
                )}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : isEbill ? 'Pay' : 'Pay Only'}
              </button>
              )}
              {isFood && orderType === 'DINEIN' && !activeOrderCode ? (
                <button
                  onClick={handleSaveDineIn}
                  disabled={cart.length === 0 || isSubmitting || !selectedTable}
                  className="flex-[1.5] flex items-center justify-center py-3.5 px-2 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20 text-sm sm:text-base disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Only'}
                </button>
              ) : !isEbill ? (
              <button
                onClick={() => guardPay(false)}
                disabled={cart.length === 0 || isSubmitting || (isFood && orderType === 'DINEIN' && (!selectedTable || !activeOrderCode || !served))}
                className={cn(
                  "flex-[1.5] flex items-center justify-center py-3.5 px-2 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-all shadow-md shadow-brand-500/20 text-sm sm:text-base",
                  settings?.orderAfterBill && "flex-1"
                )}
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5 mr-1.5 sm:mr-2" />}
                {isFood && orderType === 'DINEIN' ? 'Pay & Print' : 'Pay & Print'}
              </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View Toggle (Only shown when on Menu view) */}
      <div className={cn(
        "lg:hidden fixed bottom-16 inset-x-0 px-2 pt-2 pb-safe flex flex-col items-center z-30 pointer-events-none",
        mobileView === 'cart' ? "hidden" : "flex"
      )}>
        {mobileView === 'menu' && cart.length > 0 && (
          <button 
            onClick={() => setMobileView('cart')}
            className="w-full bg-brand-600 text-white p-4 rounded-xl font-bold flex items-center justify-between shadow-xl shadow-brand-500/30 pointer-events-auto"
          >
            <div className="flex items-center">
              <span className="text-lg">{settings?.currencySymbol || 'Rs.'}{total.toFixed(2)}</span>
            </div>
            <span className="flex items-center text-sm uppercase tracking-wider">
              View Cart
              <span className="relative ml-2">
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                  {cart.reduce((n, c) => n + c.quantity, 0)}
                </span>
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

