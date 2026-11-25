import React, { useState } from 'react';
import { inspectLegacyBackupRequirements, listRepository, type ListBackup, type LegacyCorrections, type LegacyRequirement } from '../infrastructure/listRepository';

import { removeLegacyData, clearAppStorage } from '../services/deleteLegacy';

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;
type Preview = { backup: ListBackup; existing: number; incoming: number; conflicts: number; expectedSnapshot: string };
export default function LocalBackup({ flush, onRestored, onCleared }: { flush: () => Promise<void>; onRestored: () => void; onCleared: () => void }) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [lists, setLists] = useState<{id:string; destination:string}[]>([]);
  const [selected, setSelected] = useState('');
  const [legacyFile, setLegacyFile] = useState<unknown>(null);
  const [legacyRequirements, setLegacyRequirements] = useState<LegacyRequirement[]>([]);
  const [corrections, setCorrections] = useState<LegacyCorrections>({});
  const refreshLists = async () => { const values = await listRepository.getAll(); setLists(values.map(v => ({id:v.id,destination:v.trip.destination}))); };
  const openManager = async (open: boolean) => { if (!open) return; try { await flush(); await refreshLists(); } catch { setError('無法讀取清單，請先處理儲存錯誤。'); } }; 
  const download = async () => {
    setBusy(true);
    try {
      await flush();
      const backup = await listRepository.backup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      if (blob.size > MAX_BACKUP_BYTES) { setError('備份超過 50 MB，無法下載可還原的備份；請先移除部分單據影像或資料。'); setMessage(''); return; }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url;
      anchor.download = `travel-packing-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError(''); setMessage(`備份已準備下載，共 ${backup.count} 份清單。`);
    } catch { setError('無法保存或下載備份，請確認儲存及下載權限。'); }
    finally { setBusy(false); }
  };
  const chooseFile = async (file: File | undefined) => {
    setPreview(null); setLegacyFile(null); setLegacyRequirements([]); setCorrections({}); setMessage(''); setError('');
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setError('備份檔超過 50 MB，無法匯入。'); return; }
    setBusy(true);
    try {
      await flush();
      const contents: unknown = JSON.parse(await file.text());
      const missing = inspectLegacyBackupRequirements(contents);
      if (missing.length) { setLegacyFile(contents); setLegacyRequirements(missing); }
      else setPreview(await listRepository.previewImport(contents));
    }
    catch { setError('無法讀取備份：檔案損壞、格式不相容，或本機資料不可用。'); }
    finally { setBusy(false); }
  };
  const previewLegacy = async () => {
    if (!legacyFile) return;
    setBusy(true); setError('');
    try { await flush(); setPreview(await listRepository.previewImport(legacyFile, corrections)); setLegacyFile(null); setLegacyRequirements([]); }
    catch { setError('無法讀取備份：請確認資料格式與地區、方向選擇。'); }
    finally { setBusy(false); }
  };
  const restore = async (mode: 'merge' | 'replace') => {
    if (!preview) return;
    setBusy(true);
    try {
      await flush();
      await listRepository.importBackup(preview.backup, mode, preview.expectedSnapshot);
      setPreview(null); setError(''); setMessage('匯入完成。'); onRestored();
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('本機資料已變更')) { setPreview(null); setError(e.message); }
      else setError('匯入失敗，請保留備份並重試。');
    }
    finally { setBusy(false); }
  };
  const requestPersistence = async () => {
    try {
      if (!navigator.storage?.persist) { setMessage('此瀏覽器不支援申請持續儲存，請定期下載備份。'); return; }
      const granted = await navigator.storage.persist();
      setMessage(granted ? '瀏覽器已核准持續儲存；仍請定期備份。' : '瀏覽器未核准持續儲存，請定期下載備份。');
    } catch { setMessage('無法確認持續儲存狀態，請定期下載備份。'); }
  };
  const remove = async (all: boolean) => {
    if (!all && !selected) { setError('請選擇要刪除的清單。'); return; }
    const label = all ? '所有本機資料（包含清單、舊版副本及偏好設定）' : '選取的本機清單及其舊版副本';
    if (!window.confirm(`確定刪除${label}？此操作無法復原，請先下載備份。`)) return;
    setBusy(true); setError('');
    try {
      await flush();
      if (all) await listRepository.write([], true); else await listRepository.remove(selected);
      let legacyRemoved = true;
      try { removeLegacyData(localStorage, all ? undefined : selected); if (all) { clearAppStorage(localStorage); clearAppStorage(sessionStorage); } }
      catch { legacyRemoved = false; setError('新版資料已刪除，但舊版資料未完全清除；請保留備份並檢查瀏覽器儲存空間。'); }
      setSelected(''); setPreview(null); setMessage(legacyRemoved ? '清單與對應舊版副本已刪除；已下載的備份檔不受影響。' : '新版資料已刪除，舊版資料需進一步檢查。');
      if (all) onCleared(); else onRestored();
      await refreshLists();
    } catch { setError('刪除未完成，請保留備份並重試。'); }
    finally { setBusy(false); }
  };
  return <section className="max-w-5xl mx-auto px-4 pt-4 no-print" aria-label="本機資料備份">
    <details onToggle={e => void openManager((e.currentTarget as HTMLDetailsElement).open)}><summary className="cursor-pointer text-sm font-bold">本機資料備份與還原</summary>
      <p className="mt-1 text-xs text-slate-600">備份包含私人行程且未加密，請妥善保管。未確認的草稿也會納入備份，但不會自動用於檢查。不同瀏覽器或網址的資料不會自動同步。</p>
      <div className="flex flex-wrap gap-3 mt-2"><button type="button" disabled={busy} onClick={download} className="rounded-lg border bg-white px-3 py-2 text-sm">下載備份</button><button type="button" className="rounded-lg border bg-white px-3 py-2 text-sm" onClick={() => void requestPersistence()}>申請持續儲存</button>
        <label className="rounded-lg border bg-white px-3 py-2 text-sm">選擇備份檔<input type="file" accept="application/json,.json" disabled={busy} onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ''; }} /></label></div>
      {legacyRequirements.length > 0 && <div className="border rounded p-3 mt-3 text-sm"><p>舊備份中的部分清單缺少行李規則參考地區或方向，請逐筆確認後預覽；原備份檔不會改變。</p>{legacyRequirements.map(req => <fieldset key={req.id} className="border rounded p-3 mt-2"><legend>{req.destination || '未命名清單'}（{req.id}）</legend>
        {req.country && <label className="block mt-2">參考地區 <select value={corrections[req.id]?.country ?? ''} onChange={e => setCorrections(prev => ({ ...prev, [req.id]: { ...prev[req.id], country: e.target.value } }))}><option value="">請選擇</option><option value="JP">日本</option><option value="KR">韓國</option><option value="SG">新加坡</option><option value="VN">越南</option><option value="TH">泰國</option></select></label>}
        {req.direction && <label className="block mt-2">參考方向 <select value={corrections[req.id]?.direction ?? ''} onChange={e => setCorrections(prev => ({ ...prev, [req.id]: { ...prev[req.id], direction: e.target.value } }))}><option value="">請選擇</option><option value="OUTBOUND">出境（去程）</option><option value="INBOUND">入境（回程）</option></select></label>}
      </fieldset>)}<button className="border rounded p-2 mt-2" disabled={busy || legacyRequirements.some(req => (req.country && !corrections[req.id]?.country) || (req.direction && !corrections[req.id]?.direction))} onClick={() => void previewLegacy()}>確認並預覽備份</button><button className="border rounded p-2 mt-2 ml-2" disabled={busy} onClick={() => { setLegacyFile(null); setLegacyRequirements([]); }}>取消</button></div>}
      {preview && <div className="border rounded p-3 mt-3 text-sm"><p>目前 {preview.existing} 份；匯入 {preview.incoming} 份；{preview.conflicts} 份識別碼相同。</p><p>合併會以備份覆寫同識別碼清單；取代會刪除目前全部清單後匯入。</p><div className="flex gap-2 mt-2"><button className="border rounded p-2" disabled={busy} onClick={() => void restore('merge')}>確認合併</button><button className="border rounded p-2" disabled={busy} onClick={() => void restore('replace')}>確認取代</button><button className="border rounded p-2" disabled={busy} onClick={() => setPreview(null)}>取消</button></div></div>}
      <div className="border rounded p-3 mt-3 text-sm"><p>刪除會同時處理舊版副本，建議先下載備份；已下載的備份檔不受影響。</p>
        <label>選擇清單 <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">請選擇</option>{lists.map(item=><option key={item.id} value={item.id}>{item.destination || '未命名清單'}</option>)}</select></label>
        <div className="flex gap-2 mt-2"><button className="border rounded p-2" disabled={busy || !selected} onClick={() => void remove(false)}>刪除選取清單</button><button className="border rounded p-2" disabled={busy} onClick={() => void remove(true)}>刪除全部本機資料</button></div></div>
      {message && <p role="status" className="text-sm">{message}</p>}{error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </details>
  </section>;
}
