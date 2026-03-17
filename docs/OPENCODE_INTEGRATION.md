# TimeStream + OpenCode Integration Specification

## Overview

This document outlines the integration between TimeStream (desktop time tracking app) and OpenCode (AI coding agent) to track developer learning sessions and coding activities.

---

## 1. Problem Statement

Developers using AI coding assistants like OpenCode need to track:
- Time spent on coding tasks
- Learning from AI interactions
- Code changes and contributions
- Session-based productivity metrics

---

## 2. Integration Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   OpenCode      │────▶│  Session Data   │────▶│   TimeStream    │
│   (AI Agent)    │     │  (JSON File)    │     │   (Importer)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │  Dashboard &    │
                                                │  Analytics      │
                                                └─────────────────┘
```

### Data Flow
1. OpenCode executes and logs session events
2. Session data saved to `~/.timestream/opencode-sessions.json`
3. TimeStream monitors file and imports on sync
4. Activities displayed in dashboard with "opencode" source tag

---

## 3. Data Schema

### Session Record

```json
{
  "sessionId": "uuid-v4",
  "startTime": "2026-03-17T10:30:00Z",
  "endTime": "2026-03-17T11:45:00Z",
  "duration": 4500000,
  "source": "opencode",
  "taskType": "feature",
  "description": "Add user authentication flow",
  "model": "claude-sonnet-4-20250514",
  "modelProvider": "anthropic",
  "files": [
    {
      "path": "src/auth/login.ts",
      "action": "modified",
      "additions": 45,
      "deletions": 12,
      "language": "typescript"
    },
    {
      "path": "src/auth/hooks.ts",
      "action": "created",
      "additions": 30,
      "deletions": 0,
      "language": "typescript"
    }
  ],
  "git": {
    "commits": 2,
    "branches": ["main", "feature/auth"],
    "merges": 0
  },
  "commands": [
    "npm run dev",
    "git commit -m 'add login'",
    "npm test"
  ],
  "metrics": {
    "interactions": 12,
    "tokensUsed": 45000,
    "errorsEncountered": 3,
    "filesOpened": 8,
    "contextSwitches": 15
  },
  "tags": ["learning", "ai-assist"],
  "metadata": {
    "projectPath": "/home/devanshu/my-app",
    "projectName": "my-app",
    "opencodeVersion": "1.0.0"
  }
}
```

### Activity Record (TimeStream Format)

```json
{
  "id": "uuid-v4",
  "title": "Add user authentication flow",
  "url": "file:///home/devanshu/my-app",
  "source": "opencode",
  "category": "Coding",
  "timestamp": "2026-03-17T10:30:00Z",
  "duration": 4500000,
  "dedupKey": "opencode:session:uuid-v4",
  "metadata": {
    "taskType": "feature",
    "model": "claude-sonnet-4-20250514",
    "filesModified": 2,
    "linesAdded": 75,
    "linesDeleted": 12,
    "language": "typescript",
    "interactions": 12,
    "tags": ["learning", "ai-assist"]
  }
}
```

---

## 4. Tracking Capabilities

### 4.1 Session Tracking

| Metric | Description |
|--------|-------------|
| Session ID | Unique identifier |
| Start/End Time | When session began and ended |
| Duration | Total time in milliseconds |
| Task Type | bug-fix, feature, refactor, research, docs, test, other |
| Description | User-defined or auto-generated session description |

### 4.2 Code Activity

| Metric | Description |
|--------|-------------|
| Files Modified | Count and details of changed files |
| Lines Added | Total new lines of code |
| Lines Deleted | Total removed lines of code |
| Languages Used | Programming languages worked on |
| File Types | Extensions of modified files |

### 4.3 Git Integration

| Metric | Description |
|--------|-------------|
| Commits Made | Number of commits in session |
| Branches | Branches created/switched |
| Merges | Number of merges |
| Commit Messages | Recent commit subjects |

### 4.4 AI Interaction

| Metric | Description |
|--------|-------------|
| Model Used | LLM name (Claude, GPT, Gemini, etc.) |
| Model Provider | anthropic, openai, google, etc. |
| Interactions | Number of prompt/response exchanges |
| Tokens Used | Approximate token consumption |
| Context Window | Max tokens of model |

### 4.5 Productivity Metrics

| Metric | Description |
|--------|-------------|
| Errors Encountered | Debug/error count |
| Files Opened | Total files accessed |
| Context Switches | File-to-file transitions |
| Commands Executed | Shell commands run |

### 4.6 Learning Insights

| Metric | Description |
|--------|-------------|
| Task Category | Classification (Learning, Coding, Research, etc.) |
| Tags | Custom tags (learning, ai-assist, debugging) |
| Session Type | Feature work, bug fix, exploration |

---

## 5. Implementation Components

### 5.1 OpenCode Session Logger

**Location**: OpenCode plugin or wrapper script

**Responsibilities**:
- Hook into OpenCode lifecycle events
- Collect session metrics in real-time
- Write to session data file

**Events to Track**:
1. `session_start` - Initialize session
2. `file_changed` - Track file modifications
3. `command_executed` - Log terminal commands
4. `ai_interaction` - Log prompt/response
5. `session_end` - Finalize and save session

### 5.2 TimeStream Importer

**Location**: `src/importers/opencode.js`

**Responsibilities**:
- Read session data from JSON file
- Transform to TimeStream activity format
- Deduplicate based on session ID
- Import into main data store

**Process**:
1. Monitor `~/.timestream/opencode-sessions.json`
2. On file change, parse new entries
3. Filter already-imported sessions (by sessionId)
4. Convert and merge into activities
5. Mark sessions as imported

### 5.3 Dashboard Display

**Location**: `renderer/pages/opencode.html`

**Components**:
1. **Session List** - Chronological list of OpenCode sessions
2. **Session Detail** - Expandable view with full metrics
3. **Statistics Cards** - Total time, sessions, files modified
4. **Learning Timeline** - Visual representation of coding journey
5. **Category Breakdown** - Pie chart of task types

---

## 6. UI Mockup

### OpenCode Sessions View

```
┌─────────────────────────────────────────────────────────────────┐
│  OpenCode Sessions                              [Filter ▼] [📅] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔵 Today, March 17, 2026                    Total: 3h 45m│   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ 10:30 AM - Add user authentication         Claude 4      │   │
│  │ Feature Development • 45 min • 2 files    +75 -12      │   │
│  │                                                         │   │
│  │ 02:15 PM - Fix login redirect bug          Claude 4     │   │
│  │ Bug Fix • 30 min • 1 file                   +20 -5      │   │
│  │                                                         │   │
│  │ 04:00 PM - Research API integration          Gemini 2   │   │
│  │ Research • 1h 30m • 0 files                  -          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📊 This Week                                              │
│  │                                                           │
│  │  Mon  Tue  Wed  Thu  Fri  Sat  Sun                      │
│  │  ▓▓   ▓▓   ▓▓   ▓▓   ▓▓    -    -                        │
│  │  2h   3h   4h   2h   1h                            ⏱ 12h │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌────────────────────┐  ┌────────────────────┐                │
│  │ 📁 Files Modified  │  │ 🤖 Model Usage     │                │
│  │        24          │  │ Claude: 80%        │                │
│  │                    │  │ Gemini: 20%        │                │
│  └────────────────────┘  └────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### Session Detail Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  Session: Add user authentication              ✕               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📅 March 17, 2026 • 10:30 AM - 11:15 AM (45 min)              │
│  🤖 Model: Claude Sonnet 4                                     │
│  📂 Project: /home/devanshu/my-app                             │
│                                                                 │
│  ──────────────────────────────────────────────────────────    │
│                                                                 │
│  📝 Description                                                │
│  Implement JWT authentication with login/logout flows           │
│                                                                 │
│  ──────────────────────────────────────────────────────────    │
│                                                                 │
│  📊 Metrics                                                    │
│  ┌─────────────────┬─────────────────┬─────────────────┐     │
│  │ Interactions    │ Tokens Used     │ Errors          │     │
│  │      12         │    45,000       │       3         │     │
│  └─────────────────┴─────────────────┴─────────────────┘     │
│                                                                 │
│  📁 Files Changed (2)                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ src/auth/login.ts         [+45, -12]  ✏️ Modified      │   │
│  │ src/auth/hooks.ts         [+30, -0]   ✨ Created        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🔧 Commands Executed (3)                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ npm run dev                                             │   │
│  │ git commit -m "add login"                               │   │
│  │ npm test                                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🏷️ Tags                                                       │
│  [learning] [ai-assist] [feature]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Configuration

