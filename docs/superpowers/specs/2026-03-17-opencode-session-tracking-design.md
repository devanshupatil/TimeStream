# OpenCode Session Tracking — Design Spec

**Date:** 2026-03-17
**Version:** 1.1.0
**Status:** Approved

---

## Goal

Collect OpenCode CLI sessions from a developer's system, extract what was learned, and show the developer **"What I Learned Today"** — a daily view of their sessions with titles, summaries, errors fixed, and tags.

---

## Architecture

```
Developer's System
├── OpenCode CLI runs normally
└── ~/.opencode/sessions/           ← session files saved here automatically
        <session-id>.json
        <session-id>.json

TimeStream App (Electron)
├── FileWatcher Service             ← src/services/fileWatcher.js
│   ├── uses chokidar to watch ~/.opencode/sessions/
│   ├── debounces file writes (retries on partial JSON)
│   └── calls Session Importer on stable new files
├── Session Importer                ← src/importers/opencode.js
│   ├── parses raw OpenCode session file
│   ├── extracts: title, summary, errors, tags
│   ├── deduplicates by sessionId
│   └── saves to userData/opencode-sessions.json
├── IPC Layer (main.js + preload.js)
│   ├── ipcMain.handle('get-opencode-sessions', date)
│   └── mainWindow.webContents.send('opencode-session-imported', session)
└── App Storage (app.getPath('userData'))
        opencode-sessions.json      ← all sessions, array

TimeStream Dashboard (renderer/index.html)
└── data-page="opencode" section
    ├── Daily session cards with title + summary
    └── Yesterday / Tomorrow navigation
```

---

## OpenCode Source File Format

OpenCode saves sessions to `~/.opencode/sessions/<id>.json`. Each file has this structure:

```json
{
  "id": "abc123",
  "title": "Fix missing module error in Node server",
  "createdAt": "2026-03-17T10:30:00Z",
  "updatedAt": "2026-03-17T11:15:00Z",
  "messages": [
    {
      "role": "user",
      "content": "I'm getting this error: Cannot find module 'express'",
      "createdAt": "2026-03-17T10:30:05Z"
    },
    {
      "role": "assistant",
      "content": "This error means the express package isn't installed. Run `npm install express` to fix it.",
      "createdAt": "2026-03-17T10:30:10Z"
    }
  ]
}
```

**Fallback handling if fields are missing:**

| Missing Field | Fallback |
|---------------|----------|
| `title` | First 60 chars of first user message |
| `createdAt` | File `mtime` (filesystem modified time) |
| `updatedAt` | File `mtime` |
| No assistant messages | Use first user message as summary |

---

## Stored Session Schema

Each session stored in `opencode-sessions.json` (inside `app.getPath('userData')`):

```json
{
  "sessionId": "abc123",
  "date": "2026-03-17",
  "startTime": "10:30:00",
  "endTime": "11:15:00",

  "title": "Fix missing module error in Node server",

  "errors": [
    {
      "message": "Cannot find module 'express'",
      "fixed": true
    }
  ],
  "errorsFixed": 2,

  "summary": "This error means the express package isn't installed. Run npm install express to fix it.",

  "tags": ["node.js", "npm", "modules"],

  "filesChanged": ["src/server.js", "package.json"],

  "source": "opencode"
}
```

### Extraction Rules (No API Cost)

| Field | Source |
|-------|--------|
| `sessionId` | `id` field from source file |
| `title` | `title` field from source file (or fallback) |
| `startTime` | `createdAt` from source file (or file mtime) |
| `endTime` | `updatedAt` from source file (or file mtime) |
| `summary` | Last `role: "assistant"` message content |
| `errors` | Scan all messages for error patterns (e.g. `Error:`, `cannot find`, `failed`, `exception`) |
| `errorsFixed` | Count of error-pattern messages followed by a successful assistant response |
| `tags` | Keywords extracted from error messages + file extensions (.js → "javascript") |
| `filesChanged` | File paths mentioned in any message (regex: `/[\w./-]+\.\w{1,5}/g`) |

---

## IPC Contract

### New IPC Channels (main.js)

```js
// Get all sessions, optionally filtered by date (YYYY-MM-DD)
ipcMain.handle('get-opencode-sessions', (_, date) => { ... })

// Push newly imported session to renderer in real time
mainWindow.webContents.send('opencode-session-imported', sessionObject)
```

### New preload.js Entries

```js
getOpencodeSessions: (date) => ipcRenderer.invoke('get-opencode-sessions', date),
onOpenCodeSessionImported: (cb) => ipcRenderer.on('opencode-session-imported', (_, s) => cb(s)),
```

### New opencode-sessions.json Storage File

