import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Armchair, Plus, Users, Clock, Loader2, Trash2, Link as LinkIcon, QrCode, ExternalLink, X, Check, Globe } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface Table {
  id: number;
  table_no: string;
  seats: number;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BILLED' | 'HAVING_FOOD' | 'CUSTOMER_ORDERED';
  current_order_code?: string;
  menu_code?: string;
  floor_section?: string;
  capacity?: number;
}

interface OrderItem {
  name: string;
  price: number;
  qty?: number;
  quantity?: number;
}

interface ActiveOrder {
  orderCode: string;
  items: OrderItem[];
  subtotal: number;
  total: number;
  orderStatus: string;
  customerName?: string;
  customerPhone?: string;
  customer_phone?: string;
  kitchenNotes?: string;
}

export function TablesView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Entry decides the view: bottom-nav "/tables" => Active Tables only;
  // sidebar "/tables?tab=settings" => Table Settings only.
  const activeTab: 'active' | 'settings' = searchParams.get('tab') === 'settings' ? 'settings' : 'active';
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Table Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(4);
  const [newFloorSection, setNewFloorSection] = useState('');
  const [newCapacity, setNewCapacity] = useState(4);
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingOnline, setIsAddingOnline] = useState(false);

  // Shared QR for delivery/online orders (reserved table_no ONLINETABLE).
  const handleCreateOnlineTable = async () => {
    try {
      setIsAddingOnline(true);
      await api.createTable({ table_no: 'ONLINETABLE', seats: 0 });
      toast.success('Online Ordering Table created — share its QR for delivery orders!');
      fetchTables();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create online table');
    } finally {
      setIsAddingOnline(false);
    }
  };

  // QR Modal State
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);

  // Detail Modal State (Active tab)
  const [detailTable, setDetailTable] = useState<Table | null>(null);
  const [detailOrder, setDetailOrder] = useState<ActiveOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [freeHint, setFreeHint] = useState<string | null>(null);
  const [serveProgress, setServeProgress] = useState(0);
  const [isServing, setIsServing] = useState(false);
  const serveDragging = useRef(false);
  const serveTrackRef = useRef<HTMLDivElement>(null);

  const openDetail = async (table: Table) => {
    setDetailTable(table);
    setDetailOrder(null);
    setServeProgress(0);
    setDetailLoading(true);
    try {
      const res = await api.getTableActiveOrder(table.id);
      setDetailOrder(res?.data || null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load order');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleServeFromDetail = async () => {
    const code = detailOrder?.orderCode || detailTable?.current_order_code;
    if (!code || isServing) return;
    try {
      setIsServing(true);
      try { await api.updateDineOrderStatus(code, 'SERVED'); }
      catch { await api.updateOrder(code, { orderStatus: 'SERVED' }); }
      setDetailOrder((prev) => (prev ? { ...prev, orderStatus: 'SERVED' } : prev));
      setTables((prev) => prev.map((t) => (t.id === detailTable?.id ? { ...t, status: 'HAVING_FOOD' as any } : t)));
      toast.success('✓ Order Served');
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark served');
      setServeProgress(0);
    } finally {
      setIsServing(false);
    }
  };

  const detailServed = String(detailOrder?.orderStatus || '').toUpperCase() === 'SERVED';

  // While the detail modal is open, re-fetch the live order so a customer
  // re-order (order flips SERVED -> ACTIVE, table -> CUSTOMER_ORDERED)
  // re-enables swipe-to-serve automatically.
  useEffect(() => {
    if (!detailTable) return;
    const id = setInterval(async () => {
      try {
        const res = await api.getTableActiveOrder(detailTable.id);
        const ord = res?.data || null;
        setDetailOrder(ord);
        if (ord) {
          setDetailTable((prev: any) => {
            if (!prev) return prev;
            const st = String(ord.orderStatus || '').toUpperCase() === 'SERVED' ? 'HAVING_FOOD' : 'CUSTOMER_ORDERED';
            return prev.status === st ? prev : { ...prev, status: st, current_order_code: ord.orderCode || prev.current_order_code };
          });
          if (String(ord.orderStatus || '').toUpperCase() !== 'SERVED') setServeProgress(0);
        } else {
          setDetailTable(null);
        }
        window.dispatchEvent(new Event('sparkpos:tables-changed'));
      } catch { /* silent */ }
    }, 10000);
    return () => clearInterval(id);
  }, [detailTable?.id]);

  useEffect(() => {
    fetchTables();
    // Auto-refresh so a customer re-order (CUSTOMER_ORDERED) and swipe-to-serve
    // state update without manual refresh.
    const id = setInterval(async () => {
      try {
        const res = await api.getTables();
        setTables(res.data || []);
      } catch { /* silent */ }
    }, 10000);
    const onChanged = () => fetchTables();
    window.addEventListener('sparkpos:tables-changed', onChanged);
    return () => {
      clearInterval(id);
      window.removeEventListener('sparkpos:tables-changed', onChanged);
    };
  }, []);

  const fetchTables = async () => {
    try {
      setIsLoading(true);
      const res = await api.getTables();
      setTables(res.data || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch tables');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim()) {
      toast.error('Table name is required');
      return;
    }
    if (newTableSeats < 1) {
      toast.error('Seats must be at least 1');
      return;
    }

    try {
      setIsAdding(true);
      const payload: any = { table_no: newTableName, seats: newTableSeats };
      if (newFloorSection.trim()) payload.floor_section = newFloorSection.trim();
      if (newCapacity && newCapacity > 0) payload.capacity = newCapacity;
      try {
        await api.createTable(payload);
      } catch (err: any) {
        // Ignore backend rejection of extra fields gracefully: retry minimal payload
        const msg = String(err?.message || '');
        if (payload.floor_section !== undefined || payload.capacity !== undefined) {
          try {
            await api.createTable({ table_no: newTableName, seats: newTableSeats });
          } catch (retryErr: any) {
            throw retryErr;
          }
        } else {
          throw new Error(msg || 'Failed to create table');
        }
      }
      toast.success('Table created successfully');
      setNewTableName('');
      setNewTableSeats(4);
      setNewFloorSection('');
      setNewCapacity(4);
      setIsAddModalOpen(false);
      fetchTables();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create table');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string, orderCode?: string) => {
    try {
      setTables(tables.map(t => t.id === id ? { ...t, status: status as any } : t));
      await api.updateTableStatus(id, status, orderCode);
      toast.success('Status updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
      fetchTables();
    }
  };

  const handleDeleteTable = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this table?')) return;
    try {
      setTables(tables.filter(t => t.id !== id));
      await api.deleteTable(id);
      toast.success('Table deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete table');
      fetchTables();
    }
  };

  // App uses BrowserRouter: public menu lives at /menu/:code (no hash, root path).
  const getTableMenuUrl = (menuCode?: string) => {
    if (!menuCode) return '';
    return `${window.location.origin}/menu/${menuCode}`;
  };

  const handleCopyLink = (url: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'absolute';
      textArea.style.left = '-999999px';
      document.body.prepend(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error(error);
      } finally {
        textArea.remove();
      }
    }
    toast.success('Link copied to clipboard');
  };

  const handleDownloadQR = () => {
    if (!qrModalTable) return;
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    canvas.width = 1024;
    canvas.height = 1024;

    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngFile = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.download = `table-${qrModalTable.table_no}-qr.png`;
        downloadLink.href = pngFile;
        downloadLink.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FREE': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'OCCUPIED': return 'bg-red-100 text-red-700 border-red-200';
      case 'HAVING_FOOD': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'CUSTOMER_ORDERED': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'RESERVED': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'BILLED': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const statusLabel = (status: string) => status === 'HAVING_FOOD' ? 'HAVING FOOD' : status === 'CUSTOMER_ORDERED' ? 'CUSTOMER ORDERED' : status;
  const isActiveStatus = (status: string) => status === 'OCCUPIED' || status === 'HAVING_FOOD' || status === 'CUSTOMER_ORDERED';

  const openTableDetail = async (table: Table) => {
    if (!isActiveStatus(table.status)) {
      setFreeHint(`Table ${table.table_no} is free — start an order from POS.`);
      toast('Start order from POS for free tables', { icon: 'ℹ️' });
      return;
    }
    setFreeHint(null);
    await openDetail(table);
  };

  const qtyOf = (it: OrderItem) => it.qty ?? it.quantity ?? 1;

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center">
          <Armchair className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">{activeTab === 'settings' ? 'Table Settings' : 'Tables'}</h1>
            <p className="text-sm text-gray-500">{activeTab === 'settings' ? 'Add, edit and configure tables' : 'Live floor status'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'settings' && (
            <>
              {!tables.some((t: any) => String(t.table_no || '').trim().toUpperCase() === 'ONLINETABLE') && (
                <button
                  onClick={handleCreateOnlineTable}
                  disabled={isAddingOnline}
                  className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
                  title="Creates the shared ONLINETABLE QR for delivery/online orders"
                >
                  {isAddingOnline ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe className="w-4 h-4 mr-2" />} Online Table
                </button>
              )}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Table
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
        {activeTab === 'active' && (
          <>
            {freeHint && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded-lg flex justify-between items-center">
                <span>{freeHint}</span>
                <button onClick={() => setFreeHint(null)} className="ml-2 text-blue-500 hover:text-blue-700"><X className="w-4 h-4" /></button>
              </div>
            )}
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              </div>
            ) : tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Armchair className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-xl font-medium text-gray-900">No tables yet</p>
                <p className="text-sm mt-1">Add tables from Table Settings.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {tables.map(table => {
                  const havingFood = table.status === 'HAVING_FOOD';
                  const customerOrdered = table.status === 'CUSTOMER_ORDERED';
                  const isOccupied = table.status === 'OCCUPIED' || havingFood || customerOrdered;
                  return (
                    <button
                      key={table.id}
                      onClick={() => openTableDetail(table)}
                      className={cn(
                        'relative p-5 rounded-2xl border-2 transition-all shadow-sm hover:shadow-md text-left',
                        customerOrdered
                          ? 'bg-yellow-50 border-yellow-400 hover:border-yellow-500'
                          : havingFood
                          ? 'bg-orange-50 border-orange-400 hover:border-orange-500'
                          : isOccupied
                          ? 'bg-red-50 border-red-300 hover:border-red-400'
                          : 'bg-white border-gray-200 hover:border-emerald-300'
                      )}
                    >
                      <span className={cn(
                        'absolute top-3 right-3 text-[11px] font-bold px-2 py-0.5 rounded-full',
                        customerOrdered ? 'bg-yellow-500 text-white' : havingFood ? 'bg-orange-500 text-white' : isOccupied ? 'bg-red-600 text-white' : 'bg-emerald-100 text-emerald-700'
                      )}>
                        {customerOrdered ? '🟡 Customer Ordered' : havingFood ? '🟠 Having Food' : isOccupied ? '🔴 Occupied' : '🟢 Free'}
                      </span>
                      <Armchair className={cn('w-7 h-7 mb-2', customerOrdered ? 'text-yellow-600' : havingFood ? 'text-orange-500' : isOccupied ? 'text-red-500' : 'text-emerald-500')} />
                      <div className="text-xl font-display font-bold text-gray-900">{table.table_no}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center">
                        <Users className="w-3.5 h-3.5 mr-1" /> {table.seats} seats
                        {table.floor_section ? ` · ${table.floor_section}` : ''}
                      </div>
                      {isOccupied && table.current_order_code && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center">
                          <Clock className="w-3.5 h-3.5 mr-1" /> {table.current_order_code}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'settings' && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Table Settings</h2>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
              </div>
            ) : tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Armchair className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-xl font-medium text-gray-900">No tables yet</p>
                <p className="text-sm mt-1">Add your first table to start managing dining.</p>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="mt-6 flex items-center px-6 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Table
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {tables.map(table => {
                  const menuUrl = getTableMenuUrl(table.menu_code);
                  return (
                    <div
                      key={table.id}
                      className={cn(
                        'relative bg-white p-5 rounded-2xl border-2 transition-all shadow-sm hover:shadow-md flex flex-col group',
                        getStatusColor(table.status).split(' ')[2]
                      )}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center">
                          <Armchair className={cn('w-6 h-6 mr-2', getStatusColor(table.status).split(' ')[1])} />
                          <h3 className="text-2xl font-display font-bold text-gray-900">{table.table_no}</h3>
                        </div>
                        <button
                          onClick={() => handleDeleteTable(table.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete Table"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm">
                          <span className="flex items-center text-gray-500"><Users className="w-4 h-4 mr-1" /> Seats</span>
                          <span className="font-medium text-gray-900">{table.seats}</span>
                        </div>
                        {table.floor_section && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Floor / Section</span>
                            <span className="font-medium text-gray-900">{table.floor_section}</span>
                          </div>
                        )}
                        {(table.capacity ?? null) !== null && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Capacity</span>
                            <span className="font-medium text-gray-900">{table.capacity}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Status</span>
                          <select
                            value={table.status}
                            onChange={(e) => handleUpdateStatus(table.id, e.target.value, table.current_order_code)}
                            className={cn(
                              'px-2.5 py-1 text-xs font-bold rounded-full outline-none cursor-pointer appearance-none text-center',
                              getStatusColor(table.status)
                            )}
                          >
                        <option value="FREE">FREE</option>
                        <option value="OCCUPIED">OCCUPIED</option>
                        <option value="HAVING_FOOD">HAVING FOOD</option>
                        <option value="CUSTOMER_ORDERED">CUSTOMER ORDERED</option>
                        <option value="RESERVED">RESERVED</option>
                        <option value="BILLED">BILLED</option>
                          </select>
                        </div>
                      </div>
                      {table.menu_code && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-500 truncate flex-1 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                              {menuUrl}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleCopyLink(menuUrl)}
                              className="flex-1 flex items-center justify-center py-1.5 px-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-xs font-medium border border-gray-200"
                            >
                              <LinkIcon className="w-3.5 h-3.5 mr-1" /> Copy
                            </button>
                            <button
                              onClick={() => setQrModalTable(table)}
                              className="flex-1 flex items-center justify-center py-1.5 px-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-xs font-medium border border-gray-200"
                            >
                              <QrCode className="w-3.5 h-3.5 mr-1" /> QR
                            </button>
                            <button
                              onClick={() => window.open(menuUrl, '_blank')}
                              className="flex-1 flex items-center justify-center py-1.5 px-2 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors text-xs font-medium border border-gray-200"
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Table Detail Modal (Active tab, occupied tables) */}
      {detailTable && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Table {detailTable.table_no}</h2>
                <p className="text-sm text-gray-500">{detailTable.current_order_code || detailOrder?.orderCode || 'Occupied'}</p>
                {(detailOrder?.customerName || (detailOrder as any)?.customer_phone || detailOrder?.customerPhone) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    👤 {detailOrder.customerName || '—'}
                    {(detailOrder.customerPhone || (detailOrder as any)?.customer_phone) ? ` · 📞 ${detailOrder.customerPhone || (detailOrder as any)?.customer_phone}` : ''}
                  </p>
                )}
              </div>
              <button onClick={() => { setDetailTable(null); setDetailOrder(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {detailLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
              ) : detailOrder ? (
                <div>
                  <div className="space-y-2 max-h-64 overflow-auto">
                    {detailOrder.items.map((it, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700">{it.name} <span className="text-gray-400">x{qtyOf(it)}</span></span>
                        <span className="font-medium text-gray-900">{qtyOf(it)} x ₹{it.price}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 text-sm">
                    <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{detailOrder.subtotal}</span></div>
                    <div className="flex justify-between font-bold text-gray-900"><span>Total</span><span>₹{detailOrder.total}</span></div>
                    <div className="text-xs text-gray-500">Status: {detailOrder.orderStatus}</div>
                    {detailOrder.kitchenNotes ? (
                      <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg p-2.5 text-xs">
                        <span className="font-bold text-orange-700">👨‍🍳 Kitchen Notes: </span>
                        <span className="text-orange-900">{detailOrder.kitchenNotes}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No active order details found.</p>
              )}
              <button
                onClick={() => navigate(`/pos?table=${detailTable.id}`)}
                className="mt-6 w-full flex justify-center items-center px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
              >
                Open in POS
              </button>
              {detailOrder && !detailServed && (
                <div className="mt-3">
                  <div
                    ref={serveTrackRef}
                    className="relative h-12 bg-gray-100 rounded-xl overflow-hidden select-none touch-none border border-gray-200"
                    onPointerMove={(e) => {
                      if (!serveDragging.current || !serveTrackRef.current) return;
                      const rect = serveTrackRef.current.getBoundingClientRect();
                      const pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
                      setServeProgress(pct);
                    }}
                    onPointerUp={() => {
                      serveDragging.current = false;
                      if (serveProgress > 85) handleServeFromDetail();
                      else setServeProgress(0);
                    }}
                    onPointerLeave={() => { if (serveDragging.current) { serveDragging.current = false; setServeProgress(0); } }}
                  >
                    <div className="absolute inset-0 bg-emerald-500 transition-all" style={{ width: `${serveProgress}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-600">
                      {isServing ? 'Serving...' : 'Swipe to Serve →'}
                    </span>
                    <div
                      className="absolute top-1 bottom-1 w-12 bg-white rounded-lg shadow flex items-center justify-center cursor-grab font-bold"
                      style={{ left: `calc(${serveProgress}% - ${serveProgress * 0.48}px + 4px)` }}
                      onPointerDown={(e) => { serveDragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
                    >→</div>
                  </div>
                </div>
              )}
              {detailOrder && detailServed && (
                <div className="mt-3 flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 border border-emerald-200 rounded-xl py-2">
                  <Check className="w-4 h-4" /> ✓ Order Served
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Table Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Add New Table</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTable} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Table Name / Number</label>
                  <input
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="e.g. T1 or Balcony 1"
                    autoFocus
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of Seats</label>
                  <input
                    type="number"
                    min="1"
                    value={newTableSeats}
                    onChange={(e) => setNewTableSeats(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Floor / Section</label>
                  <input
                    type="text"
                    value={newFloorSection}
                    onChange={(e) => setNewFloorSection(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="e.g. Ground, Balcony"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 flex justify-center items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium disabled:opacity-70"
                >
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModalTable && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Table {qrModalTable.table_no}</h2>
                <p className="text-sm text-gray-500">Scan to view digital menu</p>
              </div>
              <button onClick={() => setQrModalTable(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6">
                <QRCodeSVG
                  id="qr-code-svg"
                  value={getTableMenuUrl(qrModalTable.menu_code)}
                  size={220}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <button
                onClick={handleDownloadQR}
                className="w-full flex justify-center items-center px-4 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium"
              >
                Download QR Code
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
