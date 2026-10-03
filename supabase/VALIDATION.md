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

## 尚待完成

實際 Email／Password 成功登入、瀏覽器 CRUD／匯入、兩個帳號各自登入後的 API 測試、跨裝置操作與正式部署。

使用者回報的「無法連線到雲端」已在瀏覽器重現並修正：原生 fetch 需要正確的 global receiver，不能當成 Cloud 物件的方法直接呼叫。測試先確認原碼失敗，再修正為 wrapper；目前 15/15 本機測試通過。

修正後使用不存在的 example.invalid 測試帳號，真實瀏覽器已收到 Supabase 的 Invalid login credentials，後續也確認中文訊息「Email 或密碼不正確，請重新確認」。此證明瀏覽器已可連到 Auth，但不是使用者成功登入證明；沒有建立測試帳號或寄送 Email。

上述資料庫角色驗證不取代真正帳號登入測試，也不代表正式版已上線。

## Advisor 結果

Badminton Lab 沒有新增 RLS／SECURITY DEFINER 安全告警；新增的歷史索引因尚未使用被列為 unused index，保留供歷史查詢。

life-tools 的既有共用函式有 SECURITY DEFINER 可執行提示；這只是 advisor 提示，不直接證明存在越權漏洞，未在本次調整它們。另有共用 Auth 的 leaked-password protection 未啟用提示，未改動共用設定。

參考：[函式權限提示](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)、[密碼保護](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)。
