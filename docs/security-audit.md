# 依賴及既有 API 盤查

稽核日期 2026-11-07；依使用者本機執行修補後的 `npm audit` JSON：全量 6 項（2 low、4 moderate、0 high、0 critical），`--omit=dev` 0 項。結果僅反映當次鎖定依賴與 npm advisory，不等同整體安全驗收。修補前全量 28 項、production 6 項；下表為修補前歷史基線，不是目前版本。

| 套件 | 已鎖版本 | 嚴重度 | 路徑／待確認 |
| --- | --- | --- | --- |
| proxy-addr | 2.0.7 | critical | express 傳遞相依；受影響版本 <2.0.8。IP 信任判斷，實際風險取決於既有服務配置和暴露情況。 |
| body-parser | 1.20.4 | high | Express 傳遞相依。 |
| path-to-regexp | 0.1.12 | high | Express 傳遞相依。 |
| ws | 8.19.0 | high | Supabase realtime 傳遞相依；瀏覽器 bundle 與既有服務實際使用情況仍需查證。 |
| express | 4.22.1 | moderate | 受 qs 等依賴影響；此 repo 保留既有 API，但靜態版本不預設啟用。 |
| qs | 6.14.1 | moderate | Express 依賴鏈；相關 advisory 有數個不同版本界線。 |

修補後已安裝 Express 4.22.3、proxy-addr 2.0.8、ws 8.22.1，型別檢查及建置通過。剩餘六項來自 vite-plugin-pwa／workbox-build 開發依賴鏈（deepmerge、glob、minimatch 等）；npm 的建議涉及變更 PWA 版本，不能未驗證即使用 `--force`，需評估相容性與離線更新回歸。

程式碼修補（尚未部署）：`api/index.js` 的 IP 限流不再直接信任 `x-forwarded-for`，改用連線對端；反向代理後方的多位用戶可能共用同一限流額度，部署前須依實際拓撲檢核並配置可信代理或平台限流。`server/index.js` 已移除非 production 免密碼本機管理例外，所有環境都須設定並提供 `ADMIN_TOKEN`；本機開發也需設定。已以純函式測試偽造標頭與 token 比對，尚未完成 HTTP 整合及部署環境驗證。**尚未確認既有雲端服務是否部署、可達或可被利用**；既有雲端資源未修改。

既有 API 暴露情況與程式風險未完成查證前不應正式發布。這個預覽不構成資安驗收。
