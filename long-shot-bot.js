// 實時 Token 由 app_scripts.py 在部署前從 token.json 讀取並替換此處
const LINE_ACCESS_TOKEN = 'w4zfK7E0Re6QfiGPPF+YOlZx5b7TMJLN5sM5Ezf39q04uoRbHBaKUkQobpAZ73eAD43D690f3OrqEfuDlfnABkElb6eMvRHqffkN4LiZyu7DMKVlOb9xIX1b/YZp4n0pUY+4ADH3Xi56sGGzDMcWRQdB04t89/1O/w1cDnyilFU=';
const LINE_CHANNEL_SECRET = '7aa52f302eb00e4b78de914b76042b24';

function verifyLineSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  try {
    // GAS 的 computeHmacSha256Signature 參數順序為 (key, value)
    const hash = Utilities.computeHmacSha256Signature(secret, rawBody);
    const expected = Utilities.base64Encode(hash);
    const expectedClean = expected.replace(/[\r\n]/g, '');
    const sigClean = signature.replace(/[\r\n]/g, '');
    const result = expectedClean === sigClean;
    if (!result) {
      console.log("Sig mismatch. expected: " + expectedClean + " | received: " + sigClean);
    }
    return result;
  } catch (err) {
    console.error("Signature verification error: " + err.toString());
    return false;
  }
}

// ----------------------------------------------------
// 循環賽狀態與輔助管理函式
// ----------------------------------------------------
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

function handleStartRecord(spreadsheet, cycleNum) {
  const playerSheet = spreadsheet.getSheetByName("球員名冊");
  if (!playerSheet) return "❌ 找不到「球員名冊」工作表";
  const playerData = playerSheet.getDataRange().getValues();
  
  let msg = `🏐 請複製以下格式，填入【第 ${cycleNum || 1} 循環】隊伍編號（1/2/3）：\n\n`;
  for (let i = 1; i < playerData.length; i++) {
    const name = playerData[i][1]; // 姓名
    if (name) {
      msg += `${name}:____\n`;
    }
  }
  msg += `\n💡 提示：若球員缺席，請直接「留空」或「維持底線」即可。`;
  msg += `\n（格式範例：李明緯:1, 齊蹦:2, 王小明:____）`;
  return msg;
}


function parseTeamRegistration(text) {
  const lines = text.split(/[\n,]/).map(l => l.trim()).filter(l => l.length > 0);
  const teams = { "1": [], "2": [], "3": [] };
  
  for (const line of lines) {
    const parts = line.split(/[:：]/);
    if (parts.length !== 2) continue;
    const name = parts[0].trim();
    // 💡 移除所有空白與底線字元
    const teamId = parts[1].replace(/[\s_＿]/g, ""); 
    
    // 如果編號是空的（代表原本輸入空白、底線或 ____），視為缺席，直接跳過不登記
    if (teamId === "") {
      continue; 
    }
    
    // 檢查有效的隊伍編號
    if (["1", "2", "3"].includes(teamId)) {
      teams[teamId].push(name);
    } else {
      throw new Error(`無效的隊伍編號 "${teamId}"，僅能為 1, 2, 3 或留空(缺席)`);
    }
  }
  return teams;
}


function getNextMatchDescription(state) {
  const cycle = state.cycle;
  const match = state.match;
  if (match === 1) {
    return `請輸入第 ${cycle} 循環 第 1 場 (隊 1 vs 隊 2) 比分 (格式 A:B)：`;
  } else if (match === 2) {
    const w1 = state.history[`${cycle}-1`].winner;
    return `請輸入第 ${cycle} 循環 第 2 場 (勝者 隊 ${w1} vs 隊 3) 比分 (格式 A:B)：`;
  } else if (match === 3) {
    const l1 = state.history[`${cycle}-1`].loser;
    return `請輸入第 ${cycle} 循環 第 3 場 (敗者 隊 ${l1} vs 隊 3) 比分 (格式 A:B)：`;
  }
  return "";
}


