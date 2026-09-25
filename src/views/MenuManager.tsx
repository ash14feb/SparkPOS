import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { usePosStore, MenuItem } from '../store/usePosStore';
import { Search, Plus, Edit2, Trash2, Package, ScanLine, X, Loader2, Image as ImageIcon, Sparkles, Camera, Upload, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { BarcodeScannerModal } from '../components/BarcodeScanner';

export function MenuManager() {
  const { menuItems, categories, settings, fetchBootstrap } = usePosStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [quickCategory, setQuickCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showPexelsModal, setShowPexelsModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Bulk selection (tap a card to select; edit/delete buttons are exempt)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [showCategoryPopup, setShowCategoryPopup] = useState(false);
  const [isBulkWorking, setIsBulkWorking] = useState(false);

  const EMPTY_FORM: Partial<MenuItem> = { name: '', price: 0, category: '', image: '', barcode: '', stock: 0, mrp: null, unit: 'NONE', description: '', dietaryType: 'NONE', hsnSac: '', taxRate: 0, purchasePrice: null, wholesalePrice: null, minWholesaleQty: null, portionSize: '', stockInDate: '', lowStockAlert: null, variants: [], isAvailable: true, spiceLevel: 0 };
  const [formData, setFormData] = useState<Partial<MenuItem>>(EMPTY_FORM);
  const UNITS = ['NONE','BAG','BOX','BTL','BUC','CARATS','CARTONS','DOZENS','GMS','KG','KW'];
  const UNIT_LABELS: Record<string,string> = { NONE: 'None', BAG: 'BAG (Bags)', BOX: 'BOX', BTL: 'BTL (Bottle)', BUC: 'BUC (Buckets)', CARATS: 'Carats', CARTONS: 'Cartons', DOZENS: 'Dozens', GMS: 'Gms', KG: 'Kg', KW: 'kW' };
  const TAX_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];
  const PORTIONS = ['Regular','Medium','Large','Half','Full','Serves 1-3','Serves 4-6'];
  const VARIANT_TYPES = ['SIZE','PORTION','QUANTITY','SERVING','CUSTOM'];
  const set = (p: Partial<MenuItem>) => setFormData((prev) => ({ ...prev, ...p }));
  const resetForm = () => setFormData({ ...EMPTY_FORM });

  const filteredItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode?.includes(searchTerm)
  );

  // Group items under category headings (store category order first)
  const groupedSections: { category: string; items: MenuItem[] }[] = (() => {
    const groups = new Map<string, MenuItem[]>();
    for (const item of filteredItems) {
      const key = item.category || 'Uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    const order = categories.map((c: any) => c.name);
    return [...groups.entries()]
      .sort((a, b) => {
        const ia = order.indexOf(a[0]);
        const ib = order.indexOf(b[0]);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      })
      .map(([category, items]) => ({ category, items }));
  })();

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCategory.trim()) return;
    try {
      setIsAddingCategory(true);
      const res = await api.createCategory({ name: quickCategory });
      toast.success('Category added');
      setQuickCategory('');
      fetchBootstrap(true);
      if (res.data?.name) {
        setFormData(prev => ({ ...prev, category: res.data.name }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add category');
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleEdit = (item: MenuItem) => {
    setFormData({ ...EMPTY_FORM, ...item });
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteMenuItem(itemToDelete);
      toast.success('Item deleted');
      fetchBootstrap(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    } finally {
      setIsDeleting(false);
      setItemToDelete(null);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  };

  const clearSelection = () => {
    setSelectedIds([]);
    setBulkCategory('');
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBulkWorking(true);
      await Promise.all(selectedIds.map((id) => api.deleteMenuItem(id)));
      toast.success(`${selectedIds.length} item(s) deleted`);
      clearSelection();
      fetchBootstrap(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete items');
    } finally {
      setIsBulkWorking(false);
      setShowBulkDelete(false);
    }
  };

  const handleBulkCategory = async () => {
    if (selectedIds.length === 0 || !bulkCategory) {
      return toast.error('Select items and a category');
    }
    try {
      setIsBulkWorking(true);
      await Promise.all(
        selectedIds.map((id) => {
          const item = menuItems.find((m) => m.id === id);
          return api.updateMenuItem(id, { ...(item || {}), category: bulkCategory });
        })
      );
      toast.success(`${selectedIds.length} item(s) moved to ${bulkCategory}`);
      clearSelection();
      setShowCategoryPopup(false);
      fetchBootstrap(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    } finally {
      setIsBulkWorking(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      toast.error('Name and price are required');
      return;
    }

    try {
      setIsSubmitting(true);
      if (formData.id) {
        await api.updateMenuItem(formData.id, formData);
        toast.success('Item updated');
      } else {
        await api.createMenuItem(formData);
        toast.success('Item added');
      }
      setIsEditing(false);
      setFormData({ ...EMPTY_FORM });
      fetchBootstrap(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 flex flex-col animate-in slide-in-from-bottom sm:static sm:z-auto sm:bg-transparent sm:block sm:animate-none space-y-0 sm:space-y-6 overflow-hidden sm:overflow-visible">
        <div className="bg-white sm:bg-brand-50 border-b sm:border border-gray-200 sm:border-brand-100 sm:rounded-xl p-4 flex items-center justify-between shadow-sm sm:shadow-none shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setIsEditing(false);
                setFormData({ ...EMPTY_FORM });
              }}
              className="sm:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-gray-900 sm:text-brand-900 font-bold text-lg sm:text-base">{formData.id ? 'Edit Item' : 'Add New Item'}</h2>
              <p className="text-xs sm:text-sm text-gray-500 sm:text-brand-700 hidden sm:block">Fill in the details below</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setIsEditing(false);
              setFormData({ ...EMPTY_FORM });
            }}
            className="hidden sm:flex p-2 hover:bg-brand-100 rounded-lg text-brand-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50 sm:bg-white sm:p-6 sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-100 pb-24 sm:pb-6">
          <form onSubmit={handleQuickAddCategory} className="mb-6 flex gap-2 p-4 sm:p-0 bg-white sm:bg-transparent border-b sm:border-b-0 border-gray-200 sm:border-transparent">
            <input
              type="text"
              placeholder="Quick add new category..."
              value={quickCategory}
              onChange={(e) => setQuickCategory(e.target.value)}
              className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
            />
            <button
              type="submit"
              disabled={isAddingCategory || !quickCategory.trim()}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Add Category
            </button>
          </form>

          <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-0 bg-white sm:bg-transparent">
            {/* 1. Item Image (first) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Item Image</label>
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 flex gap-2">
                    <label className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-center font-medium shadow-sm whitespace-nowrap">
                      <Camera className="w-4 h-4 mr-2" />
                      <span className="text-sm">Upload Photo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                  <div className="hidden sm:block w-px h-8 bg-gray-200"></div>
                  <button type="button" onClick={() => setShowPexelsModal(true)} className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-700 rounded-lg hover:from-purple-100 hover:to-indigo-100 transition-colors flex items-center justify-center font-medium whitespace-nowrap">
                    <Sparkles className="w-4 h-4 mr-2 text-purple-500" />
                    <span className="text-sm">Image Suggestion</span>
                  </button>
                </div>
                {formData.image && (
                  <div className="mt-4 flex items-center gap-4 p-3 bg-white border border-gray-200 rounded-lg">
                    <img src={formData.image} alt="Preview" className="w-16 h-16 object-cover rounded-md border border-gray-200" />
                    <div className="flex-1"><p className="text-sm font-medium text-gray-900">Image selected</p></div>
                    <button type="button" onClick={() => set({ image: '' })} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-5 h-5" /></button>
                  </div>
                )}
              </div>
            </div>
            {/* 2. Name then 3. Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Item Name *</label>
                <input type="text" required value={formData.name || ''} onChange={e => set({ name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select value={formData.category || ''} onChange={e => set({ category: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-white">
                  <option value="">Select a category</option>
                  {categories.map((c: any) => (<option key={c.id} value={c.name}>{c.name}</option>))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={formData.description || ''} onChange={e => set({ description: e.target.value })} rows={3} placeholder="Short description of the item..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Price ({settings.currencySymbol || 'Rs.'}) *</label>
                <input type="number" step="0.01" required min="0" value={formData.price ?? ''} onChange={e => set({ price: parseFloat(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">MRP</label>
                <input type="number" step="0.01" min="0" value={formData.mrp ?? ''} onChange={e => set({ mrp: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit</label>
                <select value={formData.unit || 'NONE'} onChange={e => set({ unit: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white outline-none">
                  {UNITS.map(u => (<option key={u} value={u}>{UNIT_LABELS[u]}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Dietary</label>
                <div className="flex gap-2">
                  {[{ v: 'VEG', icon: '🟩', label: 'Veg' }, { v: 'NONVEG', icon: '🟥', label: 'Non-veg' }, { v: 'EGG', icon: '🥚', label: 'Egg' }, { v: 'NONE', icon: '—', label: 'None' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set({ dietaryType: o.v })} title={o.label} className={cn('flex-1 px-2 py-2 border rounded-lg text-sm font-medium', formData.dietaryType === o.v ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-600')}>{o.icon} {o.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Availability</label>
                <div className="flex gap-2">
                  {[{ v: true, icon: '✅', label: 'Available' }, { v: false, icon: '🚫', label: 'Out of Stock' }].map(o => {
                    const on = (formData.isAvailable !== false) === o.v;
                    return (
                      <button key={String(o.v)} type="button" onClick={() => set({ isAvailable: o.v })} title={o.label} className={cn('flex-1 px-2 py-2 border rounded-lg text-sm font-medium', on ? (o.v ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-gray-300 text-gray-600')}>{o.icon} {o.label}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Spice Level 🌶️</label>
                <div className="flex gap-2">
                  {[{ v: 0, icon: '—', label: 'None' }, { v: 1, icon: '🌶️', label: 'Mild' }, { v: 2, icon: '🌶️🌶️', label: 'Medium' }, { v: 3, icon: '🌶️🌶️🌶️', label: 'Hot' }].map(o => (
                    <button key={o.v} type="button" onClick={() => set({ spiceLevel: o.v })} title={o.label} className={cn('flex-1 px-2 py-2 border rounded-lg text-sm font-medium', (formData.spiceLevel || 0) === o.v ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-300 text-gray-600')}>{o.icon} {o.label}</button>
                  ))}
                </div>
              </div>
              {settings.enableBarcode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Barcode</label>
                  <div className="relative">
                    <input type="text" value={formData.barcode || ''} onChange={e => set({ barcode: e.target.value })} className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg outline-none" />
                    <button type="button" onClick={() => setShowScanner(true)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-brand-600 rounded-md"><ScanLine className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
            {/* TAX and HSN section */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">TAX &amp; HSN</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">HSN / SAC</label><input type="text" value={formData.hsnSac || ''} onChange={e => set({ hsnSac: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Tax Rate %</label><select value={String(formData.taxRate ?? 0)} onChange={e => set({ taxRate: parseFloat(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white outline-none">{TAX_RATES.map(r => (<option key={r} value={r}>{r}%</option>))}</select></div>
              </div>
            </div>
            {/* Other Pricing */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Other Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Price</label><input type="number" step="0.01" min="0" value={formData.purchasePrice ?? ''} onChange={e => set({ purchasePrice: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Wholesale Price</label><input type="number" step="0.01" min="0" value={formData.wholesalePrice ?? ''} onChange={e => set({ wholesalePrice: e.target.value === '' ? null : parseFloat(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Min Wholesale Qty</label><input type="number" min="0" step="1" value={formData.minWholesaleQty ?? ''} onChange={e => set({ minWholesaleQty: e.target.value === '' ? null : parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" /></div>
              </div>
            </div>
            {/* Other Details */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Other Details</h3>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Portion Size</label>
              <div className="flex flex-wrap gap-2">{PORTIONS.map(p => (<button key={p} type="button" onClick={() => set({ portionSize: p })} className={cn('px-3 py-1.5 border rounded-full text-sm', formData.portionSize === p ? 'border-brand-600 bg-brand-50 text-brand-700 font-medium' : 'border-gray-300 text-gray-600')}>{p}</button>))}</div>
            </div>
            {/* Stock / Inventory */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Stock / Inventory</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Opening Stock</label><input type="number" value={formData.stock || 0} onChange={e => set({ stock: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Stock-in Date</label><input type="date" value={formData.stockInDate || ''} onChange={e => set({ stockInDate: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Low Stock Alert At</label><input type="number" min="0" step="1" value={formData.lowStockAlert ?? ''} onChange={e => set({ lowStockAlert: e.target.value === '' ? null : parseInt(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none" /></div>
              </div>
            </div>
            {/* Variants */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-gray-900">Variants</h3><button type="button" onClick={() => set({ variants: [...(formData.variants || []), { variantType: 'SIZE', variantName: '', extraPrice: 0 }] })} className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg">+ Add Variant</button></div>
              <div className="space-y-2">
                {(formData.variants || []).map((v, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <select value={v.variantType} onChange={e => { const arr = [...(formData.variants || [])]; arr[i] = { ...arr[i], variantType: e.target.value as any }; set({ variants: arr }); }} className="col-span-3 px-2 py-2 border border-gray-300 rounded-lg bg-white text-sm outline-none">{VARIANT_TYPES.map(t => (<option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>))}</select>
                    <input type="text" placeholder="Name (e.g. Large)" value={v.variantName} onChange={e => { const arr = [...(formData.variants || [])]; arr[i] = { ...arr[i], variantName: e.target.value }; set({ variants: arr }); }} className="col-span-5 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                    <input type="number" step="0.01" placeholder="+ Price" value={v.extraPrice ?? ''} onChange={e => { const arr = [...(formData.variants || [])]; arr[i] = { ...arr[i], extraPrice: parseFloat(e.target.value) || 0 }; set({ variants: arr }); }} className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                    <button type="button" onClick={() => set({ variants: (formData.variants || []).filter((_, j) => j !== i) })} className="col-span-1 p-2 text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                {(formData.variants || []).length === 0 && (<p className="text-xs text-gray-400">No variants. Add Size, Portion, Quantity, Serving, Custom or your own name.</p>)}
              </div>
            </div>

            <div className="fixed sm:static bottom-0 left-0 right-0 p-4 sm:p-0 bg-white sm:bg-transparent border-t sm:border-t-0 border-gray-200 sm:pt-4 sm:border-gray-100 flex justify-end z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] sm:shadow-none">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto flex items-center justify-center px-6 py-3 sm:py-2.5 bg-brand-600 text-white rounded-xl sm:rounded-lg hover:bg-brand-700 transition-colors font-medium disabled:opacity-70 text-lg sm:text-base"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
                {formData.id ? 'Update Item' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
        
        {showPexelsModal && (
          <PexelsImageModal
            isOpen={showPexelsModal}
            onClose={() => setShowPexelsModal(false)}
            initialQuery={formData.name || ''}
            onSelectImage={(url) => {
              setFormData({ ...formData, image: url });
              setShowPexelsModal(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items by name, category, or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs font-bold text-gray-900 whitespace-nowrap px-1">
                {selectedIds.length} selected
              </span>
              <button
                onClick={() => setShowCategoryPopup(true)}
                disabled={isBulkWorking}
                className="flex items-center justify-center px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                Change Category
              </button>
              <button
                onClick={() => setShowBulkDelete(true)}
                disabled={isBulkWorking}
                className="flex items-center justify-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </button>
              <button
                onClick={clearSelection}
                className="px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
              >
                Clear
              </button>
              <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block" />
            </>
          )}
          <button
            onClick={() => setShowAIModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium shadow-sm shadow-purple-500/30 relative overflow-hidden group"
          >
            <Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse" />
            <span className="relative z-10">Import (AI)</span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </button>
          <button
            onClick={() => {
              setFormData({ ...EMPTY_FORM });
              setIsEditing(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </button>
        </div>
      </div>

      {/* Bulk action bar — mobile only (desktop uses compact header buttons) */}
      {selectedIds.length > 0 && (
        <div className="sm:hidden bg-white rounded-xl border border-brand-200 shadow-sm p-3 flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 whitespace-nowrap mr-1">
            {selectedIds.length} selected
          </span>
          <button
            onClick={() => setShowCategoryPopup(true)}
            disabled={isBulkWorking}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            Change Category
          </button>
          <button
            onClick={() => setShowBulkDelete(true)}
            disabled={isBulkWorking}
            className="flex-1 flex items-center justify-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4 mr-1.5" /> Delete
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {groupedSections.map((sec) => (
        <div key={sec.category}>
          <div className="flex items-center gap-2 mt-1 mb-2">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{sec.category}</h3>
            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{sec.items.length}</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
            {sec.items.map((item) => {
          const isOutOfStock = item.isAvailable === false || (settings.enableStock && !settings.allowSaleWhenOutOfStock && (item.stock || 0) <= 0);
          
          return (
            <div 
              key={item.id}
              onClick={() => toggleSelect(item.id)}
              className={cn(
                "bg-white rounded-xl border overflow-hidden group hover:shadow-md transition-all relative flex flex-col cursor-pointer",
                selectedIds.includes(item.id)
                  ? "border-brand-600 ring-2 ring-brand-500/30"
                  : "border-gray-200",
                isOutOfStock ? "opacity-60 grayscale-[0.5]" : ""
              )}
            >
              <div className="absolute top-2 left-2 z-10 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                  className="p-1.5 sm:p-2 bg-white text-gray-600 hover:text-brand-600 rounded-md shadow-sm border border-gray-200"
                >
                  <Edit2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </button>
              </div>
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
                {selectedIds.includes(item.id) && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-md bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center shadow">
                    {selectedIds.indexOf(item.id) + 1}
                  </span>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setItemToDelete(item.id); }}
                  className="p-1.5 sm:p-2 bg-white text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md shadow-sm border border-gray-200 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </button>
              </div>
              
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-display text-4xl font-bold bg-brand-50/30">
                    {item.name.charAt(0)}
                  </div>
                )}
                
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] flex items-center justify-center">
                    <span className="bg-red-600 text-white px-3 py-1 text-xs font-bold rounded-full shadow-sm">
                      OUT OF STOCK
                    </span>
                  </div>
                )}
              </div>
              
              <div className="p-3 flex-1 flex flex-col">
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 truncate">{item.category || 'Uncategorized'}</div>
                <h3 className="font-semibold text-gray-900 leading-tight mb-2 line-clamp-2">{item.name}</h3>
                
                <div className="mt-auto space-y-2">
                  <div className="font-display font-bold text-brand-600">
                    {settings.currencySymbol || 'Rs.'} {Number(item.price).toFixed(2)}
                  </div>
                  
                  {(settings.enableStock || settings.enableBarcode) && (
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      {settings.enableStock && (
                        <div className={cn("flex items-center", (item.stock || 0) <= 0 ? "text-red-600 font-medium" : "text-emerald-600")}>
                          <Package className="w-3.5 h-3.5 mr-1" />
                          {item.stock || 0} left
                        </div>
                      )}
                      {settings.enableBarcode && item.barcode && (
                        <div className="flex items-center text-gray-400 font-mono text-[10px]" title={item.barcode}>
                          <ScanLine className="w-3 h-3 mr-1" />
                          {item.barcode.length > 8 ? '...' + item.barcode.slice(-4) : item.barcode}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
              );
            })}
          </div>
        </div>
      ))}
      
      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-100 border-dashed">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-900">No items found</p>
          <p className="text-sm">Try a different search or add a new item.</p>
        </div>
      )}

      {showAIModal && (
        <AIImportModal 
          isOpen={showAIModal} 
          onClose={() => setShowAIModal(false)} 
          categories={categories}
          onImportSuccess={() => fetchBootstrap(true)}
        />
      )}

      {showScanner && (
        <BarcodeScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={(code) => setFormData({ ...formData, barcode: code })}
        />
      )}

      {/* Delete confirmation */}
      {itemToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete item?</h3>
            <p className="text-sm text-gray-500 mb-6">
              {menuItems.find((i) => i.id === itemToDelete)?.name
                ? `"${menuItems.find((i) => i.id === itemToDelete)?.name}" will be permanently removed.`
                : 'This item will be permanently removed.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center justify-center"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change-category popup */}
      {showCategoryPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Change Category</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedIds.length} item(s) will be moved.</p>
            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 mb-5">
              {categories.length === 0 && (
                <p className="text-sm text-gray-400 py-2">No categories available.</p>
              )}
              {categories.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => setBulkCategory(c.name)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    bulkCategory === c.name
                      ? 'bg-brand-50 text-brand-700 border border-brand-200'
                      : 'text-gray-700 hover:bg-gray-50 border border-transparent'
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowCategoryPopup(false); setBulkCategory(''); }}
                disabled={isBulkWorking}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCategory}
                disabled={!bulkCategory || isBulkWorking}
                className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {isBulkWorking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete {selectedIds.length} item(s)?</h3>
            <p className="text-sm text-gray-500 mb-6">They will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkDelete(false)}
                disabled={isBulkWorking}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkWorking}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center justify-center"
              >
                {isBulkWorking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PexelsImageModal({ isOpen, onClose, initialQuery, onSelectImage }: { isOpen: boolean, onClose: () => void, initialQuery: string, onSelectImage: (url: string) => void }) {
  const [query, setQuery] = useState(initialQuery || 'food');
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // You can set the actual API key provided by user or use a public default if provided
  const PEXELS_API_KEY = 'TqzzxBKklGMCCgr9EfWXANsxu64rIlrVTx992qX9BfjOpfSIKJ74nAhr'; // Generic test key, replace if needed

  const searchImages = async (searchQuery: string, pageNum: number, append = false) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery)}&per_page=15&page=${pageNum}`, {
        headers: {
          Authorization: PEXELS_API_KEY
        }
      });
      if (!res.ok) throw new Error('Failed to fetch images');
      const data = await res.json();
      
      if (append) {
        setImages(prev => [...prev, ...data.photos]);
      } else {
        setImages(data.photos);
      }
      setHasMore(data.photos.length > 0 && data.next_page != null);
    } catch (err) {
      console.error(err);
      if (!append) setImages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      searchImages(query, 1, false);
    }
  }, [isOpen]); // Only run once when modal opens

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    searchImages(query, 1, false);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && !loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      searchImages(query, nextPage, true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <h2 className="font-bold text-lg text-gray-900 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
            Image Suggestions
          </h2>
          <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search images (e.g. 'chicken biryani')"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none"
            />
            <button
              type="submit"
              disabled={loading && page === 1}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center shadow-sm disabled:opacity-50"
            >
              <Search className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </div>

        <div 
          className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50"
          onScroll={handleScroll}
        >
          {images.length === 0 && !loading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <ImageIcon className="w-12 h-12 mb-3 text-gray-300" />
              <p>No images found. Try a different search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {images.map((img: any) => (
                <div 
                  key={img.id} 
                  onClick={() => onSelectImage(img.src.medium)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-gray-200 cursor-pointer shadow-sm hover:shadow-md transition-shadow border-2 border-transparent hover:border-purple-500"
                >
                  <img 
                    src={img.src.medium} 
                    alt={img.alt || 'Suggestion'} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all bg-white text-gray-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                      Select
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="col-span-full py-8 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AIImportModal({ isOpen, onClose, categories, onImportSuccess }: { isOpen: boolean, onClose: () => void, categories: any[], onImportSuccess: () => void }) {
  const { menuItems } = usePosStore();
  const [category, setCategory] = useState('');
  const [image, setImage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allowAutoImages, setAllowAutoImages] = useState(false);
  const [extractedItems, setExtractedItems] = useState<{name: string, price: number, status?: 'pending'|'success'|'error', errorMsg?: string}[]>([]);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const loadingMessages = [
    "Something wonderful is happening...",
    "Analyzing your delicious menu...",
    "Extracting items and prices...",
    "Cooking up the data...",
    "Giving your menu a makeover..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading && extractedItems.length === 0) {
      interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading, extractedItems.length]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImport = async () => {
    if (!category) {
      toast.error('Please select a category first');
      return;
    }
    if (!image) {
      toast.error('Please upload a menu image');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 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'
        },
        body: JSON.stringify({
          model: "gpt-5.6-luna",
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Extract every menu item and its price from this restaurant menu. price should only have the number value nothing else no Rs ,curreny symbol or other text it should be only numeric value. Return JSON only. Do not invent information."
                },
                {
                  type: "input_image",
                  image_url: image
                }
              ]
            }
          ]
        })
      });

      if (!res.ok) {
        throw new Error('API request failed');
      }

      const data = await res.json();
      
      let rawJsonText = '';
      try {
        const messageOutput = data.output?.find((o: any) => o.type === 'message');
        if (messageOutput && messageOutput.content?.[0]?.text) {
          rawJsonText = messageOutput.content[0].text;
        } else if (data.output?.[1]?.content?.[0]?.text) {
          rawJsonText = data.output[1].content[0].text;
        } else {
          rawJsonText = data.output?.[0]?.content?.[0]?.text || "[]"; 
        }
      } catch (err) {
         rawJsonText = "[]"; 
      }
      
      const cleanJsonText = rawJsonText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(cleanJsonText);
      
      let items: {name: string, price: number, status?: 'pending'|'success'|'error', errorMsg?: string}[] = [];
      
      const processPrice = (priceVal: any) => {
        if (typeof priceVal === 'number') return priceVal;
        if (typeof priceVal === 'string') {
          const match = priceVal.match(/[\d.]+/);
          return match ? Number(match[0]) : 0;
        }
        return 0;
      };

      const sourceArray = parsedData.items || parsedData;
      
      if (Array.isArray(sourceArray)) {
        items = sourceArray.map((item: any) => ({
          name: item.name || item.item || 'Unknown',
          price: processPrice(item.price)
        }));
      } else {
        Object.values(parsedData).forEach((catItems: any) => {
          if (Array.isArray(catItems)) {
            catItems.forEach((item: any) => {
              items.push({
                name: item.name || item.item || 'Unknown',
                price: processPrice(item.price)
              });
            });
          }
        });
      }

      setExtractedItems(items);
      toast.success(`Successfully extracted ${items.length} items`);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to analyze image. Ensure API is reachable.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (extractedItems.length === 0) return;
    setIsLoading(true);
    let successCount = 0;
    
    const updatedItems = [...extractedItems];
    
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      // Skip already processed items
      if (item.status === 'success' || item.status === 'error') continue;
      
      const exists = menuItems.some(m => m.name.toLowerCase().trim() === item.name.toLowerCase().trim());
      
      if (exists) {
        updatedItems[i].status = 'error';
        updatedItems[i].errorMsg = 'items already exist in menu';
      } else {
        try {
          let imageUrl = '';
          if (allowAutoImages) {
            const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(item.name)}&per_page=1`, {
              headers: { Authorization: 'TqzzxBKklGMCCgr9EfWXANsxu64rIlrVTx992qX9BfjOpfSIKJ74nAhr' }
            });
            if (res.ok) {
              const data = await res.json();
              if (data.photos && data.photos.length > 0) {
                imageUrl = data.photos[0].src.medium;
              }
            }
          }

          await api.createMenuItem({
            name: item.name,
            price: item.price,
            category: category,
            stock: 0,
            image: imageUrl,
            barcode: ''
          });
          
          updatedItems[i].status = 'success';
          successCount++;
        } catch (err) {
          console.error('Failed to save item', item, err);
          updatedItems[i].status = 'error';
          updatedItems[i].errorMsg = 'Failed to save';
        }
      }
      // Update UI incrementally
      setExtractedItems([...updatedItems]);
    }
    
    setIsLoading(false);
    toast.success(`Processed items. ${successCount} saved.`);
    onImportSuccess();
    // Intentionally NOT closing so they can see the checkmarks/red marks
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center text-purple-900">
            <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
            <h2 className="font-bold text-lg">AI Menu Import</h2>
          </div>
          <button onClick={onClose} disabled={isLoading} className="p-2 -mr-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-white/50">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
          {isLoading && extractedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in duration-300">
              <div className="relative">
                <Sparkles className="w-16 h-16 text-purple-500 animate-pulse" />
                <div className="absolute inset-0 border-4 border-purple-200 rounded-full border-t-purple-600 animate-spin" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-gray-900 transition-opacity duration-300">
                {loadingMessages[loadingMessageIndex]}
              </h3>
              <p className="mt-2 text-sm text-gray-500 max-w-[250px]">Please wait, your menu is getting a makeover.</p>
            </div>
          ) : extractedItems.length === 0 ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">1. Target Category *</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none bg-white"
                >
                  <option value="">Select a category to add items to...</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">2. Menu Image *</label>
                {!image ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-purple-500 hover:bg-purple-50 hover:text-purple-600 transition-colors cursor-pointer group">
                      <Camera className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">Take Photo</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
                    </label>
                    <label className="flex-1 border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-purple-500 hover:bg-purple-50 hover:text-purple-600 transition-colors cursor-pointer group">
                      <Upload className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                      <span className="text-sm font-medium">Upload Image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-gray-200">
                    <img src={image} alt="Menu preview" className="w-full h-48 object-cover" />
                    <button 
                      onClick={() => setImage('')} 
                      className="absolute top-2 right-2 p-1.5 bg-white text-red-600 rounded-md shadow-sm hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mr-2" /> 
                  Extracted Items ({extractedItems.length})
                </h3>
                <span className="text-xs font-bold px-2 py-1 bg-purple-100 text-purple-700 rounded-md">
                  Target: {category}
                </span>
              </div>
              
              <div className="flex items-center justify-between mb-4 p-3 bg-purple-50 rounded-xl border border-purple-100">
                <div className="flex-1 pr-4">
                  <label htmlFor="allowAutoImages" className="text-sm font-bold text-purple-900 cursor-pointer block">AI Auto Assign Images</label>
                  <p className="text-[11px] leading-tight text-purple-700 mt-0.5">Automatically assigns a matching picture to each new dish imported. You can always change it later.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowAutoImages}
                  onClick={() => setAllowAutoImages(!allowAutoImages)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-600 focus:ring-offset-2",
                    allowAutoImages ? "bg-purple-600" : "bg-gray-200"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      allowAutoImages ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto custom-scrollbar">
                {extractedItems.map((item, idx) => (
                  <div key={idx} className="flex flex-col p-3 hover:bg-gray-50">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        {item.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                        {item.status === 'error' && <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
                        <span className={cn("font-medium text-sm text-gray-900", item.status === 'error' && "text-red-700")}>{item.name}</span>
                      </div>
                      <span className="font-bold text-sm text-brand-600 font-mono">{Number(item.price).toFixed(2)}</span>
                    </div>
                    {item.status === 'error' && item.errorMsg && (
                      <span className="text-xs text-red-500 mt-1 ml-6">{item.errorMsg}</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 pt-2 text-center">
                Review the items above. Click Save to add them all to the selected category.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
          >
            {extractedItems.length > 0 && extractedItems.every(item => item.status === 'success' || item.status === 'error') ? 'Close' : 'Cancel'}
          </button>
          
          {extractedItems.length === 0 ? (
            <button 
              onClick={handleImport}
              disabled={isLoading || !image || !category}
              className="flex items-center px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-5 h-5 mr-2" />
              )}
              {isLoading ? 'Extracting...' : 'Extract Items'}
            </button>
          ) : !extractedItems.every(item => item.status === 'success' || item.status === 'error') ? (
            <button 
              onClick={handleSave}
              disabled={isLoading}
              className="flex items-center px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" />
              )}
              {isLoading ? 'Saving...' : 'Save All Items'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