### TimeStream Config (`config.json`)

```json
{
  "integrations": {
    "opencode": {
      "enabled": true,
      "sessionFile": "~/.timestream/opencode-sessions.json",
      "autoImport": true,
      "importInterval": 60000,
      "defaultCategory": "Coding",
      "trackCommands": true,
      "trackAiInteraction": true
    }
  }
}
```

### OpenCode Config (for logger)

```json
{
  "timetrack": {
    "enabled": true,
    "outputPath": "~/.timestream/opencode-sessions.json",
    "includeCommands": true,
    "includeFiles": true,
    "includeAiMetrics": true,
    "defaultTaskType": "feature"
  }
}
```

---

## 8. File Structure

```
TimeStream/
├── src/
│   ├── importers/
│   │   └── opencode.js          # Session importer
│   ├── processors/
│   │   └── sessionProcessor.js # Data transformation
│   └── services/
│       └── fileWatcher.js       # Monitor session file
├── renderer/
│   ├── pages/
│   │   └── opencode.html        # Sessions dashboard
│   ├── components/
│   │   ├── SessionCard.js
│   │   ├── SessionDetail.js
│   │   └── OpenCodeStats.js
│   └── styles/
│       └── opencode.css
├── config/
│   └── opencode.json             # Default config
└── docs/
    └── OPENCODE_INTEGRATION.md   # This file
```

