# Badminton Lab V2 進度與驗證

日期：2026-10-03。沿用原專案的 V2 改造，網站已公開部署；正式 A 登入、原有資料讀取與重新整理已通過。正式精確回跳 URL 已保存，Email 送信／確認連結完整流程尚未實測。

- 正式網站：https://jonchang046-ux.github.io/badminton-lab/
- 獨立 repository：https://github.com/jonchang046-ux/badminton-lab

## 範圍核對與資料保留

- 唯一操作專案：`outputs/badminton-lab`；新增獨立本機 Git repository，初始 commit `16494e9` 保存原 MVP。
- 沒有操作家庭補貨助手的程式碼、repository、部署或資料表。
- 原資料來源：`data/badminton.sqlite`，盤點為 3 支球拍、2 筆穿線。
- 已備份 SQLite 與 JSON 至本 task 的 `work/mvp-backup-2026-10-03`；另有不提交的 `private-backups` JSON 可直接匯入。
- V2 預覽使用 4197；曾嘗試的 4186 已被占用，沒有終止或修改該埠的任何既有服務。
- Supabase 依使用者最新指示共用 `life-tools`，只新增 `badminton_*` 物件，SQL 由使用者手動執行。

## 程式已實作

- Email／Password Auth、註冊 Email 確認回跳、登出、session 恢復與 token 更新。
- 前端私人資料全部改走 Supabase；不讀寫 SQLite／JSON／localStorage 作為正式裝備來源。
- localStorage 僅保存 `badminton-lab.auth.v2.*` 登入 session，不與家庭補貨助手共用 session key。
- 原有球拍 CRUD、穿線 CRUD、主橫線各別磅數、錯磅、店家、價格、備註、六項評分與詳細歷史全部延續。
- 六種可搜尋／選擇／直接輸入的歷史選項；型號依品牌篩選；選項由資料庫 trigger 保留。
- 可從 Dashboard、球拍頁、穿線頁快速新增穿線，選擇既有球拍。
- Dashboard 新增總穿線次數、各拍穿線次數、不同線材六項個人平均；未評分不算 0。
- 手動同步、重新整理／回分頁同步與前景 30 秒輪詢；版本衝突不直接覆寫。
- MVP JSON 先驗證與預覽，再由單一 RPC transaction 匯入；不清除原資料、重複備份不重複建立。
- PWA manifest、PNG icons、apple-touch-icon、公開 shell 快取；私人 Supabase 資料不快取。
- GitHub Pages 獨立部署 workflow，僅部署 public/，私有備份與 SQLite 均忽略。

## Database schema 與安全

完整 migration：`supabase/migrations/202610030001_badminton_v2.sql`。

五張表：badminton_profiles、badminton_rackets、badminton_stringing_records、badminton_user_options、badminton_import_runs。

每張表 user_id 直接 FK → auth.users，全部啟用 RLS。authenticated 的 USING / WITH CHECK 都要求 auth.uid()=user_id，anon 與 PUBLIC 無私人表授權；只有 authenticated 可執行個人資料 RPC。

穿線用 (user_id,racket_id) 複合外鍵 → badminton_rackets(user_id,id)，避免跨帳號掛球拍。相關歷史查詢有索引。SQL 不修改現有 life_household_members、life_households、restock_history、restock_items，不變更共用 Auth 設定。

使用者已手動套用，唯讀查詢確認五張表、RLS policies、外鍵與 SECURITY INVOKER 函式均已建立。真實未登入 API、資料庫角色隔離與 A/B 各自登入的 12 項 API 隔離測試已通過，詳見 supabase/VALIDATION.md。

## 已執行驗證

