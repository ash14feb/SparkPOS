import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2, AlertCircle, ShoppingBag, Info, Plus, Minus, Trash2, X, CheckCircle2, UtensilsCrossed, Star, MessageSquareText, ChefHat } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

function Stars({ value, onRate, size = 'w-7 h-7' }: { value: number; onRate?: (v: number) => void; size?: string }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onRate}
          onClick={() => onRate?.(s)}
          className={cn(!onRate && 'cursor-default')}
          aria-label={`${s} star`}
        >
          <Star className={cn(size, s <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-300', onRate && 'hover:scale-110 transition-transform')} />
        </button>
      ))}
    </div>
  );
}

interface CartLine {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  qty: number;
}

export function PublicMenuView() {
  const { code } = useParams();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);
  // Ratings (HAVING_FOOD only)
  const [overallRating, setOverallRating] = useState(0);
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [reviewText, setReviewText] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (code) {
      fetchMenu();
    }
  }, [code]);

  // Live status: when staff serves (HAVING_FOOD) or updates the order, the
  // public menu refreshes silently — no manual refresh needed.
  useEffect(() => {
    if (!code) return;
    pollRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !showCart) fetchMenu(true);
    }, 12000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, showCart]);

  const fetchMenu = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError('');
      const res = await api.getPublicMenu(code!);
      if (res.success && res.data) {
        setData(res.data);
        if (res.data?.activeOrder?.orderCode) {
          setPlacedOrder((prev: any) => prev || { orderCode: res.data.activeOrder.orderCode, tableNo: res.data.table?.table_no, total: res.data.activeOrder.total });
        }
        // Prefill name/phone from the live order so re-orders don't retype
        // (functional set => never clobbers what the user already typed).
        if (res.data?.activeOrder?.customerName) {
          const nm = res.data.activeOrder.customerName;
          setCustomerName((prev) => prev || nm);
        }
        if (res.data?.activeOrder?.customerPhone) {
          const ph = res.data.activeOrder.customerPhone;
          setCustomerPhone((prev) => prev || ph);
        }
        // Prefill existing review (if already rated on this device/order).
        const mr = res.data?.activeOrder?.myReview;
        if (mr) {
          if (mr.overallRating) setOverallRating((prev) => prev || mr.overallRating);
          if (mr.reviewText) setReviewText((prev) => prev || mr.reviewText);
          if (Array.isArray(mr.items) && mr.items.length) {
            setItemRatings((prev) => {
              if (Object.keys(prev).length) return prev;
              const m: Record<string, number> = {};
              mr.items.forEach((it: any) => { if (it.name) m[it.name] = it.rating; });
              return m;
            });
          }
        }
      } else {
        setError(res.message || 'Menu not found');
      }
    } catch (err: any) {
      if (!silent) setError(err.message || 'Failed to load menu');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const addToCart = (item: any) => {
    setCart((prev) => {
      const found = prev.find((c) => String(c.id) === String(item.id));
      if (found) return prev.map((c) => (String(c.id) === String(item.id) ? { ...c, qty: c.qty + 1 } : c));
      return [...prev, { id: String(item.id), name: item.name, price: Number(item.price) || 0, image: item.image || '', category: item.category || 'General', qty: 1 }];
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (String(c.id) === String(id) ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const cartCount = cart.reduce((n, c) => n + c.qty, 0);
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const handleConfirm = async () => {
    if (!customerName.trim()) return toast.error('Please enter your name');
    if (!customerPhone.trim()) return toast.error('Please enter your phone number');
    if (cart.length === 0) return toast.error('Your order is empty');
    try {
      setIsPlacing(true);
      const res = await api.placeTableOrder(code!, {
        items: cart.map((c) => ({ id: c.id, name: c.name, price: c.price, image: c.image, category: c.category, qty: c.qty })),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        kitchenNotes: kitchenNotes.trim(),
      });
      setPlacedOrder(res.data);
      setCart([]);
      setKitchenNotes('');
      setShowCart(false);
      toast.success(res.appended ? 'Extra items added to your order!' : 'Order placed!');
      // Refresh so the summary card + totals reflect the live order, then flip
      // into celebration mode (status back to CUSTOMER_ORDERED on re-order).
      await fetchMenu(true);
      setData((prev: any) => prev ? {
        ...prev,
        tableStatus: 'CUSTOMER_ORDERED',
        table: { ...(prev.table || {}), status: 'CUSTOMER_ORDERED', current_order_code: res.data?.orderCode || prev.table?.current_order_code || null },
      } : prev);
    } catch (err: any) {
      toast.error(err.message || 'Could not place order');
    } finally {
      setIsPlacing(false);
    }
  };

  const handleReview = async () => {
    if (!overallRating) return toast.error('Please tap the stars for an overall rating');
    if (reviewText.length > 250) return toast.error('Review must be within 250 characters');
    try {
      setIsReviewing(true);
      await api.submitTableReview(code!, {
        overallRating,
        reviewText: reviewText.trim(),
        itemRatings: Object.entries(itemRatings).map(([name, rating]) => ({ name, rating })),
      });
      toast.success('Thank you for your feedback! ⭐');
      await fetchMenu(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not save review');
    } finally {
      setIsReviewing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm text-center max-w-md w-full">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Oops!</h2>
          <p className="text-gray-600">{error || 'Menu not available'}</p>
        </div>
      </div>
    );
  }

  // Order placed -> celebration mode is handled inline (banner + VIBGYOR
  // background) so the customer can still browse the menu and add more items.

  const { table, restaurantName, currencySymbol, menuItems, activeOrder } = data;
  const tableStatus = String((data as any).tableStatus || table?.status || '').toUpperCase();
  const hasLiveOrder = (tableStatus === 'CUSTOMER_ORDERED' || tableStatus === 'HAVING_FOOD') && !!activeOrder;
  const isHavingFood = tableStatus === 'HAVING_FOOD';
  const customerOrdered =
    tableStatus === 'CUSTOMER_ORDERED' || !!placedOrder;
  const showCelebration = customerOrdered || isHavingFood;
  const welcomeName = (activeOrder?.customerName || customerName || '').trim();

  const categories = ['All', ...new Set(menuItems.map((item: any) => item.category || 'Other').filter(Boolean))] as string[];

  // Grouped by category (menu order preserved)
  const grouped: { category: string; items: any[] }[] = (() => {
    const map = new Map<string, any[]>();
    for (const item of menuItems) {
      const key = item.category || 'Other';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    const order = categories.filter((c) => c !== 'All');
    const sections = [...map.entries()].map(([category, items]) => ({ category, items }));
    sections.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    return activeCategory === 'All' ? sections : sections.filter((s) => s.category === activeCategory);
  })();

  return (
    <div className={cn("min-h-screen pb-28", !showCelebration && "bg-gray-50", showCelebration && "vibgyor-bg")}>
      <style>{`
        @keyframes vibgyorSmoke {
          0% { background-position: 0% 20%; }
          25% { background-position: 60% 40%; }
          50% { background-position: 100% 70%; }
          75% { background-position: 40% 100%; }
          100% { background-position: 0% 20%; }
        }
        .vibgyor-bg {
          background: linear-gradient(120deg, rgba(148,0,211,.28), rgba(75,0,130,.28), rgba(0,0,255,.22), rgba(0,255,0,.22), rgba(255,255,0,.26), rgba(255,127,0,.26), rgba(255,0,0,.26)),
            radial-gradient(circle at 20% 20%, rgba(255,0,128,.25), transparent 55%),
            radial-gradient(circle at 80% 30%, rgba(0,200,255,.25), transparent 55%),
            radial-gradient(circle at 50% 85%, rgba(150,255,0,.22), transparent 55%),
            #fdfaff;
          background-size: 300% 300%, 200% 200%, 200% 200%, 200% 200%;
          animation: vibgyorSmoke 14s ease-in-out infinite;
        }
        @keyframes starFly {
          0% { transform: translateY(110vh) rotate(0deg) scale(.6); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(-15vh) rotate(360deg) scale(1.2); opacity: 0; }
        }
        .flying-star { position: fixed; bottom: -40px; animation: starFly linear infinite; pointer-events: none; z-index: 5; }
        @keyframes popIn { 0% { transform: scale(.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .pop-in { animation: popIn .5s ease-out both; }
      `}</style>
      {showCelebration && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-[4]" aria-hidden>
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="flying-star"
              style={{
                left: `${(i * 41) % 100}%`,
                fontSize: `${12 + ((i * 7) % 20)}px`,
                animationDuration: `${5 + ((i * 13) % 7)}s`,
                animationDelay: `${(i * 0.45) % 6}s`,
              }}
            >
              {['⭐', '✨', '🌟', '💫'][i % 4]}
            </span>
          ))}
        </div>
      )}
      {isHavingFood && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="pop-in relative overflow-hidden rounded-2xl p-6 text-center text-white shadow-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500">
            <div className="text-4xl mb-2">🍽️</div>
            <h2 className="text-3xl font-display font-bold leading-tight">Dear {welcomeName || 'Customer'}</h2>
            <p className="text-lg font-bold mt-1">Enjoy Food! 🎉</p>
            <p className="text-sm text-white/95 mt-1 font-medium">Thank you for visiting!</p>
            <p className="text-xs text-white/85 mt-2">Craving more? Add items below — same table, same order. 🙏</p>
          </div>
        </div>
      )}
      {customerOrdered && !isHavingFood && (
        <div className="max-w-3xl mx-auto px-4 pt-4">
          <div className="pop-in relative overflow-hidden rounded-2xl p-5 text-center text-white shadow-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-500">
            <div className="text-4xl mb-1">🎉</div>
            <h2 className="text-xl font-bold">Thank you for ordering!</h2>
            <p className="text-sm text-white/95 mt-1 font-medium">Your Order is getting prepared. Please wait!</p>
            {placedOrder && (
              <p className="text-xs text-white/85 mt-1">Table {placedOrder.tableNo} · Order {placedOrder.orderCode}{placedOrder.appended ? ' · extra items added' : ''}</p>
            )}
            <p className="text-xs text-white/85 mt-2">Need something else? Add more items below — same table, same order. 🙏</p>
          </div>
        </div>
      )}
      {hasLiveOrder && (
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-5 mb-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900 text-sm">🧾 Your Ordered Items{tableStatus === 'HAVING_FOOD' ? ' · Being Served' : ''}</h3>
              {activeOrder.orderCode && (
                <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{activeOrder.orderCode}</span>
              )}
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {activeOrder.items?.map((it: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">{it.qty}x {it.name}</span>
                  <span className="font-medium text-gray-900">{currencySymbol || 'Rs.'}{Number(it.lineTotal ?? it.price * it.qty).toFixed(2)}</span>
                </div>
              ))}
              {(!activeOrder.items || activeOrder.items.length === 0) && (
                <p className="text-sm text-gray-500">No items found on this order.</p>
              )}
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-2 mt-2 border-t border-gray-200">
              <span>Order Total</span>
              <span>{currencySymbol || 'Rs.'}{Number(activeOrder.total ?? 0).toFixed(2)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Please pay at the counter. Thank you!</p>
            {isHavingFood && Number(activeOrder.total ?? 0) > 0 && (
              <a
                href={`upi://pay?pa=aaaaindia@ybl&pn=9986439557&cu=INR&am=${Number(activeOrder.total ?? 0).toFixed(2)}`}
                className="mt-3 w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2 text-center"
              >
                💳 Pay {currencySymbol || 'Rs.'}{Number(activeOrder.total ?? 0).toFixed(2)} via UPI
              </a>
            )}
          </div>
        </div>
      )}
      {isHavingFood && hasLiveOrder && (
        <div className="max-w-3xl mx-auto px-4 pt-1 pb-5 mb-1">
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-4">
            <h3 className="font-bold text-gray-900 text-sm flex items-center">
              <Star className="w-4 h-4 mr-1.5 text-amber-400 fill-amber-400" />
              {activeOrder?.myReview ? 'Your Rating (tap to update)' : 'How was your food? Rate us!'}
            </h3>
            <div className="mt-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Overall Experience *</p>
              <Stars value={overallRating} onRate={setOverallRating} />
            </div>
            <div className="mt-4 space-y-2.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rate each dish</p>
              {activeOrder?.items?.map((it: any, i: number) => (
                <div key={`${it.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-700 truncate flex-1">{it.qty}x {it.name}</span>
                  <Stars
                    value={itemRatings[it.name] || 0}
                    size="w-5 h-5"
                    onRate={(v) => setItemRatings((prev) => ({ ...prev, [it.name]: v }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4">
              <label className="flex items-center text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                <MessageSquareText className="w-3.5 h-3.5 mr-1.5" /> Write a review
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value.slice(0, 250))}
                placeholder="Loved the taste? Tell us in a few words…"
                rows={3}
                maxLength={250}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none text-sm"
              />
              <p className="text-[11px] text-gray-400 mt-1 text-right">{reviewText.length}/250</p>
            </div>
            <button
              onClick={handleReview}
              disabled={isReviewing || !overallRating}
              className="mt-2 w-full py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center"
            >
              {isReviewing ? <Loader2 className="w-5 h-5 animate-spin" /> : activeOrder?.myReview ? 'Update My Review' : 'Submit My Review'}
            </button>
            {Number(activeOrder?.total ?? 0) > 0 && (
              <a
                href={`upi://pay?pa=aaaaindia@ybl&pn=9986439557&cu=INR&am=${Number(activeOrder?.total ?? 0).toFixed(2)}`}
                className="mt-2 w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2 text-center"
              >
                💳 Pay {currencySymbol || 'Rs.'}{Number(activeOrder?.total ?? 0).toFixed(2)} Directly via UPI
              </a>
            )}
          </div>
        </div>
      )}
      {/* Header: restaurant + table on top */}
      <header className="bg-white shadow-sm sticky top-0 z-20 pb-2">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-gray-900 leading-tight">
                {restaurantName || 'Digital Menu'}
              </h1>
              {table && (
                <p className="text-sm font-bold text-brand-700 mt-0.5 flex items-center">
                  <UtensilsCrossed className="w-4 h-4 mr-1.5" />
                  Table {table.table_no} • {table.seats} Seats
                </p>
              )}
            </div>
            <button
              onClick={() => cart.length > 0 && setShowCart(true)}
              className="relative w-11 h-11 bg-brand-600 rounded-full flex items-center justify-center text-white shadow-md"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>

          {/* Category Scroller */}
          <div className="flex overflow-x-auto hide-scrollbar space-x-2 pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
                  activeCategory === cat
                    ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Menu grouped by category */}
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {grouped.map((sec) => (
          <section key={sec.category}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{sec.category}</h2>
              <span className="text-[11px] font-bold text-gray-500 bg-gray-200/60 px-2 py-0.5 rounded-full">{sec.items.length}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sec.items.map((item: any) => {
                const line = cart.find((c) => String(c.id) === String(item.id));
                return (
                  <div key={item.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-4">
                    <div className="w-24 h-24 bg-gray-100 rounded-xl flex-shrink-0 overflow-hidden">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-display text-2xl font-bold bg-brand-50/50">
                          {item.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base leading-tight mb-1">{item.name}</h3>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <span className="font-display font-bold text-brand-600 text-lg">
                          {currencySymbol || 'Rs.'} {Number(item.price || 0).toFixed(2)}
                        </span>
                        {!line ? (
                          <button
                            onClick={() => addToCart(item)}
                            className="flex items-center px-3 py-1.5 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700"
                          >
                            <Plus className="w-4 h-4 mr-1" /> Add
                          </button>
                        ) : (
                          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                            <button onClick={() => changeQty(line.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-white shadow-sm text-gray-700">
                              {line.qty === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                            </button>
                            <span className="font-bold text-sm w-5 text-center">{line.qty}</span>
                            <button onClick={() => changeQty(line.id, 1)} className="w-7 h-7 flex items-center justify-center rounded-md bg-white shadow-sm text-gray-700">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {grouped.length === 0 && (
          <div className="py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
            <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="font-medium">No items found in this category.</p>
          </div>
        )}
      </main>

      {/* Bottom order bar: new items in cart, else live order total */}
      {cartCount > 0 && !showCart ? (
        <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t border-gray-200 z-30 pb-safe">
          <div className="max-w-3xl mx-auto">
            <button
              onClick={() => setShowCart(true)}
              className="w-full bg-brand-600 text-white p-4 rounded-xl font-bold flex items-center justify-between shadow-xl"
            >
              <span className="text-lg">{currencySymbol || 'Rs.'}{cartTotal.toFixed(2)}</span>
              <span className="text-sm uppercase tracking-wider">View Order · {cartCount}</span>
            </button>
          </div>
        </div>
      ) : hasLiveOrder && !showCart ? (
        <div className="fixed bottom-0 inset-x-0 p-3 bg-white border-t border-gray-200 z-30 pb-safe">
          <div className="max-w-3xl mx-auto">
            <div className="w-full bg-gray-900 text-white p-4 rounded-xl font-bold flex items-center justify-between shadow-xl">
              <span className="text-xs uppercase tracking-wider text-white/70">Order Total · {activeOrder.items?.length || 0} item(s)</span>
              <span className="text-lg">{currencySymbol || 'Rs.'}{Number(activeOrder.total ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Cart / checkout sheet */}
      {showCart && (
        <div className="fixed inset-0 z-40 flex flex-col bg-gray-50 animate-in slide-in-from-bottom">
          <div className="bg-white p-4 border-b border-gray-200 flex items-center justify-between shadow-sm">
            <button onClick={() => setShowCart(false)} className="p-2 -ml-2 text-gray-500 hover:text-gray-900">
              <X className="w-6 h-6" />
            </button>
            <h2 className="font-bold text-lg text-gray-900">Your Order{table ? ` · Table ${table.table_no}` : ''}</h2>
            <div className="w-10" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 max-w-3xl w-full mx-auto">
            {cart.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100">
                <div className="flex-1 pr-2">
                  <h4 className="font-bold text-sm text-gray-900">{c.name}</h4>
                  <p className="text-xs text-gray-500">{currencySymbol || 'Rs.'}{Number(c.price).toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-gray-50 rounded p-0.5 border border-gray-200">
                    <button onClick={() => changeQty(c.id, -1)} className="w-7 h-7 flex items-center justify-center rounded bg-white shadow-sm border border-gray-100">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-bold text-sm w-7 text-center">{c.qty}</span>
                    <button onClick={() => changeQty(c.id, 1)} className="w-7 h-7 flex items-center justify-center rounded bg-white shadow-sm border border-gray-100">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="font-bold text-sm w-16 text-right">{currencySymbol || 'Rs.'}{(c.price * c.qty).toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 98765 43210"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <ChefHat className="w-4 h-4 mr-1.5 text-orange-500" /> Notes to Kitchen?
                </label>
                <textarea
                  value={kitchenNotes}
                  onChange={(e) => setKitchenNotes(e.target.value.slice(0, 500))}
                  placeholder="Less spicy, no onion, extra crispy… our chef will take care! 👨‍🍳"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none"
                />
                <p className="text-[11px] text-gray-400 mt-1">Any allergy, spice level or special request — tell our kitchen directly.</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white border-t border-gray-200 pb-safe">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="font-display text-2xl font-bold text-brand-600">{currencySymbol || 'Rs.'}{cartTotal.toFixed(2)}</div>
              <button
                onClick={handleConfirm}
                disabled={isPlacing || cart.length === 0}
                className="flex-1 py-3.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center"
              >
                {isPlacing ? <Loader2 className="w-5 h-5 animate-spin" /> : (hasLiveOrder || showCelebration ? 'Add More Items' : 'Confirm Order')}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="py-6 text-center text-sm text-gray-400">
        Powered by Intelli Billing Software
      </footer>
    </div>
  );
}
