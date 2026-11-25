import React, { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export default function UpdateNotice({ flush }: { flush: () => Promise<void> }) {
  const [error, setError] = useState('');
  const { needRefresh: [needRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  if (!needRefresh && !offlineReady) return null;
  const update = async () => {
    try { await flush(); await updateServiceWorker(true); }
    catch { setError('無法保存目前編輯，請先處理儲存問題再更新。'); }
  };
  return <div className="update-notice no-print" role="status">
    {needRefresh ? <><span>有新版可用。更新前會嘗試保存清單與檢查卡草稿；草稿尚未確認，不會用於檢查。</span> <button className="border rounded p-2" onClick={() => void update()}>保存並更新</button></> : <><span>基本頁面已儲存於此瀏覽器；官方網站仍需網路。</span> <button className="border rounded p-2" onClick={() => setOfflineReady(false)}>知道了</button></>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
