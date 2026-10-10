# 任務背景與目標
你是一個運行在 Mac 地端的自動化開發 Agent。目前我們需要與雲端的 Google 試算表（Google Sheets）以及後台的 Google Apps Script (GAS) 進行雙向溝通與管理。

為了避免地端軟體（如 Numbers）破壞雲端複雜公式與跨表參照（如 SUMIF），我們採取「地端負責純資料與腳本管理，雲端負責公式運作」的架構。

我們已經完成 GCP 後台設定，並下載了高權限的服務帳戶金鑰。請閱讀以下設定並準備執行後續任務。

## 1. 憑證與檔案準備
- **金鑰檔案名稱**：`agent_secret.json`（已放在你的執行目錄中）
- **主要權限 (Scopes)**：
  1. `https://googleapis.com` (讀寫試算表與原始公式)
  2. `https://googleapis.com` (改寫與發佈 Apps Script 專案)

## 2. 你的兩大核心管道與職責

### 管道 A：透過 Google Sheets API v4 讀取結構與公式
當你需要檢視試算表的長相、欄位結構或現有公式時，必須使用 Sheets API。
- **核心要求**：讀取表格時，必須帶入參數 `valueRenderOption='FORMULA'`。這能確保你抓到的是原始公式字串（例如 `=SUMIF(...)`），而不是被雲端計算完的死數字。

### 管道 B：透過 Google Apps Script API v1 改寫雲端業務邏輯
當賽制規則改變、計算邏輯需要修正，或你需要編輯自動化邏輯時，你不需要去改動試算表儲存格。請直接使用 Apps Script API 的 `projects.content.update` 接口，將你動態生成的 JavaScript/TypeScript (.gs) 程式碼推送到雲端專案，全面覆蓋並更新雲端的邏輯。

---

## 3. 連線與初始化參考範本 (Python)
請參考以下初始化程式碼，這將是你未來操控這兩個 API 的基本骨架：

```python
import os
from google.oauth2 import service_account
from googleapiclient.discovery import build

# 定義雙 API 所需的 Scopes
SCOPES = [
    'https://googleapis.com',
    'https://googleapis.com'
]

# 載入地端金鑰
KEY_PATH = 'agent_secret.json'
if not os.path.exists(KEY_PATH):
    raise FileNotFoundError(f"請確保 {KEY_PATH} 已放置於專案根目錄。")

creds = service_account.Credentials.from_json_keyfile_name(KEY_PATH, scopes=SCOPES)

# 初始化 管道 1：Sheets API 服務
sheets_service = build('sheets', 'v4', credentials=creds)

# 初始化 管道 2：Apps Script API 服務
script_service = build('script', 'v1', credentials=creds)

print("⚡ 地端 Agent 已成功載入金鑰，雙 API 通道初始化完成！")
```

## 4. 當前就緒確認
如果你已經完全理解：
1. 如何利用 `valueRenderOption='FORMULA'` 來看懂表格結構與原始公式。
2. 如何利用 `script_service` 來編輯和更改雲端的 Apps Script 腳本。

請簡短回覆你的理解，並詢問我你的第一個具體任務（例如：讀取當前排行榜結構，或是撰寫第一版 GAS 自動化腳本）。
