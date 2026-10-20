# Task: New Three-Cycle Match Scoring Module (A/B/C Design Options)

> **Objective**: Design and implement an automated match scoring module for the Long Shot Bot that handles 3-cycle × 3-team matches with automatic win/loss determination.

---

## Background Rules (Already Documented in `AGENTS.md` §4)

### Core Loop Logic
- **Daily Match Structure**: 3 cycles × 3 teams = 9 matches total (`1-1, 1-2, 1-3, 2-1, 2-2, 2-3, 3-1, 3-2, 3-3`)
- **Fixed Sequence**:
  - Match 1: Team 1 vs Team 2 (Input score → Auto-determine winner)
  - Match 2: Winner of Match 1 vs Team 3
  - Match 3: Loser of Match 1 (remaining) vs Team 3

### Scoring Rules
- **Each match**: Winner team gets +1 point for all members, loser team gets 0 points.
- **Point differential**: Winner = +diff, Loser = -diff (where diff = winner score - loser score).

### Registration Flow
- **抽签登记**: Users input `name:team_id` (1/2/3), e.g., `李明緯:1,齊蹦:2...`
- **Validation**: Only allow team IDs `{1, 2, 3}`.
- **Absent handling**: Teams can be empty (no real-time substitute handling for now).

### Interaction Pattern
- **Pre-match inquiry**: "Please enter score for cycle X (e.g., 1-1): Team A vs Team B → input `A:B`"
- **Immediate feedback**: "✅ Recorded! Match X: Team A(+1), Team B(0)"

---

## Scenario A: Independent New Function Design (Redesign First)

### Scope
Create a standalone `do抽签登记 + do比分輸入` function that completely refactors the existing registration → score-entry flow.

### Benefits
- ✅ Clean separation of concerns: 抽籤 vs 比分輸入 fully decoupled
- ✅ Easy to test and debug new auto-decision logic independently
- ✅ Minimal risk to existing features (old flow preserved until explicitly switched)

### Risks
- ⚠️ Requires users to adopt new registration mechanism (breaking change for existing workflows)
- ⚠️ May introduce complexity if old functionality needs to coexist

### Implementation Approach
1. Add `do抽签登记( userId, userMessage)` function that validates team IDs {1, 2, 3}.
2. Store team assignments in ScriptProperties using `pendingRecord_${userId}`.
3. Add new message handler for比分输入 format like "第 X 循環 比分 A:B".
4. Implement auto-win-logic: parse score → compare A vs B → determine winner/loser → assign +1/0 points.
5. Store daily match state in ScriptProperties (cycle, round, current_winner).

---

## Scenario B: Incremental Enhancement (Keep Existing 抽籤)

### Scope
Keep the `O/X/-` registration mechanism as-is; only add per-match score inquiry with automatic win/loss determination after比分 input.

### Benefits
- ✅ Low risk: Existing user experience unchanged
- ✅ Quick rollout: Minimal code changes (add auto-decision to existing flow)
- ✅ No breaking changes for current users

### Risks
- ⚠️ May feel inconsistent: Old O/X/- registration coexisting with new比分 auto-decision
- ⚠️ Requires hybrid handling of old vs new flows (temp complexity)

### Implementation Approach
1. Keep `doPost` logic for score recording (功能 2 / 功能 3).
2. Add a new pre-match inquiry layer: check if message matches比分 format → auto-detect winner/loser.
3. Store cycle state in ScriptProperties with backward-compatible keys.
4. Enhance existing Team ID parsing to support `{1, 2, 3}` validation (no breaking change).

---

## Scenario C: Unified Hybrid Module (Recommended 🚀)

### Scope
Merge "抽籤登记" + auto-decision into a unified module `龙虾自动循环赛记录模组`, creating a single entry point for all new logic.

### Benefits
- ✅ Best Developer Experience: Single code path for both registration and auto-decision
- ✅ Clean transition from old to new flow (can phase out old mechanism)
- ✅ Future-proof: Easy to extend with features like 临打 Members，跳場 Delay Handling

### Risks
- ⚠️ Medium complexity: Requires careful refactoring of existing `doPost` → `sendLineReply` path
- ⚠️ Requires upfront planning to avoid breaking critical paths

### Implementation Approach
1. Create a new module file `long-shot-bot-cycles.js` with functions:
   - `register抽签(userId, message)` → Validates team IDs, stores assignments
   - `processMatchScore(userId, message, currentCycleState)` → Auto-detects winner/loser by comparing A vs B
   - `updateDailyProgress(userId, cycleId)` → Tracks daily 3-cycle state
2. Integrate into existing `doPost` function:
   - Detect 抽籤 format (`name:id`), call `register抽签`.
   - Detect比分 format (`A:B`), call `processMatchScore`.
3. Add automatic opponent logic for next matches (Winner vs Team 3, Loser vs Team 3).
4. Replace old O/X/- registration path eventually (but keep coexistence temporarily).

---

## Recommendation Summary

| Scenario | Best For | Risk Level |
|---|---|---|
| **A** | New feature starting fresh from scratch | High (breaking) |
| **B** | Quick rollout without disruption | Low (incremental) |
| **C** 🚀 | Long-term maintainability & DX | Medium (refactoring) |

### Decision Criteria
- If prioritizing **speed + stability**: Choose **Scenario B**.
- If prioritizing **clean architecture + future-proofing**: Choose **Scenario C**.
- If starting with **brand new feature** (not modifying existing flow): Choose **Scenario A**.

---

## Next Steps

1. Please select which scenario to proceed with (A, B, or C recommended).
2. Once selected, I will generate detailed sub-tasks with file modifications list, dependencies, and verification checks.
