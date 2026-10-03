# Badminton Lab V2 進度與驗證

日期：2026-10-03。這是沿用原專案的 V2 改造，**正式上線尚未完成**。

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

使用者已手動套用，唯讀查詢確認五張表、RLS policies、外鍵與 SECURITY INVOKER 函式均已建立。真實未登入 API 與資料庫角色隔離測試已通過；實際帳號登入測試仍待完成，詳見 supabase/VALIDATION.md。

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

## 雲端與部署狀態

1. life-tools SQL migration 已套用並確認。資料庫角色的 CRUD／版本／匯入／隔離驗證通過，測試異動全部回滾。
2. Project URL／publishable key 已透過 Supabase 連線取得並設定；五張表與未登入 API 拒絕已確認。
3. 真實 Supabase Auth、球拍／穿線 CRUD、完整 Dashboard 與匯入流程的瀏覽器回歸。
4. 真實 A/B／未登入者 RLS 隔離測試與五張表 RLS=true 確認。工具已提供，不將本機測試替身結果當作 RLS 證據。
5. 實體 iPhone Safari 與加入主畫面驗證。
6. 專屬 GitHub 遠端 repository 建立、public 授權、正式部署與正式 URL。

## 下一步

Migration 與公開設定已完成。已重現並修正登入的原生 fetch receiver 錯誤，瀏覽器可收到 Supabase Auth 回應；等待使用者重新整理並登入，再進行瀏覽器操作與兩帳號 API 隔離測試。通過後再完成 GitHub repo／Pages，並取得公開 source 的明確確認。

## 目前限制／技術債

- 已修正的 bug：資料層把原生 fetch 當成物件方法呼叫，瀏覽器拒絕執行，誤顯示網路故障。新增回歸測試先重現失敗、修正後通過，並用不存在的帳號實際確認 Auth 回應。密碼／Email 確認錯誤已中文化。

- 登入後的選項、表單與歷史流程仍需真實雲端 UI QA，不能只依單元測試推定完成。
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

影響僅限 Badminton Lab 的主要檢視與部署流程；現有 SQLite 和 V1 repository/server 原碼保留。公開設定與 SQL 已完成，正式雲端裝備功能仍需實際帳號與瀏覽器測試。
