import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Loader2,
  AlertCircle,
  ShoppingBag,
  Info,
  Plus,
  Minus,
  Trash2,
  X,
  CheckCircle2,
  UtensilsCrossed,
  Star,
  MessageSquareText,
  ChefHat,
  Search,
  Copy,
  Check,
  Clock,
  Sparkles,
  Flame,
  ArrowRight,
  Receipt,
  QrCode,
  HeartHandshake,
  User,
  Phone,
  Send,
  ChevronDown,
  ChevronUp,
  RotateCw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface CartLine {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  qty: number;
}

// Spice level helpers (set per item in Menu > Items).
export function spiceEmoji(level: number): string {
  const l = Number(level) || 0;
  if (l >= 3) return '🌶️🌶️🌶️';
  if (l === 2) return '🌶️🌶️';
  if (l === 1) return '🌶️';
  return '';
}

export function spiceLabel(level: number): string {
  const l = Number(level) || 0;
  if (l >= 3) return 'Extra hot';
  if (l === 2) return 'Medium spicy';
  if (l === 1) return 'Mild spicy';
  return '';
}

// Interactive Golden Stars Component
function StarRating({
  value,
  onRate,
  size = 'w-7 h-7',
  interactive = true,
}: {
  value: number;
  onRate?: (v: number) => void;
  size?: string;
  interactive?: boolean;
}) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const activeStars = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!interactive || !onRate}
          onClick={() => onRate?.(s)}
          onMouseEnter={() => interactive && setHoverValue(s)}
          onMouseLeave={() => interactive && setHoverValue(null)}
          className={cn(
            'transition-all duration-150 p-1 rounded-lg focus:outline-none',
            interactive ? 'cursor-pointer hover:scale-115 active:scale-95' : 'cursor-default'
          )}
          aria-label={`${s} Star Rating`}
        >
          <Star
            className={cn(
              size,
              'transition-colors duration-150',
              s <= activeStars
                ? 'text-amber-400 fill-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.4)]'
                : 'text-stone-300 fill-stone-100'
            )}
          />
        </button>
      ))}
    </div>
  );
}

// Veg / Non-Veg food dietary indicator
function DietIndicator({ name, category }: { name: string; category?: string }) {
  const text = `${name} ${category || ''}`.toLowerCase();
  const isNonVeg =
    text.includes('chicken') ||
    text.includes('mutton') ||
    text.includes('fish') ||
    text.includes('egg') ||
    text.includes('meat') ||
    text.includes('prawn') ||
    text.includes('pork') ||
    text.includes('beef') ||
    text.includes('non veg') ||
    text.includes('non-veg');

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 border rounded-[3px] p-[1.5px] shrink-0',
        isNonVeg ? 'border-red-600 bg-red-50/50' : 'border-emerald-600 bg-emerald-50/50'
      )}
      title={isNonVeg ? 'Non-Vegetarian' : 'Vegetarian'}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          isNonVeg ? 'bg-red-600' : 'bg-emerald-600'
        )}
      />
    </span>
  );
}

