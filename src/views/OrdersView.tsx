import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { FileText, Search, ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { usePosStore } from '../store/usePosStore';
import { startOfDay, endOfDay, addDays, format } from 'date-fns';
import { parseDbTime, dbTimeMs } from '../lib/datetime';

interface HistoryOrder {
  id: number;
  order_code: string;
  table_id?: number | null;
  table_no?: string;
  order_type?: string;
  order_status?: string;
  items?: any[];
  total_amount?: number;
  total?: number;
  payment_mode?: string;
  paymentMode?: string;
  created_at: string;
  timestamp?: number;
  subtotal?: number;
  discount?: number;
  cgst_amount?: number;
  sgst_amount?: number;
}

export function OrdersView() {
  const { settings } = usePosStore();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Date navigation: day offset from today (0 = today), or custom range.
  const [dayOffset, setDayOffset] = useState(0);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<HistoryOrder | null>(null);

  const isFoodBusiness = String(settings?.businessType || '').toUpperCase().includes('FOOD');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const res = await api.getDineOrders();
      setOrders(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  };

  const useCustom = customStart !== '' || customEnd !== '';
  const range = useMemo(() => {
    if (useCustom) {
      const s = customStart ? startOfDay(new Date(customStart)) : startOfDay(new Date(0));
      const e = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(new Date());
      return { start: s, end: e, label: `${customStart || '…'} → ${customEnd || '…'}` };
    }
    const day = addDays(new Date(), dayOffset);
    return { start: startOfDay(day), end: endOfDay(day), label: format(day, 'EEE, d MMM yyyy') };
  }, [dayOffset, customStart, customEnd, useCustom]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return orders
      .filter((o) => {
        // DB datetimes are server-timezone (UTC) strings: convert to client tz first.
        const t = dbTimeMs(o.created_at ?? o.timestamp ?? 0);
        if (!(t >= range.start.getTime() && t <= range.end.getTime())) return false;
        if (q && !(o.order_code || '').toLowerCase().includes(q)) return false;
        return true;
      })
      // Latest order on top
      .sort((a, b) => dbTimeMs(b.created_at ?? b.timestamp ?? 0) - dbTimeMs(a.created_at ?? a.timestamp ?? 0));
  }, [orders, range, searchQuery]);

  const totalOf = (o: HistoryOrder) => Number(o.total_amount ?? o.total ?? 0);
  const orderTypeOf = (o: HistoryOrder) => String(o.order_type || 'TAKEAWAY').toUpperCase();
  const isDineIn = (o: HistoryOrder) => orderTypeOf(o).includes('DINE');

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center">
          <FileText className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Order History</h1>
            <p className="text-sm text-gray-500">Dine-in and takeaway orders by day</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
          />
        </div>
      </div>

      {/* Date navigation */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setDayOffset((d) => d - 1); setCustomStart(''); setCustomEnd(''); }}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            title="Previous day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setDayOffset(0); setCustomStart(''); setCustomEnd(''); }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
              !useCustom && dayOffset === 0 ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            Today
          </button>
          <button
            onClick={() => { setDayOffset((d) => Math.min(0, d + 1)); setCustomStart(''); setCustomEnd(''); }}
            disabled={dayOffset >= 0}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30"
            title="Next day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="ml-2 text-sm font-bold text-gray-900">{useCustom ? 'Custom range' : range.label}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarDays className="w-4 h-4" />
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none"
          />
          <span>-</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white outline-none"
          />
          {useCustom && (
            <button
              onClick={() => { setCustomStart(''); setCustomEnd(''); setDayOffset(0); }}
              className="text-xs font-bold text-gray-500 hover:text-gray-900"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th scope="col" className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-base font-medium text-gray-900">No orders in this period</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} onClick={() => setSelectedOrder(order)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900 text-sm">{order.order_code}</div>
                        {order.table_no || order.table_id ? (
                          <div className="text-xs text-gray-500">Table {order.table_no || order.table_id}</div>
                        ) : null}
                        {isFoodBusiness && (
                          <span className={cn(
                            'mt-0.5 inline-block px-1.5 py-px text-[9px] font-bold rounded-full uppercase',
                            isDineIn(order) ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
                          )}>
                            {isDineIn(order) ? '🍽️ Dine In' : '🛍️ Take Away'}
                          </span>
                        )}
                      </td>
                      {/* Client timezone rendering */}
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{parseDbTime(order.created_at || order.timestamp || 0).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">{parseDbTime(order.created_at || order.timestamp || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase bg-gray-100 text-gray-700">
                          {order.payment_mode || order.paymentMode || 'CASH'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                        {settings?.currencySymbol || 'Rs.'} {totalOf(order).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>

      {/* Items popup */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="font-bold text-lg text-gray-900">{selectedOrder.order_code}</h2>
                <p className="text-xs text-gray-500">
                  {parseDbTime(selectedOrder.created_at || selectedOrder.timestamp || 0).toLocaleString()}
                  {isFoodBusiness ? ` · ${isDineIn(selectedOrder) ? 'DINE IN' : 'TAKE AWAY'}` : ''}
                  {selectedOrder.table_no || selectedOrder.table_id ? ` · Table ${selectedOrder.table_no || selectedOrder.table_id}` : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Items</h3>
              <div className="space-y-3">
                {(selectedOrder.items || []).map((item: any, i: number) => {
                  const qty = Number(item.qty ?? item.quantity ?? 1);
                  const price = Number(item.price ?? item.unit_price ?? 0);
                  return (
                    <div key={i} className="flex justify-between text-sm">
                      <div className="flex gap-2">
                        <span className="font-medium text-gray-900">{qty}x</span>
                        <span className="text-gray-600">{item.name || item.item_name}</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {settings?.currencySymbol || 'Rs.'} {(price * qty).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                {(selectedOrder.items || []).length === 0 && (
                  <p className="text-sm text-gray-500">No item details available.</p>
                )}
              </div>
              <div className="border-t border-gray-100 mt-4 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-900">{settings?.currencySymbol || 'Rs.'} {Number(selectedOrder.subtotal ?? totalOf(selectedOrder)).toFixed(2)}</span>
                </div>
                {Number(selectedOrder.discount || 0) > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Discount</span>
                    <span>-{settings?.currencySymbol || 'Rs.'} {Number(selectedOrder.discount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span>{settings?.currencySymbol || 'Rs.'} {totalOf(selectedOrder).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Payment Mode</span>
                  <span className="uppercase font-medium">{selectedOrder.payment_mode || selectedOrder.paymentMode || 'CASH'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