---

## 9. Installation & Setup

### Step 1: Enable Integration in TimeStream

```bash
# Via TimeStream settings UI
Settings > Integrations > OpenCode > Enable
```

### Step 2: Configure OpenCode (Optional)

Create `~/.opencode/config.json`:

```json
{
  "timetrack": {
    "enabled": true,
    "outputPath": "~/.timestream/opencode-sessions.json"
  }
}
```

### Step 3: Verify Connection

```bash
# Run a test session in OpenCode
opencode "Hello, track this session"

# Check if data is being written
cat ~/.timestream/opencode-sessions.json
```

### Step 4: Sync in TimeStream

- Auto-sync: Every 60 seconds (configurable)
- Manual sync: Click "Sync Now" in dashboard

---

## 10. Future Enhancements

### Phase 2
- **Real-time sync** - Live activity streaming
- **Commit attribution** - Link code to AI sessions
- **Learning recommendations** - Based on time tracked

### Phase 3
- **Multiple AI agents** - Support for Claude Code, Cursor, etc.
- **Team analytics** - Aggregate team learning data
- **Export reports** - PDF/CSV learning reports

### Phase 4
- **AI cost tracking** - Estimate API costs per session
- **Quality metrics** - Code review scores
- **Integration with GitHub** - PR/issue time tracking

---

## 11. Acceptance Criteria

- [ ] OpenCode sessions are logged to JSON file
- [ ] TimeStream imports sessions as activities
- [ ] Sessions display in dashboard with correct metadata
- [ ] Filter by date, task type, model works
- [ ] Statistics (total time, files, etc.) are accurate
- [ ] Deduplication prevents duplicate imports
- [ ] Works with Chrome & Firefox extensions

---

## 12. Related Documents

- [TimeStream UI Specification](./timestream_ui_specification.md)
- [Chrome Extension Documentation](./chrome-extension/README.md)
- [Data Import Format](./docs/IMPORT_FORMAT.md)

---

*Last Updated: March 17, 2026*
*Version: 1.0.0*
