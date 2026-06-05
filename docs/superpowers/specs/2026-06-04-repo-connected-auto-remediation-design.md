# OpsAgents: Repo-Connected Auto-Remediation

**Date:** 2026-06-04  
**Status:** Approved  
**Scope:** New feature extending the existing OpsAgents simulation server

---

## 1. Problem Statement

The existing OpsAgents system can detect errors via the embedded EPG HTTP service and auto-trigger the
7-agent pipeline. However, it has no connection to the real source repository of the target service.
When a code defect is identified, the CodeFixAgent creates an empty commit — no real file is changed.
For non-code incidents, the pipeline produces recommendations but nothing is applied.

This feature closes that gap: given a GitHub repo URL, OpsAgents clones it, discovers where the service
writes logs, watches those logs for errors, and when the threshold triggers the pipeline it either applies
a real code patch (for code defects) or executes an automated remediation (for infra/config incidents).
All reasoning and actions are displayed in the UI, with an executive summary panel always visible after
each incident.

---

## 2. Architecture

```
User inputs GitHub repo (owner/repo)
        │
        ▼
┌─────────────────────┐
│   RepoConnector     │  gh repo clone → temp dir; auto-discover log paths
└────────┬────────────┘
         │ RepoConfig { cloneDir, repoSlug, logPaths[], language }
         ▼
┌─────────────────────┐
│   LogWatcher        │  fs.watch + readline; language-agnostic error parsing
│                     │  emits ErrorRecord { errorType, message, file, line, stackTrace }
└────────┬────────────┘
         │ ErrorRecord
         ▼
┌─────────────────────┐
│  ErrorWatchdog      │  existing — rolling 60s window; fires pipeline at threshold
└────────┬────────────┘
         │ auto-trigger with ErrorRecord in ServiceInputs
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpsAgents Pipeline (existing 7 agents)                         │
│  IssueId → RootCause → CodeFix → RiskAssessment → Remediation  │
│  → Reporting → ExecComms → [Escalation if needed]              │
└────────┬────────────────────────────────────────────────────────┘
         │
         ├── Root cause = CODE DEFECT
         │         └── PatchAgent (new)
         │               • Reads file:line from ErrorRecord
         │               • Applies heuristic text patch
         │               • git diff → staged (not committed)
         │               • Streams diff to UI via SSE
         │               • User clicks "Push & Open Draft PR"
         │               • POST /api/push-pr → commit → push → gh pr create --draft
         │
         ├── Root cause = OTHER, CAN automate
         │         └── AutoRemediationAgent (new)
         │               • Writes config fix (pool size, retry config, etc.)
         │               • git diff → staged
         │               • "Push & Open Draft PR" button
         │
         └── Root cause = OTHER, CANNOT automate
                   └── EscalationAgent (existing)
                         • Full reasoning hierarchy streamed to UI
                         • Manual fix steps listed
```

---

## 3. New Components

### 3.1 RepoConnector (`packages/agents/reliability/src/repo-connector.ts`)

**Responsibility:** Clone a GitHub repo and discover log file locations.

**Inputs:** `owner/repo` string, optional `GITHUB_TOKEN` env var for private repos.

**Process:**
1. Run `gh repo clone owner/repo /tmp/opsagents-<slug>-<ts>` (idempotent — skip if already cloned)
2. Scan the clone for log configuration using these signals (in priority order):

| Language | Signal |
|---|---|
| Node.js / TypeScript | `winston`/`pino`/`log4js` in `package.json`; `transports.File(` or `FileHandler(` in source; `LOG_FILE=` in `.env` |
| Java | `log4j.properties`, `logback.xml`, `log4j2.xml`, `logging.properties` |
| Python | `logging.basicConfig(filename=`, `FileHandler(` in `.py` files |
| C / C++ | `fopen(.*\.log`, `fprintf(logfile` in source |
| Generic | `LOG_FILE=`, `LOG_PATH=`, `LOG_DIR=` in any config or env file |
| Fallback | `logs/` directory; any `*.log` files present in repo root |

**Output:** `RepoConfig` interface:
```typescript
interface RepoConfig {
  cloneDir: string;       // absolute path to local clone
  repoSlug: string;       // "owner/repo"
  logPaths: string[];     // absolute paths to log files to watch
  language: string;       // detected primary language
  defaultBranch: string;  // e.g. "main"
}
```

