import { useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { Armchair, Plus, Users, Clock, Loader2, Trash2, Link as LinkIcon, QrCode, ExternalLink, X, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

interface Table {
  id: number;
  table_no: string;
  seats: number;
  status: 'FREE' | 'OCCUPIED' | 'RESERVED' | 'BILLED';
  current_order_code?: string;
  menu_code?: string;
}

export function TablesView() {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add Table Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableSeats, setNewTableSeats] = useState(4);
  const [isAdding, setIsAdding] = useState(false);

  // QR Modal State
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);

  useEffect(() => {
    fetchTables();
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
      await api.createTable({ table_no: newTableName, seats: newTableSeats });
      toast.success('Table created successfully');
      setNewTableName('');
      setNewTableSeats(4);
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
      // Optimistic update
      setTables(tables.map(t => t.id === id ? { ...t, status: status as any } : t));
      await api.updateTableStatus(id, status, orderCode);
      toast.success('Status updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
      fetchTables(); // Revert on failure
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
      fetchTables(); // Revert on failure
    }
  };

  const getTableMenuUrl = (menuCode?: string) => {
    if (!menuCode) return '';
    return `${window.location.origin}${window.location.pathname}#/menu/${menuCode}`;
  };

  const handleCopyLink = (url: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url);
    } else {
      // Fallback
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
    
    // Set canvas dimensions
    canvas.width = 1024;
    canvas.height = 1024;

    img.onload = () => {
      if (ctx) {
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw SVG image
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
      case 'RESERVED': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'BILLED': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden pb-16 md:pb-0">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center">
          <Armchair className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">Tables & Dining</h1>
            <p className="text-sm text-gray-500">Manage dining areas and table status</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Table
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
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
              const isOccupied = table.status === 'OCCUPIED';
              const menuUrl = getTableMenuUrl(table.menu_code);
              
              return (
                <div 
                  key={table.id}
                  className={cn(
                    "relative bg-white p-5 rounded-2xl border-2 transition-all shadow-sm hover:shadow-md flex flex-col group",
                    getStatusColor(table.status).split(' ')[2] // Extract border color
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      <Armchair className={cn("w-6 h-6 mr-2", getStatusColor(table.status).split(' ')[1])} />
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

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">Status</span>
                      <select
                        value={table.status}
                        onChange={(e) => handleUpdateStatus(table.id, e.target.value, table.current_order_code)}
                        className={cn(
                          "px-2.5 py-1 text-xs font-bold rounded-full outline-none cursor-pointer appearance-none text-center",
                          getStatusColor(table.status)
                        )}
                      >
                        <option value="FREE">FREE</option>
                        <option value="OCCUPIED">OCCUPIED</option>
                        <option value="RESERVED">RESERVED</option>
                        <option value="BILLED">BILLED</option>
                      </select>
                    </div>

                    {isOccupied && table.current_order_code && (
                      <div className="flex justify-between items-center text-sm text-gray-500 border-t border-gray-100 pt-3">
                        <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> Order</span>
                        <span className="font-medium text-gray-900">{table.current_order_code}</span>
                      </div>
                    )}
                  </div>

                  {/* Public Menu Link Actions */}
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
      </div>

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
