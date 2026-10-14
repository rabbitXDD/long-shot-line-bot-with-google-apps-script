// 請將此處替換為你在 LINE Developers 申請的 Channel Access Token
const LINE_ACCESS_TOKEN = 'w4zfK7E0Re6QfiGPPF+YOlZx5b7TMJLN5sM5Ezf39q04uoRbHBaKUkQobpAZ73eAD43D690f3OrqEfuDlfnABkElb6eMvRHqffkN4LiZyu7DMKVlOb9xIX1b/YZp4n0pUY+4ADH3Xi56sGGzDMcWRQdB04t89/1O/w1cDnyilFU='; 


function doPost(e) {
  let replyToken = null;

  try {
    const rawBody = e && e.postData && e.postData.contents;
    if (!rawBody) {
      console.log("Webhook received without a request body");
      return HtmlService.createHtmlOutput("OK");
    }

    const json = JSON.parse(rawBody);
    const events = json.events || [];

    // LINE Webhook 驗證可能傳入空事件陣列
    if (events.length === 0) {
      console.log("Webhook verification: empty events");
      return HtmlService.createHtmlOutput("OK");
    }

    // 目前沿用原本的單一事件處理邏輯
    const event = events[0];

    // 忽略非文字訊息或沒有 replyToken 的事件
    if (
      event.type !== "message" ||
      !event.message ||
      event.message.type !== "text" ||
      !event.replyToken
    ) {
      console.log("Ignored non-text or non-replyable event");
      return HtmlService.createHtmlOutput("OK");
    }

    replyToken = event.replyToken;
    const userMessage = event.message.text.trim();

    // 從這裡開始，保留原本四種功能的程式碼

    
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let replyText = "";

    if (userMessage.startsWith("紀錄 ")) {
      const parts = userMessage.substring(3).trim().split(" ");
      if (parts.length !== 2) {
        replyText = "❌ 格式錯誤！請使用：紀錄 <場次>-<局數> <勝方得分>:<敗方得分>\n例如：紀錄 1-1 25:14";
      } else {
        const [matchPart, scorePart] = parts;
        const [roundStr, setStr] = matchPart.split("-");
        const roundNum = parseInt(roundStr, 10);
        const setNum = parseInt(setStr, 10);
        const [winnerScoreStr, loserScoreStr] = scorePart.split(":");
        const winnerScore = parseInt(winnerScoreStr, 10);
        const loserScore = parseInt(loserScoreStr, 10);
        
        if (isNaN(roundNum) || isNaN(setNum) || isNaN(winnerScore) || isNaN(loserScore)) {
          replyText = "❌ 請確認場次、局數和得分都是數字！";
        } else {
          // 計算正負值
          const diff = Math.abs(winnerScore - loserScore);
          
          // 存狀態
          const props = PropertiesService.getScriptProperties();
          props.setProperty("pendingRecord", JSON.stringify({
            round: roundNum,
            set: setNum,
            winnerScore,
            loserScore,
            diff,
            date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
          }));
          
          // 取得球員名單
          const playerSheet = spreadsheet.getSheetByName("球員名冊");
          const playerData = playerSheet.getDataRange().getValues();
          
          // 建立 template
          replyText = `📊 第${roundNum}場第${setNum}局 - 比數 ${winnerScore}:${loserScore}\n`;
          replyText += "請複製以下格式，填入有參與的球員（O=勝, X=敗, -=未出賽）：\n\n";
          
          for (let i = 1; i < playerData.length; i++) { // 跳過標題行
            const playerId = playerData[i][0]; // D 欄 球員ID
            const playerName = playerData[i][1]; // E 欄 姓名
            replyText += `${playerName}：____\n`;
          }
          
          replyText += `\n貼回範例：\n李明緯：O\n齊蹦：X\n\n（貼回後系統會自動計算正負值並寫入）`;
        }
      }
    }
    
    // 處理功能 3：貼回紀錄資料（格式：姓名：O/X/-）
    // 處理功能 1：【查詢當週戰績】格式範例：「李明緯-1」 (嚴格限制結尾為數字，避免球員名帶有 '-' 誤判)
    else if (/^.+- \d+$/.test(userMessage) || /^.+-[-]?\d+$/.test(userMessage)) {
      const sheet = spreadsheet.getSheetByName("每局對戰紀錄");
      const data = sheet.getDataRange().getValues();
      let found = false;
      let totalWin = 0;
      let totalLose = 0;
      let plusMinus = 0;
      let lastScore = "";
      let lastDate = "";

      // 欄位索引：A場次(0) B比賽日期(1) C局數(2) D球員ID(3) E姓名(4) F勝局(5) G正負值(6) H原始比數(7) I查詢字串(8)
      for (let i = 1; i < data.length; i++) {
        if (data[i][8] == userMessage) { // I 欄 (第9欄，索引為8) - 查詢字串
          found = true;
          totalWin += Number(data[i][5]);  // F 欄 (勝局)
          totalLose += (Number(data[i][5]) === 0) ? 1 : 0; // 敗局 = 勝局為0的場次
          plusMinus += Number(data[i][6]); // G 欄 (正負值)
          lastScore = data[i][7];          // H 欄 (原始比數)
          lastDate = data[i][1];           // B 欄 (比賽日期)
        }
      }

      if (found) {
        const parts = userMessage.split("-");
        replyText = `🏐 ${parts[0]} 第 ${parts[1]} 場\n`;
        if (lastDate) {
          replyText += `📅 比賽日期：${lastDate}\n`;
        }
        replyText += `🟢 勝局：${totalWin}\n🔴 敗局：${totalLose}\n📊 正負值：${plusMinus >= 0 ? "+" : ""}${plusMinus}\n`;
        if (lastScore) {
          replyText += `🎾 原始比數：${lastScore}\n`;
        }
        replyText += `當週獲得積分：${totalWin} 分！`;
      } else {
        replyText = "❌ 找不到該場次戰績，請確認格式是否正確（例如：李明緯-1）或主辦方尚未輸入數據。";
      }
    }
    
    // 處理功能 2：【紀錄成績】格式：「紀錄 1-1 25:14」
    else if (userMessage.includes("：")) {
      // 檢查是否有待處理的記錄
      const props = PropertiesService.getScriptProperties();
      const pendingJson = props.getProperty("pendingRecord");
      
      if (!pendingJson) {
        replyText = "❌ 沒有待處理的記錄。請先使用「紀錄 <場次>-<局數> <比數>」指令。";
      } else {
        const pending = JSON.parse(pendingJson);
        const roundNum = pending.round;
        const setNum = pending.set;
        const winnerScore = pending.winnerScore;
        const loserScore = pending.loserScore;
        const diff = pending.diff;
        const gameDate = pending.date;
        
        // 解析貼回的資料
        const lines = userMessage.split("\n").map(line => line.trim()).filter(line => line.length > 0);
        const records = [];
        
        for (const line of lines) {
          const parts = line.split("：");
          if (parts.length !== 2) continue;
          
          const name = parts[0].trim();
          const mark = parts[1].trim().toUpperCase();
          
          if (mark !== "O" && mark !== "X" && mark !== "-") continue;
          
          records.push({ name, mark });
        }
        
        if (records.length === 0) {
          replyText = "❌ 沒有找到有效的記錄格式。請使用：姓名：O/X/-";
        } else {
          // 取得球員名冊和每局對戰紀錄表
          const playerSheet = spreadsheet.getSheetByName("球員名冊");
          const recordSheet = spreadsheet.getSheetByName("每局對戰紀錄");
          
          const playerData = playerSheet.getDataRange().getValues();
          const recordData = recordSheet.getDataRange().getValues();
          
          // 建立姓名到球員ID的映射
          const nameToIdMap = {};
          for (let i = 1; i < playerData.length; i++) {
            const playerId = playerData[i][0]; // D 欄 球員ID
            const playerName = playerData[i][1]; // E 欄 姓名
            nameToIdMap[playerName] = playerId;
          }
          
          // 檢查每筆記錄
          // 建立已存在記錄的快速索引（key = 場次-局數-球員ID → dataRow）
          const existingRowMap = {};
          for (let r = 1; r < recordData.length; r++) {
            const k = recordData[r][0] + "-" + recordData[r][2] + "-" + recordData[r][3];
            if (existingRowMap[k] === undefined) {
              existingRowMap[k] = r;
            }
          }
          let addedCount = 0;
          let updatedCount = 0;
          let nextRowNum = recordData.length + 1;
          const errors = [];
          
          for (const record of records) {
            const playerId = nameToIdMap[record.name];
            if (!playerId) {
              errors.push(`找不到球員：${record.name}`);
              continue;
            }
            
            // 計算勝局和正負值
            const win = (record.mark === "O") ? 1 : 0;
            const plusMinus = (record.mark === "O") ? diff : (record.mark === "X") ? -diff : 0;
            
            // 檢查是否已存在該場次該局該球員的記錄
            const key = roundNum + "-" + setNum + "-" + playerId;
            const foundRow = existingRowMap[key];
            
            if (foundRow !== undefined) {
              // 更新現有記錄
              recordSheet.getRange(foundRow + 1, 2).setValue(gameDate); // B 欄 比賽日期
              recordSheet.getRange(foundRow + 1, 6).setValue(win);      // F 欄 勝局
              recordSheet.getRange(foundRow + 1, 7).setValue(plusMinus); // G 欄 正負值
              recordSheet.getRange(foundRow + 1, 8).setValue(`${winnerScore}:${loserScore}`); // H 欄 原始比數
              // I 欄 查詢字串 = 公式，會自動更新
              updatedCount++;
            } else {
              // 新增記錄
              const newRow = nextRowNum++;
              recordSheet.getRange(newRow, 1).setValue(roundNum); // A 欄 場次
              recordSheet.getRange(newRow, 2).setValue(gameDate); // B 欄 比賽日期
              recordSheet.getRange(newRow, 3).setValue(setNum);   // C 欄 局數
              recordSheet.getRange(newRow, 4).setValue(playerId); // D 欄 球員ID
              recordSheet.getRange(newRow, 5).setValue(record.name); // E 欄 姓名
              recordSheet.getRange(newRow, 6).setValue(win);      // F 欄 勝局
              recordSheet.getRange(newRow, 7).setValue(plusMinus); // G 欄 正負值
              recordSheet.getRange(newRow, 8).setValue(`${winnerScore}:${loserScore}`); // H 欄 原始比數
              recordSheet.getRange(newRow, 9).setFormula(`=E${newRow}&"-"&A${newRow}`); // I 欄 查詢字串
              existingRowMap[key] = newRow - 1; // 防止同批次新增
              addedCount++;
            }
          }
          
          // 清除待處理狀態
          props.deleteProperty("pendingRecord");
          
          // 建立回覆訊息
          replyText = `✅ 第${roundNum}場第${setNum}局記錄已保存！\n`;
          replyText += `🆕 新增：${addedCount} 筆\n`;
          replyText += `🔄 更新：${updatedCount} 筆\n`;
          if (errors.length > 0) {
            replyText += `⚠️ 錯誤：${errors.join("；")}`;
          }
          
          // 觸發排行榜重新計算（公式會自動更新）
          replyText += `\n📊 排行榜將在幾秒內自動更新。`;
        }
      }
    }
    
    // 處理功能 4：【查詢排行】
    else if (userMessage === "查詢排行" || userMessage === "排行") {
      const sheet = spreadsheet.getSheetByName("季賽總排行榜");
      let data = sheet.getDataRange().getValues();
      
      // 初始化出席次數欄位 (在 E 欄和 F 欄中間，即插入到 F 欄)
      if (data[0] && data[0][5] !== "出席次數") {
        sheet.insertColumnAfter(5);
        sheet.getRange(1, 6).setValue("出席次數");
        for (let i = 2; i <= data.length; i++) {
          if (data[i-1][1]) {
            sheet.getRange(i, 6).setFormula(`=COUNTUNIQUEIFS(每局對戰紀錄!$B:$B, 每局對戰紀錄!$D:$D, B${i})`);
          }
        }
        SpreadsheetApp.flush();
        data = sheet.getDataRange().getValues();
      }

      replyText = "🏆 【龍蝦 2026 10-12月季打 最新排行榜】 🏆\n";
      
      const players = [];
      for (let i = 1; i < data.length; i++) {
        if (data[i] && data[i][1]) {
          players.push({
            rank: Number(data[i][0]) || 0,
            id: data[i][1],
            name: data[i][2],
            score: Number(data[i][3]) || 0,
            lose: Number(data[i][4]) || 0,
            attendance: Number(data[i][5]) || 0,
            diff: Number(data[i][6]) || 0,
            tier: data[i][7]
          });
        }
      }
      
      // 排序順序: 積分 (大到小) -> 出席 (大到小) -> 正負值 (大到小)
      players.sort((a, b) => b.score - a.score || b.attendance - a.attendance || b.diff - a.diff);
      
      // 更新排名編號
      for (let i = 0; i < players.length; i++) {
        players[i].rank = i + 1;
        sheet.getRange(i + 2, 1).setValue(players[i].rank);
      }
      
      for (let i = 0; i < Math.min(players.length, 12); i++) {
        const p = players[i];
        replyText += `\n${p.rank}. ${p.name} ｜ 出席: ${p.attendance} ｜ 積分: ${p.score} ｜ 正負值: ${p.diff >= 0 ? "+" : ""}${p.diff}`;
      }
    } 
    
    // 預設說明選單
    else {
      replyText = "🤖 歡迎使用龍蝦季賽查詢機器人！\n\n💡 查詢指令說明：\n1. 輸入【排行】: 查看目前 12 人的完整 Tier 排行榜。\n2. 輸入【姓名-場次】: 查詢當週得失分戰績。（例如：李明緯-1）\n3. 輸入【紀錄 <場次>-<局數> <比數>】: 開始記錄一局比賽。（例如：紀錄 1-1 25:14）\n   系統會回傳 template，請填入 O/X/- 後貼回。";
    }

    sendLineReply(replyToken, replyText);
    

  } catch (err) {
    console.error("=== ERROR IN doPost ===");
    console.error(err.stack || err);

    // 只有在取得有效 replyToken 時，才嘗試傳送錯誤通知
    if (replyToken) {
      try {
        sendLineReply(
          replyToken,
          "❌ 系統處理失敗，請稍後再試。"
        );
      } catch (sendErr) {
        console.error("Failed to send error reply: " + sendErr);
      }
    }
  }

  // 使用先前已驗證成功的回應方式
  return HtmlService.createHtmlOutput("OK");
}



function sendLineReply(replyToken, replyText) {
  Logger.log("🚀 sendLineReply CALLED");
  Logger.log(`replyToken length: ${replyToken.length}`);
  Logger.log(`replyText preview: ${replyText.substring(0, 50)}`);
  
  const url = 'https://api.line.me/v2/bot/message/reply';
  const options = {
    'method': 'post',
    'headers': {
       'Content-Type': 'application/json',
       'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
      },
     'payload': JSON.stringify({
        'replyToken': replyToken,
        'messages': [{'type': 'text', 'text': replyText}]
        })
      };
    
  Logger.log("🌐 Sending to LINE API...");
  
  var response;
  try {
     response = UrlFetchApp.fetch(url, options);
     Logger.log(`✅ Response status: ${response.getResponseCode()}`);
     Logger.log(`Response body: ${response.getContentText()}`);
  } catch(fetchErr) {
     Logger.log(`❌ fetch error: ${fetchErr.toString()}`);
  }
}
