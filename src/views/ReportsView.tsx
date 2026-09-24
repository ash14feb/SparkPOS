import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BarChart3, Download, Printer } from 'lucide-react';
import { usePosStore } from '../store/usePosStore';
import { api, API_BASE_URL, getAuthToken } from '../lib/api';
import toast from 'react-hot-toast';
import { inDateRange, todayRange, exportCSV, printReport, paginate } from '../lib/reportUtils';
import { formatDate, formatDateTime, formatTime, dateKeyInTimezone, todayInTimezone } from '../lib/datetime';
import { cn } from '../lib/utils';

const TABS = [
  'Sales', 'Discount', 'Day Book', 'Business Summary', 'Business Txn',
  'Expense', 'Payment Type', 'Daywise', 'Top Selling', 'Stock Summary',
  'Low Stock', 'Item Wise', 'GSTR-1',
] as const;
type Tab = typeof TABS[number];
const PER_PAGE = 10;

export function ReportsView() {
  const { orders, menuItems, settings, fetchBootstrap } = usePosStore();
  const [tab, setTab] = useState<Tab>('Sales');
  const [range, setRange] = useState(todayRange());
  const [expenses, setExpenses] = useState<any[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!usePosStore.getState().bootstrapped) fetchBootstrap(true);
    else usePosStore.getState().refreshInBackground();
    api.getExpenses().then(r => setExpenses(r.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setPage(1); }, [tab, range]);

  const fOrders = useMemo(() => (orders || []).filter(o => inDateRange(o.timestamp, range.start, range.end, settings)), [orders, range, settings]);
  const fExpenses = useMemo(() => (expenses || []).filter(e => String(e.expense_date).slice(0, 10) >= range.start && String(e.expense_date).slice(0, 10) <= range.end), [expenses, range]);
  const fmt = (v: number) => `${settings?.currencySymbol || 'Rs.'} ${Number(v || 0).toFixed(2)}`;

  const itemAgg = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; revenue: number; cost: number }>();
    fOrders.forEach(o => (o.items || []).forEach((i: any) => {
      const name = i.name || i.item_name || 'Item';
      const qty = Number(i.quantity ?? i.qty ?? 1);
      const price = Number(i.price ?? 0);
      const cur = m.get(name) || { name, qty: 0, revenue: 0, cost: 0 };
      cur.qty += qty; cur.revenue += price * qty;
      const menu = (menuItems || []).find((x: any) => x.name === name);
      cur.cost += Number(menu?.purchasePrice || 0) * qty;
      m.set(name, cur);
    }));
    return [...m.values()].sort((a, b) => b.qty - a.qty);
  }, [fOrders, menuItems]);

  const daywise = useMemo(() => {
    const m = new Map<string, { sales: number; orders: number; discount: number; tax: number }>();
    fOrders.forEach(o => {
      const d = dateKeyInTimezone(o.timestamp, settings);
      const cur = m.get(d) || { sales: 0, orders: 0, discount: 0, tax: 0 };
      cur.sales += Number(o.total) || 0; cur.orders += 1;
      cur.discount += Number(o.discount) || 0;
      cur.tax += Number(o.cgst || 0) + Number(o.sgst || 0);
      m.set(d, cur);
    });
    return [...m.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => b.date.localeCompare(a.date));
  }, [fOrders, settings]);

  const payMode = (list: any[]) => {
    const r = { CASH: 0, UPI: 0, CARD: 0, OTHER: 0 };
    list.forEach(o => {
      const m = String(o.paymentMode || o.payment_mode || 'CASH').toUpperCase();
      const v = Number(o.total ?? o.amount ?? 0);
      if (m in r) (r as any)[m] += v; else r.OTHER += v;
    });
    return r;
  };

  // Build rows per tab
  let headers: string[] = [];
  let rows: (string | number)[][] = [];
  let summary: ReactNode = null;

  const salePay = payMode(fOrders);
  const totalSale = fOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);
  const totalDisc = fOrders.reduce((s, o) => s + (Number(o.discount) || 0), 0);
  const totalTax = fOrders.reduce((s, o) => s + Number(o.cgst || 0) + Number(o.sgst || 0), 0);
  const totalExp = fExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalCost = itemAgg.reduce((s, i) => s + i.cost, 0);
  const gross = totalSale - totalCost;
  const net = gross - totalExp;

  switch (tab) {
    case 'Sales':
      headers = ['Order ID', 'Date', 'Customer', 'Payment', 'Total'];
      rows = fOrders.map(o => [String(o.id).slice(-8), formatDateTime(o.timestamp, settings), o.customerName || '-', o.paymentMode || o.payment_mode || 'CASH', Number(o.total || 0).toFixed(2)]);
      summary = <SummaryCards items={[['Total Sales', fmt(totalSale)], ['Orders', String(fOrders.length)], ['Avg Bill', fmt(fOrders.length ? totalSale / fOrders.length : 0)]]} />;
      break;
    case 'Discount':
      headers = ['Order ID', 'Date', 'Subtotal', 'Discount', 'Total'];
      rows = fOrders.filter(o => Number(o.discount) > 0).map(o => [String(o.id).slice(-8), formatDateTime(o.timestamp, settings), Number(o.subtotal || 0).toFixed(2), Number(o.discount || 0).toFixed(2), Number(o.total || 0).toFixed(2)]);
      summary = <SummaryCards items={[['Total Discount', fmt(totalDisc)], ['Discounted Bills', String(rows.length)]]} />;
      break;
    case 'Day Book': {
      const moneyIn = totalSale;
      headers = ['Time', 'Type', 'Description', 'Money In', 'Money Out'];
      const r1 = fOrders.map(o => [formatTime(o.timestamp, settings), 'Sale', `Order ...${String(o.id).slice(-6)}`, Number(o.total || 0).toFixed(2), '0.00']);
      const r2 = fExpenses.map(e => [String(e.expense_date).slice(0, 10), 'Expense', `${e.category} ${e.notes || ''}`, '0.00', Number(e.amount || 0).toFixed(2)]);
      rows = [...r1, ...r2] as any;
      summary = <SummaryCards items={[['Transactions', String(fOrders.length + fExpenses.length)], ['Money In', fmt(moneyIn)], ['Money Out', fmt(totalExp)], ['Net', fmt(moneyIn - totalExp)]]} />;
      break;
    }
    case 'Business Summary':
      headers = ['Metric', 'Value'];
      rows = [['Gross Sales', totalSale.toFixed(2)], ['Item Cost', totalCost.toFixed(2)], ['Gross Profit', gross.toFixed(2)], ['Expenses', totalExp.toFixed(2)], ['Net Profit', net.toFixed(2)], ['Discount', totalDisc.toFixed(2)], ['Tax', totalTax.toFixed(2)]];
      summary = <SummaryCards items={[['Gross Profit', fmt(gross)], ['Net Profit', fmt(net)], ['Expenses', fmt(totalExp)]]} />;
      break;
    case 'Business Txn': {
      const sp = payMode(fOrders);
      headers = ['Category', 'Cash', 'Card', 'UPI', 'Total'];
      rows = [
        ['Sale', sp.CASH.toFixed(2), sp.CARD.toFixed(2), sp.UPI.toFixed(2), totalSale.toFixed(2)],
        ['Expense', '-', '-', '-', totalExp.toFixed(2)],
        ['Purchase (est. cost)', '-', '-', '-', totalCost.toFixed(2)],
      ];
      summary = <SummaryCards items={[['Sale–Cash', fmt(sp.CASH)], ['Sale–Card', fmt(sp.CARD)], ['Sale–UPI', fmt(sp.UPI)]]} />;
      break;
    }
    case 'Expense': {
      const byCat = new Map<string, number>();
      fExpenses.forEach(e => byCat.set(e.category || 'General', (byCat.get(e.category || 'General') || 0) + Number(e.amount || 0)));
      headers = ['Date', 'Category', 'Notes', 'Amount'];
      rows = fExpenses.map(e => [String(e.expense_date).slice(0, 10), e.category || 'General', e.notes || '-', Number(e.amount || 0).toFixed(2)]);
      summary = <SummaryCards items={[['Total Expense', fmt(totalExp)], ...[...byCat.entries()].slice(0, 4).map(([k, v]) => [k, fmt(v)] as [string, string])]} />;
      break;
    }
    case 'Payment Type':
      headers = ['Payment Mode', 'Orders', 'Amount'];
      rows = (['CASH', 'UPI', 'CARD', 'OTHER'] as const).map(m => {
        const list = fOrders.filter(o => String(o.paymentMode || o.payment_mode || 'CASH').toUpperCase() === m);
        return [m, list.length, list.reduce((s, o) => s + (Number(o.total) || 0), 0).toFixed(2)];
      });
      summary = <SummaryCards items={[['Cash', fmt(salePay.CASH)], ['UPI', fmt(salePay.UPI)], ['Card', fmt(salePay.CARD)]]} />;
      break;
    case 'Daywise':
      headers = ['Date', 'Orders', 'Sales', 'Discount', 'Tax'];
      rows = daywise.map(d => [d.date, d.orders, d.sales.toFixed(2), d.discount.toFixed(2), d.tax.toFixed(2)]);
      break;
    case 'Top Selling':
      headers = ['Item', 'Qty Sold', 'Revenue'];
      rows = itemAgg.slice(0, 50).map(i => [i.name, i.qty, i.revenue.toFixed(2)]);
      break;
    case 'Stock Summary':
      headers = ['Item', 'Category', 'Price', 'Stock', 'Value'];
      rows = (menuItems || []).map((m: any) => [m.name, m.category || '-', Number(m.price || 0).toFixed(2), m.stock ?? '-', ((Number(m.stock) || 0) * Number(m.price || 0)).toFixed(2)]);
      break;
    case 'Low Stock':
      headers = ['Item', 'Stock', 'Alert Level'];
      rows = (menuItems || []).filter((m: any) => m.stock != null && Number(m.stock) <= Number(m.lowStockAlert ?? 5)).map((m: any) => [m.name, m.stock, m.lowStockAlert ?? 5]);
      break;
    case 'Item Wise':
      headers = ['Item', 'Qty', 'Revenue', 'Cost', 'Profit'];
      rows = itemAgg.map(i => [i.name, i.qty, i.revenue.toFixed(2), i.cost.toFixed(2), (i.revenue - i.cost).toFixed(2)]);
      break;
    case 'GSTR-1':
      headers = ['Invoice', 'Date', 'Customer GSTIN', 'Taxable', 'CGST', 'SGST', 'Total'];
      rows = fOrders.map(o => {
        const tax = Number(o.cgst || 0) + Number(o.sgst || 0);
        const taxable = (Number(o.total) || 0) - tax;
        return [String(o.id).slice(-8), formatDate(o.timestamp, settings), o.customerGstin || '-', taxable.toFixed(2), Number(o.cgst || 0).toFixed(2), Number(o.sgst || 0).toFixed(2), Number(o.total || 0).toFixed(2)];
      });
      summary = <SummaryCards items={[['Taxable', fmt(totalSale - totalTax)], ['Tax (CGST+SGST)', fmt(totalTax)]]} />;
      break;
  }

  const pg = paginate(rows, page, PER_PAGE);
  const slug = tab.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const serverDownload = async (format: 'xlsx' | 'pdf') => {
    try {
      const url = `${API_BASE_URL}/api/export/${slug}.${format}?start=${range.start}&end=${range.end}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
      if (!res.ok) throw new Error('Server export unavailable');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${slug}-${range.start}-to-${range.end}.${format}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error('Server export failed — using offline fallback');
      if (format === 'xlsx') exportCSV(`${tab}-${range.start}-to-${range.end}`, headers, rows);
      else doPrintFallback();
    }
  };
  const doCSV = () => serverDownload('xlsx');
  const doPrintFallback = () => {
    const html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    printReport(`${tab} Report (${range.start} to ${range.end})`, html);
  };
  const doPrint = () => serverDownload('pdf');

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      {/* Header — same style as Dashboard */}
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col gap-3 shadow-sm z-10 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center">
            <BarChart3 className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Reports</h1>
              <p className="text-sm text-gray-500 capitalize">{tab} Report • {range.start} to {range.end}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={range.start} onChange={e => setRange({ ...range, start: e.target.value })} className="flex-1 sm:flex-none min-w-[130px] px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
            <span className="text-gray-400 hidden sm:inline">–</span>
            <input type="date" value={range.end} onChange={e => setRange({ ...range, end: e.target.value })} className="flex-1 sm:flex-none min-w-[130px] px-2 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
            <button onClick={() => setRange(({ start: todayInTimezone(settings), end: todayInTimezone(settings) }))} className="px-3 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg">Today</button>
            <button onClick={doCSV} className="flex items-center px-3 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"><Download className="w-3.5 h-3.5 mr-1" /> Excel</button>
            <button onClick={doPrint} className="flex items-center px-3 py-2 text-xs font-bold bg-gray-900 hover:bg-gray-800 text-white rounded-lg shadow-sm"><Printer className="w-3.5 h-3.5 mr-1" /> PDF</button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn('px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap border shrink-0 transition-colors', tab === t ? 'bg-brand-600 text-white border-brand-600 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:text-gray-900')}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        {summary && <div className="mb-4 sm:mb-6">{summary}</div>}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-gray-900">{tab} Records</h2>
            <span className="text-[11px] sm:text-xs text-gray-500">{rows.length} rows</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[560px]">
              <thead><tr className="bg-white border-b border-gray-100">{headers.map(h => <th key={h} className="px-3 sm:px-6 py-2 sm:py-3 text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {pg.slice.length === 0 ? <tr><td colSpan={headers.length} className="px-3 sm:px-6 py-8 text-center text-gray-500 text-sm">No data for this period</td></tr>
                  : pg.slice.map((r, i) => <tr key={i} className="hover:bg-gray-50 transition-colors">{r.map((c, j) => <td key={j} className="px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm text-gray-800 whitespace-nowrap max-w-[220px] truncate" title={String(c)}>{c}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-[11px] sm:text-xs text-gray-500">Page {pg.page} of {pg.total} • {rows.length} rows</span>
            <div className="flex gap-1 w-full sm:w-auto">
              <button disabled={pg.page <= 1} onClick={() => setPage(p => p - 1)} className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white disabled:opacity-40">Prev</button>
              <button disabled={pg.page >= pg.total} onClick={() => setPage(p => p + 1)} className="flex-1 sm:flex-none px-4 py-1.5 text-xs font-medium border border-gray-200 rounded-lg bg-white disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CARD_THEMES = [
  'from-brand-500 to-brand-600 text-white',
  'bg-emerald-50 border-emerald-100 text-emerald-900',
  'bg-purple-50 border-purple-100 text-purple-900',
  'bg-blue-50 border-blue-100 text-blue-900',
  'bg-amber-50 border-amber-100 text-amber-900',
  'bg-rose-50 border-rose-100 text-rose-900',
  'bg-teal-50 border-teal-100 text-teal-900',
  'bg-orange-50 border-orange-100 text-orange-900',
];

function SummaryCards({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
      {items.map(([k, v], i) => {
        const theme = CARD_THEMES[i % CARD_THEMES.length];
        const isGradient = theme.includes('from-');
        return (
          <div key={k} className={cn('p-3 sm:p-4 rounded-xl shadow-sm border flex flex-col justify-between min-h-[76px]', isGradient ? `bg-gradient-to-br ${theme} border-transparent` : `bg-white ${theme} border`)}>
            <p className={cn('text-[10px] sm:text-xs font-medium uppercase tracking-wider truncate', isGradient ? 'opacity-80 text-white' : 'opacity-70')}>{k}</p>
            <p className="text-base sm:text-xl font-display font-bold truncate" title={v}>{v}</p>
          </div>
        );
      })}
    </div>
  );
}
