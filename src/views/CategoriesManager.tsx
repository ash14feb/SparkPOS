import { useState } from 'react';
import { api } from '../lib/api';
import { usePosStore } from '../store/usePosStore';
import { Folder, Plus, Edit2, Trash2, Check, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

export function CategoriesManager() {
  const { categories, fetchBootstrap } = usePosStore();
  const [newCategory, setNewCategory] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    
    try {
      setIsAdding(true);
      await api.createCategory({ name: newCategory.trim() });
      toast.success('Category created');
      setNewCategory('');
      fetchBootstrap();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create category');
    } finally {
      setIsAdding(false);
    }
  };

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    
    try {
      setIsSaving(true);
      await api.updateCategory(id, { name: editName.trim() });
      toast.success('Category updated');
      setEditingId(null);
      fetchBootstrap();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update category');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this category? Active items linked to it will prevent deletion.')) return;
    
    try {
      await api.deleteCategory(id);
      toast.success('Category deleted');
      fetchBootstrap();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category (it may contain active items)');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Add Category</h2>
        <form onSubmit={handleAddCategory} className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. Beverages, Starters, Main Course..."
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
          />
          <button
            type="submit"
            disabled={isAdding || !newCategory.trim()}
            className="flex items-center px-6 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {isAdding ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            Add
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Manage Categories</h2>
          <span className="text-xs font-bold text-brand-700 bg-brand-100 px-2.5 py-1 rounded-full">
            {categories.length} Total
          </span>
        </div>
        
        {categories.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-900">No categories found</p>
            <p className="text-sm">Add a category above to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {categories.map((cat: any) => (
              <li key={cat.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                {editingId === cat.id ? (
                  <div className="flex-1 flex items-center gap-3 mr-4">
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdate(cat.id)}
                      className="flex-1 px-3 py-1.5 border border-brand-300 rounded-md focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none bg-white"
                    />
                    <button 
                      onClick={() => handleUpdate(cat.id)}
                      disabled={isSaving}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                      title="Save"
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => setEditingId(null)}
                      disabled={isSaving}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md transition-colors"
                      title="Cancel"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center mr-3">
                        <Folder className="w-4 h-4 text-gray-500" />
                      </div>
                      <span className="font-medium text-gray-900">{cat.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => startEdit(cat)}
                        className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Edit Category"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(cat.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Category"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
