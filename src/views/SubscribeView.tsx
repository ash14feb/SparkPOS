import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { useSubscriptionStore } from '../store/useSubscriptionStore';

// Yearly / 3-year pricing per region — edit here to change prices.
const PRICING = {
  INR: { symbol: '₹', yearly: 799, threeYear: 1999, label: 'INR' },
  USD: { symbol: '$', yearly: 9.99, threeYear: 24.99, label: 'USD' },
} as const;

function detectRegion(): 'INR' | 'USD' {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const locale = Intl.NumberFormat().resolvedOptions().locale || '';
    if (tz === 'Asia/Kolkata' || /-IN\b/i.test(locale) || /^en-IN/i.test(navigator.language)) return 'INR';
  } catch {}
  return 'USD';
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-IN') : n.toFixed(2));

export function SubscribeView() {
  const navigate = useNavigate();
  const { status, subscribe } = useSubscriptionStore();
  const [region] = useState<'INR' | 'USD'>(detectRegion);
  const [plan, setPlan] = useState<'1YR' | '3YR'>('1YR');
  const [busy, setBusy] = useState(false);
  const price = PRICING[region];

  const handleSubscribe = async () => {
    try {
      setBusy(true);
      await subscribe(plan);
      toast.success('Subscription activated — welcome to SPARKPOS Pro!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err?.message || 'Subscription failed');
    } finally {
      setBusy(false);
    }
  };

  const amount = plan === '1YR' ? price.yearly : price.threeYear;
  const perYear = plan === '1YR' ? price.yearly : price.threeYear / 3;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-gradient-to-b from-brand-50 to-gray-50 p-4 sm:p-8 no-chain-scroll">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg mb-3">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-gray-900">Upgrade to SPARKPOS Pro</h1>
          <p className="text-gray-500 mt-2 text-sm sm:text-base">
            {status?.expired
              ? 'Your free trial has ended. Subscribe to keep billing without interruption.'
              : 'Unlock the full power of your point of sale — billing, KDS, reports and more.'}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {(
            [
              { id: '1YR', title: '1 Year', value: price.yearly, save: null },
              { id: '3YR', title: '3 Years', value: price.threeYear, save: 'Best value' },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPlan(p.id)}
              className={cn(
                'relative text-left rounded-2xl border-2 p-4 transition-all',
                plan === p.id
                  ? 'border-brand-600 bg-white shadow-lg shadow-brand-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {p.save && (
                <span className="absolute -top-2.5 left-4 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-brand-600 text-white rounded-full">
                  {p.save}
                </span>
              )}
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">{p.title}</span>
                <span className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center', plan === p.id ? 'border-brand-600' : 'border-gray-300')}>
                  {plan === p.id && <span className="w-2.5 h-2.5 rounded-full bg-brand-600" />}
                </span>
              </div>
              <div className="mt-1 font-display text-3xl font-bold text-gray-900">
                {price.symbol}{fmt(p.value)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {price.symbol}{fmt(p.id === '1YR' ? p.value : p.value / 3)} per year · {price.label}
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          {['Unlimited billing & KOT printing', 'Kitchen display (KDS) & table management', 'Reports, expenses & customer reviews', 'Menu, stock & staff management'].map((f) => (
            <div key={f} className="flex items-center py-1.5 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mr-2 shrink-0">
                <Check className="w-3 h-3" />
              </span>
              {f}
            </div>
          ))}
        </div>

        <button
          onClick={handleSubscribe}
          disabled={busy}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-display font-bold text-lg shadow-xl shadow-brand-500/30 hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-60 flex items-center justify-center"
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Sparkles className="w-5 h-5 mr-2" /> Subscribe · {price.symbol}{fmt(amount)} / {plan === '1YR' ? 'year' : '3 years'}</>}
        </button>
        <p className="text-center text-xs text-gray-400 mt-3">
          {price.symbol}{fmt(perYear)} per year · Prices in {region === 'INR' ? 'Indian Rupees (GST invoice available)' : 'US Dollars'} · Renews manually, cancel anytime
        </p>
      </div>
    </div>
  );
}