export function PublicMenuView() {
  const { code } = useParams();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart & Ordering State
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<any>(null);

  // Accordion for receipt / live items
  const [showOrderItems, setShowOrderItems] = useState(true);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedOrderCode, setCopiedOrderCode] = useState(false);

  // Ratings (HAVING_FOOD state)
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

  // Live silent polling every 12 seconds so status updates (e.g. from CUSTOMER_ORDERED to HAVING_FOOD)
  // appear instantly without requiring manual browser reload
  useEffect(() => {
    if (!code) return;
    pollRef.current = window.setInterval(() => {
      if (document.visibilityState === 'visible' && !showCart) {
        fetchMenu(true);
      }
    }, 12000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [code, showCart]);

  const fetchMenu = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError('');
      const res = await api.getPublicMenu(code!);
      if (res.success && res.data) {
        setData(res.data);
        if (res.data?.activeOrder?.orderCode) {
          setPlacedOrder((prev: any) => prev || {
            orderCode: res.data.activeOrder.orderCode,
            tableNo: res.data.table?.table_no,
            total: res.data.activeOrder.total,
          });
        }
        // Prefill name/phone from live order if available
        if (res.data?.activeOrder?.customerName) {
          const nm = res.data.activeOrder.customerName;
          setCustomerName((prev) => prev || nm);
        }
        if (res.data?.activeOrder?.customerPhone) {
          const ph = res.data.activeOrder.customerPhone;
          setCustomerPhone((prev) => prev || ph);
        }
        // Prefill existing review if already rated
        const mr = res.data?.activeOrder?.myReview;
        if (mr) {
          if (mr.overallRating) setOverallRating((prev) => prev || mr.overallRating);
          if (mr.reviewText) setReviewText((prev) => prev || mr.reviewText);
          if (Array.isArray(mr.items) && mr.items.length) {
            setItemRatings((prev) => {
              if (Object.keys(prev).length) return prev;
              const m: Record<string, number> = {};
              mr.items.forEach((it: any) => {
                if (it.name) m[it.name] = it.rating;
              });
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
      if (found) {
        return prev.map((c) => (String(c.id) === String(item.id) ? { ...c, qty: c.qty + 1 } : c));
      }
      return [
        ...prev,
        {
          id: String(item.id),
          name: item.name,
          price: Number(item.price) || 0,
          image: item.image || '',
          category: item.category || 'General',
          qty: 1,
        },
      ];
    });
    toast.success(`Added ${item.name}`, { duration: 1500, position: 'bottom-center' });
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

  const handleConfirmOrder = async () => {
    if (!customerName.trim()) return toast.error('Please enter your name');
    if (!customerPhone.trim()) return toast.error('Please enter your phone number');
    if (cart.length === 0) return toast.error('Your order is empty');

    try {
      setIsPlacing(true);
      const res = await api.placeTableOrder(code!, {
        items: cart.map((c) => ({
          id: c.id,
          name: c.name,
          price: c.price,
          image: c.image,
          category: c.category,
          qty: c.qty,
        })),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        kitchenNotes: kitchenNotes.trim(),
      });

      setPlacedOrder(res.data);
      setCart([]);
      setKitchenNotes('');
      setShowCart(false);
      toast.success(res.appended ? 'Extra dishes added to your table!' : 'Order sent to the kitchen! 👨‍🍳');

      // Refresh data so live order card updates smoothly
      await fetchMenu(true);
      setData((prev: any) =>
        prev
          ? {
              ...prev,
              tableStatus: 'CUSTOMER_ORDERED',
              table: {
                ...(prev.table || {}),
                status: 'CUSTOMER_ORDERED',
                current_order_code: res.data?.orderCode || prev.table?.current_order_code || null,
              },
            }
          : prev
      );
    } catch (err: any) {
      toast.error(err.message || 'Could not place order');
    } finally {
      setIsPlacing(false);
    }
  };

  const handleReview = async () => {
    if (!overallRating) return toast.error('Please tap stars to rate your overall experience');
    if (reviewText.length > 250) return toast.error('Review must be within 250 characters');

    try {
      setIsReviewing(true);
      await api.submitTableReview(code!, {
        overallRating,
        reviewText: reviewText.trim(),
        itemRatings: Object.entries(itemRatings).map(([name, rating]) => ({ name, rating })),
      });
      toast.success('Thank you! Your feedback is deeply appreciated ⭐');
      await fetchMenu(true);
    } catch (err: any) {
      toast.error(err.message || 'Could not save review');
    } finally {
      setIsReviewing(false);
    }
  };

  const copyToClipboard = (text: string, type: 'upi' | 'orderCode') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'upi') {
        setCopiedUpi(true);
        toast.success('UPI ID copied to clipboard');
        setTimeout(() => setCopiedUpi(false), 2000);
      } else {
        setCopiedOrderCode(true);
        toast.success('Order code copied');
        setTimeout(() => setCopiedOrderCode(false), 2000);
      }
    });
  };

  const addNoteTag = (tag: string) => {
    if (!kitchenNotes.includes(tag)) {
      setKitchenNotes((prev) => (prev ? `${prev.trim()}, ${tag}` : tag));
    }
  };

  const addReviewCompliment = (compliment: string) => {
    if (!reviewText.includes(compliment)) {
      setReviewText((prev) => (prev ? `${prev.trim()} ${compliment}` : compliment).slice(0, 250));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center p-6 text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-amber-200 border-t-amber-600 animate-spin mb-4" />
          <ChefHat className="w-7 h-7 text-amber-600 absolute inset-0 m-auto" />
        </div>
        <h2 className="text-xl font-display font-bold text-slate-800 tracking-tight">Setting your table…</h2>
        <p className="text-sm text-stone-500 mt-1 max-w-xs">Loading live menu and table details</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-stone-200/80 text-center max-w-md w-full">
          <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-display font-bold text-slate-900 mb-2">Table Not Found</h2>
          <p className="text-stone-600 text-sm leading-relaxed mb-6">{error || 'This dining table QR code is invalid or no longer active.'}</p>
          <button
            onClick={() => fetchMenu()}
            className="w-full py-3 px-4 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors inline-flex items-center justify-center gap-2"
          >
            <RotateCw className="w-4 h-4" /> Try Reloading
          </button>
        </div>
      </div>
    );
  }

  const { table, restaurantName, currencySymbol, menuItems, activeOrder } = data;
  const tableStatus = String((data as any).tableStatus || table?.status || '').toUpperCase();
  const hasLiveOrder = (tableStatus === 'CUSTOMER_ORDERED' || tableStatus === 'HAVING_FOOD') && !!activeOrder;
  const isHavingFood = tableStatus === 'HAVING_FOOD';
  const customerOrdered = tableStatus === 'CUSTOMER_ORDERED' || !!placedOrder;
  const welcomeName = (activeOrder?.customerName || customerName || '').trim();

  // Ratings sentiment helper
  const getRatingSentiment = (r: number) => {
    if (r === 5) return { label: 'Exceptional Dining!', desc: 'Outstanding food & hospitality 🌟' };
    if (r === 4) return { label: 'Very Good!', desc: 'Thoroughly enjoyed the meal ✨' };
    if (r === 3) return { label: 'Good', desc: 'Satisfactory taste & service 👍' };
    if (r === 2) return { label: 'Average', desc: 'Room for improvement' };
    if (r === 1) return { label: 'Needs Improvement', desc: 'We will do better next time' };
    return { label: 'Select your rating', desc: 'Tap the stars above to rate' };
  };

  const categories = ['All', ...new Set(menuItems.map((item: any) => item.category || 'Specialties').filter(Boolean))] as string[];

  // Filter items by active category & search query
  const filteredItems = menuItems.filter((item: any) => {
    const matchesCategory = activeCategory === 'All' || (item.category || 'Specialties') === activeCategory;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      item.name.toLowerCase().includes(query) ||
      (item.category && item.category.toLowerCase().includes(query)) ||
      (item.description && item.description.toLowerCase().includes(query));
    return matchesCategory && matchesSearch;
  });

  // Group filtered items by category
  const grouped: { category: string; items: any[] }[] = (() => {
    const map = new Map<string, any[]>();
    for (const item of filteredItems) {
      const key = item.category || 'Specialties';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    const order = categories.filter((c) => c !== 'All');
    const sections = [...map.entries()].map(([category, items]) => ({ category, items }));
    sections.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
    return sections;
  })();

  // Today's Recommended: join picks with live menu items for full info.
  const recommendedPicks: any[] = (() => {
    const recs: any[] = (data as any).recommended || [];
    if (!recs.length) return [];
    const byId = new Map(menuItems.map((m: any) => [String(m.id), m]));
    return recs
      .map((r: any) => {
        const m = byId.get(String(r.productId ?? r.product_id));
        if (!m) return null;
        const delta = Number(r.priceDelta ?? r.price_delta) || 0;
        return { ...m, recPrice: Number(m.price || 0) + delta, recDelta: delta };
      })
      .filter(Boolean);
  })();

  // Shared dish card: description, spice emojis, out-of-stock grey-out.
  // Pass priceOverride for recommended picks (base + delta).
  const renderDishCard = (item: any, priceOverride?: number) => {
    const available = item.isAvailable !== false;
    const effPrice = priceOverride !== undefined ? priceOverride : Number(item.price || 0);
    const cartId = priceOverride !== undefined ? `rec-${item.id}` : String(item.id);
    const line = cart.find((c) => String(c.id) === cartId);
    const alreadyOrderedQty = activeOrder?.items?.find((ai: any) => ai.name === item.name)?.qty;
    const spice = spiceEmoji(Number(item.spiceLevel || 0));
    const spiceTitle = spiceLabel(Number(item.spiceLevel || 0));

    return (
      <div
        key={priceOverride !== undefined ? `rec-${item.id}` : item.id}
        className={cn(
          'bg-white rounded-2xl p-3.5 border transition-all duration-200 flex gap-3.5 items-center relative overflow-hidden group',
          !available && 'opacity-60 grayscale',
          line
            ? 'border-amber-400/80 shadow-md bg-amber-50/20'
            : 'border-stone-200/80 shadow-xs hover:border-stone-300 hover:shadow-sm'
        )}
      >
        {/* Dish Thumbnail / Avatar */}
        <div className="w-20 h-20 bg-stone-100 rounded-xl shrink-0 overflow-hidden relative border border-stone-100">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              className={cn('w-full h-full object-cover group-hover:scale-105 transition-transform duration-300', !available && 'grayscale')}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-stone-100 text-stone-400">
              <span className="font-display font-bold text-xl text-amber-800/60">
                {item.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute top-1.5 left-1.5">
            <DietIndicator name={item.name} category={item.category} />
          </div>
          {!available && (
            <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-white text-[9px] font-bold text-center py-0.5 uppercase tracking-wide">
              Out of Stock
            </div>
          )}
        </div>

        {/* Details & Price */}
        <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
          <div>
            <h4 className="font-display font-bold text-slate-900 text-sm leading-snug truncate">
              {item.name}
              {spice ? (
                <span className="ml-1.5 text-xs" title={spiceTitle} role="img" aria-label={spiceTitle}>
                  {spice}
                </span>
              ) : null}
            </h4>
            {item.description ? (
              <p className="text-[11px] text-stone-500 leading-snug mt-0.5 line-clamp-2">{item.description}</p>
            ) : alreadyOrderedQty ? (
              <span className="inline-block text-[10px] font-medium text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded mt-0.5">
                Ordered ×{alreadyOrderedQty} at table
              </span>
            ) : item.category ? (
              <span className="text-[11px] text-stone-400 truncate block mt-0.5">
                {item.category}
              </span>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 mt-2">
            <div className="font-display font-bold text-slate-900 text-base">
              <span className="text-xs text-stone-500 mr-0.5">{currencySymbol || 'Rs.'}</span>
              {effPrice.toFixed(0)}
              {priceOverride !== undefined && Number(item.recDelta || 0) !== 0 && (
                <span className="ml-1.5 text-[11px] font-medium text-stone-400 line-through">
                  {currencySymbol || 'Rs.'}{Number(item.price || 0).toFixed(0)}
                </span>
              )}
            </div>

            {!available ? (
              <span className="px-3 py-1.5 rounded-lg bg-stone-200 text-stone-500 font-display font-bold text-xs">
                Unavailable
              </span>
            ) : !line ? (
              <button
                type="button"
                onClick={() => addToCart({ ...item, id: cartId, price: effPrice })}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-display font-bold text-xs shadow-xs hover:shadow-sm transition-all flex items-center gap-1 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Add
              </button>
            ) : (
              <div className="flex items-center bg-slate-900 text-white rounded-lg p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => changeQty(line.id, -1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-white hover:bg-white/20 transition-colors"
                  aria-label="Decrease quantity"
                >
                  {line.qty === 1 ? <Trash2 className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3" />}
                </button>
                <span className="font-bold text-xs w-6 text-center text-amber-300 font-mono">
                  {line.qty}
                </span>
                <button
                  type="button"
                  onClick={() => changeQty(line.id, 1)}
                  className="w-6 h-6 flex items-center justify-center rounded text-white hover:bg-white/20 transition-colors"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const sentiment = getRatingSentiment(overallRating);
  const upiPayAmount = Number(activeOrder?.total ?? 0).toFixed(2);
  const upiId = 'aaaaindia@ybl';
  const upiUrl = `upi://pay?pa=${upiId}&pn=9986439557&cu=INR&am=${upiPayAmount}`;

  return (
    <div className="min-h-screen bg-[#faf8f5] text-slate-900 pb-36 font-sans selection:bg-amber-200 selection:text-amber-950">
      {/* Top Ambient Restaurant Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200/80 shadow-xs">
        <div className="max-w-2xl mx-auto px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center font-display font-bold text-lg shadow-sm shrink-0">
                {restaurantName ? restaurantName.charAt(0).toUpperCase() : '🍽️'}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-display font-bold text-slate-900 tracking-tight truncate leading-tight">
                  {restaurantName || 'Artisan Dining'}
                </h1>
                {table && (
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-500">
                    <span className="inline-flex items-center font-semibold text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                      <UtensilsCrossed className="w-3 h-3 mr-1 text-amber-600" />
                      Table {table.table_no}
                    </span>
                    {table.seats && <span>· {table.seats} Seats</span>}
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action: Cart / Order Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchMenu()}
                title="Refresh Menu"
                className="w-10 h-10 rounded-full border border-stone-200 bg-stone-50 hover:bg-stone-100 flex items-center justify-center text-stone-600 transition-colors"
                aria-label="Refresh status"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => (cartCount > 0 ? setShowCart(true) : null)}
                className={cn(
                  'relative h-10 px-3.5 rounded-full font-bold text-xs flex items-center gap-2 shadow-sm transition-all',
                  cartCount > 0
                    ? 'bg-slate-900 text-white hover:bg-slate-800 scale-100'
                    : 'bg-stone-100 text-stone-400 cursor-default'
                )}
              >
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>{currencySymbol || 'Rs.'}{cartTotal.toFixed(0)}</span>
                {cartCount > 0 && (
                  <span className="w-5 h-5 bg-amber-500 text-slate-950 text-[11px] font-black rounded-full flex items-center justify-center ml-0.5 shadow-xs">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* ==================================================================== */}
        {/* LIVE STATE 1: HAVING FOOD (Meal Served, Bon Appétit & Review Suite) */}
        {/* ==================================================================== */}
        {isHavingFood && (
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl p-5 shadow-xl border border-emerald-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Meal Served · Enjoy!
                </span>
                {table && (
                  <span className="text-xs text-stone-300 font-medium bg-white/10 px-2.5 py-1 rounded-full">
                    Table {table.table_no}
                  </span>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-display font-bold tracking-tight text-white">
                  Bon Appétit{welcomeName ? `, ${welcomeName}` : ''}! 🍽️
                </h2>
                <p className="text-emerald-200/90 text-sm mt-1 leading-relaxed">
                  Your meal has been freshly prepared and served to your table. Have a wonderful dining experience!
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <a
                  href="#guest-rating-section"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Star className="w-3.5 h-3.5 fill-slate-950" /> Rate Food & Experience
                </a>
                <a
                  href="#bill-upi-section"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/20 transition-colors inline-flex items-center gap-1.5"
                >
                  <QrCode className="w-3.5 h-3.5 text-emerald-300" /> Pay Bill via UPI
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* LIVE STATE 2: CUSTOMER ORDERED (Chef Preparing in Kitchen)          */}
        {/* ==================================================================== */}
        {customerOrdered && !isHavingFood && (
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950 text-white rounded-3xl p-5 shadow-xl border border-amber-500/30 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> In The Kitchen
                </span>
                {placedOrder?.orderCode && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(placedOrder.orderCode, 'orderCode')}
                    className="text-xs text-stone-300 font-mono bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
                  >
                    <span>#{placedOrder.orderCode}</span>
                    {copiedOrderCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-display font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Chef is preparing your order</span>
                  <ChefHat className="w-6 h-6 text-amber-400 shrink-0" />
                </h2>
                <p className="text-stone-300 text-sm mt-1 leading-relaxed">
                  {welcomeName ? `Thank you, ${welcomeName}! ` : 'Thank you! '}
                  Your dishes are being freshly handcrafted. They will be served at your table shortly.
                </p>
              </div>

              {/* 3-Step Visual Preparation Timeline */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs mb-1">
                    ✓
                  </div>
                  <span className="text-[11px] font-bold text-white">Order Received</span>
                  <span className="text-[10px] text-emerald-400">Confirmed</span>
                </div>

                <div className="flex flex-col items-center text-center p-2 rounded-xl bg-amber-500/15 border border-amber-500/40">
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-bold text-xs mb-1 animate-bounce">
                    🔥
                  </div>
                  <span className="text-[11px] font-bold text-amber-300">In Preparation</span>
                  <span className="text-[10px] text-amber-400 font-semibold">Simmering</span>
                </div>

                <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-6 h-6 rounded-full bg-stone-700 text-stone-300 flex items-center justify-center font-bold text-xs mb-1">
                    🍽️
                  </div>
                  <span className="text-[11px] font-bold text-stone-300">Table Serving</span>
                  <span className="text-[10px] text-stone-400">Up Next</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-stone-400 pt-1">
                <span>Craving extra drinks, breads, or sides?</span>
                <span className="font-semibold text-amber-300">Add below anytime ↓</span>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* ORDERED ITEMS & DIGITAL BILL / UPI CARD                              */}
        {/* ==================================================================== */}
        {hasLiveOrder && (
          <div id="bill-upi-section" className="bg-white rounded-3xl shadow-sm border border-stone-200/80 overflow-hidden">
            <div
              onClick={() => setShowOrderItems(!showOrderItems)}
              className="p-4 bg-stone-50/80 border-b border-stone-200/80 flex items-center justify-between cursor-pointer hover:bg-stone-100/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-sm">
                    Your Table Bill {isHavingFood ? '· Served' : '· In Kitchen'}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {activeOrder.items?.length || 0} item(s) · {activeOrder.orderCode ? `Order #${activeOrder.orderCode}` : `Table ${table?.table_no}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-base text-slate-900">
                  {currencySymbol || 'Rs.'}{Number(activeOrder.total ?? 0).toFixed(2)}
                </span>
                <button type="button" className="text-stone-400 hover:text-stone-700">
                  {showOrderItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showOrderItems && (
              <div className="p-4 space-y-3">
                <div className="space-y-2 divide-y divide-stone-100 max-h-60 overflow-y-auto pr-1">
                  {activeOrder.items?.map((it: any, i: number) => (
                    <div key={i} className="pt-2 first:pt-0 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-stone-100 text-stone-700 font-bold text-xs flex items-center justify-center">
                          {it.qty}
                        </span>
                        <span className="font-medium text-slate-800">{it.name}</span>
                      </div>
                      <span className="font-semibold text-slate-900">
                        {currencySymbol || 'Rs.'}{Number(it.lineTotal ?? it.price * it.qty).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  {(!activeOrder.items || activeOrder.items.length === 0) && (
                    <p className="text-xs text-stone-400 py-2">No ordered items found.</p>
                  )}
                </div>

                <div className="pt-3 border-t border-dashed border-stone-200 flex justify-between items-baseline">
                  <span className="font-display font-bold text-stone-600 text-sm">Grand Total</span>
                  <span className="font-display font-bold text-xl text-slate-950">
                    {currencySymbol || 'Rs.'}{Number(activeOrder.total ?? 0).toFixed(2)}
                  </span>
                </div>

                {/* Instant UPI Payment Box (Especially prominent when HAVING_FOOD) */}
                {Number(activeOrder.total ?? 0) > 0 && (
                  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-stone-900 to-slate-900 text-white border border-stone-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-amber-400" />
                        <span className="font-display font-bold text-xs tracking-wider uppercase text-amber-300">
                          Scan & Pay with any UPI App
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400">GPay · PhonePe · Paytm</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 bg-white p-4 rounded-xl text-slate-900">
                      <div className="p-2 bg-white rounded-lg border border-stone-200 shadow-xs">
                        <QRCodeSVG value={upiUrl} size={140} />
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-1.5">
                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Amount to Pay</p>
                        <p className="font-display font-bold text-2xl text-slate-950">
                          {currencySymbol || 'Rs.'}{upiPayAmount}
                        </p>
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(upiId, 'upi')}
                            className="inline-flex items-center gap-1 text-xs font-mono bg-stone-100 hover:bg-stone-200 text-stone-700 px-2.5 py-1 rounded-md transition-colors"
                          >
                            <span>{upiId}</span>
                            {copiedUpi ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-500" />}
                          </button>
                        </div>
                        <p className="text-[10px] text-stone-400 leading-tight">
                          Counter payment with cash or cards is also accepted.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* GUEST RATING & DISH-BY-DISH REVIEW (When HAVING_FOOD)               */}
        {/* ==================================================================== */}
        {isHavingFood && hasLiveOrder && (
          <div id="guest-rating-section" className="bg-white rounded-3xl shadow-sm border border-amber-200/80 p-5 space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base">
                    {activeOrder?.myReview ? 'Your Dining Review' : 'How Was Your Dining Experience?'}
                  </h3>
                  <p className="text-xs text-stone-500">Your feedback helps our culinary team serve you better</p>
                </div>
              </div>
              {activeOrder?.myReview && (
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Saved
                </span>
              )}
            </div>

            {/* Overall Star Rating */}
            <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-center space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Overall Experience *
              </p>
              <div className="flex justify-center py-1">
                <StarRating value={overallRating} onRate={setOverallRating} size="w-8 h-8" />
              </div>
              <p className="font-display font-bold text-sm text-amber-950">{sentiment.label}</p>
              <p className="text-xs text-stone-500">{sentiment.desc}</p>
            </div>

            {/* Dish-by-Dish Rating Section */}
            {activeOrder?.items && activeOrder.items.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    Rate Each Dish
                  </h4>
                  <span className="text-[11px] text-stone-400">Tap stars for each item</span>
                </div>

                <div className="space-y-2">
                  {activeOrder.items.map((it: any, i: number) => {
                    const currentDishRating = itemRatings[it.name] || 0;
                    return (
                      <div
                        key={`${it.name}-${i}`}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200/60 hover:bg-white hover:border-amber-200 transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <DietIndicator name={it.name} category={it.category} />
                            <span className="font-medium text-slate-900 text-sm truncate">{it.name}</span>
                          </div>
                          <span className="text-xs text-stone-400">{it.qty} portion(s) ordered</span>
                        </div>
                        <StarRating
                          value={currentDishRating}
                          onRate={(v) => setItemRatings((prev) => ({ ...prev, [it.name]: v }))}
                          size="w-5 h-5"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Feedback Chips */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-stone-600">Quick Tags (Tap to add):</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '🌟 Delicious Taste',
                  '⚡ Fast Service',
                  '👨‍🍳 Perfect Seasoning',
                  '🔥 Fresh & Hot',
                  '🥤 Loved the Drinks',
                  '🍰 Heavenly Dessert',
                ].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addReviewCompliment(tag)}
                    className="text-xs bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 px-2.5 py-1 rounded-full border border-stone-200 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Written Review */}
            <div className="space-y-1.5">
              <label className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-600">
                <span className="flex items-center gap-1.5">
                  <MessageSquareText className="w-3.5 h-3.5 text-amber-600" /> Comments & Suggestions
                </span>
                <span className="text-[11px] text-stone-400 font-normal">{reviewText.length}/250</span>
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value.slice(0, 250))}
                placeholder="Share your favorite dish, flavor notes, or compliments for the team…"
                rows={3}
                maxLength={250}
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm text-slate-800 placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
              />
            </div>

            <button
              type="button"
              onClick={handleReview}
              disabled={isReviewing || !overallRating}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-display font-bold text-sm rounded-xl shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isReviewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Review…
                </>
              ) : activeOrder?.myReview ? (
                <>
                  <Sparkles className="w-4 h-4" /> Update Guest Review
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Guest Review
                </>
              )}
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MENU BROWSING & DISHES SECTION                                      */}
        {/* ==================================================================== */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-display font-bold text-slate-900">
                {customerOrdered || isHavingFood ? 'Craving More? Explore Menu' : 'Explore Our Menu'}
              </h2>
              <p className="text-xs text-stone-500">
                {customerOrdered || isHavingFood
                  ? `Items added now will go straight to Table ${table?.table_no || ''}`
                  : 'Handcrafted dishes freshly made to order'}
              </p>
            </div>
            <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
              {menuItems.length} Dishes
            </span>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, drinks, appetizers, desserts…"
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-stone-200/90 rounded-2xl text-sm placeholder:text-stone-400 text-slate-800 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="w-6 h-6 text-stone-400 hover:text-stone-700 absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Categories Pill Scroller */}
          <div className="flex overflow-x-auto no-scrollbar gap-2 py-1 -mx-4 px-4 scroll-smooth">
            {categories.map((cat) => {
              const count =
                cat === 'All'
                  ? menuItems.length
                  : menuItems.filter((i: any) => (i.category || 'Specialties') === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border shadow-xs',
                    activeCategory === cat
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:text-stone-900'
                  )}
                >
                  <span>{cat}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                      activeCategory === cat ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Today's Recommended — featured on top with adjusted prices */}
        {recommendedPicks.length > 0 && (
          <section className="space-y-3 rounded-3xl border border-amber-300/70 bg-gradient-to-b from-amber-50 to-white p-3.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">⭐</span>
              <h3 className="font-display font-bold text-sm uppercase tracking-wider text-amber-800">
                Today's Recommended
              </h3>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-200/70 px-2 py-0.5 rounded-full">
                {recommendedPicks.length}
              </span>
              <div className="flex-1 h-px bg-amber-200" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recommendedPicks.map((item: any) => (
                <div key={`rec-wrap-${item.id}`} className="relative">
                  {Number(item.recDelta || 0) < 0 && (
                    <span className="absolute -top-2 right-3 z-10 text-[10px] font-black uppercase tracking-wide bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow">
                      Deal −{currencySymbol || 'Rs.'}{Math.abs(Number(item.recDelta)).toFixed(0)}
                    </span>
                  )}
                  {renderDishCard(item, Number(item.recPrice ?? item.price ?? 0))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Dish List by Category */}
        <div className="space-y-6 pt-2">
          {grouped.map((sec) => (
            <section key={sec.category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-sm uppercase tracking-wider text-slate-800">
                  {sec.category}
                </h3>
                <span className="text-[11px] font-bold text-stone-500 bg-stone-200/60 px-2 py-0.5 rounded-full">
                  {sec.items.length}
                </span>
                <div className="flex-1 h-px bg-stone-200" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sec.items.map((item: any) => renderDishCard(item))}
              </div>
            </section>
          ))}

          {grouped.length === 0 && (
            <div className="py-12 text-center text-stone-400 bg-white rounded-3xl border border-stone-200/80 p-8 space-y-2">
              <Info className="w-8 h-8 text-stone-300 mx-auto" />
              <p className="font-display font-bold text-slate-700 text-sm">No dishes matched your search</p>
              <p className="text-xs text-stone-400">Try clearing filters or search terms</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
                className="mt-2 text-xs font-bold text-amber-600 hover:underline"
              >
                Reset Search
              </button>
            </div>
          )}
        </div>
      </main>

      {/* ==================================================================== */}
      {/* FLOATING BOTTOM BAR (CART OR ACTIVE TABLE STATUS)                   */}
      {/* ==================================================================== */}
      {cartCount > 0 && !showCart ? (
        <div className="fixed bottom-0 inset-x-0 p-4 z-40 pb-safe">
          <div className="max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="w-full bg-slate-900 text-white p-3.5 rounded-2xl font-bold flex items-center justify-between shadow-2xl shadow-slate-950/40 border border-slate-700/60 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 bg-amber-400 text-slate-950 text-xs font-black rounded-lg flex items-center justify-center">
                  {cartCount}
                </span>
                <div className="text-left leading-tight">
                  <div className="text-xs text-stone-300">View Table Order</div>
                  <div className="font-display font-bold text-base text-white">
                    {currencySymbol || 'Rs.'}{cartTotal.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-amber-400 font-display font-bold text-sm pr-1">
                <span>Proceed</span>
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          </div>
        </div>
      ) : hasLiveOrder && !showCart ? (
        <div className="fixed bottom-0 inset-x-0 p-4 z-30 pb-safe">
          <div className="max-w-md mx-auto">
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl flex items-center justify-between shadow-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium text-stone-200">
                  Table {table?.table_no} · {isHavingFood ? 'Meal Served' : 'Order in Kitchen'}
                </span>
              </div>
              <a
                href="#bill-upi-section"
                className="font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-lg"
              >
                <span>Total: {currencySymbol || 'Rs.'}{Number(activeOrder.total ?? 0).toFixed(0)}</span>
                <Receipt className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {/* ==================================================================== */}
      {/* CART & CHECKOUT DRAWER SHEET                                        */}
      {/* ==================================================================== */}
      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="flex-1"
            onClick={() => !isPlacing && setShowCart(false)}
            aria-hidden="true"
          />

          <div className="bg-[#faf8f5] rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl border-t border-stone-200 max-w-lg w-full mx-auto overflow-hidden animate-in slide-in-from-bottom duration-250">
            {/* Sheet Header */}
            <div className="p-4 bg-white border-b border-stone-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-base">
                    Review Order {table ? `· Table ${table.table_no}` : ''}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {cartCount} item(s) selected
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCart(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors"
                aria-label="Close cart"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Selected Dishes */}
              <div className="space-y-2 bg-white p-3.5 rounded-2xl border border-stone-200/80">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-stone-500 pb-1 border-b border-stone-100">
                  <span>Selected Dishes</span>
                  <span>Price</span>
                </div>
                {cart.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1.5">
                    <div className="flex-1 pr-2 min-w-0">
                      <h4 className="font-display font-bold text-sm text-slate-900 truncate">{c.name}</h4>
                      <p className="text-xs text-stone-400">
                        {currencySymbol || 'Rs.'}{Number(c.price).toFixed(2)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200/60">
                        <button
                          type="button"
                          onClick={() => changeQty(c.id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white shadow-xs text-stone-700 hover:text-stone-950"
                        >
                          {c.qty === 1 ? <Trash2 className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3" />}
                        </button>
                        <span className="font-bold text-xs w-6 text-center">{c.qty}</span>
                        <button
                          type="button"
                          onClick={() => changeQty(c.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white shadow-xs text-stone-700 hover:text-stone-950"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-display font-bold text-sm text-slate-900 w-16 text-right">
                        {currencySymbol || 'Rs.'}{(c.price * c.qty).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Guest Details Form */}
              <div className="bg-white p-4 rounded-2xl border border-stone-200/80 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-700 pb-1 border-b border-stone-100">
                  <User className="w-3.5 h-3.5 text-amber-600" /> Guest Information
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Your Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Phone Number *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 98765 43210"
                      className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Kitchen Special Requests */}
                <div>
                  <label className="flex items-center gap-1 text-xs font-medium text-stone-600 mb-1">
                    <ChefHat className="w-3.5 h-3.5 text-amber-600" /> Special Kitchen Instructions
                  </label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {['Less Spicy 🌶️', 'No Onion/Garlic 🧄', 'Extra Crispy 🔥', 'Serve Hot ♨️', 'Mild Spice 🥛'].map(
                      (tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addNoteTag(tag)}
                          className="text-[11px] bg-stone-100 hover:bg-amber-100 text-stone-700 px-2 py-0.5 rounded-md transition-colors"
                        >
                          + {tag}
                        </button>
                      )
                    )}
                  </div>
                  <textarea
                    value={kitchenNotes}
                    onChange={(e) => setKitchenNotes(e.target.value.slice(0, 300))}
                    placeholder="Allergies, spice adjustments, extra sauce… our chef will follow your notes!"
                    rows={2}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Sheet Footer & Place CTA */}
            <div className="p-4 bg-white border-t border-stone-200 pb-safe">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-stone-500">Order Subtotal</span>
                <span className="font-display font-bold text-xl text-slate-950">
                  {currencySymbol || 'Rs.'}{cartTotal.toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isPlacing || cart.length === 0}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-display font-bold text-sm rounded-xl shadow-lg shadow-slate-950/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                {isPlacing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending to Kitchen…
                  </>
                ) : hasLiveOrder || customerOrdered ? (
                  <>
                    <Plus className="w-4 h-4 text-amber-400" /> Add Extra Items to Table {table?.table_no}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-amber-400" /> Confirm & Send Order to Kitchen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subdued Footer */}
      <footer className="py-8 text-center text-xs text-stone-400 space-y-1">
        <p className="font-medium text-stone-500">{restaurantName || 'Intelli Dining'}</p>
        <p>Digital Table Concierge & Contactless Ordering</p>
      </footer>
    </div>
  );
}
