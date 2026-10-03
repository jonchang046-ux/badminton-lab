# Badminton Lab V2

在原本 Badminton Lab 專案內升級，沿用深色中文 UI、球拍 CRUD、分開主／橫線磅數、六項心得、詳細頁與歷史。

**目前狀態：life-tools migration、兩個真實帳號登入、雲端 CRUD／重新整理保存、MVP 舊資料匯入與 12 項實際 API 隔離測試已通過。經使用者同意清理 QA 後，A 保留原有 3 支球拍、2 筆穿線，B 無測試紀錄。仍待 GitHub repository 建立及正式部署，不能視為已上線正式版。**

## 啟動預覽

需要 Node.js 24+，沒有新增套件，也不需要 npm install。

```sh
node preview.mjs
```

開啟 http://127.0.0.1:4197/ 。Windows 也可雙擊 start.cmd。預覽提供 public/ 與兩個明列的本機 QA 頁面，不開啟 SQLite，不提供 /api/state 等舊私人 API。程式使用 BADMINTON_PORT 獨立設定，不沿用其他專案的 PORT。正式 Pages 只部署 public/，不包含 QA 頁面。

## life-tools SQL migration

1. 登入 Supabase Dashboard，確認左上角專案是 **life-tools**。
2. 左側 **SQL Editor → New query**。
3. 開啟 `supabase/migrations/202610030001_badminton_v2.sql`，複製全部內容（含 begin/commit），貼上並 Run。
4. 成功後執行 `supabase/security-status.sql`：應有五張表，rls_enabled 全為 true，anon_can_select / anon_can_insert 全為 false。
5. 若報錯，保留完整錯誤訊息；這個 migration 是單一 transaction，失敗不會留下半套資料表。不要自行刪除原有表或重建 project。

新增內容全部是 badminton_ 名稱，不操作 life_household_members、life_households、restock_history、restock_items，也不變更現有 Auth 設定。若相同 Badminton Lab 表已存在，migration 會報錯並回滾；不會覆蓋既有表。

| 表 | 用途與關聯 |
|---|---|
| badminton_profiles | user_id 主鍵，直接 FK → auth.users(id) |
| badminton_rackets | 球拍資料；(user_id,id) 複合主鍵，user_id FK → auth.users |
| badminton_stringing_records | 完整穿線與六項心得；user_id FK → auth.users，(user_id,racket_id) FK → badminton_rackets |
| badminton_user_options | 每個人的已用品牌、型號、重量、握把；球拍／穿線刪除後仍可快速選取 |
| badminton_import_runs | 每個人的舊資料匯入識別與筆數，防止重複匯入 |

五張表全開 RLS；authenticated 只可操作 auth.uid()=user_id 的資料，anon 無私人表權限。穿線與球拍用複合外鍵阻擋跨帳號關聯。資料函式全部 security invoker，不使用 service-role。update trigger 維護 version，避免跨裝置覆寫已變更的紀錄。

RPC：badminton_snapshot（一致的個人完整資料）、badminton_import_v1（原子匯入）、badminton_security_status（僅五張表安全旗標）。這些函式只有 authenticated 可呼叫。

## 取得公開設定

目前已透過 Supabase 連線取得並設定 `public/config.js`，不需要使用者再提供。日後更換設定時，打開 life-tools 的 **Connect**，可取得 Project URL 與 publishable key；或到 **Settings → API Keys** 複製 publishable key：

```js
export const config = Object.freeze({
  supabaseUrl: 'https://你的專案代碼.supabase.co',
  supabaseKey: 'sb_publishable_...'
});
```

這是瀏覽器允許公開的設定；權限由 RLS 決定。不要提供 database password、service-role、sb_secret_ key。程式會拒絕 secret/service-role key。參考：[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)。

## Auth 與跨裝置

- Email + Password 登入／註冊；可直接使用 life-tools 中既有的相同 Auth 帳號，不需要另建立 Supabase Project。
- 依現有 Supabase 設定寄送 Email 確認。**不要為 Badminton Lab 修改共用的 Site URL、停用 Email 確認或重設現有使用者密碼。**
- 到 Authentication → URL Configuration → Redirect URLs，**新增** Badminton Lab 最終網址與 http://127.0.0.1:4197/。既有網址保留。
- 註冊請求會指定 Badminton Lab 回跳網址；確認回跳後先向 Auth 驗證 token，再保存 session。
- 私人裝備只有 Supabase 是正式來源。localStorage 只保留 Badminton Lab 專屬 Auth session，不保存裝備、穿線或心得。
- 兩台裝置登入同帳號後，重新整理、回到分頁或按同步即可取得新資料；前景每 30 秒同步一次。編輯表單開啟時不覆蓋輸入。
- 登出使用 local scope，只結束此 Badminton Lab session，不全域登出同 project 的其他工具。
- 若另一台裝置已修改該紀錄，儲存／刪除會被版本檢查擋下，請同步後重新編輯。

## 舊資料匯入（保留 SQLite）

盤點時找到 3 支球拍、2 筆穿線。已在本 task 的 work/mvp-backup-2026-10-03 保留 SQLite 與 JSON 備份；原始 data/badminton.sqlite 未刪除。已透過 A 帳號的實際匯入介面將 3／2 筆舊資料存入 Supabase，再次匯入同檔顯示「這份備份已匯入，不會重複建立」，並由資料庫筆數確認。

可隨時重新唯讀匯出：

```sh
node tools/export-mvp.mjs
```

結果存於 `private-backups/`（不提交 Git、不部署）。正式資料庫設定完成後：

