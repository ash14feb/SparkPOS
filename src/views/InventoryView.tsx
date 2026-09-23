import { useEffect, useState } from 'react';
import { Package, FolderTree, LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';
import { MenuManager } from './MenuManager';
import { CategoriesManager } from './CategoriesManager';
import { usePosStore } from '../store/usePosStore';

export function InventoryView() {
  const [activeTab, setActiveTab] = useState<'inventory' | 'categories'>('inventory');
  const { menuItems, fetchBootstrap } = usePosStore();

  // Load items on direct visit/refresh (POS is not the only entry point)
  useEffect(() => {
    if (menuItems.length === 0) fetchBootstrap(true);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10 shrink-0">
        <div className="flex items-center">
          <Package className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Menu & Inventory</h1>
            <p className="text-sm text-gray-500">Manage your products, stock, and categories</p>
          </div>
        </div>

        <div className="flex items-center bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('inventory')}
            className={cn(
              "flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
              activeTab === 'inventory' 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Items
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={cn(
              "flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
              activeTab === 'categories' 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <FolderTree className="w-4 h-4 mr-2" />
            Categories
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 custom-scrollbar no-chain-scroll">
        {activeTab === 'inventory' ? <MenuManager /> : <CategoriesManager />}
      </div>
    </div>
  );
}
