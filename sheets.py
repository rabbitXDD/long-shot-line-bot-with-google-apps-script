# 地端 Agent 讀取試算表結構與公式的程式碼
sheet_metadata = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
# 取得所有工作表名稱（看懂長相）
sheets = [s['properties']['title'] for s in sheet_metadata['sheets']] 

# 讀取特定範圍的原始公式
result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID,
    range="季賽總排行榜!A1:G10",
    valueRenderOption="FORMULA" # 關鍵：確保抓到的是 =SUMIF(...) 而不是計算結果
).execute()

formulas = result.get('values', [])
# 現在 Agent 已經把表格長相與公式全部吃進記憶體了
