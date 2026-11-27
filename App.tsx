import React, { useEffect, useState, useRef, useCallback } from 'react';
import GeneratorTab from './components/GeneratorTab';
import CrossBorderTab from './components/CrossBorderTab';
import LocalBackup from './components/LocalBackup';
import UpdateNotice from './components/UpdateNotice';
import ReminderExport from './components/ReminderExport';
import RegulationsTab from './components/RegulationsTab';
import AdminDashboardTab from './components/AdminDashboardTab';
import { trackEvent } from './services/analyticsService';
import { CLOUD_FEATURES_ENABLED } from './services/featureFlags';
import type { Expense, CrossBorderItem, ExchangeRate } from './domain/expenses';
import { takeSharedText, type ReceiptRequest } from './domain/receiptText';
import { parseBookingText } from './domain/bookingText';

enum Tab {
  GENERATOR = 'generator',
  REGULATIONS = 'regulations',
  SHOPPING = 'shopping',
  ADMIN = 'admin',
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.GENERATOR);
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [crossBorderItems, setCrossBorderItems] = useState<CrossBorderItem[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [tripCountry, setTripCountry] = useState<string>('JP');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [storageError, setStorageError] = useState('');
  const [storageRevision, setStorageRevision] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [receiptRequest, setReceiptRequest] = useState<ReceiptRequest | null>(null);
  const [bookingRequest, setBookingRequest] = useState<ReceiptRequest | null>(null);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const registerFlush = useCallback((flush: (() => Promise<void>) | null) => { flushRef.current = flush; }, []);
  const flush = async () => { if (flushRef.current) await flushRef.current(); };


  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const shared = takeSharedText();
    if (!shared) return;
    const request = { id: Date.now(), text: shared };
    let isBooking = false;
    try { isBooking = parseBookingText(shared).length > 0; } catch { /* oversized text falls through to the receipt form, which reports it */ }
    if (isBooking) setBookingRequest(request); else setReceiptRequest(request);
  }, []);

  useEffect(() => {
    trackEvent('app_opened');

    if (typeof window === 'undefined') return;
    if (!CLOUD_FEATURES_ENABLED) return;
    const params = new URLSearchParams(window.location.search);
    const hasAdminParam = params.get('admin') === '1';
    const stored = window.localStorage.getItem('tpa_admin_enabled') === '1';
    const enabled = hasAdminParam || stored;
    setAdminEnabled(enabled);
    if (hasAdminParam) {
      window.localStorage.setItem('tpa_admin_enabled', '1');
      params.delete('admin');
      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, []);

  const handleShoppingChange = useCallback((newExpenses: Expense[], newItems: CrossBorderItem[]) => {
    setExpenses(newExpenses);
    setCrossBorderItems(newItems);
  }, []);

  const handleTabChange = async (tab: Tab) => {
    try { await flush(); } catch { return; }
    setActiveTab(tab);
    trackEvent('tab_opened', { tab });
  };

  return (
    <div className="app-shell min-h-screen flex flex-col font-sans text-slate-900">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center text-xs py-1.5 font-medium no-print">
          <i className="fa-solid fa-wifi mr-1.5"></i>
          離線模式 — 已載入的旅程與清單可在本機使用，官方網站需連線開啟
        </div>
      )}

      {/* Header */}
      <header className="app-header sticky top-0 z-30 no-print">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="app-brand flex items-center gap-3">
            <div className="app-brand-mark"><i className="fa-solid fa-plane-departure" aria-hidden="true"></i></div>
            <div><h1>旅程準備助手</h1><p className="app-build">跨境物品版 1126.3</p></div>
          </div>
          <button type="button" className="app-tools-toggle" aria-expanded={toolsOpen} aria-controls="travel-tools" onClick={() => setToolsOpen(v => !v)}><i className="fa-solid fa-sliders" aria-hidden="true"></i><span>工具</span></button>
        </div>
      </header>

      <UpdateNotice flush={flush} />
      <div id="travel-tools" className="app-tools" hidden={!toolsOpen}>
        <ReminderExport flush={flush} />
        <div className="max-w-5xl mx-auto px-4 pt-4"><button type="button" className="text-sm underline"
          onClick={async () => {
            try { await flush(); } catch { return; }
            window.location.assign('/api/mobile-update.html');
          }}>檢查手機版更新</button></div>
        <LocalBackup flush={flush} onRestored={() => setStorageRevision(n => n + 1)} onCleared={() => { setAdminEnabled(false); setActiveTab(Tab.GENERATOR); setStorageRevision(n => n + 1); }} />
      </div>
      {storageError && <div role="alert" className="mx-auto p-3 text-red-800 bg-red-100">{storageError}</div>}

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <div className="animate-fade-in-up">
            <div hidden={activeTab !== Tab.GENERATOR}><GeneratorTab key={storageRevision} registerFlush={registerFlush} onStorageError={setStorageError} expenses={expenses} crossBorderItems={crossBorderItems} exchangeRates={exchangeRates} onShoppingChange={handleShoppingChange} onRatesChange={setExchangeRates} onCountryChange={setTripCountry} onNavigateToShopping={() => handleTabChange(Tab.SHOPPING)} receiptRequest={receiptRequest} onReceiptRequestHandled={() => setReceiptRequest(null)} bookingRequest={bookingRequest} onBookingRequestHandled={() => setBookingRequest(null)} /></div>
            {activeTab === Tab.SHOPPING && <CrossBorderTab expenses={expenses} items={crossBorderItems} rates={exchangeRates} defaultDestination={tripCountry === 'JP' ? 'TW' : 'unknown'} onChange={setCrossBorderItems} onReceiptCapture={async () => { await handleTabChange(Tab.GENERATOR); setReceiptRequest({ id: Date.now(), text: '' }); }} />}
            {activeTab === Tab.REGULATIONS && <div className="secondary-screen"><RegulationsTab /></div>}
            {activeTab === Tab.ADMIN && adminEnabled && <AdminDashboardTab />}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav aria-label="主要導覽" className="app-nav fixed bottom-0 left-0 right-0 z-40 no-print pb-safe">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <button 
            onClick={() => handleTabChange(Tab.GENERATOR)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.GENERATOR ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`text-xl mb-0.5 ${activeTab === Tab.GENERATOR ? 'transform -translate-y-1 transition-transform' : ''}`}>
                <i className="fa-solid fa-list-check" aria-hidden="true"></i>
            </div>
            <span className="text-[10px] font-bold">我的旅程</span>
          </button>
          
          <button 
            onClick={() => handleTabChange(Tab.REGULATIONS)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.REGULATIONS ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`text-xl mb-0.5 ${activeTab === Tab.REGULATIONS ? 'transform -translate-y-1 transition-transform' : ''}`}>
                <i className="fa-solid fa-scale-balanced" aria-hidden="true"></i>
            </div>
            <span className="text-[10px] font-bold">法規查詢</span>
          </button>
          
          <button
            onClick={() => handleTabChange(Tab.SHOPPING)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.SHOPPING ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
             <div className={`text-xl mb-0.5 ${activeTab === Tab.SHOPPING ? 'transform -translate-y-1 transition-transform' : ''}`}>
                <i className="fa-solid fa-bag-shopping" aria-hidden="true"></i>
            </div>
            <span className="text-[10px] font-bold">旅遊記帳</span>
          </button>

          {adminEnabled && (
            <button 
              onClick={() => handleTabChange(Tab.ADMIN)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.ADMIN ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`text-xl mb-0.5 ${activeTab === Tab.ADMIN ? 'transform -translate-y-1 transition-transform' : ''}`}>
                  <i className="fa-solid fa-chart-line" aria-hidden="true"></i>
              </div>
              <span className="text-[10px] font-bold">管理</span>
            </button>
          )}
        </div>
      </nav>
      <style>{`
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .mask-linear-fade { -webkit-mask-image: linear-gradient(to right, black 90%, transparent 100%); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

export default App;