- Node.js 24.19.0：`node --test tests/*.test.mjs` **15/15 通過**。
- 保留 V1 的 HTTP CRUD、重啟持久化、輸入檢查、連動刪除回歸。
- V2 測試：secret key 阻擋、snake/camel 欄位映射、未評分分母、品牌選項隔離、單次 refresh、Auth header、版本衝突、匯入孤兒／重複 UUID／無效評分、失效 session 清理、Email token callback。
- V2 前端／資料層／preview／RLS 測試程式已完成語法檢查。
- 4197 首頁 HTTP 200，標題 Badminton Lab V2｜羽球裝備管理；manifest/icons/assets 及舊 API 不對外提供已檢查。
- 瀏覽器登入／註冊入口切換正常；390×844、320×740 的登入頁未見橫向溢出，可見按鈕至少 44px。瀏覽器沒有 error/warn。
- 手機測試畫面保留在 v2-mobile-preview.jpg。
- Supabase 連線後唯讀確認 life-tools 為 ACTIVE_HEALTHY；家庭補貨四張表仍啟用 RLS，沒有修改。
- public/config.js 已設定 life-tools 的公開 URL／publishable key；真實 Auth settings 請求成功，Email 登入啟用、註冊啟用、Email 確認保留。
- Migration 前的真實 REST 請求曾回報 PGRST205／404；使用者套用後已確認五張表建立，未登入請求改為 HTTP 401／42501，詳細結果見 supabase/VALIDATION.md。
- A／B 由使用者實際登入；A 的新增、編輯、六項心得、主橫磅數、錯磅、店家與價格、重新整理保存、歷史最新標記均通過。
- A 透過 App 匯入原有 3 支球拍、2 筆穿線，再匯入同檔不重複建立；原 SQLite 與備份保留。
- B 實際 GET／PATCH／DELETE A 的 QA 球拍與穿線皆無資料／無異動；profile／選項／匯入紀錄隔離、冒用 user_id 與跨帳號球拍關聯拒絕、五張表 RLS=true 均通過。
- B 停用球拍後首頁使用中為 0，另一分頁亦取得保存狀態；正常刪除穿線後歷史為 0，再刪除球拍成功。
- 經使用者同意清理指定 QA：A／B 測試 UUID 均不存在，9 個測試專屬選項移除；A 保留原有 3／2、B 為 0／0。
- 登入後 320／390px 手機與 1440px 桌面檢查未見橫向溢出。未以此聲稱已實測 iPhone Safari。
- 正式網址由使用者登入 A，Dashboard 正確顯示原有 3 支球拍、2 筆穿線、HP-63 與 25／27 lb；重新整理仍保留登入並取得相同資料。
- 正式 Preview 實際可用寬度 319px，Dashboard／新增穿線表單未見橫向溢出；文字輸入與選單 16px、表單操作按鈕至少 44px。此次 viewport override 未改變 Preview 的實際寬度，不以此新增 1440px 正式站驗證宣稱；先前本機多尺寸驗證仍有效。
- 正式網站新增穿線可選取三支既有球拍，開啟後取消，沒有修改原有裝備或額外留下 QA 資料。

## 雲端與部署狀態

1. life-tools SQL migration 已套用並確認。資料庫角色的 CRUD／版本／匯入／隔離驗證通過，測試異動全部回滾。
2. Project URL／publishable key 已透過 Supabase 連線取得並設定；五張表與未登入 API 拒絕已確認。
3. 真實 Supabase Auth、球拍／穿線 CRUD、Dashboard 與舊資料匯入瀏覽器回歸已通過。
4. 真實 A/B／未登入者 RLS 隔離與五張表 RLS=true 已通過，不將單元測試替身當作 RLS 證據。
5. 待實體 iPhone Safari、加入主畫面及跨實體裝置驗證。
6. 已取得 public／部署授權，建立專屬遠端 repository，完整推送既有 Git 歷史；Pages run 37094344632 attempt 2 成功。正式首頁與 public 資產 HTTP 200，私人路徑與本機 QA 均 404。
7. 正式 A 登入與重新整理取得原有 3／2 已通過。Supabase Redirect URLs 已保存 `https://jonchang046-ux.github.io/badminton-lab/`；共用 Site URL、Email 確認與 SMTP 保留。Email 確認連結完整流程尚未實測。