```js
const OPENCODE_FILE = path.join(app.getPath('userData'), 'opencode-sessions.json');
// Initialized to [] on first run (same pattern as activities.json)
```

---

## FileWatcher Flow

```
TimeStream starts
       ↓
chokidar.watch('~/.opencode/sessions/', { ignoreInitial: false })
       ↓
File 'add' or 'change' event fires
       ↓
Debounce: wait 500ms for write to settle
       ↓
Try to JSON.parse the file
  → SyntaxError? Retry up to 3x with 500ms delay, then log warning and skip
       ↓
Already imported? (check sessionId in OPENCODE_FILE) → Skip silently
       ↓
Extract: title, summary, errors, tags, filesChanged
       ↓
Append to opencode-sessions.json
       ↓
mainWindow.webContents.send('opencode-session-imported', session)
       ↓
Renderer updates "What I Learned Today" dashboard live
```

### Error Handling

| Situation | Behaviour |
|-----------|-----------|
| Session file unreadable | Skip, log warning |
| Partial/malformed JSON | Retry up to 3x (500ms apart), then skip with warning |
| No assistant messages found | Use first user message content as summary |
| Duplicate `sessionId` | Skip silently |
| `~/.opencode/sessions/` missing | Show "Connect OpenCode" prompt in dashboard, retry watch every 30s |

---

## Renderer — Dashboard Page

The OpenCode view is added as a **new `data-page` section inside the existing `renderer/index.html`** (consistent with current architecture — no separate HTML file).

New navigation item added to the existing sidebar, and a new `<div data-page="opencode">` section added alongside existing pages.

### "What I Learned Today" UI

```
┌─────────────────────────────────────────────┐
│  What I Learned Today  — March 17, 2026     │
├─────────────────────────────────────────────┤
│  3 Sessions  •  5 Errors Fixed              │
├─────────────────────────────────────────────┤
│                                             │
│  10:30 AM                                   │
│  "Fix missing module error in Node server"  │
│  ┌─────────────────────────────────────┐    │
│  │ This error means the express package│    │
│  │ isn't installed. Run npm install.   │    │
│  │                                     │    │
│  │ Tags: [node.js] [npm] [modules]     │    │
│  │ Errors Fixed: 2                     │    │
│  │ Files: src/server.js, package.json  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  02:15 PM                                   │
│  "Debug JWT token expiry in auth middleware"│
│  ┌─────────────────────────────────────┐    │
│  │ JWT tokens expire because...        │    │
│  │                                     │    │
│  │ Tags: [auth] [jwt] [express]        │    │
│  │ Errors Fixed: 3                     │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  [← Yesterday]              [Tomorrow →]   │
└─────────────────────────────────────────────┘
```

---

## Dependencies

One new dependency required:

```bash
npm install chokidar   # runtime dependency — goes into "dependencies", NOT "devDependencies"
```

`chokidar` is the standard Node.js file watcher — more reliable than `fs.watch` on Linux and macOS (handles atomic writes, symlinks, and polling edge cases). It runs in the Electron main process at runtime, so it must be in `dependencies`.

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/services/fileWatcher.js` | **Create** | chokidar watcher + debounce + retry logic |
| `src/importers/opencode.js` | **Create** | Parse session, extract fields, deduplicate |
| `src/main.js` | **Modify** | Add `OPENCODE_FILE`, `get-opencode-sessions` IPC, init fileWatcher |
| `src/preload.js` | **Modify** | Add `getOpencodeSessions` + `onOpenCodeSessionImported` |
| `renderer/index.html` | **Modify** | Add sidebar nav item + `data-page="opencode"` section |
| `renderer/js/opencode.js` | **Create** | Dashboard logic — load sessions, render cards, date nav |
| `renderer/styles/opencode.css` | **Create** | Session card styles |

---

## Out of Scope

- AI model used (not tracked)
- Token usage (not tracked)
- GitHub issues/tickets (not tracked)
- Raw terminal output (not tracked)
- Session cost estimation (not tracked)

---

## Acceptance Criteria

- [ ] FileWatcher detects new OpenCode session files automatically on app start
- [ ] Each session stored with title, summary, errors, tags, filesChanged
- [ ] Summary extracted from Claude's last response (no new API call)
- [ ] Duplicate sessions are never imported twice (deduplicated by sessionId)
- [ ] Dashboard shows all sessions for selected day with title + summary
- [ ] "Yesterday / Tomorrow" date navigation works
- [ ] Daily stats show total sessions + total errors fixed
- [ ] Partial/malformed JSON retried 3x before skipping
- [ ] "Connect OpenCode" prompt shown when `~/.opencode/sessions/` is missing
- [ ] New sessions appear in dashboard live without page refresh
