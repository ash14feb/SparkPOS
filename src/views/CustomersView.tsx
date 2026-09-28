import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Users, Search, Plus, User, MessageCircle, X, Save, Trash2 } from 'lucide-react';
import { usePosStore } from '../store/usePosStore';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface Customer {
  id: number | string;
  name: string;
  phone: string;
  email: string;
  loyalty_points: number;
  total_orders: number;
  total_spent: number;
  source?: string | null; // ONLINE | DINEIN | TAKEAWAY | null(manual)
  auto?: boolean;
}

interface Template {
  id: string;
  name: string;
  text: string;
}

const DEFAULT_TEMPLATE: Template = {
  id: 'default',
  name: 'Festival Offer',
  text: 'Hi {{1}}, Today we are having a special offer for you! 🎉 Visit us soon!',
};

function templateKey(tenantId: any) {
  return `dinoscan-wa-templates-${tenantId || 'x'}`;
}
function selectedKey(tenantId: any) {
  return `dinoscan-wa-selected-${tenantId || 'x'}`;
}

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`; // India default
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

function sourceBadge(source?: string | null) {
  const s = String(source || '').toUpperCase();
  if (s === 'ONLINE') return { label: '🛵 Online', cls: 'bg-violet-100 text-violet-700' };
  if (s === 'DINEIN' || s === 'DINE IN') return { label: '🍽️ Dine-In', cls: 'bg-orange-100 text-orange-700' };
  if (s === 'TAKEAWAY' || s === 'TAKE AWAY') return { label: '🛍️ Takeaway', cls: 'bg-teal-100 text-teal-700' };
  return { label: '• Manual', cls: 'bg-gray-100 text-gray-500' };
}

export function CustomersView() {
  const { settings } = usePosStore();
  const tenantId = (settings as any)?.tenantId ?? (settings as any)?.tenant_id ?? 'x';
  const restaurantName = settings?.restaurantName || 'our restaurant';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Marketing templates (saved per tenant, local).
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftText, setDraftText] = useState(DEFAULT_TEMPLATE.text);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add-customer modal
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(templateKey(tenantId));
      setTemplates(raw ? JSON.parse(raw) : [DEFAULT_TEMPLATE]);
      setSelectedTemplateId(localStorage.getItem(selectedKey(tenantId)) || '');
    } catch {
      setTemplates([DEFAULT_TEMPLATE]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const persistTemplates = (list: Template[]) => {
    setTemplates(list);
    try { localStorage.setItem(templateKey(tenantId), JSON.stringify(list)); } catch {}
  };

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const res = await api.getCustomers();
      setCustomers(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch customers');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (typeFilter) {
        const s = String(c.source || '').toUpperCase();
        if (typeFilter === 'MANUAL' && s) return false;
        if (typeFilter !== 'MANUAL' && s !== typeFilter) return false;
      }
      if (!q) return true;
      return c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
    });
  }, [customers, searchQuery, typeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ONLINE: 0, DINEIN: 0, TAKEAWAY: 0, MANUAL: 0 };
    for (const cu of customers) {
      const s = String(cu.source || '').toUpperCase();
      if (s === 'ONLINE') c.ONLINE++;
      else if (s === 'DINEIN' || s === 'DINE IN') c.DINEIN++;
      else if (s === 'TAKEAWAY' || s === 'TAKE AWAY') c.TAKEAWAY++;
      else c.MANUAL++;
    }
    return c;
  }, [customers]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  const handleSaveTemplate = () => {
    if (!draftText.trim()) return toast.error('Template text is required');
    if (editingId) {
      persistTemplates(templates.map((t) => (t.id === editingId ? { ...t, name: draftName.trim() || t.name, text: draftText } : t)));
      toast.success('Template updated');
    } else {
      const t: Template = { id: `tpl-${Date.now()}`, name: draftName.trim() || `Template ${templates.length + 1}`, text: draftText };
      persistTemplates([...templates, t]);
      setSelectedTemplateId(t.id);
      try { localStorage.setItem(selectedKey(tenantId), t.id); } catch {}
      toast.success('Template saved & selected — WhatsApp is now enabled!');
    }
    setDraftName('');
    setDraftText(DEFAULT_TEMPLATE.text);
    setEditingId(null);
  };

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    try { localStorage.setItem(selectedKey(tenantId), id); } catch {}
  };

  const handleDeleteTemplate = (id: string) => {
    persistTemplates(templates.filter((t) => t.id !== id));
    if (selectedTemplateId === id) {
      setSelectedTemplateId('');
      try { localStorage.removeItem(selectedKey(tenantId)); } catch {}
    }
  };

  const sendWhatsApp = (customer: Customer) => {
    if (!selectedTemplate) return toast.error('Select a message template above first');
    const wa = normalizePhone(customer.phone);
    if (!wa) return toast.error('No valid phone number for this customer');
    const text = selectedTemplate.text
      .split('{{1}}').join(customer.name || 'Customer')
      .split('{{2}}').join(restaurantName);
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const handleAddCustomer = async () => {
    if (!addName.trim()) return toast.error('Name is required');
    if (!addPhone.trim()) return toast.error('Phone is required');
    try {
      setIsSaving(true);
      await api.createCustomer({ name: addName.trim(), phone: addPhone.trim(), email: addEmail.trim() });
      toast.success('Customer added');
      setShowAdd(false);
      setAddName('');
      setAddPhone('');
      setAddEmail('');
      fetchCustomers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center">
          <Users className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Customers</h1>
            <p className="text-sm text-gray-500">{customers.length} total · auto-recorded from orders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all w-full sm:w-56"
            />
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm shrink-0">
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Marketing template */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">📣 WhatsApp Marketing Template</p>
            <p className="text-xs text-gray-400 mb-3">Use <b>{'{{1}}'}</b> for customer name and <b>{'{{2}}'}</b> for your restaurant name. Save & select a template to enable the WhatsApp button on every customer.</p>
            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="Template name (e.g. Diwali Offer)"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-brand-500"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveTemplate} className="flex-1 flex items-center justify-center px-3 py-2 bg-brand-600 text-white text-sm font-bold rounded-lg hover:bg-brand-700">
                  <Save className="w-4 h-4 mr-1.5" /> {editingId ? 'Update' : 'Save'} Template
                </button>
                {editingId && (
                  <button onClick={() => { setEditingId(null); setDraftName(''); setDraftText(DEFAULT_TEMPLATE.text); }} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-brand-500 resize-none"
            />
            {templates.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={cn(
                      'flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full border text-xs font-bold cursor-pointer',
                      selectedTemplateId === t.id ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                    )}
                    onClick={() => handleSelectTemplate(t.id)}
                    title={t.text}
                  >
                    <span className={cn('w-2 h-2 rounded-full', selectedTemplateId === t.id ? 'bg-emerald-500' : 'bg-gray-300')} />
                    {t.name}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(t.id);
                        setDraftName(t.name);
                        setDraftText(t.text);
                      }}
                      className="px-1.5 py-0.5 text-gray-400 hover:text-brand-600"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!selectedTemplate && (
              <p className="text-[11px] text-amber-600 font-medium mt-2">Select a template above to enable WhatsApp messaging.</p>
            )}
          </div>

          {/* Type filter */}
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: '', label: `All (${customers.length})` },
              { id: 'ONLINE', label: `🛵 Online (${counts.ONLINE})` },
              { id: 'DINEIN', label: `🍽️ Dine-In (${counts.DINEIN})` },
              { id: 'TAKEAWAY', label: `🛍️ Takeaway (${counts.TAKEAWAY})` },
              { id: 'MANUAL', label: `• Manual (${counts.MANUAL})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border',
                  typeFilter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Customer list */}
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
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Contact</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Orders</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Spent</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          <User className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                          <p className="text-base font-medium text-gray-900">No customers found</p>
                          <p className="text-sm">Customers are recorded automatically with every order.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer) => {
                        const badge = sourceBadge(customer.source);
                        const waOk = !!selectedTemplate && !!normalizePhone(customer.phone);
                        return (
                          <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-display font-bold">
                                  {customer.name?.charAt(0) || 'C'}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                                  <div className="text-xs text-gray-500 md:hidden">{customer.phone}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={cn('px-2.5 py-1 inline-flex text-xs font-semibold rounded-full', badge.cls)}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                              <div className="text-sm text-gray-900">{customer.phone}</div>
                              <div className="text-sm text-gray-500">{customer.email || '-'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden sm:table-cell">
                              {customer.total_orders || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 hidden sm:table-cell">
                              Rs. {Number(customer.total_spent || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button
                                onClick={() => sendWhatsApp(customer)}
                                disabled={!waOk}
                                title={selectedTemplate ? `Send "${selectedTemplate.name}" via WhatsApp` : 'Select a template above to enable'}
                                className={cn(
                                  'p-2.5 rounded-full transition-all',
                                  waOk ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/30 active:scale-90' : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                )}
                              >
                                <MessageCircle className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add customer modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50" onClick={() => !isSaving && setShowAdd(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Add Customer</h3>
              <button onClick={() => setShowAdd(false)} className="p-2 text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Full name *" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" />
              <input value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="Phone *" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" />
              <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email (optional)" className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-500" />
              <button onClick={handleAddCustomer} disabled={isSaving} className="w-full py-2.5 bg-brand-600 text-white font-bold rounded-lg hover:bg-brand-700 disabled:opacity-60">
                {isSaving ? 'Saving…' : 'Save Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
