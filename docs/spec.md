# 規格說明書 (Specification) - Long Shot Bot

## 1. 概述
本文件定義 LINE Bot (Google Apps Script 版) 之技術規格與已知架構風險。依據專案協同規範與 `docs/line-spec.md`，本文件記錄目前系統之核心行為、安全限制與改善目標。

---

## 2. 系統架構與安全限制 (G1–G7 規格要求)

### G1: 1秒Webhook回應 SLA 違規風險
* **違規條款**: `docs/line-spec.md` §1.1
* **說明**: `doPost(e)` 內包含大量的同步試算表讀寫、鎖定等待與 LINE API 請求，整體執行時間極易超過 1000ms。
* **驗收標準**: 所有耗時操作應改為非同步任務佇列或背景執行，確保 `doPost(e)` 能在 800ms 內回傳 `200 OK`。
* **影響範圍**: `long-shot-bot.js:55-342`

### G2: 缺少 `x-line-signature` 簽章驗證
* **違規條款**: `docs/line-spec.md` §2.2
* **說明**: `doPost(e)` 進入點未驗證來自 LINE 平台的 HMAC-SHA256 簽章，存在偽造 Webhook 事件之資安風險。
* **驗收標準**: 系統須比對 `X-Line-Signature` 標頭與 Channel Secret 計算出之雜湊值，不符者直接拒絕請求。
* **影響範圍**: `long-shot-bot.js:5`

### G3: 錯誤處理與日誌記錄不足
* **違規條款**: `docs/line-spec.md` §3.1
* **說明**: 例外捕捉僅使用 `console.error`，且 `sendLineReply` 在遭遇 401/429/400 等錯誤時會靜默吞掉，缺乏外部診斷記錄。
* **驗收標準**: 所有例外與 API 失敗皆須記錄至專屬錯誤記錄表或結構化 Log 中。
* **影響範圍**: `long-shot-bot.js:346-358`, `long-shot-bot.js:369-398`

### G4: 試算表公式名稱錯誤 (`COUNTUNIQUEIFS`)
* **說明**: 程式碼中使用 Google Sheets 原生不支援的公式 `COUNTUNIQUEIFS`，將導致儲存格回傳 `#NAME?` 錯誤。
* **驗收標準**: 改用支援的公式組合（如 `SUMPRODUCT` 或 `COUNTIFS`）或改由 Apps Script 程式端計算不重複數。
* **影響範圍**: `long-shot-bot.js:289`

### G5: 唯讀路徑過度鎖定 (Lock Contention)
* **違規條款**: `docs/line-spec.md` §3.2
* **說明**: 功能1與功能4等純讀取操作亦請求了全域 Script Lock，導致高併發時使用者排隊等待。
* **驗收標準**: 僅在寫入操作時鎖定，讀取操作去除 `LockService` 限制或降低等待超時。
* **影響範圍**: `long-shot-bot.js:118-154`, `long-shot-bot.js:279-330`

### G6: 全域 `pendingRecord` 狀態污染
* **說明**: 使用單一全域 ScriptProperties 儲存 `pendingRecord`，多使用者同時操作時會互相覆蓋狀態。
* **驗收標準**: `pendingRecord` 須以 `userId` 作為鍵值隔離（如 `pendingRecord_${userId}`）。
* **影響範圍**: `long-shot-bot.js:88`, `long-shot-bot.js:160`, `long-shot-bot.js:262`

### G7: ReplyToken 單次使用與多事件處理瑕疵
* **違規條款**: `docs/line-spec.md` §2.1
* **說明**: 程式碼直接取 `events[0]` 處理，若單次 Webhook 夾帶多個事件或在例外重試時重用已過期/已消耗的 `replyToken` 將造成發送失敗。
* **驗收標準**: 遍歷 `events` 陣列，並確保單一 `replyToken` 僅使用一次，失敗時轉用 Push API。
* **影響範圍**: `long-shot-bot.js:26`, `long-shot-bot.js:37-48`, `long-shot-bot.js:346-358`
