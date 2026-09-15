import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { FileText, Search, Clock, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface Order {
  id: number;
  order_code: string;
  table_id: number;
  order_status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  items: string; // JSON string of items in this API
  total: number;
  payment_mode: string;
  created_at: string;
}

export function OrdersView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const res = await api.getDineOrders(statusFilter === 'ALL' ? undefined : statusFilter);
      setOrders(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch orders');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = orders
    .filter(o =>
      o.order_code?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    // Latest record on top
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const renderItems = (itemsJson: string) => {
    try {
      const parsed = JSON.parse(itemsJson);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => `${item.qty}x ${item.name}`).join(', ');
      }
      return 'Invalid items format';
    } catch (e) {
      return 'Could not parse items';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center">
          <FileText className="w-8 h-8 text-brand-600 mr-3" />
          <div>
            <h1 className="text-2xl font-display font-bold text-gray-900 leading-tight">Order History</h1>
            <p className="text-sm text-gray-500">View and manage dine-in and takeaway orders</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search order ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all w-64"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center space-x-2">
        {['ALL', 'PENDING', 'COMPLETED'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status as any)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              statusFilter === status ? "bg-brand-50 text-brand-700" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items Summary</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                      <p className="text-base font-medium text-gray-900">No orders found</p>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{order.order_code}</div>
                        {order.table_id && <div className="text-xs text-gray-500">Table {order.table_id}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(order.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">{new Date(order.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 line-clamp-2 max-w-xs" title={renderItems(order.items)}>
                          {renderItems(order.items)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full flex items-center",
                          order.order_status === 'COMPLETED' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        )}>
                          {order.order_status === 'COMPLETED' ? <CheckCircle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                          {order.order_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        Rs. {Number(order.total || 0).toFixed(2)}
                        <div className="text-xs font-normal text-gray-500">{order.payment_mode}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
