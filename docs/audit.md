# WP0 專案盤查

盤查日期：2026-11-07。正式來源 `losangeles1156/travel-packing-assistant`，基準 commit `958dbdc2b259625f34f3f5c1bb8b1d5b6d93a040`。原目錄 clone 的 main 在盤查時乾淨。工作副本為原目錄下 guardian-work，分支 `journey-guardian-implementation`；工作副本 remote 設為正式 GitHub 來源。外部連線 DNS 在受限環境失敗，遠端 HEAD 由 GitHub 連接器確認；工作副本由完整本機 clone 建立。原始專案和本工作副本未發現 AGENTS.md，遵循使用者提供的指示。

## 基線

- Node v22.23.2、npm 10.9.8；`npm ci --offline --ignore-scripts` 根據 lockfile 安裝 466 套件成功；未執行安裝腳本，因此不能據此認定所有原生依賴可運作。
- 原始 `npm run typecheck`、`npm run build` 成功。
- 原始 `npm test` 37 項中 34 通過、3 失敗；API 契約測試建立監聽時遭 `listen EPERM 0.0.0.0` 拒絕，不能判定 API 契約通過或產品有相同錯誤。
- `npm run test:e2e` 開發伺服器在 `127.0.0.1:4173` 遭 `listen EPERM` 拒絕，未執行瀏覽器流程。正式網站及 Android 未驗證。

## 路由與外部資料

- `index.html` 執行時載入 Tailwind CDN、Font Awesome CDN 與 Google Fonts；離線與 CSP 需重構。Vite PWA 預設關閉，現行 autoUpdate 也不符合保存後提示更新的計畫。
- `services/apiBase.ts` 預設產生 `/events`、`/share` 與 `/admin/*`；Vite 僅代理 `/api`，Vercel rewrite 也只包含 `/api/*`。有環境變數時實際行為取決於 base URL；目前沒有部署驗證，不能推定正式站端點可用。
- `services/analyticsService.ts` 傳送事件；`GeneratorTab.tsx` 有分享、`hooks/useCollabSession.ts` 直接讀寫 Supabase `collab_sessions`。這與首版本機優先、不得自動外傳的目標需逐項調整。
- `database/schema.sql` 對 `collab_sessions` 宣告公開 select、insert、update 政策。這是 repository schema 的確認結果，**尚未確認實際雲端是否套用或公開**；不可因本機變更認定雲端已安全，也不刪除既有資源。
- README 指示 `npm run server`／`npm run start`，但 package.json 沒有對應腳本；`server/index.js` 匯入未列相依的 `better-sqlite3`。另有 `api/index.js`；目前部署實際使用路徑尚未確認。
- localStorage 清單最多保留五個的原始寫入會刪除被擠出的資料；原始清單可能在開啟第六份後已經刪除，無法從程式推定能恢復。首次遷移前仍需備份、可重跑遷移及交易驗證。
- Supabase 在缺少環境變數時以空字串初始化；已在後續變更加上無設定的安全降級，尚需瀏覽器驗證。

## 待完成

需可執行本機 HTTP listener 的環境驗證啟動、端到端與離線；確認實際部署和雲端政策；備份、遷移、資料契約及其驗收尚未完成。以上為 WP0 的部分盤查，不能宣稱 WP0 全部通過。

## 2026-11-08 補充盤查

- 透過 GitHub 只讀查詢再次核對：`main` HEAD 仍為 `958dbdc2b259625f34f3f5c1bb8b1d5b6d93a040`，與工作副本的基準一致。現行工作副本存在大量未提交變更，不能把基準 commit 誤稱目前完整成果。
- GitHub 該 commit 有一筆 Vercel 成功狀態；此為歷史部署狀態證據，不代表目前公開網址仍可達、使用哪組 Supabase、或資料存取規則安全。未取得 Vercel、Zeabur、Supabase 的實際設定及資料權限；未變更或刪除任何遠端資源。
- 使用者於 2026-11-08 表示 Zeabur 已停止服務，並決定此專案不使用 Vercel 與 Supabase；此為使用者提供的現況與產品方向，非獨立雲端查核。現行新版以瀏覽器邏輯與 IndexedDB 為核心，不需上述服務；程式庫中仍保留停用的舊程式，並不表示舊雲端資源已刪除或停止公開。
- 使用者曾在自己電腦以正式 PWA 建置和 Playwright 跑完七項案例；結果僅適用當時程式。之後增加行李操作，仍需重跑最新版腳本。
- 原版 `loadListSnapshot` 對缺少 country 或 direction 的舊資料採用預設值。新版現提供逐筆確認參考地區及方向的補正流程，不自行推定，保留原始舊資料；相同補正也適用舊備份匯入。已用合成資料測試，尚未驗證所有歷史格式及真實資料。
