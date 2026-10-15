# LINE Bot Messaging API Technical Specification (v1.0)
<!-- Meta Context: This document serves as the structural source of truth for AI agent verification. Any code change or PR must satisfy all constraints below. -->

## 1. Webhook Core Constraints & Telemetry

### 1.1 The 1-Second Response SLA (Critical)
*   **Rule:** The Webhook URL must return an HTTP status code `200 OK` **within 1,000 milliseconds** after receiving a POST request from the LINE platform.
*   **Timeout Mitigation:** Any business logic, database queries, heavy LLM inference, or `UrlFetchApp` operations that might exceed **800ms** MUST be offloaded to an asynchronous task runner, worker thread, or a decoupled queue (e.g., triggering a background GAS execution via script properties or external execution token).
*   **Agent Verification Goal:** Analyze the implementation path. If any `doPost(e)` block contains synchronous, long-running tasks without an immediate `200 OK` flush, fail the review and trigger a grilling event.

### 1.2 Channel Access Token Lifecycle Management
*   **Token Source:** `LINE_ACCESS_TOKEN` must be securely injected via environment variables or encrypted script properties. **Never hardcode raw tokens in the codebase.**
*   **Validation:** Every outbound API call to `https://line.me` or `push` must explicitly check token integrity.

---

## 2. Token Security & State Idempotency

### 2.1 ReplyToken Single-Use & Expiration
*   **Ephemeral Nature:** A `replyToken` is string-based, highly dynamic, and **expires within 1 minute** of the webhook event trigger.
*   **Strict Mutex Rule:** A `replyToken` can be consumed **exactly once**. Any subsequent attempt to re-use the same token for a secondary response will throw an API error and result in a silent failure or broken UX.
*   **Agent Verification Goal:** 
    *   Inspect conditional statements (`if/else`). Ensure a single transaction path does not accidentally invoke `sendLineReply()` twice using the same token.
    *   If multi-stage processing or fallback handling is required, the logic must either transition to the `push` API (`/bot/message/push`) or explicitly aggregate all reply text components into a single array payload before hitting the `/reply` endpoint.

### 2.2 Idempotency & Duplicate Request Filtering
*   **Network Retries:** LINE webhooks may resend the exact same event under network instability.
*   **Deduplication Strategy:** Implement an idempotency check layer. The combination of `event.timestamp` + `event.source.userId` (or the `x-line-signature`) should be checked against a lightweight cache/state store to prevent double-processing.

---

## 3. Google Apps Script (GAS) Execution Safeguards

### 3.1 Authorization & Manifest Declarations
*   **Scopes:** The `appsscript.json` manifest must explicitly declare OAuth scopes required for network traffic and sheet manipulation:
    *   `https://googleapis.com` (Required for `UrlFetchApp` to LINE API)
    *   `https://googleapis.com` (Required for ledger updates)
*   **Silent Failures:** The agent must verify that any exception caught inside `doPost(e)` is caught within a `try/catch` wrapper that logs to an external diagnostic endpoint or dedicated sheet, as standard GAS execution logs will not display under anonymous webhook triggers.

### 3.2 Concurrency & Mutex Locking
*   **Race Conditions:** When writing to columns (e.g., scoring ledger, record updates), a `LockService.getScriptLock()` must be requested with a minimum **5-second timeout** to ensure serial execution.

---

## 4. Agent Grilling Prompts (Behavioral Triggers)
<!-- This section informs the grill-me skill on how to construct its critique questions. -->
*   *If code updates a spreadsheet inside `doPost`:* "Wait, I notice you are writing to a Google Sheet before replying to LINE. Have you guaranteed that this disk I/O will complete within the 1-second webhook SLA? What happens if `LockService` blocks?"
*   *If an error fallback triggers a second reply:* "Look at this catch block. You are trying to use the same `replyToken` to send an error message to the user. This token was already consumed in the try block! Are you sure you shouldn't switch to a Push Message here?"