---

### 3.2 LogWatcher (`packages/agents/reliability/src/log-watcher.ts`)

**Responsibility:** Tail log files and parse error lines into structured `ErrorRecord` objects.

**Interface:**
```typescript
interface ErrorRecord {
  ts: number;
  errorType: string;       // e.g. "TypeError", "NullPointerException", "SIGSEGV"
  message: string;         // first line of error
  file?: string;           // source file from stack trace (absolute path in clone)
  line?: number;           // line number
  column?: number;
  stackTrace: string[];    // raw stack trace lines
  logFile: string;         // which log file this came from
  language: string;        // detected from context
}
```

**Error detection rules:**

| Pattern | Languages |
|---|---|
| `ERROR`, `FATAL`, `CRITICAL` (log level) | All |
| `Exception`, `Error:`, `panic:`, `fatal:` | All |
| `at com.`, `at java.`, `Caused by:` | Java |
| `Traceback (most recent call last)`, `File "...", line N` | Python |
| `Segmentation fault`, `Aborted`, `core dumped` | C/C++ |
| `at Object.`, `TypeError:`, `ReferenceError:` | Node.js |

**Stack frame parsing:** Extracts `file:line[:col]` from the first non-framework stack frame.
Framework frames are those whose path contains `node_modules`, `java.`, `sun.`, `jdk.`,
`<anonymous>`, `internal/`, or `dist/` (transpiled output). The first frame NOT matching
these patterns is used as the fault location.
- Node.js: `at functionName (path/to/file.ts:42:10)`
- Java: `at com.example.MyClass.method(MyClass.java:42)`
- Python: `File "path/to/file.py", line 42`
- C: `#0  0x0000... in functionName (file.c:42)`

**Feed to watchdog:** Each `ErrorRecord` is passed to `ErrorWatchdog.record()` as a 500-status record.
The `ErrorRecord` is stored in a shared map keyed by timestamp so the pipeline can retrieve it.

---

### 3.3 PatchAgent (`packages/agents/reliability/src/patch-agent.ts`)

**Responsibility:** Apply a heuristic text patch to the fault line identified in the stack trace.

**Slot in pipeline:** Runs after `CodeFixAgent`. Skipped if root cause is not a code defect.
When a real repo clone is connected, PatchAgent takes over all git operations — CodeFixAgent's
`git checkout -b / commit / push / gh pr create` steps are bypassed (CodeFixAgent still runs for
RCA classification but returns early after producing its `patch_summary` output).

**Heuristic patch rules:**

| Error Pattern | Language | Patch Applied |
|---|---|---|
| `Cannot read properties of null`, `NullPointerException` | Any | Null guard before the access |
| `undefined is not a function`, `NoSuchMethodError` | Any | Existence check before the call |
| `IndexOutOfBoundsException`, `index out of range` | Any | Bounds check before array access |
| `FileNotFoundException`, `ENOENT` | Any | try/catch or existence check |
| `StackOverflowError`, `Maximum call stack` | Any | Recursion depth guard |
| Fallback | Any | Wrap fault line in try/catch with error logging |

**Process:**
1. Read `ErrorRecord` from pipeline shared state
2. Open `ErrorRecord.file` in the clone directory
3. Extract lines `[line-5, line+5]` as context window
4. Apply patch rule — mutate only the fault line and ±1 lines
5. Write file back
6. Run `git -C cloneDir diff` to capture unified diff string
7. Run `git -C cloneDir add <file>` to stage (do NOT commit)
8. Return `PatchResult { diff, file, line, patchType, branch, cloneDir }`

**Branch naming:** `fix/auto-<errorType>-<timestamp>` (e.g. `fix/auto-null-pointer-1717488000000`)

**Output streamed via SSE event:** `patch:ready { diff, file, line, branch, patchType }`

---

### 3.4 AutoRemediationAgent (`packages/agents/reliability/src/auto-remediation.ts`)

**Responsibility:** Apply automated non-code fixes for infra/config root causes.

**Supported remediations:**

| Root Cause | Action |
|---|---|
| DB pool exhausted | Find pool size config; multiply by 5; write file |
| Traffic surge | Write scale-out recommendation to `ops/scaling-advice.md` |
| Config missing/drift | Copy `.env.example` → `.env` with sane defaults |
| Upstream service down | Find retry config; increase retry count + add circuit-breaker comment |
| Memory pressure | Write heap dump script + restart recommendation to `ops/memory-runbook.md` |

