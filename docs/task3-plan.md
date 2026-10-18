# Task 3 實作交接計畫書 (Task 3 Execution Plan)

> **目標讀者**：負責程式碼修改的 Executor Agent。  
> **任務目標**：在 `long-shot-bot.js` 實作結構化診斷與錯誤日誌功能（G3 限制），確保 LINE API 回應異常與未預期例外能自動記錄至試算表。

---

## 1. 外部環境與前提條件 (已就緒)
* **試算表 ID**: `1UmsSglJz6Ub1nm7QPJV4ypJLci-7OA1kkvZ3Qo3ElbE`
* **日誌工作表**: `系統日誌`（已由 API 事先建立並寫入標題行）。
* **欄位結構**:
  * `A 欄 (1)`: 時間戳記 (`new Date().toISOString()` 或本地字串)
  * `B 欄 (2)`: 日誌層級 (`ERROR` / `WARN` / `INFO`)
  * `C 欄 (3)`: 使用者 ID (`userId`，若無則傳 `'UNKNOWN'`)
  * `D 欄 (4)`: 觸發訊息 (`userMessage` 或截斷字串)
  * `E 欄 (5)`: 錯誤訊息與堆疊 (`err.message` / `err.stack`)
  * `F 欄 (6)`: 其他詳細資訊 (如 LINE HTTP 狀態碼、API 回傳內容)

---

## 2. 具體修改步驟 (Step-by-Step Instructions)

### Step 1: 在 `long-shot-bot.js` 新增日誌輔助函式 `logToSheet`
建議將此函式放置於全域輔助函式區域（例如 `sendLineReply` 附近）：

```javascript
/**
 * 寫入結構化日誌至「系統日誌」工作表
 * @param {string} level - 日誌層級 (ERROR, WARN, INFO)
 * @param {string} userId - 使用者 ID
 * @param {string} message - 觸發訊息或情境
 * @param {string} errorDetails - 錯誤訊息或堆疊
 * @param {string} extra - 其他詳細數據 (如 API 回傳)
 */
function logToSheet(level, userId, message, errorDetails, extra) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    const logSheet = ss.getSheetByName("系統日誌");
    if (!logSheet) return;
    
    const timestamp = Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd HH:mm:ss");
    logSheet.appendRow([
      timestamp,
      level || "INFO",
      userId || "SYSTEM",
      (message || "").substring(0, 200),
      (errorDetails || "").substring(0, 1000),
      (extra || "").substring(0, 1000)
    ]);
  } catch (e) {
    // 日誌記錄本身不可引發阻斷性錯誤
    console.error("logToSheet failed: " + e.toString());
  }
}
```

---

### Step 2: 攔截 `sendLineReply` 的 HTTP 狀態與失敗
現有 `sendLineReply` (約行 374-403) 僅使用 `Logger.log`，請修改以傳入 `userId` 與 `userMessage`（或將其整合），並在狀態碼非 200 時觸發 `logToSheet`：

* **目標範圍**: `sendLineReply(replyToken, replyText, userId, userMessage)`
* **修改重點**:
  1. 檢查 `response.getResponseCode()` 是否為 `200`。
  2. 若非 `200`，呼叫：
     ```javascript
     logToSheet("ERROR", userId, userMessage, `LINE API returned ${response.getResponseCode()}`, response.getContentText());
     ```
  3. 若進入 `catch (fetchErr)`，呼叫：
     ```javascript
     logToSheet("ERROR", userId, userMessage, "LINE API UrlFetchApp error", fetchErr.toString());
     ```

---

### Step 3: 更新 `doPost(e)` 的頂層 Catch 區塊
在 `doPost(e)` 的結尾 `catch (err)` (約行 350)：

* **現有邏輯**:
  ```javascript
  } catch (err) {
    console.error("=== ERROR IN doPost ===");
    console.error(err.stack || err);
    // ...
  }
  ```
* **改進邏輯**:
  在 `console.error` 後加入：
  ```javascript
  logToSheet(
    "ERROR",
    typeof userId !== "undefined" ? userId : "UNKNOWN",
    typeof userMessage !== "undefined" ? userMessage : "UNKNOWN",
    err.message || String(err),
    err.stack || ""
  );
  ```

---

## 3. 驗證與交付要求
1. **執行測試部署**:
   修改完成後，在本地執行 `python3 app_scripts.py` 驗證部署是否成功（需輸出 `🏆 SUCCESS!`）。
2. **更新計畫文件**:
   將 `docs/plan.md` 中的 `Task 3` 標記為 `✅ 已完成`。
3. **Git 提交與推送**:
   ```bash
   git add long-shot-bot.js docs/plan.md
   git commit -m "feat: implement Task 3 - structured diagnostic logging to sheet (G3)"
   git push origin main
   ```
