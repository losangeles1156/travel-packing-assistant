import React, { useEffect, useState } from 'react';
import GeneratorTab from './components/GeneratorTab';
import RegulationsTab from './components/RegulationsTab';
import RecommendationsTab from './components/RecommendationsTab';
import AdminDashboardTab from './components/AdminDashboardTab';
import { trackEvent } from './services/analyticsService';

enum Tab {
  GENERATOR = 'generator',
  REGULATIONS = 'regulations',
  RECOMMENDATIONS = 'recommendations',
  ADMIN = 'admin',
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.GENERATOR);
  const [adminEnabled, setAdminEnabled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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
    trackEvent('app_opened');

    if (typeof window === 'undefined') return;
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

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    trackEvent('tab_opened', { tab });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col font-sans text-slate-900">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center text-xs py-1.5 font-medium no-print">
          <i className="fa-solid fa-wifi mr-1.5"></i>
          離線模式 — 清單功能照常使用，分享功能暫時無法使用
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 no-print">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <i className="fa-solid fa-plane-departure text-sm"></i>
            </div>
            <h1 className="font-bold text-xl text-slate-800 tracking-tight">行李清單助手</h1>
          </div>
          
          {/* Desktop Nav - Could be added here if needed, but mobile-first tab bar is at bottom */}
          <div className="text-xs font-bold text-slate-300 hidden sm:block border border-slate-200 px-2 py-1 rounded-md">v1.1.0</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-6">
        <div className="animate-fade-in-up">
            {activeTab === Tab.GENERATOR && <GeneratorTab />}
            {activeTab === Tab.REGULATIONS && <RegulationsTab />}
            {activeTab === Tab.RECOMMENDATIONS && <RecommendationsTab />}
            {activeTab === Tab.ADMIN && adminEnabled && <AdminDashboardTab />}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 shadow-[0_-5px_10px_rgba(0,0,0,0.02)] z-40 no-print pb-safe">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          <button 
            onClick={() => handleTabChange(Tab.GENERATOR)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.GENERATOR ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`text-xl mb-0.5 ${activeTab === Tab.GENERATOR ? 'transform -translate-y-1 transition-transform' : ''}`}>
                <i className="fa-solid fa-list-check"></i>
            </div>
            <span className="text-[10px] font-bold">清單生成</span>
          </button>
          
          <button 
            onClick={() => handleTabChange(Tab.REGULATIONS)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.REGULATIONS ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className={`text-xl mb-0.5 ${activeTab === Tab.REGULATIONS ? 'transform -translate-y-1 transition-transform' : ''}`}>
                <i className="fa-solid fa-scale-balanced"></i>
            </div>
            <span className="text-[10px] font-bold">法規查詢</span>
          </button>
          
          <button 
            onClick={() => handleTabChange(Tab.RECOMMENDATIONS)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.RECOMMENDATIONS ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
             <div className={`text-xl mb-0.5 ${activeTab === Tab.RECOMMENDATIONS ? 'transform -translate-y-1 transition-transform' : ''}`}>
                <i className="fa-solid fa-thumbs-up"></i>
            </div>
            <span className="text-[10px] font-bold">好物推薦</span>
          </button>

          {adminEnabled && (
            <button 
              onClick={() => handleTabChange(Tab.ADMIN)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === Tab.ADMIN ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <div className={`text-xl mb-0.5 ${activeTab === Tab.ADMIN ? 'transform -translate-y-1 transition-transform' : ''}`}>
                  <i className="fa-solid fa-chart-line"></i>
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
