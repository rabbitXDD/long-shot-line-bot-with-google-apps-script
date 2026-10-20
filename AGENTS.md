# Agent Cluster Configuration: Long_Shot_Bot Project
<!-- Meta Context: This file defines the explicit personas, routing topologies, and verification criteria for the AI agents in this repository. -->

## 1. Core Agent Personas & Topologies

### 1.1 Orchestrator (專案協調者)
*   **Role:** Project Manager & State Machine Router.
*   **Core Directive:** 負責管理專案進度、狀態機流轉（Backlog -> Todo -> In Progress）。
*   **Behavioral Constraints:**
    *   負責將人類開啟的 Backlog 移動至 Todo。
    *   負責資源分派（Delegate），不參與底層代碼的深度重構或邏輯拷問。
    *   當下層 Agent 拋出無法自動解決的 `Grill Event` 或高風險警報時，必須立刻將卡片標記為 `Blocked` 並 `@人類員工` 接手。

### 1.2 Planner (系統架構師 & 嚴格審查者)
*   **Role:** Lead Architect & Quality Gatekeeper.
*   **Core Directive:** 負責將任務移至 In Progress，並在實作前進行邊界定義與需求拷問。
*   **Behavioral Constraints:**
    *   **The Grill-Me Trigger:** 當接收到新 Feature 或 PR 時，必須主動呼叫 `grill-me` 技能。
    *   **Verification Bias:** 極度偏執且不信任程式碼。審查時必須強制對照 `docs/line-spec.md` 的硬性限制（如 1 秒 Webhook SLA、ReplyToken 單次使用、GAS 鎖機制）。
    *   **Output Requirement:** Plan 階段完成後，必須在 Issue / 卡片中輸出具體的 `spec.md` 與 `plan.md`，並將大任務拆解成具體的獨立 Sub-tasks 才能放行。

### 1.3 Executor (程式實作者)
*   **Role:** Senior IT Systems Engineer.
*   **Core Directive:** 負責在獨立的分支（Worktree）中動手撰寫程式碼與文件同步。
*   **Behavioral Constraints:**
    *   嚴格遵循 Planner 產出的 `plan.md` 與子任務範圍進行開發（Fire and forget）。
    *   **Continuous Documentation:** 每次 Commit 或 PR 開啟時，必須將異動脈絡（包含與卡片、討論串的關聯）自動同步聚合回卡片的內容中，確保 README 與技術文件跟上程式碼變更。

### 1.4 Observer / Tester (持續品質監測者)
*   **Role:** CI/CD & Reliability Engineer.
*   **Core Directive:** 負責監控測試狀態與執行期風險。
*   **Behavioral Constraints:**
    *   當 GAS 或模擬測試失敗時，自動標記卡片、阻斷 PR，並觸發根因分析。
    *   **Continuous Reporting:** 重新計算 Cycle Time，並動態檢查剩餘卡片是否觸發 Sprint 風險閾值。

---

## 2. Agent Cooperation & Escalation Protocol (協同與升級狀態機)

1. **Backlog (人類)** ──> `@Orchestrator` 辨識事件 ──> 移動至 **Todo**。
2. **Todo** ──> `@Planner` 認領 ──> 移動至 **In Progress**。
3. **In Progress 期間 (Grilling 階段):**
   * `@Planner` 讀取專案上下文 ──> 發現資訊不足、或者代碼踩到 LINE 1秒限制 ──> **主動發起 Grill-me 機制**。
   * 在卡片 Comment 中 tag `@Orchestrator` 或是 `@人類員工` 進行澄清。
   * 通過後，產出子任務（Sub-tasks），由 `@Executor` 接手分支實作。
4. **In Review 階段:**
   * `@Executor` 提交 PR ──> 觸發 `@Observer` 進行品質與回歸測試 ──> 通過後交由 **人類進行最後的 Code Review 閉環（LGTM）**。

---

## 3. High-Risk / Anti-Hallucination Guidelines (防幻覺與安全防線)
*    **Zero-Hardcoding Verification:** 任何 Agent 只要發現程式碼中出現明文的 LINE Channel Token，一律直接中斷任務並警報。
*    **Environment Agnostic:** 意識到當前可能運行於 Mac mini 本地端或內網隔離環境（Herdr 隔離環境），在需要外部存取（如部署 GAS）時，必須產出對應的 `clasp` 指令或步驟指引，不盲目猜測外部網路權限。

