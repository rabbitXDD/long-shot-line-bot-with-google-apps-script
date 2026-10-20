# 實作計畫書 (Plan) - Long Shot Bot

## 1. 執行目標
本計畫針對 `docs/spec.md` 所列之 G1–G7 技術限制提出系統性改善方案與子任務拆解。

---

## 2. 改善方案與子任務拆解 (Sub-tasks)

### Task 1: 實作 Webhook 非同步卸載與 1 秒 SLA 確保 (對應 G1)
* **目標**: 將耗時的試算表寫入與 LINE API 請求移至非同步佇列或利用觸發器非同步化。
* **步驟**:
  1. 拆分 `doPost(e)` 為「接收驗證 + 立即 200 OK」與「背景處理」。
  2. 使用 `ScriptApp.newTrigger()` 或屬性佇列緩衝背景任務。
* **優先級**: High

### Task 2: 強化 Webhook 簽章驗證 (對應 G2)
* **目標**: 阻擋偽造的 LINE Webhook 請求。
* **步驟**:
  1. 讀取請求標頭中的 `X-Line-Signature`。
  2. 使用 Channel Secret 進行 HMAC-SHA256 計算並比對。
* **優先級**: High

### Task 3: 完善結構化錯誤記錄與診斷機制 (對應 G3)
* **目標**: 確保 API 錯誤與例外皆可被追蹤。
* **步驟**:
  1. 建立錯誤日誌寫入試算表或屬性之輔助函式。
  2. 在 `sendLineReply` 錯誤分支中寫入診斷日誌。
* **優先級**: Medium

### Task 4: 修復無效試算表公式 (對應 G4)
* **目標**: 移除 GAS 端動態注入錯誤公式的邏輯，改依賴試算表現有之正確靜態公式。
* **步驟**:
  1. 移除 `long-shot-bot.js` 查詢排行中動態插入 `COUNTUNIQUEIFS` 的判斷與覆寫邏輯。
* **優先級**: Medium
* **狀態**: ✅ 已完成

### Task 5: 優化讀取路徑之鎖定機制 (對應 G5)
* **目標**: 減少高併發下的鎖定競爭。
* **步驟**:
  1. 移除純讀取邏輯（如功能 1、功能 4 查詢）中的 `LockService` 呼叫，將鎖定縮小到寫入路徑。
* **優先級**: Low
* **狀態**: ✅ 已完成（外層全域鎖定 removed, only write path uses lock.waitLock()）

### Task 6: 隔離 `pendingRecord` 使用者狀態 (對應 G6)
* **目標**: 防止多用戶狀態互相覆蓋。
* **步驟**:
  1. 將 ScriptProperties 的鍵名改為 `pendingRecord_${userId}`。
* **優先級**: High
* **狀態**: ✅ 已完成（commit 2481ae2 之后的 Task 6 commit）

### Task 7: 強化 ReplyToken 生命週期管理 (對應 G7)
* **目標**: 避免重複使用 `replyToken` 或遺漏多事件。
* **步驟**:
  1. 改用迴圈遍歷 `events` 陣列。
  2. 確保例外發生時改用 Push API 進行回覆。
* **優先級**: Medium
