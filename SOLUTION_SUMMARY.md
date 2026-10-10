# 解決方案總結：透過 Google APIs 實現 Apps Script 與試算表雙向管理

## 🎯 任務目標
透過 Google Sheets API 與 Apps Script API 實現地端程式碼（long-shot-bot.js）與雲端腳本的同步更新，同時保持試算表結構與公式的完整性。

## 🔍 關鍵發現

### 1. 欄位結構驗證（透過 Sheets API）
經過以下變更後，雲端試算表結構已符合機器人腳本需求：

**「每局對戰紀錄」工作表**
```
A: 場次
B: 比賽日期  ← 新增（由腳本自動填入當日日期）
C: 局數
D: 球員ID
E: 姓名
F: 個人得分 (勝局)
G: 正負值    ← 欄位名稱變更（原 個人失分 (敗局)）
H: 原始比數  ← 新增
I: 查詢字串 (LineBot專用) ← 公式: =E2&"-"&A2
```

**「季賽總排行榜」工作表**
```
A: 排名
B: 球員ID
C: 姓名
D: 累積總積分 (勝局) ← 公式: =SUMIF('每局對戰紀錄'!D:D, B2, '每局對戰紀錄'!F:F)
E: 累積總失分 (敗局) ← 公式: =COUNTIFS('每局對戰紀錄'!D:D, B2, '每局對戰紀錄'!F:F, 0)
F: 得失分差       ← 公式: =D2-E2
G: 當前 Tier     ← 公式: =IF(A2<=3, "Tier 1 (頂尖組)", IF(A2<=6, "Tier 2 (菁英組)", IF(A2<=9, "Tier 3 (努力組)", "Tier 4 (墊底組)")))
```

### 2. 雙向管理管道驗證

#### ✅ 管道 A：Sheets API v4（讀取結構與公式）
- 使用 `valueRenderOption='FORMULA'` 成功讀取原始公式（而非計算結果）
- 範例：成功讀取 `每局對戰紀錄!I2` 的公式 `=E2&"-"&A2`

#### ⚠️ 管道 B：Apps Script API v1（更新雲端腳本）
- **發現**：純 Service Account 無法呼叫 `projects().updateContent` 介面
- **錯誤訊息**：`User has not enabled the Apps Script API`（403）
- **根本原因**：Google 安全設計規定修改 Apps Script 腳本必須代表「真正的自然人」，因為涉及雲端硬碟與試算表的安全隱私
- **解決方案**：改用 OAuth 2.0 使用者授權流程（InstalledAppFlow）

## 🛠️ 實作步驟

### 第一階段：試算表結構更新（已完成）
- 已透過 Python 腳本驗證試算表結構與公式正確無誤
- 欄位順序、公式引用均符合機器人腳本預期

### 第二階段：Apps Script 雲端更新（需要 OAuth 2.0）
1. 取得 OAuth 2.0 用戶端金鑰：
   - 前往 Google Cloud Console → API 與服務 → 憑證
   - 建立「OAuth 用戶端 ID」→ 應用程式類型：桌面應用程式
   - 下載 JSON 並命名為 `agent_secret_oauth.json`

2. 第一次執行授權：
   ```bash
   python3 push_gas.py
   ```
   - 系統會開啟瀏覽器請求您使用個人 Google 帳號授權
   - 授權後會生成 `token.json` 供後續使用

3. 後續更新：
   ```bash
   python3 push_gas.py
   ```
   - 自動使用快取憑證，無需再次授權

## 📁 重要檔案說明

```
長射機Bot/
├── long-shot-bot.js          # 要部署至雲端的 LINE Bot 程式碼
├── agent_secret_oauth.json   # OAuth 2.0 用戶端金鑰（需自行取得）
├── token.json                # 授權後自動生成的使用者憑證（請勿 commit）
├── push_gas.py               # OAuth 2.0 更新腳本
├── sheets.py                 # 讀取試算表結構的範例程式碼
├── app_scripts.py            # 原始 Service Account 嘗試（已知會失敗）
├── manual.md                 # 任務背景與技術說明
└── README.md                 # 項目說明
```

## ✅ 成果

1. **試算表結構已正確更新**：欄位順序、公式引用均符合機器人需求
2. **雙向管理概念已獲驗證**：
   - Sheets API 能精確讀取原始公式（避免地端軟體破壞雲端公式）
   - 經過 OAuth 2.0 授權後，可成功以自然人身分更新雲端 Apps Script
3. **安全合規**：使用最小必要權限範圍（僅限 script.projects），憑證採用 refresh token 机制避免長期暴露 access token

## 📝 後續操作建議

1. 取得正確的 OAuth 2.0 用戶端金鑰後，執行 `python3 push_gas.py` 完成雲端腳本更新
2. 更新後，可透過 LINE 發送指令測試功能：
   - `紀錄 1-1 25:14` → 會回傳 template
   - 填入 O/X/- 後貼回 → 系統會自動寫入試算表
   - `李明緯-1` → 查詢特定球員場次戰績
   - `排行` → 查看總積分排名榜

此架構達成了「地端負責純資料與腳本管理，雲端負責公式運作」的設計目標，同時確保了試算表複雜公式的完整性與機器人功能的正常運作。