If no automated fix is applicable, returns `{ canAutomate: false }` → triggers EscalationAgent.

---

## 4. Modified: simulation-server.ts

New endpoints:

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/connect-repo` | Clone repo, discover logs, return `RepoConfig` |
| `POST` | `/api/start-watching` | Start `LogWatcher` on discovered log paths |
| `POST` | `/api/stop-watching` | Stop log watching |
| `POST` | `/api/push-pr` | Commit staged patch, push branch, `gh pr create --draft`. Uses server-side `currentPatch` state (`PatchResult`) set when `patch:ready` was emitted — no body required. |
| `GET`  | `/api/repo-status` | Current `RepoConfig` + watcher state |

New SSE events:

| Event | Payload |
|---|---|
| `repo:connected` | `RepoConfig` |
| `repo:log-discovered` | `{ path, language }` |
| `log:error` | `ErrorRecord` |
| `log:info` | `{ message, ts, logFile }` |
| `patch:ready` | `{ diff, file, line, branch, patchType }` |
| `patch:pushed` | `{ branch, prUrl, prNumber }` |
| `remediation:applied` | `{ action, file, diff }` |
| `reasoning:tree` | Full agent result tree (for escalation path) |
| `exec:summary` | `ExecutiveCommunicationAgent` output |

---

## 5. UI Changes (`opsagents-simulator.html`)

### 5.1 Repo Connection Bar (replaces auto-detect bar)
```
[ GitHub Repo: owner/repo ] [🔗 Connect]  ● Cloned  Lang: TypeScript
Logs: logs/app.log, logs/error.log                  [▶ Start Watching]  [⏹ Stop]
```

### 5.2 Live Log Stream (left panel, replaces scenario list)
- Scrolling terminal-style log feed
- Error lines highlighted red, INFO lines grey
- Live watchdog counter: `⚡ Watchdog: 3/5 errors (60s window)`

### 5.3 Code Diff Viewer (middle panel, shown after `patch:ready`)
- Unified diff with red/green line highlighting
- File path + line number header
- `[📤 Push & Open Draft PR]` button
- `[✗ Discard]` button

### 5.4 Reasoning Hierarchy (middle panel, shown for non-code escalations)
- Collapsible tree: each agent as a node with status icon (✓/✗/⚠)
- Clicking a node expands its inputs + outputs
- Manual fix steps listed at bottom as numbered checklist

### 5.5 Executive Summary Panel (always shown after pipeline completes)
- Card with: Issue / Customer Impact / Root Cause / Action Taken / Action In Progress / Next Update
- Populated from `ExecutiveCommunicationAgent` output
- Severity badge (🔴 CRITICAL / 🟠 HIGH / 🟡 MEDIUM)

---

## 6. Data Flow Summary

```
1. User enters owner/repo → POST /api/connect-repo
2. RepoConnector clones repo → discovers log paths
3. SSE: repo:connected, repo:log-discovered (×N)
4. User clicks "Start Watching" → POST /api/start-watching
5. LogWatcher tails log files
6. Error appears in log → LogWatcher emits ErrorRecord
7. SSE: log:error → UI highlights line red
8. ErrorWatchdog threshold breached → pipeline fires
9. SSE: auto:detected → pipeline events stream
10a. Code defect: PatchAgent patches file → SSE: patch:ready → diff shown in UI
10b. Non-code (can automate): AutoRemediationAgent → SSE: remediation:applied → diff shown
10c. Non-code (cannot automate): EscalationAgent → SSE: reasoning:tree → manual steps shown
11. ExecCommunicationAgent fires → SSE: exec:summary → Executive Summary panel updates
12. User clicks "Push & Open Draft PR" → POST /api/push-pr
13. SSE: patch:pushed { prUrl } → PR link shown in UI
```

---

## 7. Out of Scope

- Running the cloned service's test suite before pushing the PR
- Multi-repo support (one repo at a time)
- Non-GitHub git hosts (GitLab, Bitbucket)
- LLM-assisted patching
- Automatic PR merge (human review always required)

---

## 8. Open Questions

None — all resolved during design session.
