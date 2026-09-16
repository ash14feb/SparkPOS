import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Star, ChevronLeft, ChevronRight, MessageSquareText, X } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { usePosStore } from '../store/usePosStore';
import { timeAgo, formatDate, formatDateTime, dateKeyInTimezone } from '../lib/datetime';

interface ReviewRow {
  id: number;
  orderCode: string;
  tableId?: number | null;
  tableNo?: string | null;
  customerName: string;
  customerPhone: string;
  overallRating: number;
  reviewText: string;
  createdAt: string;
  updatedAt?: string;
}

interface ReviewDetail extends ReviewRow {
  items: { name: string; rating: number }[];
}

function Stars({ value, size = 'w-4 h-4' }: { value: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn(size, s <= value ? 'text-amber-400 fill-amber-400' : 'text-gray-300')} />
      ))}
    </div>
  );
}

export function ReviewsView() {
  const { settings } = usePosStore();
  // Date navigation: day offset from today (0 = today), in business timezone.
  const [dayOffset, setDayOffset] = useState(0);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const day = useMemo(() => dateKeyInTimezone(Date.now() + dayOffset * 86400000, settings), [dayOffset, settings]);
  const dateStr = day;
  const label = useMemo(() => (dayOffset === 0 ? 'Today' : formatDate(dateStr, settings)), [dayOffset, dateStr, settings]);

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const res = await api.getReviews(dateStr);
      setReviews(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await api.getReview(id);
      setDetail(res.data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load review');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + Number(r.overallRating || 0), 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center">
          <Star className="w-8 h-8 text-amber-500 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Customer Reviews</h1>
            <p className="text-sm text-gray-500">
              Ratings from served tables
              {avgRating ? ` · ⭐ ${avgRating} avg (${reviews.length})` : ''}
            </p>
          </div>
        </div>
        {/* Date navigation: arrows for prev/next day */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDayOffset((d) => d - 1)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            title="Previous day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => setDayOffset(0)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-bold transition-colors',
              dayOffset === 0 ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            {label}
          </button>
          <button
            onClick={() => setDayOffset((d) => Math.min(0, d + 1))}
            disabled={dayOffset >= 0}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30"
            title="Next day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
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
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Overall</th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">When</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reviews.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <MessageSquareText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-base font-medium text-gray-900">No reviews {dayOffset === 0 ? 'today' : 'on this day'}</p>
                        <p className="text-sm mt-1">Reviews appear after served customers rate their food.</p>
                      </td>
                    </tr>
                  ) : (
                    reviews.map((r) => (
                      <tr key={r.id} onClick={() => openDetail(r.id)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900 text-sm">{r.orderCode}</div>
                          {r.tableNo ? <div className="text-xs text-gray-500">Table {r.tableNo}</div> : null}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900">{r.customerName || '—'}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-600">{r.customerPhone || '—'}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Stars value={Number(r.overallRating || 0)} />
                            <span className="text-xs font-bold text-gray-700">{Number(r.overallRating || 0)}/5</span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{timeAgo(r.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail popup */}
      {selectedId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="font-bold text-lg text-gray-900">{detail?.orderCode || 'Review'}</h2>
                <p className="text-xs text-gray-500">
                  {detail ? `${detail.customerName || '—'} · ${detail.customerPhone || '—'}` : 'Loading…'}
                  {detail?.tableNo ? ` · Table ${detail.tableNo}` : ''}
                  {detail ? ` · ${timeAgo(detail.createdAt)}` : ''}
                </p>
              </div>
              <button
                onClick={() => { setSelectedId(null); setDetail(null); }}
                className="p-2 -mr-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              {detailLoading || !detail ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                    <span className="text-sm font-bold text-gray-900">Overall Experience</span>
                    <div className="flex items-center gap-2">
                      <Stars value={detail.overallRating} size="w-5 h-5" />
                      <span className="text-sm font-bold text-gray-900">{detail.overallRating}/5</span>
                    </div>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">Dish Ratings</h3>
                  <div className="space-y-2.5 mb-4">
                    {detail.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-700 truncate flex-1">{it.name}</span>
                        <Stars value={it.rating} />
                      </div>
                    ))}
                    {detail.items.length === 0 && (
                      <p className="text-sm text-gray-500">No per-dish ratings given.</p>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wider">Written Review</h3>
                  {detail.reviewText ? (
                    <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-3">“{detail.reviewText}”</p>
                  ) : (
                    <p className="text-sm text-gray-500">No written review.</p>
                  )}
                  <p className="text-xs text-gray-400 mt-3">
                    {formatDateTime(detail.createdAt, settings)}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
