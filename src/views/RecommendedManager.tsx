import { useEffect, useMemo, useState } from 'react';
import { Star, Search, Save, Loader2, Plus, Minus, Trash2 } from 'lucide-react';
import { usePosStore } from '../store/usePosStore';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface Pick {
  productId: string;
  delta: number;
}

// Today's Recommended: pick menu items + price adjustment (+ premium / - discount).
// Saved picks show on top of the public menu with the adjusted price.
export function RecommendedManager() {
  const { menuItems, recommended, settings, fetchBootstrap } = usePosStore();
  const [search, setSearch] = useState('');
  const [picks, setPicks] = useState<Pick[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const currency = settings?.currencySymbol || 'Rs.';

  // Seed from server on load / after save.
  useEffect(() => {
    setPicks((recommended || []).map((r) => ({ productId: String(r.productId), delta: Number(r.priceDelta) || 0 })));
  }, [recommended]);

  useEffect(() => {
    if ((recommended || []).length === 0) fetchBootstrap(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickMap = useMemo(() => new Map(picks.map((p) => [p.productId, p.delta])), [picks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = menuItems.filter((m) => !q || m.name.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q));
    // Picked items first
    return [...list].sort((a, b) => (pickMap.has(String(b.id)) ? 1 : 0) - (pickMap.has(String(a.id)) ? 1 : 0));
  }, [menuItems, search, pickMap]);

  const toggle = (id: string | number) => {
    const key = String(id);
    setPicks((prev) => (prev.some((p) => p.productId === key) ? prev.filter((p) => p.productId !== key) : [...prev, { productId: key, delta: 0 }]));
  };

  const setDelta = (id: string | number, delta: number) => {
    const key = String(id);
    setPicks((prev) => prev.map((p) => (p.productId === key ? { ...p, delta } : p)));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = picks.map((p, i) => ({ product_id: p.productId, price_delta: Number(p.delta) || 0, sort_order: i }));
      await api.saveRecommended(payload);
      toast.success(payload.length ? `${payload.length} recommended item(s) live on public menu!` : 'Recommended list cleared');
      await fetchBootstrap(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save recommended items');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
        <p className="font-bold mb-1">⭐ Today's Recommended</p>
        <p>Tick items to feature them on top of the public menu. Adjust price with <b>+</b> (premium) or <b>−</b> (discount) — e.g. base Rs.100 with −10 shows Rs.90 as a deal.</p>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
        />
      </div>

      <div className="space-y-2 mb-24">
        {filtered.map((m) => {
          const picked = pickMap.has(String(m.id));
          const delta = pickMap.get(String(m.id)) || 0;
          const final = Number(m.price || 0) + delta;
          return (
            <div key={m.id} className={cn('bg-white p-3 rounded-xl border flex items-center gap-3', picked ? 'border-amber-400 shadow-sm' : 'border-gray-100')}>
              <button
                onClick={() => toggle(m.id)}
                className={cn('w-9 h-9 rounded-full flex items-center justify-center border shrink-0', picked ? 'bg-amber-400 border-amber-400 text-white' : 'border-gray-300 text-gray-300')}
                title={picked ? 'Remove from recommended' : 'Add to recommended'}
              >
                <Star className={cn('w-5 h-5', picked && 'fill-white')} />
              </button>
              {m.image ? (
                <img src={m.image} alt={m.name} className="w-11 h-11 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-600 font-bold flex items-center justify-center shrink-0">{m.name.charAt(0)}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{m.name}</p>
                <p className="text-xs text-gray-500">
                  {currency}{Number(m.price || 0).toFixed(2)}
                  {picked && delta !== 0 && (
                    <span className={cn('ml-1 font-bold', delta < 0 ? 'text-emerald-600' : 'text-orange-600')}>
                      → {currency}{final.toFixed(2)} ({delta > 0 ? `+${delta}` : delta})
                    </span>
                  )}
                </p>
              </div>
              {picked ? (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setDelta(m.id, delta - 5)} className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200" title="-5">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    value={delta}
                    onChange={(e) => setDelta(m.id, parseFloat(e.target.value) || 0)}
                    className="w-16 px-1 py-1 text-center text-sm font-bold border border-amber-300 rounded-md outline-none"
                    title="Price adjustment (+/-)"
                  />
                  <button onClick={() => setDelta(m.id, delta + 5)} className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200" title="+5">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggle(m.id)} className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600" title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        {filtered.length === 0 && <p className="text-center text-gray-500 py-8">No items found.</p>}
      </div>

      <div className="fixed bottom-16 md:bottom-0 inset-x-0 p-3 bg-white border-t border-gray-200 z-30">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <span className="text-sm font-bold text-gray-700">{picks.length} picked</span>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5 mr-2" /> Save Recommended</>}
          </button>
        </div>
      </div>
    </div>
  );
}
