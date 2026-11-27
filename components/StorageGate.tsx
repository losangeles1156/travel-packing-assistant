import React, { useEffect, useState } from 'react';
import { inspectLegacyRequirements, listRepository, type LegacyCorrections, type LegacyRequirement } from '../infrastructure/listRepository';
import { buildLegacyBackup } from '../services/localBackup';

export default function StorageGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'loading' | 'backup' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const [requirements, setRequirements] = useState<LegacyRequirement[]>([]);
  const [corrections, setCorrections] = useState<LegacyCorrections>({});
  useEffect(() => {
    let cancelled = false;
    let release: (() => void) | undefined;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const held = new Promise<void>(resolve => { release = resolve; });
    const initialize = async () => {
      try {
        if (await listRepository.isMigrated()) { if (!cancelled) setState('ready'); return; }
        const count = buildLegacyBackup(localStorage).count;
        if (count) { const missing = inspectLegacyRequirements(localStorage); if (!cancelled) { setRequirements(missing); setState('backup'); } }
        else { await listRepository.migrateLegacy(localStorage); if (!cancelled) setState('ready'); }
      } catch (e) { if (!cancelled) { setMessage(e instanceof Error && e.name === 'VersionError' ? '資料由較新的版本建立，請使用較新版程式開啟，勿清除資料。此處下載的舊版備份不含新版資料。' : e instanceof Error ? e.message : '無法開啟本機資料'); setState('error'); } }
    };
    if (!navigator.locks) {
      setMessage('此瀏覽器無法保護多分頁同時寫入，請使用支援 Web Locks 的瀏覽器開啟。');
      setState('error');
    } else {
      timeout = setTimeout(() => controller.abort(), 1500);
      void navigator.locks.request('journey-guardian-writer-v1', { signal: controller.signal }, async lock => {
        if (timeout) clearTimeout(timeout);
        if (cancelled || !lock) return;
        await initialize();
        await held;
      }).catch(() => { if (!cancelled) { setMessage('另一個分頁可能正在使用資料，或瀏覽器無法取得保護鎖。請先關閉其他分頁，再重新檢查。'); setState('error'); } });
    }
    return () => { cancelled = true; if (timeout) clearTimeout(timeout); controller.abort(); release?.(); };
  }, []);
  const download = () => {
    try {
      const blob = new Blob([JSON.stringify(buildLegacyBackup(localStorage), null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob); const link = document.createElement('a');
      link.href = url; link.download = 'travel-packing-legacy-backup.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
    } catch { setMessage('備份下載失敗，請檢查瀏覽器權限。'); }
  };
  const migrate = async () => {
    setState('loading');
    try { await listRepository.migrateLegacy(localStorage, corrections); setState('ready'); }
    catch (e) { setMessage(e instanceof Error ? e.message : '資料遷移失敗'); setState('error'); }
  };
  if (state === 'ready') return <>{children}</>;
  return <main className="max-w-xl mx-auto p-6 text-slate-800">
    <h1 className="text-xl font-bold">準備本機資料</h1>
    {state === 'loading' && <p role="status">正在檢查資料，請稍候…</p>}
    {state === 'backup' && <div className="space-y-4 mt-4"><p>發現舊版清單。請先下載備份，再將清單複製到新版儲存空間；舊資料會保留。</p><p>備份未加密，包含私人行程，請妥善保管。</p><button className="border p-2 rounded" onClick={download}>下載舊資料備份</button>
      {requirements.length > 0 && <div><p>部分舊清單沒有記錄參考地區或方向，請逐筆確認後再遷移。選項用於行李規則，不能代替官方查證。</p>{requirements.map(req => <fieldset key={req.id} className="border rounded p-3 mt-3"><legend>{req.destination || '未命名清單'}（{req.id}）</legend>
        {req.country && <label className="block mt-2">參考地區 <select value={corrections[req.id]?.country ?? ''} onChange={e => setCorrections(prev => ({ ...prev, [req.id]: { ...prev[req.id], country: e.target.value } }))}><option value="">請選擇</option><option value="JP">日本</option><option value="KR">韓國</option><option value="SG">新加坡</option><option value="VN">越南</option><option value="TH">泰國</option></select></label>}
        {req.direction && <label className="block mt-2">參考方向 <select value={corrections[req.id]?.direction ?? ''} onChange={e => setCorrections(prev => ({ ...prev, [req.id]: { ...prev[req.id], direction: e.target.value } }))}><option value="">請選擇</option><option value="OUTBOUND">出境（去程）</option><option value="INBOUND">入境（回程）</option></select></label>}
      </fieldset>)}</div>}
      <button className="border p-2 rounded disabled:opacity-50" disabled={!downloaded || requirements.some(req => (req.country && !corrections[req.id]?.country) || (req.direction && !corrections[req.id]?.direction))} onClick={migrate}>我已保存備份，開始遷移</button></div>}
    {state === 'error' && <div role="alert" className="mt-4"><p>目前無法開啟資料，請保留原資料與備份。</p><p>{message}</p><button className="border p-2 rounded mt-3" onClick={download}>下載舊資料備份</button><button className="border p-2 rounded ml-2" onClick={() => location.reload()}>重新檢查</button></div>}
    {state !== 'error' && message && <p role="alert">{message}</p>}
  </main>;
}
