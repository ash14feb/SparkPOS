import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2, AlertCircle, ShoppingBag, Info } from 'lucide-react';
import { cn } from '../lib/utils';

export function PublicMenuView() {
  const { code } = useParams();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    if (code) {
      fetchMenu();
    }
  }, [code]);

  const fetchMenu = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await api.getPublicMenu(code!);
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.message || 'Menu not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load menu');
    } finally {
      setIsLoading(false);
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

  const { table, restaurantName, currencySymbol, menuItems } = data;

  // Group by category
  const categories = ['All', ...new Set(menuItems.map((item: any) => item.category || 'Other').filter(Boolean))] as string[];

  const filteredItems = activeCategory === 'All' 
    ? menuItems 
    : menuItems.filter((item: any) => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-gray-50 pb-safe">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-20 pb-2">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-gray-900 leading-tight">
                {restaurantName || 'Digital Menu'}
              </h1>
              {table && (
                <p className="text-sm text-gray-500 font-medium mt-0.5">
                  Table {table.table_no} • {table.seats} Seats
                </p>
              )}
            </div>
            <div className="w-10 h-10 bg-brand-50 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-brand-600" />
            </div>
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

      {/* Menu Grid */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredItems.map((item: any) => (
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
              <div className="flex-1 flex flex-col justify-center">
                <h3 className="font-semibold text-gray-900 text-base leading-tight mb-1">{item.name}</h3>
                {item.category && <p className="text-xs text-gray-500 mb-2">{item.category}</p>}
                <div className="mt-auto flex items-center justify-between">
                  <span className="font-display font-bold text-brand-600 text-lg">
                    {currencySymbol || 'Rs.'} {Number(item.price || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100 border-dashed">
              <Info className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-medium">No items found in this category.</p>
            </div>
          )}
        </div>
      </main>
      
      <footer className="py-6 text-center text-sm text-gray-400">
        Powered by Intelli Billing Software
      </footer>
    </div>
  );
}