1. 登入要接收資料的 Badminton Lab 帳號。
2. 帳號與資料 → 選擇 MVP JSON 備份。
3. 頁面先驗證 UUID、欄位、日期、評分與球拍關聯，再顯示筆數與目標帳號。
4. 按「確認匯入雲端」。單次匯入使用資料庫 transaction，全成功才記錄匯入結果。
5. 同一份備份再次匯入不重複建立；碰到既有相同 UUID 不覆寫，結果顯示實際新增數量。既有歷史可合併，不會清空雲端。

不要提交或公開 data/、private-backups/、使用者 token。V2 雲端 JSON 匯出可供個人備份；此版匯入只接受 schemaVersion 1 的 MVP 備份，不接受 V2 匯出檔。

## 手機與 PWA

延續卡片式深色介面，觸控按鈕至少 44px；表單字級至少 16px。Dashboard／穿線頁可直接新增穿線並選擇既有球拍。品牌、型號、重量、握把可搜尋既有值或直接輸入新增。

提供 manifest、192/512 PNG icons、apple-touch-icon、service worker。iPhone Safari 可用分享 → 加入主畫面。service worker 僅快取公開介面，不快取 Supabase 回應或私人資料；需要網路才能讀寫裝備。實體 iPhone Safari 尚待上線後實測。

## 獨立 GitHub / Pages 部署

方案是專屬 badminton-lab repository + GitHub Pages 靜態網站 + Supabase，部署內容只包含 public/。目前已有本機獨立 Git repository，保留 MVP 初始 commit；尚未建立遠端或公開 source。

`.github/workflows/pages.yml` 已準備好：push main → 跑測試 → 上傳 public/ → 部署 github-pages。GitHub repository 建立後，在 Settings → Pages 選 GitHub Actions。若使用公開 repo，需要先取得你的明確同意，因為程式、migration 和公開設定都會公開；私人裝備及備份不會上傳。

正式網址只在實際部署成功後回報，不以預估 URL 當完成證明。GitHub Pages 的 static app 不需部署 Node/SQLite。不要使用家庭補貨助手的 repository、workflow 或部署目標。

## 測試

```sh
node --test tests/*.test.mjs
```

目前 15 組本機測試通過：保留 V1 後端回歸，並新增 V2 設定／秘密 key 防護、欄位映射、評分分母、選項、token 更新、版本衝突、匯入驗證、Email callback、瀏覽器 fetch receiver 與中文 Auth 錯誤測試。單元測試的 HTTP 使用測試替身；另已完成真正 A/B Auth session 的 12 項 API 隔離測試、真實未登入 API 拒絕與資料庫交易驗證，詳見 supabase/VALIDATION.md。

本次使用本機頁面 http://127.0.0.1:4197/__qa/index.html 驗證：先在主 App 登入 A，保存專屬 QA 球拍目標；再由使用者在主 App 登出並登入 B，以 B 的實際 session 發送 REST 請求。此頁不要求密碼、不顯示或匯出 token，結果只含檢查名稱及 QA UUID，不部署到 Pages。QA 清理已取得使用者同意並完成。

真實隔離測試工具：`node tools/verify-rls.mjs`。需要 migration 完成、config.js 設定，以及兩個不同且已確認 Email 的測試帳號。工具從 stdin 讀取登入資料、不寫入檔案、不印 token；建立獨立 UUID 測試資料並檢查：

- A 可建立／讀取自己的球拍與穿線。
- B 不能讀取、修改或刪除 A 的球拍、穿線與 profile。
- B 不能冒用 A user_id，也不能關聯 A 球拍。
- 未登入者不能讀取五張表或 snapshot。
- 真實資料庫五張表 RLS=true、anon 權限撤銷。
- 結束時只清理本次測試建立的球拍／穿線 UUID 與專屬選項。

CLI 工具是替代驗證方式，本次未執行；真正帳號隔離已由上述瀏覽器 QA 頁完成。若日後使用 CLI，登入資料需透過受控 stdin 傳入，請不要貼真實密碼在聊天或提交 repository，並先確認測試帳號與清理範圍。

## 檔案結構

```text
public/               原 UI + Auth + cloud/data 模組 + PWA
supabase/migrations/  life-tools 專用新增 SQL
supabase/security-status.sql
tools/export-mvp.mjs  舊 SQLite 唯讀匯出
tools/verify-rls.mjs   真實兩帳號 API 隔離測試
tools/browser-qa.*    本機限定的實際登入隔離驗證頁
preview.mjs           V2 靜態預覽（4197）
server.mjs / repository.mjs  保留的 V1 資料維護與回歸測試
private-backups/      本機私人備份（忽略、不部署）
tests/                本機回歸測試
.github/workflows/pages.yml
README-V1.md          原 MVP 文件
```

V2 請使用 preview.mjs，不用舊 server.mjs 啟動介面。

## 待完成／限制

- life-tools 公開 URL/key、SQL migration 與資料庫角色隔離驗證已完成。
- 真實雲端 CRUD、使用狀態、歷史、Dashboard、舊資料匯入與 A/B/anon 隔離已通過；QA 已清理，原資料保留。
- 等待專屬遠端 repository、公開授權與正式部署。
- 320／390px 手機及 1440px 桌面檢查未見橫向溢出。未實測實體 iPhone／Android、跨實體裝置、大量資料及 Email 送信。送信能力沿用 life-tools 設定；SMTP 調整需另外確認。
- 已點擊 V2 備份匯出，沒有瀏覽器錯誤；Preview 下載事件逾時，尚未確認下載檔案落地，須在一般瀏覽器補測。
- 同步是重新整理／前景輪詢，沒有 WebSocket 秒級即時推送。
- 尚無實際上場時數、斷線日期、軟刪除復原與 V2 JSON 還原。

詳細進度見 V2_STATUS.md，雲端驗證見 supabase/VALIDATION.md；歷史 MVP 測試報告保留在 TEST_REPORT.md。
