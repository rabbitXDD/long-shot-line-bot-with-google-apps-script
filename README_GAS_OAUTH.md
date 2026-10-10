# Google Apps Script API 更新指南（OAuth 2.0 使用者授權）

由於 Google Apps Script API 的 `updateContent` 介面不允許純 Service Account 調用（會回報 403 錯誤：「User has not enabled the Apps Script API」），即使您在個人帳號中已開啟該設定，也必須改用 **OAuth 2.0 使用者授權流程（InstalledAppFlow）** 才能以自然人身分修改雲端腳本。

## 📋 前置作業：取得 OAuth 2.0 用戶端金鑰

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 選擇您的專案（此處為 `shaped-plateau-104307`）
3. 左側選單 → **API 與服務** → **憑證**
4. 點擊 **+ 建立憑證** → **OAuth 用戶端 ID**
5. 應用程式類型選擇 **桌面應用程式**
6. 下載得到的 JSON 檔案，並重命名為 `agent_secret_oauth.json`（置於本專案根目錄）

> ⚠️ 注意：此 JSON 舂 Service Account 金鑰格式完全不同，必須包含：
> ```json
> {
>   "installed": {
>     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
>     "project_id": "YOUR_PROJECT_ID",
>     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
>     "token_uri": "https://oauth2.googleapis.com/token",
>     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
>     "client_secret": "YOUR_CLIENT_SECRET",
>     "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"]
>   }
> }
> ```

## 🚀 使用方式

第一次執行時：
```bash
python3 push_gas.py
```
- 系統會自動開啟瀏覽器視窗
- 請使用**您的個人 Google 帳號**（即擁有該 Apps Script 專案的帳號）登入
- 授權請求的權限：`https://www.googleapis.com/auth/script.projects`
- 認證成功後，會在本地生成 `token.json`（含 refresh token）

之後每次執行：
```bash
python3 push_gas.py
```
- 會自動使用快取的 `token.json`（若過期則自動刷新）
- 無需再次授權，除非權限被撤銷或 token 檔案被刪除

## 🔐 安全說明

- `token.json` 包含您的存取與重新整理 Token，**請勿將其 commit 到 Git**
- 本專案已在 `.gitignore` 中加入 `*.json` 以避免意外上傳
- 權限範圍僅限於修改指定的 Apps Script 專案（由 `SCRIPT_ID` 決定）

## 📝 相關腳本

- `push_gas.py`：使用 OAuth 2.0 更新雲端 Apps Script 程式碼
- `long-shot-bot.js`：要推送至雲端的 LINE Bot 程式碼（已內嵌正確的 LINE Access Token）
