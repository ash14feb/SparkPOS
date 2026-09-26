import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, Check, X, Trash2, Plus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { usePosStore } from '../store/usePosStore';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface UpsellItem {
  id: number;
  recommendedItemId: string;
  name: string;
  price: number;
  image: string;
  reason: string;
  priority: number;
  type: string;
  status: string;
}

interface UpsellGroup {
  sourceItemId: string;
  sourceName: string;
  sourcePrice: number;
  generationId: string;
  items: UpsellItem[];
}

interface Stats {
  menuItems: number;
  itemsWithRecommendations: number;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  lastGenerationId: string | null;
  lastGeneratedAt: string | null;
}

export function UpsellView() {
  const { menuItems, settings, fetchBootstrap } = usePosStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [groups, setGroups] = useState<UpsellGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [regenId, setRegenId] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [addItemId, setAddItemId] = useState('');
  const currency = settings?.currencySymbol || 'Rs.';

  const load = async (status = statusFilter) => {
    try {
      setIsLoading(true);
      const [s, g] = await Promise.all([
        api.getUpsellStats(),
        api.getUpsells(status ? { status } : undefined),
      ]);
      setStats(s.data || s);
      setGroups(g.data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load upsell data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (menuItems.length === 0) fetchBootstrap(true);
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const generations = useMemo(() => {
    const m = new Map<string, { id: string; pending: number; total: number }>();
    for (const g of groups) {
      for (const it of g.items) {
        const cur = m.get(g.generationId) || { id: g.generationId, pending: 0, total: 0 };
        cur.total++;
        if (it.status === 'DRAFT') cur.pending++;
        m.set(g.generationId, cur);
      }
    }
    return [...m.values()];
  }, [groups]);

  const handleGenerate = async () => {
    if (!confirm('Generate AI recommendations for your menu? New results will be drafts — approved ones stay untouched.')) return;
    try {
      setIsGenerating(true);
      const res = await api.generateUpsell();
      toast.success(res.message || 'Recommendations generated as drafts!');
      setStatusFilter('DRAFT');
      await load('DRAFT');
    } catch (e: any) {
      toast.error(e?.message || 'Unable to generate recommendations right now. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const mutate = async (fn: () => Promise<any>, okMsg: string) => {
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    }
  };

  const handleRegenItem = async (sourceItemId: string) => {
    try {
      setRegenId(sourceItemId);
      await api.regenerateUpsellItem(sourceItemId);
      toast.success('Regenerated drafts for this item');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Unable to generate recommendations right now. Please try again.');
    } finally {
      setRegenId(null);
    }
  };

  const handleAddItem = async (sourceItemId: string) => {
    if (!addItemId) return toast.error('Pick a menu item to add');
    await mutate(
      () => api.addUpsell({ source_item_id: sourceItemId, recommended_item_id: addItemId }),
      'Item added as draft'
    );
    setAddFor(null);
    setAddItemId('');
  };

  const fmtGen = (id: string) => {
    const m = id.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
    if (!m) return id;
    return `${m[3]} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]}`;
  };

  const fmtDate = (ts: string | null) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 shadow-sm z-10">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-display font-bold text-gray-900 leading-tight">AI Upselling Engine</h1>
            <p className="text-xs text-gray-500">Smart complementary recommendations — review and approve before customers see them.</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-bold rounded-xl hover:opacity-95 disabled:opacity-60 shadow-md shrink-0"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {isGenerating ? 'Generating…' : 'Generate Recommendations'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Menu Items', value: stats?.menuItems ?? '—' },
              { label: 'Recommendations', value: stats?.total ?? '—' },
              { label: 'Approved', value: stats?.approved ?? '—' },
              { label: 'Pending Review', value: stats?.pending ?? '—' },
              { label: 'Last Generated', value: stats?.lastGeneratedAt ? fmtDate(stats.lastGeneratedAt) : 'Never', wide: true },
            ].map((s) => (
              <div key={s.label} className={cn('bg-white rounded-xl border border-gray-100 p-3 shadow-sm', (s as any).wide && 'col-span-2 md:col-span-1')}>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{s.label}</p>
                <p className="text-lg font-display font-bold text-gray-900 mt-0.5 truncate">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {['', 'DRAFT', 'APPROVED', 'REJECTED'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-bold', statusFilter === s ? 'bg-white shadow text-gray-900' : 'text-gray-500')}
                >
                  {s === '' ? 'All' : s === 'DRAFT' ? 'Pending' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <button onClick={() => load()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Generation batches */}
          {generations.map((gen) => (
            <div key={gen.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">Generation: {fmtGen(gen.id)}</p>
                <p className="text-xs text-gray-500">{gen.pending} pending · {gen.total} total</p>
              </div>
              {gen.pending > 0 && (
                <>
                  <button
                    onClick={() => mutate(() => api.approveAllUpsell(gen.id), `Approved ${gen.pending} recommendation(s)`)}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                  >
                    Approve All
                  </button>
                  <button
                    onClick={() => { if (confirm('Reject all drafts in this generation?')) mutate(() => api.rejectAllUpsell(gen.id), 'Drafts rejected'); }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200"
                  >
                    Reject All
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Review groups */}
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" /></div>
          ) : groups.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-500">
              <Sparkles className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="font-bold text-gray-900">No recommendations yet</p>
              <p className="text-sm mt-1">Tap Generate Recommendations to let AI analyze your menu.</p>
            </div>
          ) : (
            groups.map((g) => {
              const open = expanded[g.sourceItemId] !== false;
              return (
                <div key={g.sourceItemId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded((p) => ({ ...p, [g.sourceItemId]: !open }))}
                    className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{g.sourceName}</p>
                      <p className="text-xs text-gray-500">{g.items.length} recommended · {fmtGen(g.generationId)}</p>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); handleRegenItem(g.sourceItemId); }}
                      className="text-[11px] font-bold text-violet-600 hover:underline flex items-center"
                      title="Regenerate for this item"
                    >
                      {regenId === g.sourceItemId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />} Regenerate
                    </span>
                    {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {open && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {g.items.map((it) => (
                        <div key={it.id} className="flex items-center gap-3 p-3">
                          {it.image ? (
                            <img src={it.image} alt={it.name} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 font-bold flex items-center justify-center shrink-0">{it.name.charAt(0)}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {it.name}
                              <span className="ml-1.5 text-[10px] font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{it.type}</span>
                              <span className={cn(
                                'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded',
                                it.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                it.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' :
                                it.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                              )}>
                                {it.status === 'DRAFT' ? 'Pending' : it.status.charAt(0) + it.status.slice(1).toLowerCase()}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">{currency}{Number(it.price).toFixed(2)}{it.reason ? ` · “${it.reason}”` : ''}</p>
                          </div>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={it.priority}
                            title="Priority"
                            onChange={(e) => mutate(() => api.updateUpsell(it.id, { priority: parseInt(e.target.value) || 1 }), 'Priority updated')}
                            className="w-12 px-1 py-1 text-center text-xs font-bold border border-gray-200 rounded-md outline-none shrink-0"
                          />
                          {it.status === 'DRAFT' && (
                            <>
                              <button onClick={() => mutate(() => api.updateUpsell(it.id, { status: 'APPROVED' }), 'Approved')} title="Approve" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg shrink-0">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => mutate(() => api.updateUpsell(it.id, { status: 'REJECTED' }), 'Rejected')} title="Reject" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {it.status !== 'DRAFT' && (
                            <button onClick={() => mutate(() => api.updateUpsell(it.id, { status: it.status === 'APPROVED' ? 'DISABLED' : 'DRAFT' }), 'Updated')} title={it.status === 'APPROVED' ? 'Disable' : 'Back to draft'} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg text-[11px] font-bold shrink-0">
                              {it.status === 'APPROVED' ? 'Disable' : 'Draft'}
                            </button>
                          )}
                          <button onClick={() => { if (confirm(`Remove ${it.name}?`)) mutate(() => api.deleteUpsell(it.id), 'Removed'); }} title="Remove" className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <div className="p-3 bg-gray-50/60">
                        {addFor === g.sourceItemId ? (
                          <div className="flex items-center gap-2">
                            <select value={addItemId} onChange={(e) => setAddItemId(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white outline-none">
                              <option value="">Pick a menu item…</option>
                              {menuItems
                                .filter((m) => String(m.id) !== g.sourceItemId && !g.items.some((i) => i.recommendedItemId === String(m.id)))
                                .map((m) => (<option key={m.id} value={m.id}>{m.name} · {currency}{Number(m.price).toFixed(0)}</option>))}
                            </select>
                            <button onClick={() => handleAddItem(g.sourceItemId)} className="px-3 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg">Add</button>
                            <button onClick={() => { setAddFor(null); setAddItemId(''); }} className="px-3 py-2 text-xs font-bold text-gray-500">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setAddFor(g.sourceItemId)} className="flex items-center text-xs font-bold text-brand-600 hover:underline">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add another menu item
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
