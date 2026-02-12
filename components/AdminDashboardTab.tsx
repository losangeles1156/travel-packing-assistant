import React, { useEffect, useMemo, useState } from 'react';
import { trackEvent } from '../services/analyticsService';
import { TRIP_TEMPLATES } from '../constants';
import {
  AdminApiError,
  buildAdminHeaders,
  CleanupResponse,
  fetchAdminMetrics,
  fetchRecentEvents,
  MetricsResponse,
  RecentEventsResponse,
  runAdminCleanup,
} from '../services/adminApi';

const formatPercent = (numerator: number, denominator: number) => {
  if (!denominator) return '0%';
  return `${Math.round((numerator / denominator) * 100)}%`;
};

const AdminDashboardTab: React.FC = () => {
  const [days, setDays] = useState(30);
  const [token, setToken] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem('tpa_admin_token') || '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [recentEvents, setRecentEvents] = useState<RecentEventsResponse['events']>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentQuery, setRecentQuery] = useState('');
  const [recentExactName, setRecentExactName] = useState('');
  const [cleanupDays, setCleanupDays] = useState(120);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResponse | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem('tpa_admin_token', token);
  }, [token]);

  const headers = useMemo(() => {
    return buildAdminHeaders(token);
  }, [token]);

  const templateLabelById = useMemo(() => {
    const m = new Map<string, string>();
    TRIP_TEMPLATES.forEach(t => m.set(t.id, t.name));
    return m;
  }, []);

  const scenarioLabelById = useMemo(() => {
    return new Map<string, string>([
      ['cabin_essentials', '登機必需'],
      ['comfort_health', '舒適/健康'],
      ['toiletries', '盥洗用品'],
      ['clothes', '衣物'],
      ['electronics', '3C配件'],
    ]);
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminMetrics(days, headers);
      setMetrics(data);
      trackEvent('admin_metrics_loaded', { days });
    } catch (err) {
      const apiErr = err instanceof AdminApiError ? err : null;
      setError(apiErr ? apiErr.message : '載入失敗');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  const loadRecent = async () => {
    setRecentLoading(true);
    try {
      const name = recentExactName.trim();
      const q = name ? '' : recentQuery.trim();

      const events = await fetchRecentEvents(
        {
          limit: 200,
          name: name || undefined,
          q: q || undefined,
        },
        headers
      );
      setRecentEvents(events);
      trackEvent('admin_recent_events_loaded', {
        limit: 200,
        name: name || null,
        q: name ? null : q || null,
      });
    } catch {
      setRecentEvents([]);
    } finally {
      setRecentLoading(false);
    }
  };

  const downloadRecentJson = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        metricsRange: metrics?.range ?? null,
        filters: {
          name: recentExactName.trim() || null,
          q: recentExactName.trim() ? null : recentQuery.trim() || null,
        },
        events: recentEvents,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tpa_recent_events_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      trackEvent('admin_recent_events_downloaded', { count: recentEvents.length });
    } catch {
      trackEvent('admin_recent_events_download_failed');
    }
  };

  const runCleanup = async () => {
    if (cleanupBusy) return;
    setCleanupBusy(true);
    setCleanupError(null);
    setCleanupResult(null);
    try {
      const data = await runAdminCleanup(cleanupDays, headers);
      setCleanupResult(data);
      trackEvent('admin_cleanup_run', {
        days: cleanupDays,
        eventsDeleted: data.eventsDeleted,
        sessionsDeleted: data.sessionsDeleted,
        usersDeleted: data.usersDeleted,
      });
    } catch (err) {
      const apiErr = err instanceof AdminApiError ? err : null;
      setCleanupError(apiErr ? apiErr.message : '清理失敗');
      trackEvent('admin_cleanup_failed', { status: apiErr?.status ?? null, days: cleanupDays });
    } finally {
      setCleanupBusy(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [days, headers]);

  const totals = useMemo(() => {
    const daily = metrics?.dailyActive || [];
    const events = daily.reduce((sum, d) => sum + (d.events || 0), 0);
    const sessions = daily.reduce((sum, d) => sum + (d.sessions || 0), 0);
    const dauPeak = daily.reduce((m, d) => Math.max(m, d.dau || 0), 0);
    return { events, sessions, dauPeak };
  }, [metrics]);

  const funnel = metrics?.funnel;
  const stepFunnel = metrics?.stepFunnel;
  const riskKpi = metrics?.riskKpi;

  return (
    <div className="max-w-5xl mx-auto pb-24">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-2xl font-black text-slate-900 tracking-tight">監控管理</div>
            <div className="text-sm text-slate-500 mt-1">用戶行為、漏斗、趨勢與高價值事件</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-700 bg-white"
            >
              <option value={7}>近 7 天</option>
              <option value={30}>近 30 天</option>
              <option value={90}>近 90 天</option>
            </select>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Admin Token（可留空）"
              className="border border-slate-200 rounded-xl px-3 py-2 font-mono text-sm text-slate-700 bg-white"
            />
            <button
              onClick={refresh}
              className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-600 transition"
            >
              {loading ? '載入中' : '重新整理'}
            </button>
          </div>
        </div>

        {error && <div className="mt-4 text-sm text-red-600 font-bold">{error}</div>}
        {metrics && (
          <div className="mt-4 text-xs text-slate-400">
            {metrics.range.since} → {metrics.range.until}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="text-xs font-black text-slate-400 uppercase">總事件</div>
          <div className="mt-2 text-3xl font-black text-slate-900">{metrics ? totals.events : '-'}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="text-xs font-black text-slate-400 uppercase">總 Session</div>
          <div className="mt-2 text-3xl font-black text-slate-900">{metrics ? totals.sessions : '-'}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="text-xs font-black text-slate-400 uppercase">DAU 峰值</div>
          <div className="mt-2 text-3xl font-black text-slate-900">{metrics ? totals.dauPeak : '-'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="text-lg font-black text-slate-900">核心漏斗</div>
            {funnel && (
              <div className="text-xs text-slate-400">完成率 {formatPercent(funnel.finalizedSessions, funnel.startedSessions)}</div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">開始旅程（Session）</div>
              <div className="text-2xl font-black text-slate-900">{funnel ? funnel.startedSessions : '-'}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">完成清單（Session）</div>
              <div className="text-2xl font-black text-slate-900">{funnel ? funnel.finalizedSessions : '-'}</div>
              <div className="text-xs text-slate-400 mt-1">{funnel ? formatPercent(funnel.startedToFinalized, funnel.startedSessions) : ''}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">分享（Session）</div>
              <div className="text-2xl font-black text-slate-900">{funnel ? funnel.sharedSessions : '-'}</div>
              <div className="text-xs text-slate-400 mt-1">{funnel ? formatPercent(funnel.finalizedToShared, funnel.finalizedSessions) : ''}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">匯出（Session）</div>
              <div className="text-2xl font-black text-slate-900">{funnel ? funnel.exportedSessions : '-'}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">卡點步驟</div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Step 0</div>
              <div className="text-2xl font-black text-slate-900">{stepFunnel ? stepFunnel.step0Sessions : '-'}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Step 1</div>
              <div className="text-2xl font-black text-slate-900">{stepFunnel ? stepFunnel.step1Sessions : '-'}</div>
              <div className="text-xs text-slate-400 mt-1">{stepFunnel ? formatPercent(stepFunnel.step0To1, stepFunnel.step0Sessions) : ''}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">Step 2</div>
              <div className="text-2xl font-black text-slate-900">{stepFunnel ? stepFunnel.step2Sessions : '-'}</div>
              <div className="text-xs text-slate-400 mt-1">{stepFunnel ? formatPercent(stepFunnel.step1To2, stepFunnel.step1Sessions) : ''}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-lg font-black text-slate-900">風險治理成效</div>
          <div className="text-xs text-slate-500">核心指標：高風險清零率</div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">被阻擋次數</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{riskKpi ? riskKpi.blockedEvents : '-'}</div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">清零事件</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{riskKpi ? riskKpi.clearedEvents : '-'}</div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">受阻 Session</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{riskKpi ? riskKpi.blockedSessions : '-'}</div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">已清零 Session</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{riskKpi ? riskKpi.clearedSessions : '-'}</div>
          </div>
          <div className="border border-slate-200 rounded-xl p-4">
            <div className="text-xs text-slate-500">清零率</div>
            <div className="mt-1 text-2xl font-black text-emerald-700">{riskKpi ? `${riskKpi.clearanceRate}%` : '-'}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-black text-slate-400 mb-2">處置動作分布</div>
            <div className="space-y-2">
              {(riskKpi?.resolvedByAction || []).slice(0, 10).map((r) => (
                <div key={r.action} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                  <div className="font-mono text-sm text-slate-700">{r.action}</div>
                  <div className="text-sm font-black text-slate-900">{r.count}</div>
                </div>
              ))}
              {metrics && (!riskKpi || riskKpi.resolvedByAction.length === 0) && (
                <div className="text-sm text-slate-400">目前沒有資料</div>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-black text-slate-400 mb-2">風險類型分布</div>
            <div className="space-y-2">
              {(riskKpi?.resolvedByType || []).slice(0, 10).map((r) => (
                <div key={r.issueType} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                  <div className="font-mono text-sm text-slate-700">{r.issueType}</div>
                  <div className="text-sm font-black text-slate-900">{r.count}</div>
                </div>
              ))}
              {metrics && (!riskKpi || riskKpi.resolvedByType.length === 0) && (
                <div className="text-sm text-slate-400">目前沒有資料</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">Top 事件</div>
          <div className="mt-4 space-y-2">
            {(metrics?.topEvents || []).slice(0, 15).map((e) => (
              <div key={e.name} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                <div className="font-mono text-sm text-slate-700">{e.name}</div>
                <div className="text-sm font-black text-slate-900">{e.count}</div>
              </div>
            ))}
            {metrics && (metrics.topEvents || []).length === 0 && (
              <div className="text-sm text-slate-400">目前沒有資料</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">熱門目的地</div>
          <div className="mt-4 space-y-2">
            {(metrics?.topDestinations || []).slice(0, 15).map((d) => (
              <div key={d.destination} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                <div className="text-sm font-bold text-slate-700 truncate">{d.destination}</div>
                <div className="text-sm font-black text-slate-900">{d.count}</div>
              </div>
            ))}
            {metrics && (metrics.topDestinations || []).length === 0 && (
              <div className="text-sm text-slate-400">目前沒有資料</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">搜尋詞</div>
          <div className="mt-4 space-y-2">
            {(metrics?.topSearchTerms || []).slice(0, 15).map((q) => (
              <div key={q.query} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                <div className="font-mono text-sm text-slate-700 truncate">{q.query}</div>
                <div className="text-sm font-black text-slate-900">{q.count}</div>
              </div>
            ))}
            {metrics && (metrics.topSearchTerms || []).length === 0 && (
              <div className="text-sm text-slate-400">目前沒有資料</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">無結果搜尋</div>
          <div className="mt-4 space-y-2">
            {(metrics?.noResultSearchTerms || []).slice(0, 15).map((q) => (
              <div key={q.query} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                <div className="font-mono text-sm text-slate-700 truncate">{q.query}</div>
                <div className="text-sm font-black text-slate-900">{q.count}</div>
              </div>
            ))}
            {metrics && (!metrics.noResultSearchTerms || metrics.noResultSearchTerms.length === 0) && (
              <div className="text-sm text-slate-400">目前沒有資料</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">打包頁 搜尋詞</div>
          <div className="text-xs text-slate-500 mt-1">來源：打包頁「搜尋全打包 / 搜尋全取消」</div>
          <div className="mt-4 space-y-2">
            {(metrics?.topPackSearchTerms || []).slice(0, 15).map((q) => (
              <div key={q.query} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                <div className="font-mono text-sm text-slate-700 truncate">{q.query}</div>
                <div className="text-sm font-black text-slate-900">{q.count}</div>
              </div>
            ))}
            {metrics && (!metrics.topPackSearchTerms || metrics.topPackSearchTerms.length === 0) && (
              <div className="text-sm text-slate-400">目前沒有資料</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">情境模板</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">切換「僅顯示模板」</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{metrics?.scenarioUsage ? metrics.scenarioUsage.filterToggledOn : '-'}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">切換「顯示全部」</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{metrics?.scenarioUsage ? metrics.scenarioUsage.filterToggledOff : '-'}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-black text-slate-400 mb-2">被點擊</div>
              <div className="space-y-2">
                {(metrics?.scenarioUsage?.selected || []).slice(0, 10).map((s) => (
                  <div key={`sc-sel-${s.scenarioId}`} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-700 truncate">{scenarioLabelById.get(s.scenarioId) || s.scenarioId}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">{s.scenarioId}</div>
                    </div>
                    <div className="text-sm font-black text-slate-900">{s.count}</div>
                  </div>
                ))}
                {metrics && (!metrics.scenarioUsage || metrics.scenarioUsage.selected.length === 0) && (
                  <div className="text-sm text-slate-400">目前沒有資料</div>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs font-black text-slate-400 mb-2">被批次操作</div>
              <div className="space-y-2">
                {(metrics?.scenarioUsage?.bulkSet || []).slice(0, 10).map((s) => (
                  <div key={`sc-bulk-${s.scenarioId}`} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-700 truncate">{scenarioLabelById.get(s.scenarioId) || s.scenarioId}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">{s.scenarioId}</div>
                    </div>
                    <div className="text-sm font-black text-slate-900">{s.count}</div>
                  </div>
                ))}
                {metrics && (!metrics.scenarioUsage || metrics.scenarioUsage.bulkSet.length === 0) && (
                  <div className="text-sm text-slate-400">目前沒有資料</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
        <div className="text-lg font-black text-slate-900">旅遊模板</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-black text-slate-400 mb-2">被選取</div>
            <div className="space-y-2">
              {(metrics?.templateUsage?.selected || []).slice(0, 12).map((t) => (
                <div key={`tpl-sel-${t.templateId}`} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-700 truncate">{templateLabelById.get(t.templateId) || t.templateId}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">{t.templateId}</div>
                  </div>
                  <div className="text-sm font-black text-slate-900">{t.count}</div>
                </div>
              ))}
              {metrics && (!metrics.templateUsage || metrics.templateUsage.selected.length === 0) && (
                <div className="text-sm text-slate-400">目前沒有資料</div>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs font-black text-slate-400 mb-2">被套用</div>
            <div className="space-y-2">
              {(metrics?.templateUsage?.applied || []).slice(0, 12).map((t) => (
                <div key={`tpl-app-${t.templateId}`} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-700 truncate">{templateLabelById.get(t.templateId) || t.templateId}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">{t.templateId}</div>
                  </div>
                  <div className="text-sm font-black text-slate-900">{t.count}</div>
                </div>
              ))}
              {metrics && (!metrics.templateUsage || metrics.templateUsage.applied.length === 0) && (
                <div className="text-sm text-slate-400">目前沒有資料</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">分享失敗原因</div>
          <div className="mt-4 space-y-2">
            {(metrics?.shareFailures || []).slice(0, 15).map((r) => (
              <div key={r.reason} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-2">
                <div className="font-mono text-sm text-slate-700 truncate">{r.reason}</div>
                <div className="text-sm font-black text-slate-900">{r.count}</div>
              </div>
            ))}
            {metrics && (!metrics.shareFailures || metrics.shareFailures.length === 0) && (
              <div className="text-sm text-slate-400">目前沒有資料</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="text-lg font-black text-slate-900">功能使用量</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">編輯頁 全選</div>
              <div className="text-2xl font-black text-slate-900">{metrics ? metrics.featureUsage.bulkCheckedOn : '-'}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">編輯頁 全不選</div>
              <div className="text-2xl font-black text-slate-900">{metrics ? metrics.featureUsage.bulkCheckedOff : '-'}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">打包頁 全打包</div>
              <div className="text-2xl font-black text-slate-900">{metrics ? metrics.featureUsage.bulkPackedOn : '-'}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">打包頁 全取消</div>
              <div className="text-2xl font-black text-slate-900">{metrics ? metrics.featureUsage.bulkPackedOff : '-'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="text-lg font-black text-slate-900">近期事件</div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={recentQuery}
              onChange={(e) => setRecentQuery(e.target.value)}
              placeholder="事件關鍵字（例如 share / search / step）"
              className="border border-slate-200 rounded-xl px-3 py-2 font-mono text-sm text-slate-700 bg-white"
            />
            <input
              value={recentExactName}
              onChange={(e) => setRecentExactName(e.target.value)}
              placeholder="事件名稱精準比對（例如 list_share_failed）"
              className="border border-slate-200 rounded-xl px-3 py-2 font-mono text-sm text-slate-700 bg-white"
            />
            <button
              onClick={loadRecent}
              className="bg-white text-slate-700 px-4 py-2 rounded-xl font-bold border border-slate-200 hover:border-blue-300 hover:text-blue-700 transition shadow-sm"
            >
              {recentLoading ? '載入中' : '載入'}
            </button>
            <button
              onClick={downloadRecentJson}
              disabled={recentEvents.length === 0}
              className={`px-4 py-2 rounded-xl font-bold border shadow-sm transition ${
                recentEvents.length === 0
                  ? 'bg-slate-50 text-slate-300 border-slate-200'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-700'
              }`}
            >
              下載 JSON
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-auto border border-slate-200 rounded-2xl">
          <table className="min-w-[900px] w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="p-3">時間</th>
                <th className="p-3">事件</th>
                <th className="p-3">Session</th>
                <th className="p-3">Payload</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((e) => (
                <tr key={e.id} className="border-t border-slate-200 align-top">
                  <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{e.createdAt}</td>
                  <td className="p-3 font-mono text-slate-800">{e.name}</td>
                  <td className="p-3 font-mono text-slate-600">{e.sessionId.slice(0, 8)}</td>
                  <td className="p-3 font-mono text-slate-600 break-all">{JSON.stringify(e.payload || {})}</td>
                </tr>
              ))}
              {recentEvents.length === 0 && (
                <tr>
                  <td className="p-6 text-slate-400" colSpan={4}>尚未載入或目前沒有資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mt-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <div className="text-lg font-black text-slate-900">資料清理</div>
            <div className="text-sm text-slate-500 mt-1">刪除超過指定天數的 users / sessions / events</div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              min={7}
              max={3650}
              value={cleanupDays}
              onChange={(e) => setCleanupDays(Number(e.target.value))}
              className="border border-slate-200 rounded-xl px-3 py-2 font-mono text-sm text-slate-700 bg-white w-full sm:w-44"
            />
            <button
              onClick={runCleanup}
              className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 transition"
            >
              {cleanupBusy ? '清理中' : '執行清理'}
            </button>
          </div>
        </div>

        {cleanupError && <div className="mt-4 text-sm text-red-600 font-bold">{cleanupError}</div>}
        {cleanupResult && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">清理門檻</div>
              <div className="mt-1 font-mono text-xs text-slate-600 break-all">{cleanupResult.before}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">刪除事件</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{cleanupResult.eventsDeleted}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">刪除 Session</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{cleanupResult.sessionsDeleted}</div>
            </div>
            <div className="border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">刪除使用者</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{cleanupResult.usersDeleted}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboardTab;
