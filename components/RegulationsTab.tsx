import React, { useMemo, useState } from 'react';
import { REGULATION_CATEGORIES, REGULATION_RULES } from '../constants';
import { trackEvent } from '../services/analyticsService';

const RegulationsTab: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    trackEvent('regulation_category_toggle', { id });
  };

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return REGULATION_RULES.map(rule => {
      const hits = rule.keywords.filter(keyword => query.includes(keyword.toLowerCase())).length;
      return { rule, hits };
    })
      .filter(result => result.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .map(result => result.rule);
  }, [searchQuery]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    trackEvent('regulation_query', { query: searchQuery });
  };

  return (
    <div className="max-w-2xl mx-auto pb-24">
       <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-slate-800">法規查詢</h2>
            <p className="text-slate-500 mt-2">點擊類別查看詳細規定，或輸入關鍵字快速查詢</p>
       </div>

       <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-2xl shadow-lg mb-8 text-white">
          <label className="block text-sm font-medium mb-2 opacity-90"><i className="fa-solid fa-magnifying-glass mr-2"></i>規則查詢</label>
          <div className="flex gap-2">
            <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="例如：行動電源、剪刀、藥品"
                className="flex-1 p-3 rounded-lg text-slate-900 border-none outline-none focus:ring-2 focus:ring-white/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button 
                onClick={handleSearch}
                className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-lg font-bold transition"
            >
                查詢
            </button>
          </div>
       </div>

       {searchQuery.trim() && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
          <div className="text-sm font-bold text-slate-700 mb-4">查詢結果</div>
          {searchResults.length === 0 ? (
            <div className="text-sm text-slate-400">沒有找到相符的規則，請嘗試其他關鍵字</div>
          ) : (
            <div className="grid gap-4">
              {searchResults.map(rule => (
                <div key={rule.id} className="border border-slate-100 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-800">{rule.name}</div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                      {rule.decision}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 mt-2">{rule.summary}</div>
                  {rule.conditions && rule.conditions.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      {rule.conditions.map(condition => (
                        <div key={condition}>{condition}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
       )}

       <div className="space-y-4">
          {REGULATION_CATEGORIES.map(category => (
            <div key={category.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden transition-all hover:shadow-md">
                <button 
                    onClick={() => toggleExpand(category.id)}
                    className="w-full flex items-center justify-between p-5 text-left"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                            <i className={`fa-solid ${category.icon} text-lg`}></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">{category.name}</h3>
                            <p className="text-sm text-slate-500">{category.description}</p>
                        </div>
                    </div>
                    <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${expandedId === category.id ? 'rotate-180' : ''}`}></i>
                </button>
                
                {expandedId === category.id && (
                    <div className="px-5 pb-5 pt-0">
                        <div className="bg-slate-50 p-4 rounded-lg text-slate-700 text-sm leading-relaxed border border-slate-100">
                            {category.details}
                        </div>
                    </div>
                )}
            </div>
          ))}
       </div>
    </div>
  );
};

export default RegulationsTab;
