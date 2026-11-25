# 靜態部署準備與回滾

狀態：本機準備，未部署。發布前必須先排除 `docs/security-audit.md` 中的依賴弱點與既有 API 風險，完成 `docs/journey-guardian-implementation-plan.md` 的驗收。不得以此文件表示已核准發布。

`npm run build` 產生 `dist/`；`wrangler.jsonc` 將其設定為 Workers 靜態資產來源，不含應用 Worker 程式、資料庫或 API。部署名稱為暫定，實際帳號、網域及當時免費額度需先確認。`public/_headers` 在建置時放入 `dist/`：限定腳本、本機連線及 worker 來源，並設定 frame、MIME 和 referrer 防護；現有程式允許內嵌 style，並非嚴格的零 inline CSP。選配 AI gateway 尚未實作，目前 `connect-src 'self'` 不允許任意第三方端點；如未來接入，須先設計可信目的地、憑證與 CSP，不能直接放寬到全部網域。

本機以瀏覽器攔截文件回應並注入相同 CSP，測試建立清單可用；外域 fetch 遭 CSP 拒絕。這僅是模擬標頭，不是 Cloudflare 實際回應驗證。部署後需核對實際回應標頭、離線與更新流程；切勿上傳專案來源或 .env。既有雲端 API 與資料的存續和權限不會因發佈 `dist/` 自動改變。

回滾前先停止新增寫入，提示使用者匯出資料。靜態網站版本與規則要一起回退；資料庫 schema 為單向升級，舊前端可能會因 VersionError 停止而非安全降版。必須使用相容新版或在明確確認後以備份恢復，並在隔離環境驗證；不能僅回退靜態網站就宣稱資料已回滾。仍須建立實際部署編號、備份路徑、執行者和復原演練紀錄。
