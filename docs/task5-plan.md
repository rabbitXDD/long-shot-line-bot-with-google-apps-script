# Task 5 實作交接計畫書 (Task 5 Execution Plan)

> **目標讀者**：負責程式碼修改的 Executor Agent。
> **任務目標**：移除 `doPost` 外層的全域 `LockService` 鎖定，將其縮小至僅限「試算表寫入」的路徑上，以提升查詢功能的並發效能與使用者體驗。

---

## 1. 現狀問題 (Current Issue)
目前 `long-shot-bot.js` 在 `doPost(e)` 的最外層（第 74 行）直接請求全域 `LockService`，且直到函式結束（第 343 行）才釋放鎖。這導致所有操作（包括純唯讀的「戰績查詢」、「排行顯示」與「選單」）都會被無辜排隊卡住，若有寫入動作正在進行，查詢用戶會被拒絕服務並回傳「系統正忙」。

---

## 2. 具體修改步驟 (Step-by-Step Instructions)

### Step 1: 移除外層全域鎖定 (doPost L73–L80)
移除 `doPost` 進入點的鎖定檢查邏輯。

* **移除區塊**:
  ```javascript
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    replyText = "⏳ 系統正忙，請 3 秒後再試。";
    // ... 處理 Token 消費與回傳
    return ...;
  }
  ```
* **移除清理邏輯**: 移除 `finally` 區塊中的 `lock.releaseLock();` (原 L342-L344)。

### Step 2: 在「關鍵寫入路徑」加入局部鎖定
鎖定僅應發生在需要「寫入至 Google Sheet」的地方。

1. **功能 2 貼回記錄 (L174 之後)**：
   在執行 `spreadsheet.getSheetByName(...)` 後、執行 `appendRow` 或 `setValue` 等寫入操作前，加入鎖定：
   ```javascript
   // 僅在寫入前鎖定
   const lock = LockService.getScriptLock();
   lock.waitLock(5000); // 建議改用 waitLock 確保排隊執行
   try {
     // 執行所有試算表寫入操作...
   } finally {
     lock.releaseLock();
   }
   ```
2. **功能 4 查詢排行 (L297 之後)**：
   目前排行已移除自動修改公式的邏輯（Task 4），若確認該功能純讀取，則無需鎖定。若有排序後的排名寫入 (`sheet.getRange(i + 2, 1).setValue(...)`)，建議在該排序更新循環前加鎖。

---

## 3. 交付標準與注意事項
1. **安全性**: 移除全域鎖定後，確保寫入路徑的鎖定範疇（Try-Finally）正確包覆所有寫入動作，防止資料寫入發生 Race Condition。
2. **部署驗證**:
   在本地執行 `python3 app_scripts.py` 完成部署。
3. **Git 提交與推送**:
   ```bash
   git add long-shot-bot.js docs/plan.md
   git commit -m "perf: move LockService to fine-grained writing paths (Task 5, G5)"
   git push origin main
   ```
4. **更新計畫文件**: 將 `docs/plan.md` 中的 `Task 5` 狀態標記為 `✅ 已完成`。