function doPost(e) {
  let replyToken = null;
  let tokenConsumed = false;
  let userId = 'unknown';
  let userMessage = '';

  try {
    const rawBody = e && e.postData && e.postData.contents;
    if (!rawBody) {
      console.log("Webhook received without a request body");
      return HtmlService.createHtmlOutput("OK");
    }

    const json = JSON.parse(rawBody);
    const events = json.events || [];

    if (events.length === 0) {
      console.log("Webhook verification: empty events");
      return HtmlService.createHtmlOutput("OK");
    }

    const event = events[0];
    userId = event.source && event.source.userId || 'unknown';
    
    const cache = CacheService.getScriptCache();
    const dedupKey = 'webhook_' + event.timestamp + '_' + userId;
    if (cache.get(dedupKey) === 'processed') {
      console.log('Duplicate event detected, skipping: ' + dedupKey);
      return HtmlService.createHtmlOutput('OK');
    }
    cache.put(dedupKey, 'processed', 300);

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
    userMessage = event.message.text.trim();

    let replyText = "";
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // 1. 開始紀錄指令
    if (userMessage === "開始紀錄" || userMessage === "紀錄比賽") {
      clearCycleState(userId);
      const newState = {
        date: new Date().toISOString().split('T')[0],
        cycle: 1,
        match: 1,
        teams: {},
        history: {}
      };
      saveCycleState(userId, newState);
      replyText = handleStartRecord(spreadsheet, 1);
    }
    
    // 2. 接收抽籤登記（包含冒號格式且尚未開始比分）
    else if (userMessage.includes(":") || userMessage.includes("：")) {
      let state = getCycleState(userId);
      
      // 💡 1. 精準定義：這是不是一個純比分？（例如 "25:19" 或 "1-1 25:19"）
      const isPureScore = /^(?:\d+[-_#]\d+\s+)?\d+[:：]\d+$/.test(userMessage.trim());
      
      // 💡 2. 精準定義：這是不是登記名單？（只要不是純比分，且有狀態，就認定是填寫名單）
      const isRegistration = !isPureScore && state;
      console.log(userMessage);
      if (isRegistration) {
        try {
          // 💡 重大修正：如果你輸入名單時，發現目前的 match 已經打到第 3 場結束了，
          // 說明這是球友手動或系統提示要進入「全新下一個循環」，在此自動將場次重設回 1 並清空舊名單。
          if (state.match > 3 || (state.history[`${state.cycle}-3`])) {
            state.cycle += 1;
            state.match = 1;
            state.teams = {};
          } else if (state.match !== 1) {
            // 安全防護：如果比賽打到一半（例如第 2 場），突然輸入名字，提示不能亂改名單
            replyText = `❌ 目前正在進行第 ${state.cycle} 循環第 ${state.match} 場比賽，無法在中途更改隊伍名單！若要重新開始請輸入【開始紀錄】。`;
            // 這裡直接中斷，不執行下面的解析
            throw new Error("MATCH_IN_PROGRESS");
          }

          const teams = parseTeamRegistration(userMessage);
          state.teams = teams;
          // 確保開始新循環時 match 一定是 1
          state.match = 1; 
          saveCycleState(userId, state);
          
          replyText = `✅ 第 ${state.cycle} 循環 隊伍登記完成！\n`;
          replyText += `隊 1: ${teams["1"].join(", ") || "(無)"}\n`;
          replyText += `隊 2: ${teams["2"].join(", ") || "(無)"}\n`;
          replyText += `隊 3: ${teams["3"].join(", ") || "(無)"}\n\n`;
          replyText += getNextMatchDescription(state);
        } catch (err) {
          if (err.message !== "MATCH_IN_PROGRESS") {
            replyText = `❌ 抽籤解析失敗：${err.message}`;
          }
        }
      } else {
        // ==========================================
        // ➔ 進入【比分記錄流程】（當 isPureScore 為 true 時強制走這）
        // ==========================================
        if (/^\d+[:：]\d+$/.test(userMessage.trim())) {
          // 自動循環賽比分輸入
          if (!state || Object.keys(state.teams).length === 0) {
            replyText = "❌ 尚未進行隊伍抽籤登記！請先輸入【開始紀錄】。";
          } else {
            const [wScoreStr, lScoreStr] = userMessage.split(/[:：]/);
            const wScore = parseInt(wScoreStr, 10);
            const lScore = parseInt(lScoreStr, 10);
            
            if (isNaN(wScore) || isNaN(lScore)) {
              replyText = "❌ 請輸入有效的數字比分，例如：25:18";
            } else if (wScore === lScore) {
              replyText = "❌ 排球比賽不可平手，請輸入勝負比分！";
            } else {
              const actualWinnerScore = Math.max(wScore, lScore);
              const actualLoserScore = Math.min(wScore, lScore);
              const diff = actualWinnerScore - actualLoserScore;
              
              let winnerTeam = "", loserTeam = "";
              const cycle = state.cycle;
              const match = state.match;
              
              if (match === 1) {
                winnerTeam = (wScore > lScore) ? "1" : "2";
                loserTeam = (wScore > lScore) ? "2" : "1";
              } else if (match === 2) {
                const prevW = state.history[`${cycle}-1`].winner;
                winnerTeam = (wScore > lScore) ? prevW : "3";
                loserTeam = (wScore > lScore) ? "3" : prevW;
              } else if (match === 3) {
                const prevL = state.history[`${cycle}-1`].loser;
                winnerTeam = (wScore > lScore) ? prevL : "3";
                loserTeam = (wScore > lScore) ? "3" : prevL;
              }
              
              // 記錄戰績到 history
              state.history[`${cycle}-${match}`] = {
                winner: winnerTeam,
                loser: loserTeam,
                score: `${actualWinnerScore}:${actualLoserScore}`,
                diff: diff
              };

              // 💡 在這之後，原本你的程式碼會處理寫入試算表
              // 並且在第 3 場結束時提示輸入下一輪名單
              // （請保留你原本後續的 recordSheet 寫入與狀態更新程式碼...）

              
              // 寫入 Google 試算表「每局對戰紀錄」
              const playerSheet = spreadsheet.getSheetByName("球員名冊");
              const recordSheet = spreadsheet.getSheetByName("每局對戰紀錄");
              const playerData = playerSheet.getDataRange().getValues();
              const recordData = recordSheet.getDataRange().getValues();
              
              const nameToIdMap = {};
              for (let i = 1; i < playerData.length; i++) {
                nameToIdMap[playerData[i][1]] = playerData[i][0];
              }
              
              const existingRowMap = {};
              for (let r = 1; r < recordData.length; r++) {
                const k = recordData[r][0] + "-" + recordData[r][2] + "-" + recordData[r][3];
                if (existingRowMap[k] === undefined) existingRowMap[k] = r;
              }
              
              const winMembers = state.teams[winnerTeam] || [];
              const loseMembers = state.teams[loserTeam] || [];
              
              let nextRowNum = recordData.length + 1;
              const lock = LockService.getScriptLock();
              lock.waitLock(5000);
              try {
                for (const mName of winMembers) {
                  const pId = nameToIdMap[mName];
                  if (!pId) continue;
                  const key = cycle + "-" + match + "-" + pId;
                  const foundRow = existingRowMap[key];
                  if (foundRow !== undefined) {
                    recordSheet.getRange(foundRow + 1, 1).setValue(state.date);
                    recordSheet.getRange(foundRow + 1, 6).setValue(1);
                    recordSheet.getRange(foundRow + 1, 7).setValue(diff);
                    recordSheet.getRange(foundRow + 1, 8).setValue(`${actualWinnerScore}:${actualLoserScore}`);
                  } else {
                    const newRow = nextRowNum++;
                    recordSheet.getRange(newRow, 1).setValue(state.date);
                    recordSheet.getRange(newRow, 2).setValue(cycle);
                    recordSheet.getRange(newRow, 3).setValue(match);
                    recordSheet.getRange(newRow, 4).setValue(pId);
                    recordSheet.getRange(newRow, 5).setValue(mName);
                    recordSheet.getRange(newRow, 6).setValue(1);
                    recordSheet.getRange(newRow, 7).setValue(diff);
                    recordSheet.getRange(newRow, 8).setValue(`${actualWinnerScore}:${actualLoserScore}`);
                    recordSheet.getRange(newRow, 9).setFormula(`=E${newRow}&"-"&A${newRow}`);
                    existingRowMap[key] = newRow - 1;
                  }
                }
                
                // 敗隊成員 0分，-diff
                for (const mName of loseMembers) {
                  const pId = nameToIdMap[mName];
                  if (!pId) continue;
                  const key = cycle + "-" + match + "-" + pId;
                  const foundRow = existingRowMap[key];
                  if (foundRow !== undefined) {
                    recordSheet.getRange(foundRow + 1, 1).setValue(state.date);
                    recordSheet.getRange(foundRow + 1, 6).setValue(0);
                    recordSheet.getRange(foundRow + 1, 7).setValue(-diff);
                    recordSheet.getRange(foundRow + 1, 8).setValue(`${actualWinnerScore}:${actualLoserScore}`);
                  } else {
                    const newRow = nextRowNum++;
                    recordSheet.getRange(newRow, 1).setValue(state.date);
                    recordSheet.getRange(newRow, 2).setValue(cycle);
                    recordSheet.getRange(newRow, 3).setValue(match);
                    recordSheet.getRange(newRow, 4).setValue(pId);
                    recordSheet.getRange(newRow, 5).setValue(mName);
                    recordSheet.getRange(newRow, 6).setValue(0);
                    recordSheet.getRange(newRow, 7).setValue(-diff);
                    recordSheet.getRange(newRow, 8).setValue(`${actualWinnerScore}:${actualLoserScore}`);
                    recordSheet.getRange(newRow, 9).setFormula(`=E${newRow}&"-"&A${newRow}`);
                    existingRowMap[key] = newRow - 1;
                  }
                }
              } finally {
                lock.releaseLock();
              }
              
              replyText = `✅ 第 ${cycle} 循環 第 ${match} 場記錄完成！\n`;
              replyText += `🏆 勝隊：隊 ${winnerTeam} (${winMembers.join(", ") || "無"})\n`;
              replyText += `❌ 敗隊：隊 ${loserTeam} (${loseMembers.join(", ") || "無"})\n`;
              replyText += `📊 比數：${actualWinnerScore}:${actualLoserScore} (分差 +${diff})\n\n`;
              
              // 推進賽程
              if (match < 3) {
                state.match += 1;
                saveCycleState(userId, state);
                replyText += getNextMatchDescription(state);
              } else {
                // 當前循環完成 (match === 3)
                if (cycle < 3) {
                  replyText += `✅ (${state.date}) 第 ${cycle} 循環 完成紀錄！\n\n`;
                  state.cycle += 1;
                  state.match = 1;
                  state.teams = { "1": [], "2": [], "3": [] }; // 進入下個循環需重新抽籤
                  saveCycleState(userId, state);
                  replyText += `👉 請進行【第 ${state.cycle} 循環】抽籤登記：\n` + handleStartRecord(spreadsheet, state.cycle);
                } else {
                  // 3個循環共9場全部完成
                  clearCycleState(userId);
                  replyText += `🎉 (${state.date}) 今日 3 循環共 9 場紀錄全部完成！排行榜已更新。`;
                }
              }
            }
          }
        } else {
          replyText = "❌ 格式無法辨識。若要登記抽籤請使用「姓名:編號」，若要輸入比分請使用「A:B」。";
        }
      }
    }
    
    // 3. 取消成員單局紀錄（格式：取消紀錄:姓名:循環-場次）
    else if (userMessage.startsWith("取消紀錄:")) {
      const parts = userMessage.split(":");
      if (parts.length < 3) {
        replyText = "❌ 格式錯誤！請使用「取消紀錄:姓名:循環-場次」，例如：取消紀錄:李明緯:1-2";
      } else {
        const name = parts[1];
        const matchInfo = parts[2].split("-");
        if (matchInfo.length < 2) {
          replyText = "❌ 格式錯誤！請使用「取消紀錄:姓名:循環-場次」，例如：取消紀錄:李明緯:1-2";
        } else {
          const cycle = matchInfo[0];
          const match = matchInfo[1];
          const sheet = spreadsheet.getSheetByName("每局對戰紀錄");
          const data = sheet.getDataRange().getValues();
          let foundRow = -1;

          for (let i = 1; i < data.length; i++) {
            // data[i][4] 是姓名, data[i][1] 是循環, data[i][2] 是場次
            if (data[i][4] === name && String(data[i][1]) === cycle && String(data[i][2]) === match) {
              foundRow = i + 1;
              break;
            }
          }

          if (foundRow !== -1) {
            const lock = LockService.getScriptLock();
            lock.waitLock(5000);
            try {
              sheet.getRange(foundRow, 6).setValue(0);      // 積分歸零
              sheet.getRange(foundRow, 7).setValue(0);      // 正負值歸零
              sheet.getRange(foundRow, 8).setValue("已取消"); // 比分標註
              replyText = `✅ 已成功取消 ${name} 在第 ${cycle} 循環 第 ${match} 場的個人紀錄！`;
            } finally {
              lock.releaseLock();
            }
          } else {
            replyText = `❌ 找不到 ${name} 在第 ${cycle} 循環 第 ${match} 場的紀錄，請確認資料是否正確。`;
          }
        }
      }
    }
    
    // 4. 查詢戰績（格式：姓名-場次）
    else if (/^.+- \d+$/.test(userMessage) || /^.+-[-]?\d+$/.test(userMessage)) {
      const sheet = spreadsheet.getSheetByName("每局對戰紀錄");
      const data = sheet.getDataRange().getValues();
      let found = false;
      let totalWin = 0;
      let totalLose = 0;
      let plusMinus = 0;
      let lastScore = "";
      let lastDate = "";

      for (let i = 1; i < data.length; i++) {
        if (data[i][8] == userMessage) {
          found = true;
          totalWin += Number(data[i][5]);
          totalLose += (Number(data[i][5]) === 0) ? 1 : 0;
          plusMinus += Number(data[i][6]);
          lastScore = data[i][7];
          lastDate = data[i][1];
        }
      }

      if (found) {
        const parts = userMessage.split("-");
        replyText = `🏐 ${parts[0]} 第 ${parts[1]} 場\n`;
        if (lastDate) replyText += `📅 比賽日期：${lastDate}\n`;
        replyText += `🟢 勝局：${totalWin}\n🔴 敗局：${totalLose}\n📊 正負值：${plusMinus >= 0 ? "+" : ""}${plusMinus}\n`;
        if (lastScore) replyText += `🎾 原始比數：${lastScore}\n`;
        replyText += `獲得積分：${totalWin} 分！`;
      } else {
        replyText = "❌ 找不到該場次戰績，請確認格式是否正確（例如：李明緯-1）。";
      }
    }
    
    // 4. 查詢排行榜
    else if (userMessage === "查詢排行" || userMessage === "排行") {
      const sheet = spreadsheet.getSheetByName("季賽總排行榜");
      let data = sheet.getDataRange().getValues();

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
      
      players.sort((a, b) => b.score - a.score || b.attendance - a.attendance || b.diff - a.diff);
      
      for (let i = 0; i < players.length; i++) {
        players[i].rank = i + 1;
        sheet.getRange(i + 2, 1).setValue(players[i].rank);
      }
      
      for (let i = 0; i < Math.min(players.length, 12); i++) {
        const p = players[i];
        let medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : "🏐";
        replyText += `\n${medal} 第 ${p.rank} 名：${p.name}\n   🔥 積分：${p.score} 分 ｜ 🏃‍♂️ 出席：${p.attendance} 次\n   📊 正負值：${p.diff >= 0 ? "+" : ""}${p.diff}\n`;
      }
    }
    
    // 5. 說明選單
    else {
      replyText = "🤖 歡迎使用龍蝦循環賽記錄機器人！\n\n💡 快速指令：\n1.【開始紀錄】：啟動每日 3 循環自動賽事。\n2.【排行】：查看季賽總排行榜。\n3.【姓名-場次】：查詢個人戰績（例：李明緯-1）。";
    }

    tokenConsumed = true;
    sendLineReply(replyToken, replyText);

  } catch (err) {
    console.error("=== ERROR IN doPost ===");
    console.error(err.stack || err);

    logToSheet(
      "ERROR",
      userId,
      typeof userMessage !== "undefined" ? userMessage : "UNKNOWN",
      err.message || String(err),
      err.stack || ""
    );

    if (replyToken && !tokenConsumed) {
      try {
        tokenConsumed = true;
        sendLineReply(replyToken, "❌ 系統處理失敗，請稍後再試。");
      } catch (sendErr) {
        console.error("Failed to send error reply: " + sendErr);
      }
    }
  }

  return HtmlService.createHtmlOutput("OK");
}

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
    console.error("logToSheet failed: " + e.toString());
  }
}

function sendLineReply(replyToken, replyText) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const options = {
    'method': 'post',
    'muteHttpExceptions': true,
    'headers': {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN
    },
    'payload': JSON.stringify({
      'replyToken': replyToken,
      'messages': [{'type': 'text', 'text': replyText}]
    })
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      console.log(`LINE API Error: ${response.getContentText()}`);
    }
  } catch (fetchErr) {
    console.log(`Fetch error: ${fetchErr.toString()}`);
  }
}

function triggerAuth() {
  SpreadsheetApp.getActiveSpreadsheet();
  UrlFetchApp.fetch("https://line.me", { 'method': 'post', 'muteHttpExceptions': true });
}
