import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { todayInTimezone } from '../lib/datetime';
import { Wallet, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Expense {
  id: number;
  expense_date: string;
  category: string;
  amount: number;
  notes: string;
  created_by: number;
}

const today = () => todayInTimezone();

export function ExpensesView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [date, setDate] = useState(today());
  const [category, setCategory] = useState('General');
  const [amount, setAmount] = useState<number | string>('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      setIsLoading(true);
      const res = await api.getExpenses();
      setExpenses(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch expenses');
    } finally {
      setIsLoading(false);
    }
  };

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const handleAdd = async () => {
    if (!amount || !date) return;
    setIsSaving(true);
    try {
      await api.addExpense({
        expense_date: date,
        category: category.trim() || 'General',
        amount: Number(amount),
        notes: notes.trim(),
      });
      toast.success('Expense added successfully');
      setAmount('');
      setNotes('');
      setCategory('General');
      fetchExpenses();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add expense');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10 shrink-0">
        <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Expense Record</h1>
        <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-brand-50 text-brand-700 text-sm font-bold w-fit">
          Total: Rs. {total.toFixed(2)}
        </span>
      </div>

      {/* Add Expense form */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 shrink-0">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-5xl">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Rent, Vegetables"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Amount *</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')} placeholder="0.00"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional"
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
          </div>
          <div className="flex items-end col-span-2 sm:col-span-1">
            <button onClick={handleAdd} disabled={!amount || !date || isSaving}
              className="w-full flex items-center justify-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" /> Add Expense</>}
            </button>
          </div>
        </div>
      </div>

      {/* List (append-only, latest first from API) */}
      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 custom-scrollbar no-chain-scroll">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
            <p className="text-base font-medium text-gray-900">No expenses recorded.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100 max-w-5xl">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center px-4 sm:px-6 py-3.5">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mr-4 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{e.category || 'General'}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {String(e.expense_date).slice(0, 10)}{e.notes ? ` - ${e.notes}` : ''}
                  </p>
                </div>
                <p className="font-bold text-gray-900 text-sm ml-3 whitespace-nowrap">Rs. {Number(e.amount || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