## 下一步

已可在正式網址使用既有 life-tools 帳號登入並讀取原有資料。建議接著用手機 Safari 開啟相同網址、登入同帳號確認 3／2 資料，再嘗試加入主畫面。實體手機／Safari、送信、跨實體裝置與一般瀏覽器備份下載保留為未驗證項目。

## 目前限制／技術債

- 已修正的 bug：資料層把原生 fetch 當成物件方法呼叫，瀏覽器拒絕執行，誤顯示網路故障。新增回歸測試先重現失敗、修正後通過，並用不存在的帳號實際確認 Auth 回應。密碼／Email 確認錯誤已中文化。

- 已修正的 bug：背景同步曾重繪帳號頁、清除已選匯入檔案；public/app.js 改為保留匯入表單，實際輪詢及手動同步後匯入成功。
- V2 備份匯出在本機及正式網站點擊後沒有 console 錯誤，但 Preview 下載事件逾時，尚未確認下載檔案落地，須在一般瀏覽器補測；不視為已通過，也尚無證據斷定是程式或 Preview 的限制。
- GitHub Actions 使用的部分官方 action 有 Node 20 相容性警告，runner 已改用 Node 24，部署成功；日後可另行升級 action 版本，這次未改 build 流程。
- 純 REST Auth client 沒有依賴 SDK，已處理基本 session/refresh，但 MFA、忘記密碼、社群登入不在本輪。
- snapshot 一次載入所有個人資料；沒有筆數硬上限，但大量資料尚需分頁與效能設計。
- PWA 只提供公開 shell 離線快取，沒有離線私人紀錄或待送佇列。
- 同步為輪詢／重新整理，不是秒級 Realtime。
- 使用時間仍是日曆天數，沒有上場時數、拆線日／斷線日。
- 雲端 V2 JSON 備份尚未提供 V2 還原，只支援 MVP V1 migration/import。
- 舊 server.mjs 保留供資料維護／回歸，不能當成 V2 正式啟動入口；V2 請用 preview.mjs 或 start.cmd。

## 修改檔案與影響

| 檔案 | 修改重點 |
|---|---|
| public/app.js、index.html、styles.css | 保留視覺，新增登入／資料帳號頁、同步、統計、選項與手機觸控改善 |
| public/cloud.js、data.js、config.js | Auth／Supabase REST、資料映射、統計、匯入驗證、公開設定 |
| public/manifest.webmanifest、sw.js、icon* | PWA 與公開 shell 快取 |
| supabase/* | 前綴 schema／RLS／RPC／只讀安全稽核 |
| tools/*、tests/v2.test.mjs | 舊資料匯出、真實 RLS 測試工具、V2 本機回歸、icon 產生 |
| preview.mjs、start.cmd、package.json、.github/workflows/pages.yml | 獨立 4197 預覽與 Pages 部署準備 |
| .gitignore、README.md、README-V1.md、V2_STATUS.md | 私人資料忽略、操作說明、歷史文件保留與測試狀態 |

影響僅限 Badminton Lab 的主要檢視與獨立部署；SQLite 和 V1 repository/server 原碼保留。已公開部署，實際帳號、資料功能與隔離測試通過；正式 A 登入及重新整理讀取已通過，正式精確回跳網址已保存。Email 確認流程尚未實測。

本次交付收尾只修改 README.md、V2_STATUS.md、supabase/VALIDATION.md，更新正式環境驗證與限制；未修改功能程式、樣式、套件或 build 流程，不影響其他頁面的行為。

## 下一版最值得增加的 5 個功能

1. 忘記密碼／重設密碼流程，讓公開網站可自行恢復帳號。
2. 拆線／斷線日期，區分最後設定與實際仍在使用的球線。
3. 上場次數／時數，讓耐打度與成本比較更有依據。
4. V2 備份還原與匯入預覽，便於搬移資料或從備份恢復。
5. 歷史篩選與分頁，快速查找線材、磅數與日期，支援多年紀錄。
