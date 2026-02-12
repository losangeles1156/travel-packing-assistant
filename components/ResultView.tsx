
import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { PackingItem, PreFlightTask, LuggageRule, CustomRuleDef, RuleType, WarningSeverity } from '../types';
import { RED_ZONE_WARNINGS } from '../constants';
import { trackEvent } from '../services/analyticsService';
import { copyToClipboard } from '../utils/clipboard';
import { buildCustomRuleById, getResultRuleBadge, isCarryOnRule } from '../utils/packingRules';

interface ResultViewProps {
  items: PackingItem[];
  tripDetails: { destination: string; startDate: string; duration: number };
  onBack: () => void;
  onNewTrip: () => void;
  onShare: () => Promise<{ url: string | null; reason?: string; status?: number }>;
  customRules: CustomRuleDef[];
  tasks: PreFlightTask[];
  setTasks: React.Dispatch<React.SetStateAction<PreFlightTask[]>>;
  packedItemIds: Set<string>;
  setPackedItemIds: React.Dispatch<React.SetStateAction<Set<string>>>;
}

const ResultView: React.FC<ResultViewProps> = ({ 
  items, 
  tripDetails, 
  onBack, 
  onNewTrip,
  onShare,
  customRules,
  tasks,
  setTasks,
  packedItemIds,
  setPackedItemIds
}) => {

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [packSearch, setPackSearch] = useState('');
  const [scenarioId, setScenarioId] = useState('');
  const [scenarioOnly, setScenarioOnly] = useState(false);
  const noResultSearchRef = useRef<string>('');
  const searchTimerRef = useRef<number | null>(null);

  const customRuleById = useMemo(() => buildCustomRuleById(customRules), [customRules]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1500);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!shareUrl) {
        setQrDataUrl(null);
        return;
      }
      try {
        const dataUrl = await QRCode.toDataURL(shareUrl, {
          width: 220,
          margin: 1,
          errorCorrectionLevel: 'M',
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  

  const scenarios = useMemo(
    () =>
      [
        {
          id: 'cabin_essentials',
          name: '登機必需',
          icon: 'fa-plane',
          matcher: (item: PackingItem) => {
            const n = item.name.toLowerCase();
            if (item.rule === LuggageRule.STRICT_CARRY_ON) return true;
            if (n.includes('手機')) return true;
            if (n.includes('行動電源')) return true;
            if (n.includes('耳機')) return true;
            if (n.includes('筆記型電腦') || n.includes('平板')) return true;
            if (n.includes('相機') || n.includes('鏡頭')) return true;
            return false;
          },
        },
        {
          id: 'comfort_health',
          name: '舒適/健康',
          icon: 'fa-heart',
          matcher: (item: PackingItem) => {
            const n = item.name.toLowerCase();
            if (n.includes('面紙') || n.includes('濕紙巾')) return true;
            if (n.includes('口罩')) return true;
            if (n.includes('眼罩') || n.includes('耳塞') || n.includes('頸枕')) return true;
            if (n.includes('常備藥') || n.includes('ok繃') || n.includes('急救')) return true;
            if (n.includes('水瓶') || n.includes('保溫杯')) return true;
            return false;
          },
        },
        {
          id: 'toiletries',
          name: '盥洗用品',
          icon: 'fa-bottle-water',
          matcher: (item: PackingItem) => item.category === '盥洗物品',
        },
        {
          id: 'clothes',
          name: '衣物',
          icon: 'fa-shirt',
          matcher: (item: PackingItem) => item.category === '衣物',
        },
        {
          id: 'electronics',
          name: '3C配件',
          icon: 'fa-plug',
          matcher: (item: PackingItem) => item.category === '3C產品',
        },
      ] as const,
    []
  );

  const activeScenario = useMemo(() => scenarios.find(s => s.id === scenarioId) || null, [scenarios, scenarioId]);

  const scenarioIdSet = useMemo(() => {
    if (!activeScenario) return new Set<string>();
    const ids = new Set<string>();
    items.forEach(item => {
      if (activeScenario.matcher(item)) ids.add(item.id);
    });
    return ids;
  }, [activeScenario, items]);

  const { carryOnItems, checkedItems } = useMemo(() => {
    const carryOnItems: PackingItem[] = [];
    const checkedItems: PackingItem[] = [];
    for (const item of items) {
      if (isCarryOnRule(item.rule, customRuleById)) carryOnItems.push(item);
      else checkedItems.push(item);
    }
    return { carryOnItems, checkedItems };
  }, [items, customRuleById]);

  const scenarioCarryOnItems = scenarioOnly && activeScenario ? carryOnItems.filter(i => scenarioIdSet.has(i.id)) : carryOnItems;
  const scenarioCheckedItems = scenarioOnly && activeScenario ? checkedItems.filter(i => scenarioIdSet.has(i.id)) : checkedItems;

  const packQuery = packSearch.trim().toLowerCase();
  const filteredCarryOnItems = packQuery
    ? scenarioCarryOnItems.filter(i => i.name.toLowerCase().includes(packQuery))
    : scenarioCarryOnItems;
  const filteredCheckedItems = packQuery
    ? scenarioCheckedItems.filter(i => i.name.toLowerCase().includes(packQuery))
    : scenarioCheckedItems;

  const hasPackSearch = Boolean(packSearch.trim());
  const hasScenario = Boolean(activeScenario);
  const hasScenarioOnly = hasScenario && scenarioOnly;
  const hasAnyFilter = hasPackSearch || hasScenario || hasScenarioOnly;

  const showTopBulkActions = Boolean(packSearch.trim() || (scenarioOnly && activeScenario));
  const topBulkPrefix = packSearch.trim() ? '搜尋' : '目前顯示';

  const handleScenarioSelect = (nextId: string) => {
    const next = scenarioId === nextId ? '' : nextId;
    setScenarioId(next);
    setScenarioOnly(Boolean(next));
    if (next) trackEvent('packing_scenario_selected', { scenarioId: next });
    else trackEvent('packing_scenario_cleared', { scenarioId: nextId });
  };

  const handleScenarioToggleOnly = () => {
    setScenarioOnly(prev => {
      const next = !prev;
      trackEvent('packing_scenario_filter_toggled', { scenarioId: scenarioId || null, enabled: next });
      return next;
    });
  };

  const handleScenarioBulkSet = (packed: boolean) => {
    if (!activeScenario) return;
    const target = items.filter(i => scenarioIdSet.has(i.id));
    trackEvent('packing_scenario_bulk_set', {
      scenarioId: activeScenario.id,
      packed,
      count: target.length,
      query: packSearch.trim() || null,
      only: scenarioOnly,
    });
    setPackedItemIds(prev => {
      const next = new Set(prev);
      target.forEach(item => {
        if (packed) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
    setToast(packed ? '已全打包（模板）' : '已全取消（模板）');
  };

  const handleSearchBulkSet = (packed: boolean) => {
    const target = [...filteredCarryOnItems, ...filteredCheckedItems];
    trackEvent('packing_search_bulk_set', {
      packed,
      count: target.length,
      query: packSearch.trim() || null,
      scenarioId: scenarioId || null,
      only: scenarioOnly,
    });
    setPackedItemIds(prev => {
      const next = new Set(prev);
      target.forEach(item => {
        if (packed) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
    setToast(packed ? '已全打包（搜尋結果）' : '已全取消（搜尋結果）');
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);

    searchTimerRef.current = window.setTimeout(() => {
      const q = packSearch.trim();
      if (!q) return;
      if (filteredCarryOnItems.length + filteredCheckedItems.length > 0) return;

      const key = `pack|${q.toLowerCase()}`;
      if (noResultSearchRef.current === key) return;
      noResultSearchRef.current = key;

      trackEvent('search_no_results', {
        area: 'pack',
        query: q,
      });
    }, 600);

    return () => {
      if (searchTimerRef.current) {
        window.clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [filteredCarryOnItems.length, filteredCheckedItems.length, packSearch]);

  const toggleTask = (id: string) => {
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
      const updated = next.find(t => t.id === id);
      trackEvent('preflight_task_toggled', { id, completed: updated?.completed ?? null });
      return next;
    });
  };

  const togglePacked = (id: string) => {
    setPackedItemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleBulkPacked = (section: 'carry_on' | 'checked', sectionItems: PackingItem[], packed: boolean) => {
    trackEvent('packing_bulk_set', {
      packed,
      count: sectionItems.length,
      section,
      query: packSearch.trim() || null,
      scenarioId: scenarioId || null,
      only: scenarioOnly,
    });
    setPackedItemIds(prev => {
      const next = new Set(prev);
      sectionItems.forEach(item => {
        if (packed) next.add(item.id);
        else next.delete(item.id);
      });
      return next;
    });
  };

  const handleClearSection = (section: 'carry_on' | 'checked', sectionItems: PackingItem[]) => {
    if (window.confirm('確定要重置此區塊的打包進度嗎？')) {
      trackEvent('packing_section_reset', {
        count: sectionItems.length,
        section,
        query: packSearch.trim() || null,
        scenarioId: scenarioId || null,
        only: scenarioOnly,
      });
      setPackedItemIds(prev => {
        const newSet = new Set(prev);
        sectionItems.forEach(item => newSet.delete(item.id));
        return newSet;
      });
    }
  };

  const handlePrint = () => {
    trackEvent('list_exported', {
      destination: tripDetails.destination,
      duration: tripDetails.duration,
      carryOnCount: carryOnItems.length,
      checkedCount: checkedItems.length,
    });

    const originalTitle = document.title;
    const safeDestination = tripDetails.destination.replace(/[\\/:*?"<>|]/g, ' ').trim();
    const safeDate = tripDetails.startDate.replace(/[\\/:*?"<>|]/g, ' ').trim();
    const nextTitle = `行李清單_${safeDestination}_${safeDate}`.slice(0, 80);

    const restoreTitle = () => {
      document.title = originalTitle;
    };

    document.title = nextTitle;
    window.addEventListener('afterprint', restoreTitle, { once: true });
    window.scrollTo(0, 0);
    window.print();
  };

  const buildListText = () => {
    const lines: string[] = [];
    lines.push(`行李打包清單`);
    lines.push(`${tripDetails.destination} • ${tripDetails.startDate} • ${tripDetails.duration} 天`);
    lines.push('');

    const renderSection = (title: string, sectionItems: PackingItem[]) => {
      lines.push(title);
      sectionItems.forEach(item => {
        const packed = packedItemIds.has(item.id) ? 'x' : ' ';
        lines.push(`- [${packed}] ${item.name} x${item.quantity}`);
      });
      lines.push('');
    };

    renderSection('手提行李', carryOnItems);
    renderSection('託運行李', checkedItems);

    return lines.join('\n').trim();
  };

  const escapeCsv = (value: unknown) => {
    const s = String(value ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const buildListCsv = () => {
    const rows: Array<Record<string, unknown>> = [];
    const pushRows = (section: string, sectionItems: PackingItem[]) => {
      sectionItems.forEach(item => {
        const custom = customRules.find(r => r.id === item.rule);
        rows.push({
          section,
          item: item.name,
          quantity: item.quantity,
          packed: packedItemIds.has(item.id) ? '1' : '0',
          rule: custom?.name || String(item.rule),
        });
      });
    };

    pushRows('carry_on', carryOnItems);
    pushRows('checked', checkedItems);

    const header = ['section', 'item', 'quantity', 'packed', 'rule'];
    const lines = [header.join(',')];
    rows.forEach(r => {
      lines.push(header.map(k => escapeCsv((r as Record<string, unknown>)[k])).join(','));
    });
    return lines.join('\n');
  };

  const handleCopyList = async () => {
    try {
      await copyToClipboard(buildListText());
      setToast('已複製清單');
      trackEvent('list_text_copied', {
        destination: tripDetails.destination,
        duration: tripDetails.duration,
        carryOnCount: carryOnItems.length,
        checkedCount: checkedItems.length,
      });
    } catch {
      trackEvent('list_text_copy_failed');
    }
  };

  const handleDownloadCsv = () => {
    try {
      const csv = buildListCsv();
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const safeDestination = tripDetails.destination.replace(/[\\/:*?"<>|]/g, ' ').trim();
      const safeDate = tripDetails.startDate.replace(/[\\/:*?"<>|]/g, ' ').trim();
      const a = document.createElement('a');
      a.href = url;
      a.download = `packing_list_${safeDestination}_${safeDate}.csv`.slice(0, 120);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setToast('已下載 CSV');
      trackEvent('list_csv_downloaded', {
        destination: tripDetails.destination,
        duration: tripDetails.duration,
        rows: carryOnItems.length + checkedItems.length,
      });
    } catch {
      trackEvent('list_csv_download_failed');
    }
  };

  const handleShare = async () => {
    if (shareBusy) return;
    setShareBusy(true);
    try {
      const result = await onShare();
      const url = result?.url || null;
      if (!url) {
        trackEvent('list_share_failed', {
          reason: result?.reason || 'unknown',
          status: typeof result?.status === 'number' ? result.status : null,
        });
        alert('目前無法產生分享連結，請稍後再試');
        return;
      }
      setShareUrl(url);
      await copyToClipboard(url);
      trackEvent('list_shared', {
        destination: tripDetails.destination,
        duration: tripDetails.duration,
      });
    } catch {
      trackEvent('list_share_failed', { reason: 'exception' });
      alert('目前無法產生分享連結，請稍後再試');
    } finally {
      setShareBusy(false);
    }
  };

  // Progress Calculations with Stats
  const getProgressStats = (itemList: PackingItem[]) => {
    if (itemList.length === 0) return { count: 0, total: 0, percent: 0 };
    let packedCount = 0;
    for (const item of itemList) {
      if (packedItemIds.has(item.id)) packedCount += 1;
    }
    return {
        count: packedCount,
        total: itemList.length,
        percent: Math.round((packedCount / itemList.length) * 100)
    };
  };

  // Weight Calculation
  const getWeightStats = (itemList: PackingItem[]) => {
    const totalWeight = itemList.reduce((sum, item) => sum + ((item.weight || 0) * item.quantity), 0);
    return Math.round(totalWeight * 10) / 10; // 1 decimal
  };

  const carryOnStats = getProgressStats(carryOnItems);
  const checkedStats = getProgressStats(checkedItems);
  
  const carryOnWeight = getWeightStats(carryOnItems);
  const checkedWeight = getWeightStats(checkedItems);

  // Helper to get rule display info
  const getRuleDisplay = (rule: RuleType) => {
    return getResultRuleBadge(rule, customRuleById);
  };

  // Helper for Severity Styles
  const getSeverityStyle = (severity: WarningSeverity) => {
      switch(severity) {
          case 'Critical': return { 
              bg: 'bg-red-50', 
              border: 'border-red-500', 
              title: 'text-red-800', 
              tag: 'bg-red-600 text-white',
              icon: 'fa-skull-crossbones',
              badge: 'bg-red-100 text-red-700 border-red-200'
          };
          case 'High': return { 
              bg: 'bg-orange-50', 
              border: 'border-orange-400', 
              title: 'text-orange-800', 
              tag: 'bg-orange-500 text-white',
              icon: 'fa-triangle-exclamation',
              badge: 'bg-orange-100 text-orange-700 border-orange-200'
          };
          case 'Medium': return { 
              bg: 'bg-yellow-50', 
              border: 'border-yellow-400', 
              title: 'text-yellow-800', 
              tag: 'bg-yellow-500 text-white',
              icon: 'fa-circle-info',
              badge: 'bg-yellow-100 text-yellow-700 border-yellow-200'
          };
      }
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-20">
      {/* Control Bar - Hidden when printing */}
      <div className="no-print sticky top-4 z-20 bg-white/90 backdrop-blur-md border border-white/20 p-4 mb-6 flex justify-between items-center shadow-lg shadow-slate-200/50 rounded-2xl">
        <div className="flex items-center gap-2">
          <button 
            onClick={onBack}
            className="text-slate-600 hover:text-blue-600 font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
          >
            <i className="fa-solid fa-arrow-left"></i> <span className="hidden sm:inline">修改設定</span>
          </button>
          <button
            onClick={onNewTrip}
            className="text-slate-600 hover:text-blue-600 font-bold flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition"
          >
            <i className="fa-solid fa-plus"></i> <span className="hidden sm:inline">新旅程</span>
          </button>
        </div>
        <div className="flex gap-3 items-center">
            <div className="text-sm text-slate-500 hidden md:block bg-slate-100 px-3 py-1.5 rounded-lg">
                <span className="font-bold text-slate-700">{tripDetails.destination}</span> • {tripDetails.duration} 天
            </div>
            <button
                onClick={handleCopyList}
                className="bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-slate-200 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 active:translate-y-0"
            >
                <i className="fa-solid fa-clipboard"></i> 複製清單
            </button>
            <button
                onClick={handleDownloadCsv}
                className="bg-white text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-slate-200 transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 active:translate-y-0"
            >
                <i className="fa-solid fa-table"></i> 下載 CSV
            </button>
            <button
                onClick={handleShare}
                disabled={shareBusy}
                className={`px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all active:translate-y-0 ${shareBusy ? 'bg-slate-200 text-slate-400 shadow-slate-100 cursor-not-allowed' : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-300 hover:text-blue-700 shadow-slate-200 hover:-translate-y-0.5'}`}
            >
                <i className="fa-solid fa-link"></i> {shareBusy ? '產生中' : '分享'}
            </button>
            <button 
                onClick={handlePrint}
                className="bg-blue-600 text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
                <i className="fa-solid fa-file-pdf"></i> 匯出 PDF
            </button>
        </div>
      </div>

      {toast && (
        <div className="no-print -mt-3 mb-6">
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-slate-200">
            <i className="fa-solid fa-check"></i>
            {toast}
          </div>
        </div>
      )}

      {shareUrl && (
        <div className="no-print -mt-3 mb-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs font-bold text-slate-500 mb-2">分享連結（已複製）</div>
          <div className="flex gap-2">
            <input
              value={shareUrl}
              readOnly
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono text-slate-700"
            />
            <button
              onClick={() => copyToClipboard(shareUrl)}
              className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-600 transition"
            >
              再複製
            </button>
          </div>

          {qrDataUrl && (
            <div className="mt-4 flex items-center gap-4">
              <img
                src={qrDataUrl}
                alt="分享連結 QR Code"
                className="w-[140px] h-[140px] rounded-xl border border-slate-200 bg-white p-2"
              />
              <div className="text-sm text-slate-600">
                <div className="font-bold text-slate-800">掃描開啟</div>
                <div className="text-xs text-slate-500 mt-1">用手機相機掃描即可載入此清單</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="print-only">
        <div className="page-break">
          <div className="border-b border-slate-300 pb-4 mb-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-black text-slate-900 tracking-tight">行李打包清單</div>
                <div className="text-sm text-slate-600 mt-2">
                  <span className="font-bold text-slate-800">{tripDetails.destination}</span>
                  <span className="mx-2 text-slate-300">|</span>
                  {tripDetails.startDate} 出發
                  <span className="mx-2 text-slate-300">|</span>
                  {tripDetails.duration} 天
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-400">估算重量</div>
                <div className="text-sm font-bold text-slate-800">
                  手提 {carryOnWeight > 0 ? `${carryOnWeight}kg` : '-'} / 託運 {checkedWeight > 0 ? `${checkedWeight}kg` : '-'}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <div className="border border-slate-200 rounded-lg p-2">
                <div className="text-slate-500">手提物品</div>
                <div className="text-slate-900 font-black text-lg leading-tight">{carryOnItems.length}</div>
              </div>
              <div className="border border-slate-200 rounded-lg p-2">
                <div className="text-slate-500">託運物品</div>
                <div className="text-slate-900 font-black text-lg leading-tight">{checkedItems.length}</div>
              </div>
              <div className="border border-slate-200 rounded-lg p-2">
                <div className="text-slate-500">已打包</div>
                <div className="text-slate-900 font-black text-lg leading-tight">{packedItemIds.size}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-black text-slate-900 mb-2">手提行李</div>
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="p-2 w-8"> </th>
                    <th className="p-2">物品</th>
                    <th className="p-2 w-12 text-right">數量</th>
                    <th className="p-2 w-16 text-right">重量</th>
                  </tr>
                </thead>
                <tbody>
                  {carryOnItems.map(item => {
                    const isPacked = packedItemIds.has(item.id);
                    return (
                      <tr key={`p-c-${item.id}`} className="border-t border-slate-200 avoid-break">
                        <td className="p-2 text-slate-900">{isPacked ? '☑' : '☐'}</td>
                        <td className="p-2">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {getRuleDisplay(item.rule)?.label ?? ''}
                          </div>
                        </td>
                        <td className="p-2 text-right font-mono text-slate-700">{item.quantity}</td>
                        <td className="p-2 text-right font-mono text-slate-700">{item.weight ? `${item.weight}kg` : ''}</td>
                      </tr>
                    );
                  })}
                  {carryOnItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-400">此區無物品</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <div className="text-sm font-black text-slate-900 mb-2">託運行李</div>
              <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="p-2 w-8"> </th>
                    <th className="p-2">物品</th>
                    <th className="p-2 w-12 text-right">數量</th>
                    <th className="p-2 w-16 text-right">重量</th>
                  </tr>
                </thead>
                <tbody>
                  {checkedItems.map(item => {
                    const isPacked = packedItemIds.has(item.id);
                    return (
                      <tr key={`p-k-${item.id}`} className="border-t border-slate-200 avoid-break">
                        <td className="p-2 text-slate-900">{isPacked ? '☑' : '☐'}</td>
                        <td className="p-2">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {getRuleDisplay(item.rule)?.label ?? ''}
                          </div>
                        </td>
                        <td className="p-2 text-right font-mono text-slate-700">{item.quantity}</td>
                        <td className="p-2 text-right font-mono text-slate-700">{item.weight ? `${item.weight}kg` : ''}</td>
                      </tr>
                    );
                  })}
                  {checkedItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-slate-400">此區無物品</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 text-[10px] text-slate-400 flex justify-between">
            <div>Travel Packing Assistant</div>
            <div>{new Date().toLocaleString('zh-TW')}</div>
          </div>
        </div>

        <div className="page-break">
          <div className="border-b border-slate-300 pb-4 mb-5">
            <div className="text-xl font-black text-slate-900">行前待辦事項</div>
            <div className="text-sm text-slate-600 mt-1">Checklist</div>
          </div>
          <div className="grid gap-2">
            {tasks.map(task => (
              <div key={`p-t-${task.id}`} className="flex items-start gap-3 border border-slate-200 rounded-lg p-3 avoid-break">
                <div className="text-slate-900 mt-0.5">{task.completed ? '☑' : '☐'}</div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900">
                    {task.important && '【重要】'}{task.task}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="border-b border-slate-300 pb-4 mb-5">
            <div className="text-xl font-black text-slate-900">嚴重違禁品警示</div>
            <div className="text-sm text-slate-600 mt-1">違反規定可能導致巨額罰款或刑事責任</div>
          </div>

          <div className="grid gap-4">
            {RED_ZONE_WARNINGS.map(warning => (
              <div key={`p-w-${warning.id}`} className="border-2 border-slate-300 rounded-xl p-4 avoid-break">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-black text-slate-900">{warning.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                      <span className="border border-slate-300 rounded px-2 py-0.5 font-bold">{warning.severity}</span>
                      <span className="border border-slate-300 rounded px-2 py-0.5 font-bold">{warning.tag}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-slate-800 font-bold">{warning.description}</div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="border border-slate-200 rounded-lg p-3">
                    <div className="text-[10px] font-black text-slate-500 uppercase">違規罰則</div>
                    <div className="mt-1 text-sm font-bold text-slate-900">{warning.consequences}</div>
                  </div>
                  <div className="border border-slate-200 rounded-lg p-3">
                    <div className="text-[10px] font-black text-slate-500 uppercase">正確處置</div>
                    <div className="mt-1 text-sm text-slate-800">{warning.handling}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="no-print">

      {/* Page 1: Packing List */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-8 print:shadow-none print:border-none print:p-0 print:mb-0 page-break">
        <div className="border-b border-slate-100 pb-6 mb-8 flex justify-between items-end">
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">行李打包清單</h1>
                <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
                    <i className="fa-solid fa-location-dot text-blue-500"></i> {tripDetails.destination} 
                    <span className="mx-2 text-slate-300">|</span>
                    <i className="fa-regular fa-calendar text-blue-500"></i> {tripDetails.startDate} 出發 
                    <span className="mx-2 text-slate-300">|</span>
                    <i className="fa-regular fa-clock text-blue-500"></i> {tripDetails.duration} 天
                </p>
            </div>
            <div className="text-right hidden sm:block">
                <div className="text-2xl font-black text-slate-200">PACKING LIST</div>
            </div>
        </div>

        <div className="mb-6">
          <div className="flex-1 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input
              type="text"
              placeholder="搜尋打包物品..."
              value={packSearch}
              onChange={(e) => setPackSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-3 border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition bg-white"
            />
            {packSearch.trim() && (
              <button
                onClick={() => setPackSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="清除搜尋"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          {hasAnyFilter && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {hasScenario && activeScenario && (
                <button
                  type="button"
                  onClick={() => handleScenarioSelect(activeScenario.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 transition"
                  aria-label="清除情境模板"
                >
                  <span className="truncate max-w-[220px]">情境：{activeScenario.name}</span>
                  <i className="fa-solid fa-xmark text-[10px]"></i>
                </button>
              )}

              {hasScenarioOnly && (
                <button
                  type="button"
                  onClick={handleScenarioToggleOnly}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 transition"
                  aria-label="切換為顯示全部"
                >
                  <span>僅顯示模板</span>
                  <i className="fa-solid fa-xmark text-[10px]"></i>
                </button>
              )}

              {hasPackSearch && (
                <button
                  type="button"
                  onClick={() => setPackSearch('')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 transition"
                  aria-label="清除搜尋關鍵字"
                >
                  <span className="truncate max-w-[220px]">搜尋：{packSearch.trim()}</span>
                  <i className="fa-solid fa-xmark text-[10px]"></i>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setPackSearch('');
                  setScenarioId('');
                  setScenarioOnly(false);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700 transition"
                aria-label="清除全部篩選"
              >
                清除全部
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <div className="text-xs font-black text-slate-400 whitespace-nowrap">情境模板</div>
              {scenarios.map(s => {
                const active = scenarioId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleScenarioSelect(s.id)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-black border transition ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                    }`}
                  >
                    <i className={`fa-solid ${s.icon} mr-1`}></i>
                    {s.name}
                  </button>
                );
              })}
              {scenarioId && (
                <button
                  onClick={() => handleScenarioSelect(scenarioId)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-black border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700 transition"
                >
                  清除
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {activeScenario && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScenarioBulkSet(true)}
                    className="px-3 py-1.5 rounded-full text-xs font-black bg-blue-600 text-white hover:bg-blue-700 transition"
                  >
                    模板全打包
                  </button>
                  <button
                    onClick={() => handleScenarioBulkSet(false)}
                    className="px-3 py-1.5 rounded-full text-xs font-black bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-700 transition"
                  >
                    模板全取消
                  </button>
                  <button
                    onClick={handleScenarioToggleOnly}
                    className={`px-3 py-1.5 rounded-full text-xs font-black border transition ${
                      scenarioOnly ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    {scenarioOnly ? '僅顯示模板' : '顯示全部'}
                  </button>
                </div>
              )}

                {showTopBulkActions && filteredCarryOnItems.length + filteredCheckedItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSearchBulkSet(true)}
                      className="px-3 py-1.5 rounded-full text-xs font-black bg-slate-900 text-white hover:bg-blue-600 transition"
                    >
                      {topBulkPrefix}全打包
                    </button>
                    <button
                      onClick={() => handleSearchBulkSet(false)}
                      className="px-3 py-1.5 rounded-full text-xs font-black bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-700 transition"
                    >
                      {topBulkPrefix}全取消
                    </button>
                  </div>
                )}

              <div className="text-xs text-slate-400 whitespace-nowrap">
                顯示 {filteredCarryOnItems.length + filteredCheckedItems.length} / {carryOnItems.length + checkedItems.length}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
            {/* Carry On Section */}
            <div className={`p-6 rounded-2xl border transition-colors flex flex-col h-full ${carryOnStats.percent === 100 ? 'bg-green-50/30 border-green-100' : 'bg-blue-50/30 border-blue-100'} print:border-slate-200`}>
                <div className={`mb-6 border-b pb-4 ${carryOnStats.percent === 100 ? 'border-green-200/50' : 'border-blue-200/50'}`}>
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors ${carryOnStats.percent === 100 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                            <i className={`fa-solid ${carryOnStats.percent === 100 ? 'fa-check' : 'fa-suitcase'}`}></i>
                        </span>
                        <div>
                            <h2 className={`font-bold text-xl ${carryOnStats.percent === 100 ? 'text-green-900' : 'text-blue-900'}`}>手提行李</h2>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium uppercase tracking-wider ${carryOnStats.percent === 100 ? 'text-green-400' : 'text-blue-400'}`}>Carry-On</span>
                                {carryOnWeight > 0 && (
                                    <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded text-slate-500 font-bold border border-white/50">
                                        Est. {carryOnWeight} kg
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="ml-auto text-right">
                             <div className="flex flex-col items-end">
                                <span className={`text-2xl font-black transition-colors ${carryOnStats.percent === 100 ? 'text-green-500' : 'text-blue-200'} print:hidden`}>
                                    {carryOnStats.percent}%
                                </span>
                                <div className="flex items-center gap-2 mt-1 print:hidden">
                                    {filteredCarryOnItems.length > 0 && (
                                      <>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleBulkPacked('carry_on', filteredCarryOnItems, true); }}
                                          className="text-[10px] text-slate-400 hover:text-blue-600 underline decoration-slate-300 hover:decoration-blue-300 transition-all"
                                        >
                                          全打包
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleBulkPacked('carry_on', filteredCarryOnItems, false); }}
                                          className="text-[10px] text-slate-400 hover:text-slate-700 underline decoration-slate-300 transition-all"
                                        >
                                          全取消
                                        </button>
                                      </>
                                    )}
                                    {carryOnStats.count > 0 && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleClearSection('carry_on', carryOnItems); }}
                                        className="text-[10px] text-slate-400 hover:text-red-500 underline decoration-slate-300 hover:decoration-red-300 transition-all"
                                      >
                                        重置
                                      </button>
                                    )}
                                    <span className="text-xs font-bold text-slate-400">
                                        {carryOnStats.count} / {carryOnStats.total}
                                    </span>
                                </div>
                             </div>
                        </div>
                    </div>
                    {/* Progress Bar - Hidden in Print */}
                    <div className="w-full bg-white rounded-full h-2.5 overflow-hidden shadow-inner print:hidden">
                        <div 
                            className={`${carryOnStats.percent === 100 ? 'bg-green-500' : 'bg-blue-500'} h-full rounded-full transition-all duration-500 ease-out`} 
                            style={{ width: `${carryOnStats.percent}%` }}
                        ></div>
                    </div>
                </div>

                <ul className="space-y-3 flex-1">
                    {filteredCarryOnItems.map(item => {
                        const isPacked = packedItemIds.has(item.id);
                        const ruleInfo = getRuleDisplay(item.rule);
                        return (
                            <li 
                                key={item.id} 
                                onClick={() => togglePacked(item.id)}
                                className="flex items-start gap-3 group cursor-pointer select-none"
                            >
                                <div className={`w-5 h-5 rounded border-2 mt-1 flex items-center justify-center transition-all duration-200 ${
                                    isPacked 
                                    ? 'bg-blue-500 border-blue-500 text-white' 
                                    : 'bg-white border-blue-200 group-hover:border-blue-400 text-transparent'
                                } print:bg-white print:border-slate-800 print:text-transparent`}>
                                    <i className="fa-solid fa-check text-[10px]"></i>
                                </div>
                                <div className="flex-1">
                                    <span className={`font-bold transition-colors ${isPacked ? 'text-slate-400 line-through decoration-2 decoration-blue-200' : 'text-slate-700 group-hover:text-blue-700'}`}>
                                        {item.name}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {ruleInfo && (
                                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${isPacked ? 'bg-slate-200 text-slate-400' : ruleInfo.style}`}>
                                                {ruleInfo.label}
                                            </span>
                                        )}
                                        {item.weight && (
                                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-sm border ${isPacked ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                {item.weight}kg
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {item.quantity > 1 && (
                                    <span className={`font-mono text-sm ${isPacked ? 'text-slate-300' : 'text-slate-400'}`}>
                                        x{item.quantity}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                    {filteredCarryOnItems.length === 0 && <li className="text-slate-400 italic text-sm py-4 text-center">此區無物品</li>}
                </ul>
            </div>

            {/* Checked Luggage Section */}
            <div className={`p-6 rounded-2xl border transition-colors flex flex-col h-full ${checkedStats.percent === 100 ? 'bg-green-50/30 border-green-100' : 'bg-orange-50/30 border-orange-100'} print:border-slate-200`}>
                <div className={`mb-6 border-b pb-4 ${checkedStats.percent === 100 ? 'border-green-200/50' : 'border-orange-200/50'}`}>
                    <div className="flex items-center gap-3 mb-3">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-colors ${checkedStats.percent === 100 ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                             <i className={`fa-solid ${checkedStats.percent === 100 ? 'fa-check' : 'fa-cart-flatbed-suitcase'}`}></i>
                        </span>
                        <div>
                            <h2 className={`font-bold text-xl ${checkedStats.percent === 100 ? 'text-green-900' : 'text-orange-900'}`}>託運行李</h2>
                            <div className="flex items-center gap-2">
                                <span className={`text-xs font-medium uppercase tracking-wider ${checkedStats.percent === 100 ? 'text-green-400' : 'text-orange-400'}`}>Checked</span>
                                {checkedWeight > 0 && (
                                    <span className="text-[10px] bg-white/60 px-1.5 py-0.5 rounded text-slate-500 font-bold border border-white/50">
                                        Est. {checkedWeight} kg
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="ml-auto text-right">
                             <div className="flex flex-col items-end">
                                <span className={`text-2xl font-black transition-colors ${checkedStats.percent === 100 ? 'text-green-500' : 'text-orange-200'} print:hidden`}>
                                    {checkedStats.percent}%
                                </span>
                                <div className="flex items-center gap-2 mt-1 print:hidden">
                                     {filteredCheckedItems.length > 0 && (
                                      <>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleBulkPacked('checked', filteredCheckedItems, true); }}
                                          className="text-[10px] text-slate-400 hover:text-orange-700 underline decoration-slate-300 hover:decoration-orange-300 transition-all"
                                        >
                                          全打包
                                        </button>
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleBulkPacked('checked', filteredCheckedItems, false); }}
                                          className="text-[10px] text-slate-400 hover:text-slate-700 underline decoration-slate-300 transition-all"
                                        >
                                          全取消
                                        </button>
                                      </>
                                     )}
                                     {checkedStats.count > 0 && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleClearSection('checked', checkedItems); }}
                                        className="text-[10px] text-slate-400 hover:text-red-500 underline decoration-slate-300 hover:decoration-red-300 transition-all"
                                      >
                                        重置
                                      </button>
                                     )}
                                    <span className="text-xs font-bold text-slate-400">
                                        {checkedStats.count} / {checkedStats.total}
                                    </span>
                                </div>
                             </div>
                        </div>
                    </div>
                     {/* Progress Bar - Hidden in Print */}
                     <div className="w-full bg-white rounded-full h-2.5 overflow-hidden shadow-inner print:hidden">
                        <div 
                            className={`${checkedStats.percent === 100 ? 'bg-green-500' : 'bg-orange-500'} h-full rounded-full transition-all duration-500 ease-out`} 
                            style={{ width: `${checkedStats.percent}%` }}
                        ></div>
                    </div>
                </div>

                <ul className="space-y-3 flex-1">
                    {filteredCheckedItems.map(item => {
                        const isPacked = packedItemIds.has(item.id);
                        const ruleInfo = getRuleDisplay(item.rule);
                        return (
                            <li 
                                key={item.id} 
                                onClick={() => togglePacked(item.id)}
                                className="flex items-start gap-3 group cursor-pointer select-none"
                            >
                                <div className={`w-5 h-5 rounded border-2 mt-1 flex items-center justify-center transition-all duration-200 ${
                                    isPacked 
                                    ? 'bg-orange-500 border-orange-500 text-white' 
                                    : 'bg-white border-orange-200 group-hover:border-orange-400 text-transparent'
                                } print:bg-white print:border-slate-800 print:text-transparent`}>
                                    <i className="fa-solid fa-check text-[10px]"></i>
                                </div>
                                <div className="flex-1">
                                    <span className={`font-bold transition-colors ${isPacked ? 'text-slate-400 line-through decoration-2 decoration-orange-200' : 'text-slate-700 group-hover:text-orange-700'}`}>
                                        {item.name}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {ruleInfo && (
                                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${isPacked ? 'bg-slate-200 text-slate-400' : ruleInfo.style}`}>
                                                {ruleInfo.label}
                                            </span>
                                        )}
                                        {item.weight && (
                                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-sm border ${isPacked ? 'bg-slate-100 text-slate-400 border-slate-200' : 'bg-white text-slate-500 border-slate-200'}`}>
                                                {item.weight}kg
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {item.quantity > 1 && (
                                    <span className={`font-mono text-sm ${isPacked ? 'text-slate-300' : 'text-slate-400'}`}>
                                        x{item.quantity}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                    {filteredCheckedItems.length === 0 && <li className="text-slate-400 italic text-sm py-4 text-center">此區無物品</li>}
                </ul>
            </div>
        </div>
      </div>
      
      {/* Page 2: Checklist */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 mb-8 print:shadow-none print:border-none print:p-0 print:mt-8 page-break">
        <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3 border-l-4 border-green-500 pl-4">
            行前待辦事項 Checklist
        </h2>
        <div className="grid gap-3">
            {tasks.map(task => (
                <div 
                    key={task.id} 
                    className={`flex items-center p-4 rounded-xl border transition-all cursor-pointer no-print group ${
                        task.completed 
                            ? 'bg-green-50/50 border-green-100' 
                            : task.important 
                                ? 'bg-red-50/50 border-red-200 hover:bg-red-50'
                                : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'
                    }`}
                    onClick={() => toggleTask(task.id)}
                >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-colors ${
                        task.completed 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : task.important
                                ? 'border-red-400 text-transparent bg-white group-hover:border-red-500'
                                : 'border-slate-300 text-transparent group-hover:border-blue-400'
                    }`}>
                        <i className="fa-solid fa-check text-xs"></i>
                    </div>
                    <div className="flex flex-col">
                        <span className={`${task.completed ? 'text-slate-400 line-through decoration-slate-300' : task.important ? 'text-red-700 font-bold' : 'text-slate-700 font-bold'}`}>
                            {task.task}
                        </span>
                        {task.important && !task.completed && (
                            <span className="text-[10px] text-red-500 font-bold mt-1 uppercase tracking-wider">High Priority</span>
                        )}
                    </div>
                </div>
            ))}
            {/* Print Version */}
            <div className="hidden print:block space-y-4">
                 {tasks.map(task => (
                     <div key={`p-${task.id}`} className="flex items-center border-b border-slate-100 pb-3">
                        <div className={`w-6 h-6 border-2 rounded-md mr-4 ${task.important ? 'border-slate-800' : 'border-slate-400'}`}></div>
                        <span className={`font-medium ${task.important ? 'text-slate-900 font-bold' : 'text-slate-800'}`}>
                            {task.important && '【重要】 '} {task.task}
                        </span>
                     </div>
                 ))}
            </div>
        </div>
      </div>

      {/* Page 3: Red Zone Warnings */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 print:shadow-none print:border-none print:p-0 print:mt-8">
        <div className="flex items-center gap-3 mb-6 border-b-2 border-red-100 pb-4">
             <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 animate-pulse">
                <i className="fa-solid fa-triangle-exclamation text-xl"></i>
             </div>
             <div>
                 <h2 className="text-2xl font-bold text-red-700">嚴重違禁品警示</h2>
                 <p className="text-red-400 text-sm font-medium">違反下列規定可能導致巨額罰款或刑事責任</p>
             </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
            {RED_ZONE_WARNINGS.map(warning => {
                const style = getSeverityStyle(warning.severity);
                return (
                <div key={warning.id} className={`rounded-xl border-2 ${style.bg} ${style.border} flex flex-col shadow-sm break-inside-avoid avoid-break`}>
                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                            <div className="flex items-start gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm ${style.tag}`}>
                                    <i className={`fa-solid ${style.icon}`}></i>
                                </div>
                                <div>
                                    <h3 className={`font-black text-xl text-slate-900`}>{warning.title}</h3>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${style.badge}`}>
                                            Severity: {warning.severity}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${style.tag}`}>
                                            {warning.tag}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-700 font-bold mb-6 text-base leading-relaxed border-b border-black/5 pb-4">
                            {warning.description}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 text-red-500">
                                    <i className="fa-solid fa-gavel text-4xl"></i>
                                </div>
                                <div className="text-xs font-black text-red-600 uppercase mb-2 flex items-center gap-2 relative z-10">
                                    <i className="fa-solid fa-gavel"></i> 違規罰則 (Consequences)
                                </div>
                                <p className="text-sm font-bold text-slate-800 relative z-10">
                                    {warning.consequences}
                                </p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 text-blue-500">
                                    <i className="fa-solid fa-clipboard-check text-4xl"></i>
                                </div>
                                 <div className="text-xs font-black text-blue-600 uppercase mb-2 flex items-center gap-2 relative z-10">
                                    <i className="fa-solid fa-clipboard-check"></i> 正確處置 (Handling)
                                 </div>
                                 <p className="text-sm font-medium text-slate-700 relative z-10">
                                    {warning.handling}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )})}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ResultView;
