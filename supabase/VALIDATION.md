# life-tools 雲端驗證紀錄

日期：2026-10-03。範圍僅 Badminton Lab；未修改家庭補貨資料表、共用 Auth 設定或既有帳號。

## Migration 已確認

五張 badminton_ 表已建立，全部 RLS=true。每張表均有 authenticated 的使用者隔離 policy，USING 與 WITH CHECK 都要求 auth.uid()=user_id。每張表 user_id 均直接關聯 auth.users；穿線另以 (user_id,racket_id) 關聯球拍。

五個 badminton_ 函式全部為 SECURITY INVOKER，固定空 search_path。anon 無函式執行權；authenticated 可執行 snapshot、import、security_status。

家庭補貨的 life_household_members、life_households、restock_history、restock_items 仍啟用 RLS；這次沒有修改它們。

## 真實 API 未登入測試通過

以公開 publishable key、不提供使用者 token，呼叫五張表與三個 RPC，全部回傳 HTTP 401、Postgres 42501。這確認未登入者被拒絕，而不是前端隱藏資料而已。

## 真實資料庫交易測試通過

執行檔保留在本 task 的 work/badminton-db-validation.sql。使用資料庫 authenticated 角色，設定兩個不同既有 Auth 使用者的 JWT claims；不是密碼登入，也沒有用 service-role 作為測試角色。所有測試異動在子交易中回滾，並確認沒有留下測試 UUID。

已驗證：

- A 新增／讀取／編輯球拍、穿線、分開主橫線磅數與評分。
- 選項 trigger、版本遞增、舊版本修改拒絕、無效評分拒絕。
- snapshot 可讀取自己的測試資料。
- MVP RPC 匯入、相同識別碼重複匯入不建立、孤兒穿線導致整次匯入回滾。
- B 無法讀取、修改或刪除 A 球拍與穿線；snapshot／選項／匯入紀錄沒有 A 的資料。
- B 不能新增或更新成 A user_id；複合外鍵拒絕跨帳號球拍。
- A 資料在 B 攻擊後未變，球拍刪除連動穿線，歷史選項仍保留。
- 真實安全狀態 RPC 顯示五張表啟用 RLS，anon 無 SELECT／INSERT 權限。

## 真實 A/B 登入與 API 隔離測試通過

使用者分別在主 App 輸入 A、B 的既有帳號密碼；本機 QA 頁以 Auth `/user` 驗證為兩個不同使用者，再用各自 session 呼叫正式 REST API。不是以管理員或 service-role 代替使用者，也沒有讀取／輸出密碼或 token。

2026-10-03T03:28:11Z，12 項全部通過：

1. A/B 是經 Auth 驗證的不同使用者。
2. B 查詢 A 的指定 QA 球拍回傳空陣列。
3. B PATCH A 球拍回傳空陣列，沒有修改。
4. B DELETE A 球拍回傳空陣列，沒有刪除。
5. B 對 A 的兩筆 QA 穿線逐筆 GET／PATCH／DELETE，全部空陣列。
6. A 的 profile、歷史選項與匯入紀錄對 B 不可見。
7. B snapshot 不含 A 資料。
8. 未登入請求五張表與三個 RPC 均被拒絕。
9. B 可建立並讀取自己的球拍與穿線。
10. 新增／更新冒用 A user_id 被 RLS 拒絕。
11. B 穿線關聯 A 球拍被複合外鍵拒絕。
12. 安全狀態顯示五張表 RLS 啟用、anon SELECT／INSERT 權限撤銷。

測試後唯讀資料庫查詢確認 A 球拍版本 2、兩筆穿線版本 2／1、磅數及心得均未變；原有 3 支球拍、2 筆穿線仍存在。

完整 JSON 及畫面只保存於本 task 的 work/badminton-real-rls-report.json、work/badminton-real-rls.jpg，不提交私人 QA UUID／使用者 ID 到 repository。工具來源為 tools/browser-qa.html、tools/browser-qa.js；僅本機 preview 可存取，Pages 只部署 public/。

## 實際資料操作與舊資料保留

- A 新增一支 QA 球拍及兩次穿線，分開儲存 25／27 與 26／28 lb，包含錯磅、店家、價格與全部六項心得。
- A 編輯球拍備註、穿線價格與心得，重新整理後保留；歷史依日期排序且標記最新設定。
- A 從 native file chooser 匯入 MVP JSON，實際新增 3 支球拍、2 筆穿線；再匯入同檔沒有重複建立。
- B 停用自己的 QA 球拍，首頁使用中數量從 1 改為 0；另一個既有分頁也取得停用狀態。
- 320／390px 手機與 1440px 桌面沒有觀察到橫向溢出；觸控按鈕至少 44px，輸入文字 16px。
- 經使用者確認，只刪除指定 QA 資料。在 B 主 App 完成穿線刪除，球拍仍存在且歷史為 0；再刪除球拍。A QA 球拍及兩筆穿線、9 個專屬選項由有 UUID／內容檢查的交易清理。最終 A 保留原有 3／2、B 為 0／0，所有 QA UUID 已不存在。沒有清除 Auth profile 或匯入識別紀錄。
- 實體手機／Safari、跨實體裝置、Email 送信與正式部署尚未驗證。匯出點擊無 console 錯誤，但 Preview 下載事件逾時，未確認檔案落地。

## 已修正問題

使用者回報的「無法連線到雲端」已在瀏覽器重現並修正：原生 fetch 需要正確的 global receiver，不能當成 Cloud 物件的方法直接呼叫。測試先確認原碼失敗，再修正為 wrapper；目前 15/15 本機測試通過。

修正後使用不存在的 example.invalid 測試帳號，真實瀏覽器已收到 Supabase 的 Invalid login credentials，後續也確認中文訊息「Email 或密碼不正確，請重新確認」。此為初步連線驗證；後續 A、B 已分別實際登入成功。沒有由工具建立 Auth 測試帳號或寄送 Email。

匯入期間發現背景同步重繪帳號頁，可能清除已選檔案。已在 public/app.js 保留匯入表單，實測輪詢與手動同步後仍可完成匯入。上述測試不代表正式版已上線。

## Advisor 結果

Badminton Lab 沒有新增 RLS／SECURITY DEFINER 安全告警；新增的歷史索引因尚未使用被列為 unused index，保留供歷史查詢。

life-tools 的既有共用函式有 SECURITY DEFINER 可執行提示；這只是 advisor 提示，不直接證明存在越權漏洞，未在本次調整它們。另有共用 Auth 的 leaked-password protection 未啟用提示，未改動共用設定。

參考：[函式權限提示](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)、[密碼保護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。
