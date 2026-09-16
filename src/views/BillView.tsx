import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import toast from 'react-hot-toast';
import { toBlob } from 'html-to-image';
import { decodeBill, mapApiBillToBillData, type BillLinkData } from '../lib/billLink';
import { formatDateTime } from '../lib/datetime';
import { api } from '../lib/api';

// Public page: shows ONLY the bill (no login, no nav).
// - /bill/<orderId>  -> fetches the bill from the backend by order id
// - /bill#<payload>  -> legacy self-contained link, decoded locally
export function BillView() {
  const { hash } = useLocation();
  const { orderId } = useParams();
  const billRef = useRef<HTMLDivElement>(null);
  const [bill, setBill] = useState<BillLinkData | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (orderId) {
        try {
          const res = await api.getPublicBill(orderId);
          const mapped = mapApiBillToBillData(res);
          if (alive) setBill(mapped);
          return;
        } catch {
          // Backend has no bill for this id (or no endpoint) — fall through
          // to hash decode, then invalid state.
        }
      }
      const raw = hash.replace(/^#/, '');
      if (alive) setBill(raw ? await decodeBill(raw) : null);
    })();
    return () => { alive = false; };
  }, [hash, orderId]);

  if (bill === undefined) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center p-6">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow p-8 max-w-sm w-full text-center">
          <p className="font-bold text-gray-900 text-lg mb-1">Bill not found</p>
          <p className="text-sm text-gray-500">Please ask the store to share the bill again.</p>
        </div>
      </div>
    );
  }

  const download = async () => {
    if (!billRef.current) return;
    const t = toast.loading('Preparing bill...');
    try {
      const blob = await toBlob(billRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      toast.dismiss(t);
      if (!blob) return toast.error('Failed to generate bill image');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bill_${bill.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Bill downloaded');
    } catch {
      toast.dismiss(t);
      toast.error('Failed to download bill');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center px-4 py-8">
      <div ref={billRef} className="bg-white p-6 rounded-xl shadow-md border border-gray-200 max-w-sm w-full font-mono text-sm">
        <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-4">
          <h3 className="font-bold text-lg">{bill.s}</h3>
          {bill.h && <p className="text-xs text-gray-500 mt-1">{bill.h}</p>}
          <p className="text-xs text-gray-500 mt-2">Order: {bill.id}</p>
          <p className="text-xs text-gray-500">{formatDateTime(bill.ts)}</p>
        </div>
        <div className="space-y-2 mb-4">
          {bill.items.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>{item.q}x {item.n}</span>
              <span>{(item.p * item.q).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-gray-300 pt-4 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{bill.sub.toFixed(2)}</span>
          </div>
          {bill.disc > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{bill.disc.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base mt-2">
            <span>Total</span>
            <span>{bill.cur}{bill.tot.toFixed(2)}</span>
          </div>
          {bill.pm && <p className="text-xs text-gray-500 pt-1">Paid via {bill.pm}</p>}
          {bill.f && <p className="text-xs text-gray-500 text-center pt-3">{bill.f}</p>}
        </div>
      </div>

      <div className="flex gap-3 mt-6 w-full max-w-sm">
        <button
          onClick={download}
          className="flex-1 py-3.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-colors flex items-center justify-center"
        >
          <Download className="w-5 h-5 mr-2" /> Download Bill
        </button>
        <button
          onClick={() => window.print()}
          className="flex-1 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center"
        >
          <Printer className="w-5 h-5 mr-2" /> Print
        </button>
      </div>
    </div>
  );
}
