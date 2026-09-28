import { useEffect, useMemo, useState } from 'react';
import { Globe, Search, MapPin, Phone, User, X, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { usePosStore } from '../store/usePosStore';
import { dbTimeMs, formatDateTime } from '../lib/datetime';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

// Separate screen for ONLINETABLE delivery orders: customer + address +
// live location map. Filters the shared order feed by order_type === ONLINE.
export function OnlineOrdersView() {
  const { settings } = usePosStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [riderFor, setRiderFor] = useState<any | null>(null);
  const currency = settings?.currencySymbol || 'Rs.';

  // Book Rider: open the drop location in a map app.
  // Android: geo: URI opens the system app chooser (Maps, Waze, etc.).
  // iOS: no chooser exists, so offer Apple / Google / Waze explicitly.
  // Desktop: Google Maps directions in a new tab.
  const isAndroid = /android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isIOS = /iphone|ipad|ipod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '');

  const riderLinks = (o: any) => {
    const lat = Number(o.customer_lat);
    const lng = Number(o.customer_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const label = encodeURIComponent(`Delivery ${(o.order_code || '')} ${(o.customer_name || '').slice(0, 40)}`);
    return {
      geo: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
      apple: `https://maps.apple.com/?daddr=${lat},${lng}&q=${label}`,
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=&travelmode=driving`,
      waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
    };
  };

  const bookRider = (o: any) => {
    const links = riderLinks(o);
    if (!links) {
      toast.error('No GPS location on this order');
      return;
    }
    if (isAndroid) {
      // System chooser with every installed map app.
      window.location.href = links.geo;
    } else if (isIOS) {
      // iOS: show explicit app choices.
      setRiderFor(o);
    } else {
      window.open(links.google, '_blank', 'noopener');
    }
  };

  const fetchOrders = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const res = await api.getDineOrders();
      setOrders(res.data || []);
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Failed to fetch online orders');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const id = window.setInterval(() => fetchOrders(true), 30000);
    const onAck = () => fetchOrders(true);
    window.addEventListener('sparkpos:online-ack', onAck);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('sparkpos:online-ack', onAck);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acknowledge = async (orderCode: string, accept: boolean) => {
    try {
      await api.acknowledgeOnlineOrder(orderCode, accept);
      toast.success(accept ? `Order ${orderCode} accepted!` : `Order ${orderCode} rejected`);
      fetchOrders(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update order');
    }
  };

  const onlineOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (orders || [])
      .filter((o: any) => String(o.order_type || '').toUpperCase() === 'ONLINE')
      .filter((o: any) => {
        if (!q) return true;
        return (
          String(o.order_code || '').toLowerCase().includes(q) ||
          String(o.customer_name || '').toLowerCase().includes(q) ||
          String(o.customer_phone || '').includes(q) ||
          String(o.customer_address || '').toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => dbTimeMs(b.created_at ?? b.timestamp ?? 0) - dbTimeMs(a.created_at ?? a.timestamp ?? 0));
  }, [orders, searchQuery]);

  const mapEmbed = (o: any) => {
    const lat = Number(o.customer_lat);
    const lng = Number(o.customer_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
    return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  };

  const mapLink = (o: any) => {
    const lat = Number(o.customer_lat);
    const lng = Number(o.customer_lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center">
          <Globe className="w-8 h-8 text-emerald-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Online Ordering</h1>
            <p className="text-sm text-gray-500">Delivery orders from the ONLINETABLE QR · {onlineOrders.length} order(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, address…"
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
          <button onClick={() => fetchOrders()} className="p-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
        ) : onlineOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center text-gray-500 max-w-lg mx-auto">
            <Globe className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-bold text-gray-900">No online orders yet</p>
            <p className="text-sm mt-1">Create the <b>ONLINETABLE</b> in Table Settings and share its QR — delivery orders with GPS location will land here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-6xl mx-auto">
            {onlineOrders.map((o: any) => {
              const embed = mapEmbed(o);
              const link = mapLink(o);
              return (
                <div key={o.order_code || o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{o.order_code}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(o.created_at ?? o.timestamp, settings)} · <span className={cn('font-bold', String(o.order_status).toUpperCase() === 'ACTIVE' ? 'text-amber-600' : 'text-emerald-600')}>{o.order_status || 'ACTIVE'}</span></p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-display font-bold text-lg text-brand-600">{currency}{Number(o.total_amount ?? o.total ?? 0).toFixed(2)}</p>
                      <button onClick={() => setSelected(o)} className="text-xs font-bold text-brand-600 hover:underline">View items</button>
                    </div>
                  </div>
                  {String(o.order_status || '').toUpperCase() === 'ACTIVE' && (
                    <div className="px-4 pt-3 flex gap-2">
                      <button onClick={() => acknowledge(String(o.order_code), true)} className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-black rounded-xl hover:bg-emerald-700 active:scale-[0.99]">
                        ✓ ACCEPT ORDER
                      </button>
                      <button onClick={() => { if (confirm(`Reject order ${o.order_code}?`)) acknowledge(String(o.order_code), false); }} className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-black rounded-xl hover:bg-gray-200 active:scale-[0.99]">
                        ✕ REJECT
                      </button>
                    </div>
                  )}
                  {String(o.order_status || '').toUpperCase() !== 'ACTIVE' && (
                    <div className="px-4 pt-3">
                      <span className={cn(
                        'inline-block text-[11px] font-black px-2.5 py-1 rounded-full uppercase',
                        String(o.order_status).toUpperCase() === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {String(o.order_status).toUpperCase() === 'ACCEPTED' ? '✓ Accepted' : String(o.order_status)}
                      </span>
                    </div>
                  )}
                  <div className="p-4 space-y-2 text-sm">
                    <p className="flex items-center gap-2 text-gray-800"><User className="w-4 h-4 text-gray-400 shrink-0" /><span className="font-semibold">{o.customer_name || '—'}</span></p>
                    {o.customer_phone && <p className="flex items-center gap-2 text-gray-800"><Phone className="w-4 h-4 text-gray-400 shrink-0" /><a href={`tel:${o.customer_phone}`} className="text-brand-600 font-medium">{o.customer_phone}</a></p>}
                    {o.customer_address && <p className="flex items-start gap-2 text-gray-800"><MapPin className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span>{o.customer_address}{o.customer_landmark ? ` (${o.customer_landmark})` : ''}</span></p>}
                    {!o.customer_address && <p className="text-xs text-amber-600 font-medium">No address captured (ordered before location update).</p>}
                  </div>
                  {embed ? (
                    <div>
                      <iframe title={`map-${o.order_code}`} src={embed} className="w-full h-52 border-0" loading="lazy" />
                      <div className="p-3 flex items-center justify-between gap-2 bg-gray-50/60 flex-wrap">
                        <span className="text-xs text-gray-500 font-mono">{Number(o.customer_lat).toFixed(5)}, {Number(o.customer_lng).toFixed(5)}</span>
                        <div className="flex items-center gap-2">
                          {link && <a href={link} target="_blank" rel="noreferrer" className="flex items-center text-xs font-bold text-brand-600 hover:underline"><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open in Maps</a>}
                          <button onClick={() => bookRider(o)} className="flex items-center px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 active:scale-95 transition-all">
                            🛵 Book Rider
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="px-4 pb-4 text-xs text-gray-400">No GPS location for this order.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">{selected.order_code}</h3>
              <button onClick={() => setSelected(null)} className="p-2 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-2">
              {(selected.items || []).map((it: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">{it.qty ?? it.quantity ?? 1}x {it.name ?? it.item_name}</span>
                  <span className="font-semibold">{currency}{Number((it.price ?? it.unit_price ?? 0) * (it.qty ?? it.quantity ?? 1)).toFixed(2)}</span>
                </div>
              ))}
              {(!selected.items || !selected.items.length) && <p className="text-sm text-gray-500">Items load in Order History.</p>}
            </div>
            <div className="flex justify-between font-bold mt-3 pt-3 border-t">
              <span>Total</span>
              <span>{currency}{Number(selected.total_amount ?? selected.total ?? 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* iOS map-app chooser (Android/Desktop open directly) */}
      {riderFor && (() => {
        const links = riderLinks(riderFor);
        if (!links) return null;
        const opts = [
          { label: 'Apple Maps', href: links.apple },
          { label: 'Google Maps', href: links.google },
          { label: 'Waze', href: links.waze },
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-gray-900/50" onClick={() => setRiderFor(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-gray-900 text-center">🛵 Book Rider</h3>
              <p className="text-xs text-gray-500 text-center mt-1 mb-4">
                Open drop location ({Number(riderFor.customer_lat).toFixed(4)}, {Number(riderFor.customer_lng).toFixed(4)}) in…
              </p>
              <div className="space-y-2">
                {opts.map((o) => (
                  <a
                    key={o.label}
                    href={o.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setRiderFor(null)}
                    className="block w-full py-3 text-center bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl text-sm"
                  >
                    {o.label}
                  </a>
                ))}
                <button onClick={() => setRiderFor(null)} className="block w-full py-3 text-center text-sm font-bold text-gray-500">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
