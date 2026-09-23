import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ChefHat, Search, Clock, CheckCircle, Flame, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { usePosStore } from '../store/usePosStore';
import { dbTimeMs, formatTime } from '../lib/datetime';
import toast from 'react-hot-toast';

interface KOTItem {
  item_name: string;
  quantity: number;
  notes?: string;
}

interface KOT {
  id: number;
  order_code: string;
  table_id: number;
  status: 'PENDING' | 'PREPARING' | 'COMPLETED';
  created_at: string;
  items: KOTItem[];
}

type KotTab = 'PENDING' | 'PREPARING' | 'COMPLETED';

export function KDSView() {
  const { settings } = usePosStore();
  const [kots, setKots] = useState<KOT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<KotTab>('PENDING');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchKOTs();

    // Auto-refresh KDS every 30 seconds
    const interval = setInterval(fetchKOTs, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const fetchKOTs = async () => {
    try {
      setIsLoading(true);
      const res = await api.getKot(tab);
      setKots(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch KOTs');
    } finally {
      setIsLoading(false);
    }
  };

  const setStatus = async (kot: KOT, status: 'PREPARING' | 'COMPLETED') => {
    try {
      setUpdatingId(kot.id);
      await api.updateKotStatus(kot.id, status);
      // Remove from current tab immediately — no waiting for next poll.
      setKots((prev) => prev.filter((k) => k.id !== kot.id));
      toast.success(status === 'COMPLETED' ? `Order ${kot.order_code} ready!` : `Preparing ${kot.order_code}...`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update ticket');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-6 border-b border-gray-100 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center">
          <ChefHat className="w-8 h-8 text-brand-600 mr-3" />
          <div>
            <h1 className="text-2xl font-display font-bold text-gray-900 leading-tight">Kitchen Display</h1>
            <p className="text-sm text-gray-500">Live ticket management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['PENDING', 'PREPARING', 'COMPLETED'] as KotTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  tab === t ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {t === 'PENDING' ? 'New' : t === 'PREPARING' ? 'Cooking' : 'Ready'}
              </button>
            ))}
          </div>
          <button
            onClick={fetchKOTs}
            className="flex items-center px-4 py-2 bg-brand-50 text-brand-700 text-sm font-medium rounded-lg hover:bg-brand-100 transition-colors"
          >
            <Clock className="w-4 h-4 mr-2" /> Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 custom-scrollbar">
        {isLoading && kots.length === 0 ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          </div>
        ) : kots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 h-full">
            <ChefHat className="w-16 h-16 text-gray-300 mb-4 opacity-50" />
            <p className="text-xl font-display font-semibold text-gray-900">Kitchen is clear!</p>
            <p className="text-sm mt-1">No pending orders at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
            {kots.map(kot => {
              const minutesWaiting = Math.floor((Date.now() - dbTimeMs(kot.created_at)) / 60000);
              const isUrgent = minutesWaiting > 15;
              
              return (
                <div 
                  key={kot.id}
                  className={cn(
                    "bg-white rounded-xl shadow-sm border-2 overflow-hidden flex flex-col transition-shadow hover:shadow-md",
                    isUrgent ? "border-red-200" : "border-gray-200"
                  )}
                >
                  <div className={cn(
                    "p-3 border-b flex justify-between items-center text-white font-medium",
                    isUrgent ? "bg-red-500" : "bg-gray-800"
                  )}>
                    <div className="flex flex-col">
                      <span className="text-sm opacity-80">Table {kot.table_id}</span>
                      <span className="font-bold">{kot.order_code}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm flex items-center opacity-90"><Clock className="w-3 h-3 mr-1"/> {minutesWaiting}m</div>
                      <div className="text-xs mt-1">{formatTime(kot.created_at, settings)}</div>
                    </div>
                  </div>
                  
                  <div className="p-0 flex-1">
                    <ul className="divide-y divide-gray-100">
                      {kot.items?.map((item, idx) => (
                        <li key={idx} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start">
                            <span className="font-bold text-lg w-8 text-brand-600">{item.quantity}x</span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-lg leading-tight">{item.item_name}</p>
                              {item.notes && (
                                <p className="text-sm text-red-500 font-medium mt-1 bg-red-50 inline-block px-2 py-0.5 rounded">{item.notes}</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="p-3 bg-gray-50 border-t border-gray-100 space-y-2">
                    {kot.status === 'PENDING' && (
                      <button
                        onClick={() => setStatus(kot, 'PREPARING')}
                        disabled={updatingId === kot.id}
                        className="w-full flex items-center justify-center py-3 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {updatingId === kot.id ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Flame className="w-5 h-5 mr-2" />}
                        Start Cooking
                      </button>
                    )}
                    {kot.status !== 'COMPLETED' && (
                      <button
                        onClick={() => setStatus(kot, 'COMPLETED')}
                        disabled={updatingId === kot.id}
                        className="w-full flex items-center justify-center py-3 bg-emerald-500 text-white font-bold rounded-lg hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {updatingId === kot.id ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                        Mark Ready
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
