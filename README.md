# long-shot-line-bot-with-google-apps-script

## 已知架構限制與注意事項 (Known Limitations / G1–G7)
詳細規範請參閱 `docs/spec.md` 與 `docs/plan.md`。

- **G1**: 1秒 Webhook 回應 SLA 違規風險（同步 I/O）
- **G2**: 缺少 `x-line-signature` 簽章驗證
- **G3**: 錯誤處理與日誌記錄不足
- **G4**: 試算表公式名稱錯誤 (`COUNTUNIQUEIFS`)
- **G5**: 唯讀路徑過度鎖定 (Lock Contention)
- **G6**: 全域 `pendingRecord` 狀態污染
- **G7**: ReplyToken 單次使用與多事件處理瑕疵