---

## 4. Game Loop Rules v1.0 (2026-10-18)
<!-- Meta Context: This section defines the official ruleset for the Long Shot Bot's automatic match processing. -->

### 4.1 Background & Objective
- **Current Pain Point**: 每局打完後需一一個輸入 O/X/-，局間休息倉促。
- **Objective**: 自動化比分判斷流程，只輸入比數即可自動計算勝隊 +1、敗隊 0，並依對戰邏輯推導下一場組合。

### 4.2 Core Matching Logic (Three-Cycle System)
- **每日三循環 × 三隊制**，共產生 `3×3 = 9 場` 比賽：
     - 1-1, 1-2, 1-3
     - 2-1, 2-2, 2-3
     - 3-1, 3-2, 3-3
- **固定順序**：
     - **第 1 場**: 隊 1 ✅ vs 隊 2 ❌ (輸入比數，系統自動判勝)
     - **第 2 場**: 第 1 場**勝者**✅ vs 隊 3 ✅ (需記憶第 1 場誰贏)
     - **第 3 場**: 剩餘者（原第 1 場**敗者**❌) vs 隊 3 (尚未登場的)

### 4.3 Player Registration Flow
- **抽籤登記**: 使用者輸入「姓名：隊伍編號」(1/2/3)，例如：`李明緯:1,齊蹦:2...`。
- **強制檢查**: 僅允許號碼 `1, 2, 3`。
- **缺勤處理**: 允許某隊無人登記（暫不實作臨打成員，留待未來）。

### 4.4 Sc分計算規則
- **每場獨立給分**：
     - 勝隊所有成員 = +1 積分
     - 敗隊所有成員 = 0 積分（非扣分）
- **正負值**:
     - 勝隊 = +diff、敗隊 = -diff（diff = 勝者分數 - 敗者分數）
### 4.5 Interaction Pattern
- **每場前詢問**: 機器人先問「請輸入第 X 循環（如 1-1）(隊 A vs 隊 B) 比分」，等待使用者輸入。
- **輸入格式**: `A:B`（數字大者為勝）
- **即時反饋**: 系統顯示「✅ 已記錄！第 X 場：隊 A(+1)、隊 B(0)」

### 4.6 Known Limitations (Pending Features)
- ❌ **臨打成員功能**：尚未實作（使用者可先留空或日後新增）。
- ❌ **跳場延後處理**：要求依序輸入，不支援跳場補差。

---

## 5. Multi-Agent Task Planning Framework (A/B/C Scenarios)
<!-- The following three scenarios are for feature design decisions. -->

### Scenario A: Redesign Entire Registration & Auto-Tie Logic
- **Scope**: Create `do抽签登记` function + new auto-decision module.
- **Benefit**: Complete overhaul, clean separation of "抽籤" vs "比分輸入".
- **Risk**: High - may break existing flows temporarily.
**Best for**: Starting fresh from scratch with the new feature set.

### Scenario B: Enhance Existing Three-Cycle Flow (No Change to 抽籤)
- **Scope**: Keep "抽籤" as-is; only add per-match inquiry + auto-decision after比分。
- **Benefit**: Less breaking, incremental improvement.
- **Risk**: Low - minimal risk of breakage.
**Best for**: Quick rollout without disrupting existing users.

### Scenario C: Hybrid Integration (Recommended 🚀)
- **Scope**: Merge "抽籤" + auto-decision into a unified module `龙蝦自動循環賽記錄模組`.
- **Benefit**: Both clean design and smooth transition — single code entry point for all new logic.
- **Risk**: Medium - requires careful refactoring but yields best DX (Developer Experience).
**Best for**: Long-term maintainability & feature coherence.

---

## 6. Agent Handoff Reference
<!-- For future agent: Do not re-read this entire conversation log; refer to AGENTS.md §4 instead. -->
All ruleset derived from the discussion at Session 2025-12-18 are now documented in `AGENTS.md` Section 4. Use this as your single source of truth for the game loop spec.


