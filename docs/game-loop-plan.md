# 龍蝦自動循環賽記錄模組 - 完整交接與實作規格書 (Game Loop Implementation Plan v3)

> **目標讀者**：負責程式碼實作的 LLM Agent / 系統工程師。
> **專案背景**：Long Shot Bot (Google Apps Script / JavaScript V8)。本規格書定義「每日 3 循環 × 3 場（共 9 場）」自動化循環賽對戰紀錄模組。

---

## 1. 核心業務邏輯與規則 (Core Business Rules)

### 1.1 三循環與對戰順序
每日進行 **3 個循環**，每個循環固定 **3 場比賽**（合計 9 場，編號格式如 `1-1, 1-2, 1-3, 2-1 ... 3-3`）：
* **第 1 場 (M1)**: 隊 1 vs 隊 2 (輸入比分，系統自動依大小判斷勝負)
* **第 2 場 (M2)**: 第 1 場的**勝者** vs 隊 3
* **第 3 場 (M3)**: 第 1 場的**敗者**（剩餘隊伍）vs 隊 3

### 1.2 積分與正負值計算規則
* **每場獨立計分**：
  * 勝隊所有成員 = **+1 積分**（勝局 = 1）
  * 敗隊所有成員 = **0 積分**（勝局 = 0）
* **正負值 (diff)**：
  * 勝隊 = `+ (winnerScore - loserScore)`
  * 敗隊 = `- (winnerScore - loserScore)`

### 1.3 互動狀態機流程
1. **觸發「開始紀錄」**：使用者輸入 `開始紀錄` 或 `紀錄比賽`，系統讀取「球員名冊」，回傳第 1 循環抽籤模板。
2. **抽籤登記**：使用者輸入 `姓名:隊伍編號`（編號僅限 `1, 2, 3`，允許某隊無人）。
3. **逐場比分輸入**：
   * 依序輸入 `A:B` 比分（不支援跳場）。
   * 系統自動計算勝負、更新試算表、推導下一場對戰組合。
4. **循環結束與重新抽籤**：
   * 當 1-3 完成時：回傳 `✅ (日期) 第一循環 完成紀錄！` 並自動附帶**第 2 循環**抽籤模板。
   * 當 2-3 完成時：回傳 `✅ (日期) 第二循環 完成紀錄！` 並自動附帶**第 3 循環**抽籤模板。
   * 當 3-3 完成時：回傳 `🎉 (日期) 今日 3 循環共 9 場紀錄全部完成！`。

---

## 2. 狀態資料結構 (CycleState Schema)

儲存於 `PropertiesService.getScriptProperties()`，鍵名為 `cycleState_${userId}`：
```json
{
  "date": "2026-10-19",
  "cycle": 1,          // 當前循環 (1 ~ 3)
  "match": 1,          // 當前場次 (1 ~ 3)
  "teams": {
    "1": ["李明緯", "黃君楷"],
    "2": ["齊蹦", "張三"],
    "3": ["物理-呂昀修", "滕照雄"]
  },
  "history": {
    "1-1": { "winner": "1", "loser": "2", "score": "25:18", "diff": 7 },
    "1-2": { "winner": "1", "loser": "3", "score": "25:20", "diff": 5 }
  }
}
```

---

## 3. 實作步驟與程式碼藍圖 (Step-by-Step Implementation Blueprint)

### Step 1: 建立狀態管理工具函式
在 `long-shot-bot.js` 中新增輔助函式：
```javascript
function getCycleState(userId) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty("cycleState_" + userId);
  return raw ? JSON.parse(raw) : null;
}

function saveCycleState(userId, state) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("cycleState_" + userId, JSON.stringify(state));
}

function clearCycleState(userId) {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("cycleState_" + userId);
}
```

### Step 2: 實作「開始紀錄」模板產生器 (`buildTeamTemplate`)
當收到 `開始紀錄` 或 `紀錄比賽` 時：
```javascript
function handleStartRecord(spreadsheet, cycleNum) {
  const playerSheet = spreadsheet.getSheetByName("球員名冊");
  const playerData = playerSheet.getDataRange().getValues();
  
  let msg = `🏐 請複製以下格式，填入【第 ${cycleNum || 1} 循環】隊伍編號（1/2/3）：\n\n`;
  for (let i = 1; i < playerData.length; i++) {
    const name = playerData[i][1]; // E 欄 姓名
    if (name) {
      msg += `${name}：____\n`;
    }
  }
  msg += `\n（可整排貼回，或用逗號分隔：李明緯:1, 齊蹦:2）`;
  return msg;
}
```

### Step 3: 實作抽籤解析器 (`parseTeamRegistration`)
當使用者傳入 `姓名:編號` 分隔的資料時：
```javascript
function parseTeamRegistration(text, cycleNum) {
  const lines = text.split(/[\n,]/).map(l => l.trim()).filter(l => l.length > 0);
  const teams = { "1": [], "2": [], "3": [] };
  
  for (const line of lines) {
    const parts = line.split(/[:：]/);
    if (parts.length !== 2) continue;
    const name = parts[0].trim();
    const teamId = parts[1].trim();
    
    if (["1", "2", "3"].includes(teamId)) {
      teams[teamId].push(name);
    } else {
      throw new Error(`無效的隊伍編號 "${teamId}"，僅能為 1, 2 或 3`);
    }
  }
  return teams;
}
```

### Step 4: 實作比分自動判定與戰績寫入器 (`processCycleScore`)
當收到 `A:B` 格式且有 active state 時：
1. 決定當前對戰雙方（根據 `match` 屬性與 `history` 內的勝負記錄）。
2. 比較比分大小，決定勝隊與敗隊。
3. 計算 `diff`，並對勝隊成員（勝局=1, 正負值=+diff）與敗隊成員（勝局=0, 正負值=-diff）寫入「每局對戰紀錄」工作表（透過 `lock.waitLock(5000)`）。
4. 推進 `match` 或 `cycle`：
   * 若 `match === 3`：進入下一循環 (`cycle++`, `match = 1`) 或全部完成 (`clearCycleState`)。

---

## 4. 驗收標準 (Turnkey Acceptance Criteria)

| 測試項目 | 輸入 | 期望輸出 / 行為 |
|---|---|---|
| **1. 啟動選單** | `開始紀錄` | 回傳帶有所有球員姓名與空白編號的模板，標明「第 1 循環」。 |
| **2. 抽籤校驗** | `李明緯:4` | 攔截錯誤，回傳「無效的隊伍編號 4，僅能為 1, 2 或 3」。 |
| **3. 正常抽籤** | `李明緯:1,齊蹦:2,張三:3` | 儲存狀態，回傳登記成功並提示「請輸入第 1 循環 1-1 (隊 1 vs 隊 2) 比分」。 |
| **4. 比分自動判勝** | `25:18` (於 1-1) | 試算表寫入勝隊成員（勝局 1，正負值 +7）與敗隊（勝局 0，正負值 -7）；回傳下一場提示（1-2：勝者 vs 隊 3）。 |
| **5. 第一循環結束** | 1-3 比分輸入完成 | 回傳 `✅ (日期) 第一循環 完成紀錄！` 並自動附帶**第 2 循環**抽籤模板。 |
| **6. 全天完成** | 3-3 比分輸入完成 | 回傳 `🎉 (日期) 今日 3 循環共 9 場紀錄全部完成！` 並且清除 `cycleState`。 |
