import { useEffect, useState } from 'react';
import { Settings, Save, Store, Receipt, Calculator, Printer, Package, CheckSquare, RefreshCw, ChevronRight, ArrowLeft } from 'lucide-react';
import { usePosStore } from '../store/usePosStore';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

type Tab = 'restaurant' | 'business' | 'tax' | 'receipt' | 'order' | 'inventory' | 'printer';

export function SettingsView() {
  const { settings: initialSettings, fetchBootstrap } = usePosStore();
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [settings, setSettings] = useState(initialSettings || {});
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if initialSettings updates from store
  useEffect(() => {
    if (Object.keys(initialSettings).length > 0) {
      setSettings(initialSettings);
    }
  }, [initialSettings]);

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const response = await api.saveSettings(settings);
      const data = response.data || response;
      toast.success('Settings saved successfully!');
      // Re-fetch bootstrap to ensure global state is aligned
      await fetchBootstrap();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const tabs = [
    { id: 'restaurant', label: 'Store Details', icon: Store, description: 'Manage restaurant name and currency' },
    { id: 'business', label: 'Business Type', icon: Settings, description: 'Configure POS for food or retail' },
    { id: 'tax', label: 'Tax Settings', icon: Calculator, description: 'Set CGST, SGST and tax inclusivity' },
    { id: 'receipt', label: 'Receipt Options', icon: Receipt, description: 'Customize printed receipts' },
    { id: 'order', label: 'Order Flow', icon: CheckSquare, description: 'Manage billing and order behaviors' },
    { id: 'inventory', label: 'Inventory', icon: Package, description: 'Configure stock and barcode features' },
    { id: 'printer', label: 'Printer Settings', icon: Printer, description: 'Web Bluetooth or USB printing' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
      <div className="bg-white p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center">
          {activeTab ? (
            <button 
              onClick={() => setActiveTab(null)}
              className="mr-3 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-700" />
            </button>
          ) : (
            <Settings className="w-8 h-8 text-brand-600 mr-3 hidden sm:block" />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-gray-900 leading-tight">
              {activeTab ? tabs.find(t => t.id === activeTab)?.label : 'Settings'}
            </h1>
            <p className="text-sm text-gray-500">
              {activeTab ? 'Configure specific preferences' : 'Configure your POS preferences'}
            </p>
          </div>
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="flex items-center justify-center px-6 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors shadow-sm disabled:opacity-70"
        >
          {isSaving ? <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
          Save Settings
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
        <div className="max-w-3xl mx-auto">
          {!activeTab ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as Tab)}
                    className="w-full flex items-center p-4 sm:p-5 hover:bg-gray-50 transition-colors text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center mr-4 group-hover:bg-brand-100 transition-colors">
                      <tab.icon className="w-5 h-5 text-brand-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">{tab.label}</h3>
                      <p className="text-sm text-gray-500">{tab.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-500 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 md:p-8 animate-in fade-in slide-in-from-right-4 duration-300">
            
            {activeTab === 'restaurant' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-3 mb-6">Store Details</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Restaurant / Business Name</label>
                  <input
                    type="text"
                    value={settings.restaurantName || ''}
                    onChange={(e) => handleChange('restaurantName', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="e.g. Intelli Billing Software"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency Symbol</label>
                  <input
                    type="text"
                    value={settings.currencySymbol || ''}
                    onChange={(e) => handleChange('currencySymbol', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="e.g. Rs. or $"
                  />
                </div>
              </div>
            )}

            {activeTab === 'business' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-3 mb-6">Business Type</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { id: 'FOOD', label: 'Food & Restaurant', desc: 'Enables Tables and KDS views' },
                    { id: 'RETAIL', label: 'Retail / Non-Food', desc: 'Standard retail checkout' },
                    { id: 'SERVICES', label: 'Services', desc: 'Appointments and hourly' },
                    { id: 'GENERAL', label: 'General / Other', desc: 'Standard POS workflow' }
                  ].map(type => {
                    const selected = settings.businessType === type.id;
                    return (
                    <button
                      key={type.id}
                      onClick={() => handleChange('businessType', type.id)}
                      className={cn(
                        "flex flex-col items-start p-4 border rounded-xl transition-all text-left",
                        selected
                          ? "border-brand-500 bg-brand-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <span className="font-semibold text-gray-900 mb-1">{type.label}</span>
                      <span className="text-sm text-gray-500">{type.desc}</span>
                      {type.id === 'FOOD' && selected && (
                        <span
                          className="mt-3 w-full border-t border-brand-200 pt-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="block text-sm font-semibold text-gray-900 mb-0.5">Dine-In Available?</span>
                          <span className="block text-xs text-gray-500 mb-2">YES shows Dine-In in POS + Tables tab. NO means takeaway only.</span>
                          <span className="flex items-center bg-gray-200 p-1 rounded-lg w-fit" role="group" aria-label="Dine-In available">
                            {(['NO', 'YES'] as const).map(opt => {
                              const on = (settings.dineInEnabled ? 'YES' : 'NO') === opt;
                              return (
                                <span
                                  key={opt}
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => { e.stopPropagation(); handleChange('dineInEnabled', opt === 'YES'); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleChange('dineInEnabled', opt === 'YES'); } }}
                                  className={cn(
                                    'px-5 py-1.5 text-sm font-bold rounded-md transition-all cursor-pointer',
                                    on && opt === 'YES' && 'bg-emerald-600 text-white shadow-sm',
                                    on && opt === 'NO' && 'bg-gray-500 text-white shadow-sm',
                                    !on && 'text-gray-500 hover:text-gray-700'
                                  )}
                                >
                                  {opt}
                                </span>
                              );
                            })}
                          </span>
                        </span>
                      )}
                    </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'tax' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-3 mb-6">Tax Settings</h2>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CGST (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.cgstPercent || 0}
                      onChange={(e) => handleChange('cgstPercent', parseFloat(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SGST (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.sgstPercent || 0}
                      onChange={(e) => handleChange('sgstPercent', parseFloat(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center pt-4">
                  <input
                    type="checkbox"
                    id="taxInclusive"
                    checked={!!settings.taxInclusive}
                    onChange={(e) => handleChange('taxInclusive', e.target.checked)}
                    className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                  />
                  <label htmlFor="taxInclusive" className="ml-3 font-medium text-gray-900">
                    Prices are Tax Inclusive
                    <p className="text-sm font-normal text-gray-500">Back-calculates tax from the displayed price.</p>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'receipt' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-3 mb-6">Receipt Options</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Header</label>
                  <textarea
                    rows={3}
                    value={settings.receiptHeader || ''}
                    onChange={(e) => handleChange('receiptHeader', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="Welcome to our store!"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Receipt Footer</label>
                  <textarea
                    rows={3}
                    value={settings.receiptFooter || ''}
                    onChange={(e) => handleChange('receiptFooter', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="Thank you, visit again!"
                  />
                </div>
                <div className="flex items-center pt-4 border-t">
                  <input
                    type="checkbox"
                    id="enableKot"
                    checked={settings.enableKot !== false} // defaults to true
                    onChange={(e) => handleChange('enableKot', e.target.checked)}
                    className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                  />
                  <label htmlFor="enableKot" className="ml-3 font-medium text-gray-900">
                    Enable KOT (Kitchen Order Ticket)
                    <p className="text-sm font-normal text-gray-500">Shows the KOT button in the POS view.</p>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'order' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-3 mb-6">Order Flow</h2>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="orderAfterBill"
                    checked={!!settings.orderAfterBill}
                    onChange={(e) => handleChange('orderAfterBill', e.target.checked)}
                    className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                  />
                  <label htmlFor="orderAfterBill" className="ml-3 font-medium text-gray-900">
                    Print Bill Before Order
                    <p className="text-sm font-normal text-gray-500">Only accept order after successful receipt print.</p>
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-3 mb-6">Inventory Settings</h2>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableBarcode"
                      checked={!!settings.enableBarcode}
                      onChange={(e) => handleChange('enableBarcode', e.target.checked)}
                      className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                    />
                    <label htmlFor="enableBarcode" className="ml-3 font-medium text-gray-900">
                      Enable Barcode Scanning
                      <p className="text-sm font-normal text-gray-500">Show barcode scanner features in POS.</p>
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableStock"
                      checked={!!settings.enableStock}
                      onChange={(e) => handleChange('enableStock', e.target.checked)}
                      className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                    />
                    <label htmlFor="enableStock" className="ml-3 font-medium text-gray-900">
                      Track Stock Quantities
                      <p className="text-sm font-normal text-gray-500">Show available stock in item grid.</p>
                    </label>
                  </div>
                  <div className="flex items-center border-t pt-4">
                    <input
                      type="checkbox"
                      id="allowSaleWhenOutOfStock"
                      checked={settings.allowSaleWhenOutOfStock !== false} // defaults to true
                      onChange={(e) => handleChange('allowSaleWhenOutOfStock', e.target.checked)}
                      className="w-5 h-5 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                    />
                    <label htmlFor="allowSaleWhenOutOfStock" className="ml-3 font-medium text-gray-900">
                      Allow Sale When Out of Stock
                      <p className="text-sm font-normal text-gray-500">If disabled, 0-stock items are blocked from cart.</p>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'printer' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-3 mb-6">Printer Configuration</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Printer Connection Type</label>
                    <select
                      value={settings.printerConnectionType || 'ebill'}
                      onChange={(e) => handleChange('printerConnectionType', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    >
                      <option value="ebill">E-Bill (no printing)</option>
                      <option value="bluetooth">Web Bluetooth</option>
                      <option value="usb">System Print Dialog (USB)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Paper Width</label>
                    <select
                      value={settings.paperWidth || '2inch'}
                      onChange={(e) => handleChange('paperWidth', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    >
                      <option value="2inch">2 Inch (58mm)</option>
                      <option value="3inch">3 Inch (80mm)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
