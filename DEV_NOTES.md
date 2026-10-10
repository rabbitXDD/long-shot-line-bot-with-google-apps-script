# 開發備忘錄 (Development Notes)

## 網路與模型連線
- **Ollama / freellmapi 連線失敗**：若遇到本地模型連線逾時或 502/503 錯誤，通常是因為 Wi-Fi 或路由器變更導致本機虛擬 IP 改變。
  - 檢查與更新 IP 指令：`ifconfig | grep "inet " | grep -v 127.0.0.1`
  - 請確保 `freellmapi` 設定指向目前的正確區域網路 IP。
