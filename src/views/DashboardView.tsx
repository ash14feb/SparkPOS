import { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, Wallet, Users, Receipt, Smartphone, CreditCard, Trash2, X } from 'lucide-react';
import { usePosStore } from '../store/usePosStore';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { dbTimeMs, formatDateTime, timeAgo as timeAgoLib, todayInTimezone, dateKeyInTimezone, dayBoundsInTimezone, hourInTimezone } from '../lib/datetime';
import { cn } from '../lib/utils';

export function DashboardView() {
  const { orders, settings, fetchBootstrap } = usePosStore();
  const { user } = useAuthStore();
  
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'prev' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>(todayInTimezone());
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [customEnd, setCustomEnd] = useState<string>(todayInTimezone());
  
  const isAdmin = user?.user_type === 'admin' || user?.user_type === 'manager';

  // Force fetch on mount just to ensure fresh orders
  useEffect(() => {
    fetchBootstrap(true);
    api.getExpenses().then((r: any) => setExpenses(r.data || [])).catch(() => {});
  }, []);

  const dateRange = useMemo(() => {
    // All preset bounds are calendar days in the business timezone (default IST),
    // independent of the device timezone.
    const keyInTz = (offsetDays: number) => dateKeyInTimezone(Date.now() - offsetDays * 86400000, settings);
    switch (datePreset) {
      case 'today': {
        const b = dayBoundsInTimezone(keyInTz(0), settings);
        return { start: new Date(b.start), end: new Date(b.end) };
      }
      case 'yesterday': {
        const b = dayBoundsInTimezone(keyInTz(1), settings);
        return { start: new Date(b.start), end: new Date(b.end) };
      }
      case 'prev': {
        const b = dayBoundsInTimezone(keyInTz(2), settings);
        return { start: new Date(b.start), end: new Date(b.end) };
      }
      case 'custom': {
        const s = dayBoundsInTimezone(customStart, settings);
        const e = dayBoundsInTimezone(customEnd, settings);
        return { start: new Date(s.start), end: new Date(e.end) };
      }
    }
  }, [datePreset, customStart, customEnd, settings]);

  const filteredOrders = useMemo(() => {
    return (orders || []).filter(order => {
      const orderDate = dbTimeMs(order.timestamp);
      return orderDate >= dateRange.start.getTime() && orderDate <= dateRange.end.getTime();
    });
  }, [orders, dateRange]);

  const metrics = useMemo(() => {
    let totalSale = 0;
    let totalCustomers = 0;
    let cash = 0;
    let upi = 0;
    let card = 0;
    let dineInSale = 0;
    let takeawaySale = 0;

    filteredOrders.forEach(order => {
      totalSale += Number(order.total) || 0;
      totalCustomers += (order.items || []).reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);
      
      const mode = order.paymentMode || order.payment_mode; // Handle schema variations
      if (mode === 'CASH') cash += Number(order.total) || 0;
      else if (mode === 'UPI') upi += Number(order.total) || 0;
      else if (mode === 'CARD') card += Number(order.total) || 0;

      const ot = String(order.orderType || order.order_type || 'TAKEAWAY').toUpperCase();
      if (ot === 'DINEIN' || ot === 'DINE IN' || ot === 'DINE_IN') dineInSale += Number(order.total) || 0;
      else takeawaySale += Number(order.total) || 0;
    });

    return { totalSale, totalCustomers, cash, upi, card, dineInSale, takeawaySale };
  }, [filteredOrders]);

  const expenseToday = useMemo(() => {
    const t = todayInTimezone(settings);
    return (expenses || []).filter((e: any) => String(e.expense_date).slice(0, 10) === t)
      .reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
  }, [expenses, settings]);

  const topSelling = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number }>();
    filteredOrders.forEach(order => (order.items || []).forEach((i: any) => {
      const name = i.name || i.item_name || 'Item';
      const qty = Number(i.quantity ?? i.qty ?? 1);
      const cur = m.get(name) || { name, qty: 0, revenue: 0 };
      cur.qty += qty; cur.revenue += Number(i.price || 0) * qty;
      m.set(name, cur);
    }));
    return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [filteredOrders]);

  const isFoodBusiness = String(settings?.businessType || '').toUpperCase().includes('FOOD');
  const dineInEnabled = settings?.dineInEnabled === true || settings?.dineInEnabled === 1;

  const timeAgo = (ts: any) => timeAgoLib(ts);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 14 }, (_, i) => i + 10); // 10AM to 11PM (23:00)
    const counts = new Array(14).fill(0);

    filteredOrders.forEach(order => {
      const hour = hourInTimezone(order.timestamp, settings);
      if (hour >= 10 && hour <= 23) {
        counts[hour - 10] += (order.items || []).reduce((sum: number, i: any) => sum + (Number(i.quantity) || 1), 0);
      }
    });

    return { hours, counts };
  }, [filteredOrders]);

  const handleDeleteSale = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    try {
      await api.deletePosOrder(id);
      toast.success('Order deleted');
      fetchBootstrap(true); // Refresh
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete order');
    }
  };

  // SVG Chart Geometry
  const chartW = 900;
  const chartH = 260;
  const paddingX = 40;
  const paddingY = 40;
  
  const maxCustomers = Math.max(...hourlyData.counts, 5); // Avoid division by zero
  
  const getX = (index: number) => paddingX + (index * ((chartW - paddingX * 2) / (hourlyData.hours.length - 1)));
  const getY = (count: number) => chartH - paddingY - (count / maxCustomers) * (chartH - paddingY * 2);

  const linePath = hourlyData.counts.map((c, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(c)}`).join(' ');
  const areaPath = `${linePath} L ${getX(hourlyData.hours.length - 1)} ${chartH - paddingY} L ${getX(0)} ${chartH - paddingY} Z`;

  const formatCurrency = (val: number) => `${settings.currencySymbol || 'Rs.'} ${val.toFixed(2)}`;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center">
          <LayoutDashboard className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Dashboard</h1>
            <p className="text-sm text-gray-500">Overview & Analytics</p>
          </div>
        </div>
        
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
          {/* Mobile Select */}
          <select 
            className="sm:hidden w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none text-gray-700 shadow-sm"
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as any)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="prev">Previous Day</option>
            <option value="custom">Custom Date</option>
          </select>

          {/* Desktop Buttons */}
          <div className="hidden sm:flex items-center gap-1 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
            <button onClick={() => setDatePreset('today')} className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", datePreset === 'today' ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}>Today</button>
            <button onClick={() => setDatePreset('yesterday')} className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", datePreset === 'yesterday' ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}>Yesterday</button>
            <button onClick={() => setDatePreset('prev')} className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", datePreset === 'prev' ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}>Prev Day</button>
            <button onClick={() => setDatePreset('custom')} className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", datePreset === 'custom' ? "bg-white text-brand-700 shadow-sm" : "text-gray-600 hover:text-gray-900")}>Custom</button>
          </div>
          
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="flex-1 sm:flex-none px-2 py-2 sm:py-1 border border-gray-300 rounded-lg sm:rounded text-sm bg-white" />
              <span className="text-gray-400">-</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="flex-1 sm:flex-none px-2 py-2 sm:py-1 border border-gray-300 rounded-lg sm:rounded text-sm bg-white" />
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4 sm:mb-6">
          <div className="col-span-1 md:col-span-1 bg-gradient-to-br from-brand-500 to-brand-600 p-4 rounded-xl shadow-sm text-white">
            <div className="flex items-center mb-2 opacity-80"><Wallet className="w-4 h-4 mr-1" /><span className="text-xs font-medium">Total Sale</span></div>
            <p className="text-xl sm:text-2xl font-display font-bold">{formatCurrency(metrics.totalSale)}</p>
          </div>
          <div className="col-span-1 md:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div className="flex items-center text-gray-500 mb-2"><Users className="w-4 h-4 mr-1" /><span className="text-xs font-medium">Customers</span></div>
            <p className="text-xl sm:text-2xl font-display font-bold text-gray-900">{metrics.totalCustomers}</p>
          </div>
          <div className="col-span-1 md:col-span-1 bg-red-50 p-4 rounded-xl shadow-sm border border-red-100 flex flex-col justify-between">
            <div className="flex items-center text-red-600 mb-2"><Wallet className="w-4 h-4 mr-1" /><span className="text-xs font-medium">Expense Today</span></div>
            <p className="text-xl sm:text-2xl font-display font-bold text-red-700">{formatCurrency(expenseToday)}</p>
          </div>

          {/* Payment Split - Inline on Mobile */}
          <div className="col-span-2 md:col-span-3 grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-emerald-50 p-3 sm:p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center text-emerald-700 mb-1 sm:mb-2">
                <div className="flex items-center"><Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" /><span className="hidden sm:inline text-xs font-medium">Cash Sales</span><span className="sm:hidden ml-1 text-[10px] font-bold uppercase tracking-wider">Cash</span></div>
              </div>
              <p className="text-sm sm:text-xl font-display font-bold text-emerald-900">{formatCurrency(metrics.cash)}</p>
            </div>
            <div className="bg-purple-50 p-3 sm:p-4 rounded-xl shadow-sm border border-purple-100 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center text-purple-700 mb-1 sm:mb-2">
                <div className="flex items-center"><Smartphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" /><span className="hidden sm:inline text-xs font-medium">UPI Sales</span><span className="sm:hidden ml-1 text-[10px] font-bold uppercase tracking-wider">UPI</span></div>
              </div>
              <p className="text-sm sm:text-xl font-display font-bold text-purple-900">{formatCurrency(metrics.upi)}</p>
            </div>
            <div className="bg-blue-50 p-3 sm:p-4 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center text-blue-700 mb-1 sm:mb-2">
                <div className="flex items-center"><CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-1" /><span className="hidden sm:inline text-xs font-medium">Card Sales</span><span className="sm:hidden ml-1 text-[10px] font-bold uppercase tracking-wider">Card</span></div>
              </div>
              <p className="text-sm sm:text-xl font-display font-bold text-blue-900">{formatCurrency(metrics.card)}</p>
            </div>
          </div>

          {/* Dine-In / Take-Away split (food businesses only) */}
          {isFoodBusiness && (
            <div className="col-span-2 md:col-span-5 grid grid-cols-2 gap-2 sm:gap-4">
              {dineInEnabled && (
                <div className="bg-orange-50 p-3 sm:p-4 rounded-xl shadow-sm border border-orange-200 flex flex-col justify-between">
                  <div className="text-orange-700 mb-1 sm:mb-2"><span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">🍽️ Dine-In Sale</span></div>
                  <p className="text-sm sm:text-xl font-display font-bold text-orange-900">{formatCurrency(metrics.dineInSale)}</p>
                </div>
              )}
              <div className={cn('bg-teal-50 p-3 sm:p-4 rounded-xl shadow-sm border border-teal-200 flex flex-col justify-between', !dineInEnabled && 'col-span-2')}>
                <div className="text-teal-700 mb-1 sm:mb-2"><span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">🛍️ Take Away Sale</span></div>
                <p className="text-sm sm:text-xl font-display font-bold text-teal-900">{formatCurrency(metrics.takeawaySale)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Customer Flow Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 hidden md:block">
          <h2 className="text-base font-bold text-gray-900 mb-4 px-2">Customer Flow (10 AM - 11 PM)</h2>
          <div className="w-full overflow-x-auto hide-scrollbar">
            <svg width={chartW} height={chartH} className="text-gray-900">
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map(r => (
                <line key={r} x1={paddingX} y1={paddingY + r * (chartH - paddingY*2)} x2={chartW - paddingX} y2={paddingY + r * (chartH - paddingY*2)} stroke="#f3f4f6" strokeWidth="1" />
              ))}
              
              {/* Area */}
              <path d={areaPath} fill="url(#gradient)" className="opacity-20" />
              
              {/* Line */}
              <path d={linePath} fill="none" stroke="currentColor" strokeWidth="3" className="text-brand-500" strokeLinecap="round" strokeLinejoin="round" />
              
              {/* Data points & X axis */}
              {hourlyData.counts.map((c, i) => (
                <g key={i}>
                  <circle cx={getX(i)} cy={getY(c)} r="4" fill="white" stroke="currentColor" strokeWidth="2" className="text-brand-600" />
                  <text x={getX(i)} y={chartH - 10} textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">
                    {hourlyData.hours[i] > 12 ? `${hourlyData.hours[i]-12}p` : hourlyData.hours[i] === 12 ? '12p' : `${hourlyData.hours[i]}a`}
                  </text>
                  {/* Tooltip text (static for now) */}
                  {c > 0 && (
                    <text x={getX(i)} y={getY(c) - 10} textAnchor="middle" className="text-[10px] fill-gray-600 font-bold">
                      {c}
                    </text>
                  )}
                </g>
              ))}

              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="1" className="text-brand-500" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-brand-500" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>

        {/* Recent Sales Table */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-base font-bold text-gray-900 mb-3">Top Selling Items</h2>
            {topSelling.length === 0 ? <p className="text-sm text-gray-500">No sales in this period</p> : (
              <div className="space-y-2">
                {topSelling.map((t, idx) => (
                  <div key={t.name} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{t.name}</p>
                      <div className="h-1.5 bg-gray-100 rounded-full mt-1"><div className="h-1.5 bg-brand-500 rounded-full" style={{ width: `${Math.round((t.qty / Math.max(topSelling[0].qty, 1)) * 100)}%` }} /></div>
                    </div>
                    <div className="text-right"><p className="text-sm font-bold">{t.qty} sold</p><p className="text-xs text-gray-500">{formatCurrency(t.revenue)}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-base font-bold text-gray-900">Recent Sales Records</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100">
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">When</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 sm:px-6 py-8 text-center text-gray-500">
                      No sales records for this period
                    </td>
                  </tr>
                ) : (
                  filteredOrders.slice(0, 8).map(order => {
                    const ot = String(order.orderType || order.order_type || 'TAKEAWAY').toUpperCase();
                    const isDineIn = ot === 'DINEIN' || ot === 'DINE_IN' || ot === 'DINE IN';
                    return (
                    <tr 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900" title={String(order.id)}>
                        ...{String(order.id).slice(-7)}
                        {isFoodBusiness && (
                          <div className={cn(
                            'mt-0.5 inline-block sm:block w-fit px-1.5 py-px text-[9px] font-bold rounded-full uppercase',
                            isDineIn ? 'bg-orange-100 text-orange-700' : 'bg-teal-100 text-teal-700'
                          )}>
                            {isDineIn ? '🍽️ Dine In' : '🛍️ Take Away'}
                          </div>
                        )}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                        {timeAgo(order.timestamp)}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap">
                        <span className={cn(
                          "px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold rounded-full uppercase",
                          (order.paymentMode || order.payment_mode) === 'UPI' ? 'bg-purple-100 text-purple-700' :
                          (order.paymentMode || order.payment_mode) === 'CARD' ? 'bg-blue-100 text-blue-700' :
                          'bg-emerald-100 text-emerald-700'
                        )}>
                          {order.paymentMode || order.payment_mode || 'CASH'}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-bold text-gray-900 text-right">
                        {formatCurrency(Number(order.total) || 0)}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <h2 className="font-bold text-lg text-gray-900">Order Details</h2>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <button
                    onClick={() => { setSelectedOrder(null); handleDeleteSale(selectedOrder.id); }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete Sale"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button
                onClick={() => setSelectedOrder(null)} 
                className="p-2 -mr-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="mb-4">
                <p className="text-sm text-gray-500">Order ID</p>
                <p className="font-medium text-gray-900">{selectedOrder.id}</p>
                {isFoodBusiness && (
                  <p className="text-xs text-gray-500 mt-1">
                    Order Type: <span className="font-bold text-gray-900">{String(selectedOrder.orderType || selectedOrder.order_type || 'TAKEAWAY').toUpperCase().includes('DINE') ? 'DINE IN' : 'TAKE AWAY'}</span>
                  </p>
                )}
              </div>
              <div className="flex justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium text-gray-900">{selectedOrder.customerName || '-'}</p>
                  {selectedOrder.customerPhone && (
                    <p className="text-sm text-gray-500">{selectedOrder.customerPhone}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Time</p>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(selectedOrder.timestamp, settings)}
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items?.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <div className="flex gap-2">
                        <span className="font-medium text-gray-900">{item.qty}x</span>
                        <span className="text-gray-600">{item.name}</span>
                      </div>
                      <span className="font-medium text-gray-900">{formatCurrency(item.price * item.qty)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-900">{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Taxes</span>
                  <span className="font-medium text-gray-900">{formatCurrency((selectedOrder.cgst || 0) + (selectedOrder.sgst || 0))}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total Paid</span>
                  <span>{formatCurrency(selectedOrder.total)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Payment Mode</span>
                  <span className="uppercase font-medium">{selectedOrder.paymentMode || selectedOrder.payment_mode || 'CASH'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
