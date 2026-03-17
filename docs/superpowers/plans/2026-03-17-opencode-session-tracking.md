# OpenCode Session Tracking Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Watch `~/.opencode/sessions/`, import each session into TimeStream storage, and display a "What I Learned Today" dashboard showing session titles, summaries, errors fixed, and tags.

**Architecture:** A `fileWatcher` service uses chokidar to monitor `~/.opencode/sessions/`. On new/changed files it calls the `opencode` importer which parses the session, extracts fields rule-based (no API cost), deduplicates by sessionId, and saves to `opencode-sessions.json` in Electron's userData. The renderer shows sessions in a `data-page="opencode"` section inside the existing `index.html`.

**Tech Stack:** Electron 28, Node 20, chokidar (runtime dep), node:test + node:assert (built-in, no install needed)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/importers/opencode.js` | Create | Pure functions: parse raw session → stored format, extract fields, deduplicate |
| `src/services/fileWatcher.js` | Create | chokidar watcher, debounce, retry on partial JSON, calls importer |
| `src/main.js` | Modify | Add OPENCODE_FILE constant, init fileWatcher, add `get-opencode-sessions` IPC handler |
| `src/preload.js` | Modify | Expose `getOpencodeSessions` + `onOpenCodeSessionImported` via contextBridge |
| `renderer/styles/opencode.css` | Create | Session card, tags, stats bar styles |
| `renderer/index.html` | Modify | Add sidebar nav item + `data-page="opencode"` section with card template |
| `renderer/js/opencode.js` | Create | Load sessions, render cards, date navigation, live update listener |
| `tests/importers/opencode.test.js` | Create | Unit tests for all importer pure functions |
| `tests/services/fileWatcher.test.js` | Create | Unit tests for debounce + retry logic |

---

## Task 1: Add chokidar + test script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install chokidar as runtime dependency**

```bash
cd "/home/devanshu/TimeStream " && npm install chokidar
```

Expected: `chokidar` appears in `"dependencies"` in `package.json`.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "node --test --recursive tests/"
```

Note: `--recursive` is more reliable than glob expansion — it finds all `*.test.js` files under `tests/` even when the directory is empty or on shells that don't expand `**`.

- [ ] **Step 3: Create test directories**

```bash
mkdir -p "/home/devanshu/TimeStream /tests/importers"
mkdir -p "/home/devanshu/TimeStream /tests/services"
```

- [ ] **Step 4: Commit**

```bash
git -C "/home/devanshu/TimeStream " add package.json package-lock.json
git -C "/home/devanshu/TimeStream " commit -m "chore: add chokidar runtime dependency and test script"
```

---

## Task 2: Session Importer (`src/importers/opencode.js`)

**Files:**
- Create: `src/importers/opencode.js`
- Create: `tests/importers/opencode.test.js`

### Step 1: Write the failing tests

- [ ] **Create `tests/importers/opencode.test.js`**

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { extractSession, isDuplicate, extractErrors, extractTags, extractFiles } = require('../../src/importers/opencode.js');

const SAMPLE_RAW = {
  id: 'abc123',
  title: 'Fix missing module error in Node server',
  createdAt: '2026-03-17T10:30:00Z',
  updatedAt: '2026-03-17T11:15:00Z',
  messages: [
    { role: 'user', content: "I'm getting this error: Cannot find module 'express'", createdAt: '2026-03-17T10:30:05Z' },
    { role: 'assistant', content: 'Run npm install express to fix it.', createdAt: '2026-03-17T10:30:10Z' }
  ]
};

describe('extractSession', () => {
  it('maps id to sessionId', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.sessionId, 'abc123');
  });

  it('uses title from source', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.title, 'Fix missing module error in Node server');
  });

  it('falls back to first 60 chars of first user message when title missing', () => {
    const raw = { ...SAMPLE_RAW, title: undefined };
    const s = extractSession(raw, '/fake/path', Date.now());
    assert.ok(s.title.startsWith("I'm getting this error"));
  });

  it('uses last assistant message as summary', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.summary, 'Run npm install express to fix it.');
  });

  it('falls back to first user message when no assistant messages', () => {
    const raw = { ...SAMPLE_RAW, messages: [{ role: 'user', content: 'hello', createdAt: '2026-03-17T10:30:00Z' }] };
    const s = extractSession(raw, '/fake/path', Date.now());
    assert.equal(s.summary, 'hello');
  });

  it('sets source to opencode', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.source, 'opencode');
  });

  it('sets date from createdAt', () => {
    const s = extractSession(SAMPLE_RAW, '/fake/path', Date.now());
    assert.equal(s.date, '2026-03-17');
  });
});

describe('isDuplicate', () => {
  it('returns true when sessionId exists', () => {
    assert.equal(isDuplicate('abc123', [{ sessionId: 'abc123' }]), true);
  });

  it('returns false when sessionId not present', () => {
    assert.equal(isDuplicate('xyz999', [{ sessionId: 'abc123' }]), false);
  });

  it('returns false for empty array', () => {
    assert.equal(isDuplicate('abc123', []), false);
  });
});

describe('extractErrors', () => {
  it('detects error patterns in messages', () => {
    const msgs = [
      { role: 'user', content: "Cannot find module 'express'" },
      { role: 'assistant', content: 'Run npm install.' }
    ];
    const errors = extractErrors(msgs);
    assert.equal(errors.length, 1);
    assert.ok(errors[0].message.includes('Cannot find module'));
    assert.equal(errors[0].fixed, true);
  });

  it('returns empty array when no errors', () => {
    const msgs = [{ role: 'user', content: 'hello world' }];
    assert.deepEqual(extractErrors(msgs), []);
  });
});

describe('extractTags', () => {
  it('extracts tags from file extensions', () => {
    const tags = extractTags([], ['src/server.js', 'package.json']);
    assert.ok(tags.includes('javascript'));
    assert.ok(tags.includes('json'));
  });

  it('extracts npm tag from error messages', () => {
    const tags = extractTags([{ message: 'Cannot find module express' }], []);
    assert.ok(tags.includes('npm'));
  });
});

describe('extractFiles', () => {
  it('finds file paths in message content', () => {
    const msgs = [{ role: 'user', content: 'Error in src/server.js line 10' }];
    const files = extractFiles(msgs);
    assert.ok(files.includes('src/server.js'));
  });

  it('returns empty array when no file paths', () => {
    const msgs = [{ role: 'user', content: 'hello world' }];
    assert.deepEqual(extractFiles(msgs), []);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd "/home/devanshu/TimeStream " && npm test 2>&1 | head -20
```

Expected: `Error: Cannot find module '../../src/importers/opencode.js'`

- [ ] **Step 3: Create `src/importers/opencode.js`**

```js
'use strict';
const fs = require('fs');
const path = require('path');

const ERROR_PATTERNS = [
  /error:/i, /cannot find/i, /failed/i, /exception/i,
  /undefined is not/i, /syntaxerror/i, /typeerror/i,
  /referenceerror/i, /enoent/i, /permission denied/i,
  /module not found/i, /unexpected token/i,
];

const EXTENSION_TO_TAG = {
  '.js': 'javascript', '.ts': 'typescript', '.py': 'python',
  '.go': 'golang', '.rs': 'rust', '.css': 'css', '.html': 'html',
  '.json': 'json', '.md': 'markdown', '.sh': 'shell',
};

const KEYWORD_TAGS = [
  { pattern: /npm|node_modules|package\.json/i, tag: 'npm' },
  { pattern: /docker|dockerfile/i, tag: 'docker' },
  { pattern: /git\s/i, tag: 'git' },
  { pattern: /jest|test|spec/i, tag: 'testing' },
  { pattern: /auth|jwt|token|session/i, tag: 'auth' },
  { pattern: /express|fastify|koa/i, tag: 'express' },
  { pattern: /react|jsx|tsx/i, tag: 'react' },
  { pattern: /typescript|\.ts\b/i, tag: 'typescript' },
];

function extractErrors(messages) {
  const errors = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;
    const matched = ERROR_PATTERNS.find(p => p.test(msg.content));
    if (!matched) continue;
    const nextIsAssistant = messages[i + 1] && messages[i + 1].role === 'assistant';
    errors.push({ message: msg.content.slice(0, 120), fixed: nextIsAssistant });
  }
  return errors;
}

function extractTags(errors, filesChanged) {
  const tags = new Set();
  // From file extensions
  filesChanged.forEach(f => {
    const ext = path.extname(f).toLowerCase();
    if (EXTENSION_TO_TAG[ext]) tags.add(EXTENSION_TO_TAG[ext]);
  });
  // From error messages
  const allText = errors.map(e => e.message).join(' ');
  KEYWORD_TAGS.forEach(({ pattern, tag }) => {
    if (pattern.test(allText)) tags.add(tag);
  });
  return [...tags];
}

function extractFiles(messages) {
  const FILE_RE = /(?:^|\s)([\w./\\-]+\.\w{1,5})/g;
  const found = new Set();
  messages.forEach(msg => {
    let m;
    while ((m = FILE_RE.exec(msg.content)) !== null) {
      const f = m[1].trim();
      if (f.length > 3) found.add(f);
    }
  });
  return [...found];
}

function extractSession(raw, filePath, fileMtime) {
  const messages = Array.isArray(raw.messages) ? raw.messages : [];

  // Title with fallback
  let title = raw.title;
  if (!title) {
    const firstUser = messages.find(m => m.role === 'user');
    title = firstUser ? firstUser.content.slice(0, 60) : 'Untitled Session';
  }

  // Times with fallback to file mtime
  const mtimeISO = new Date(fileMtime).toISOString();
  const createdAt = raw.createdAt || mtimeISO;
  const updatedAt = raw.updatedAt || mtimeISO;

  // Summary: last assistant message, or first user message
  const assistantMsgs = messages.filter(m => m.role === 'assistant');
  const summary = assistantMsgs.length > 0
    ? assistantMsgs[assistantMsgs.length - 1].content
    : (messages[0] ? messages[0].content : '');

  const errors = extractErrors(messages);
  const filesChanged = extractFiles(messages);
  const tags = extractTags(errors, filesChanged);

  return {
    sessionId: raw.id || path.basename(filePath, '.json'),
    date: createdAt.split('T')[0],
    startTime: createdAt.split('T')[1]?.slice(0, 8) || '00:00:00',
    endTime: updatedAt.split('T')[1]?.slice(0, 8) || '00:00:00',
    title,
    summary,
    errors,
    errorsFixed: errors.filter(e => e.fixed).length,
    tags,
    filesChanged,
    source: 'opencode',
  };
}

function isDuplicate(sessionId, storedSessions) {
  return storedSessions.some(s => s.sessionId === sessionId);
}

function loadSessions(storageFile) {
  try {
    return JSON.parse(fs.readFileSync(storageFile, 'utf8'));
  } catch {
    return [];
  }
}

function saveSession(session, storageFile) {
  const sessions = loadSessions(storageFile);
  if (isDuplicate(session.sessionId, sessions)) return false;
  sessions.push(session);
  fs.writeFileSync(storageFile, JSON.stringify(sessions, null, 2));
  return true;
}

module.exports = { extractSession, isDuplicate, extractErrors, extractTags, extractFiles, saveSession, loadSessions };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd "/home/devanshu/TimeStream " && npm test 2>&1 | grep -E "pass|fail|ok"
```

Expected: All tests pass (`ok`), no failures.

- [ ] **Step 5: Commit**

```bash
git -C "/home/devanshu/TimeStream " add src/importers/opencode.js tests/importers/opencode.test.js
git -C "/home/devanshu/TimeStream " commit -m "feat: add OpenCode session importer with extraction logic"
```

---

## Task 3: FileWatcher Service (`src/services/fileWatcher.js`)

**Files:**
- Create: `src/services/fileWatcher.js`
- Create: `tests/services/fileWatcher.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/services/fileWatcher.test.js`:

```js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { debounce, parseWithRetry } = require('../../src/services/fileWatcher.js');

describe('debounce', () => {
  it('calls function after delay', async () => {
    let called = 0;
    const fn = debounce(() => called++, 50);
    fn(); fn(); fn();
    await new Promise(r => setTimeout(r, 100));
    assert.equal(called, 1);
  });

  it('resets timer on repeated calls', async () => {
    let called = 0;
    const fn = debounce(() => called++, 100);
    fn();
    await new Promise(r => setTimeout(r, 50));
    fn(); // resets
    await new Promise(r => setTimeout(r, 150));
    assert.equal(called, 1);
  });
});

describe('parseWithRetry', () => {
  it('returns parsed object on valid JSON', async () => {
    const read = async () => '{"id":"abc"}';
    const result = await parseWithRetry(read, 1, 10);
    assert.deepEqual(result, { id: 'abc' });
  });

  it('retries on invalid JSON and eventually throws', async () => {
    let attempts = 0;
    const read = async () => { attempts++; return '{bad json'; };
    await assert.rejects(() => parseWithRetry(read, 3, 10), /JSON/);
    assert.equal(attempts, 3);
  });
});
```

- [ ] **Step 2: Run tests — verify they FAIL (Red)**

```bash
cd "/home/devanshu/TimeStream " && npm test 2>&1 | head -20
```

Expected: `Error: Cannot find module '../../src/services/fileWatcher.js'`
If you see something else, stop and investigate before proceeding.

- [ ] **Step 3: Create `src/services/fileWatcher.js`**

```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const chokidar = require('chokidar');
const { extractSession, saveSession } = require('../importers/opencode.js');

const OPENCODE_SESSIONS_DIR = path.join(os.homedir(), '.opencode', 'sessions');
const RETRY_DELAY_MS = 500;
const DEBOUNCE_MS = 500;
const MAX_RETRIES = 3;
const MISSING_DIR_RETRY_MS = 30000;

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function parseWithRetry(readFn, maxRetries = MAX_RETRIES, retryDelay = RETRY_DELAY_MS) {
  let lastErr;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const text = await readFn();
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, retryDelay));
    }
  }
  throw lastErr;
}

function startWatcher({ storageFile, onSession, onMissingDir }) {
  if (!fs.existsSync(OPENCODE_SESSIONS_DIR)) {
    if (onMissingDir) onMissingDir();
    const retryTimer = setTimeout(() => startWatcher({ storageFile, onSession, onMissingDir }), MISSING_DIR_RETRY_MS);
    if (retryTimer.unref) retryTimer.unref();
    return null;
  }

  const handleFile = debounce(async (filePath) => {
    if (!filePath.endsWith('.json')) return;
    try {
      const raw = await parseWithRetry(
        () => Promise.resolve(fs.readFileSync(filePath, 'utf8'))
      );
      const mtime = fs.statSync(filePath).mtimeMs;
      const session = extractSession(raw, filePath, mtime);
      const saved = saveSession(session, storageFile);
      if (saved && onSession) onSession(session);
    } catch (err) {
      console.warn(`[FileWatcher] Skipping ${path.basename(filePath)}: ${err.message}`);
    }
  }, DEBOUNCE_MS);

  const watcher = chokidar.watch(OPENCODE_SESSIONS_DIR, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher.on('add', handleFile);
  watcher.on('change', handleFile);
  watcher.on('error', err => console.error('[FileWatcher] Error:', err));

  return watcher;
}

module.exports = { startWatcher, debounce, parseWithRetry };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd "/home/devanshu/TimeStream " && npm test 2>&1 | grep -E "pass|fail|ok"
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git -C "/home/devanshu/TimeStream " add src/services/fileWatcher.js tests/services/fileWatcher.test.js
git -C "/home/devanshu/TimeStream " commit -m "feat: add FileWatcher service with debounce and JSON retry"
```

---

## Task 4: Wire into Electron main process (`src/main.js` + `src/preload.js`)

**Files:**
- Modify: `src/main.js`
- Modify: `src/preload.js`

- [ ] **Step 1: Add OPENCODE_FILE constant and init guard to `src/main.js`**

After the existing `LEARNING_FILE` line (line 9), add:
```js
const OPENCODE_FILE = path.join(app.getPath('userData'), 'opencode-sessions.json');
```

After the existing `LEARNING_FILE` init block (around line 17), add:
```js
if (!fs.existsSync(OPENCODE_FILE)) {
    fs.writeFileSync(OPENCODE_FILE, JSON.stringify([]));
}
```

- [ ] **Step 2: Add `get-opencode-sessions` IPC handler to `src/main.js`**

After the existing `get-learning-seconds` handler (end of IPC section), add:
```js
// Get OpenCode sessions, optionally filtered by date (YYYY-MM-DD)
ipcMain.handle('get-opencode-sessions', (_, date) => {
    try {
        const sessions = JSON.parse(fs.readFileSync(OPENCODE_FILE, 'utf8'));
        if (date) return sessions.filter(s => s.date === date);
        return sessions;
    } catch {
        return [];
    }
});
```

- [ ] **Step 3: Start FileWatcher inside `app.whenReady()` in `src/main.js`**

At the top of the file, add the require after existing requires:
```js
const { startWatcher } = require('./services/fileWatcher.js');
```

Inside `app.whenReady().then(...)`, after `createWindow()`, add:
```js
    startWatcher({
        storageFile: OPENCODE_FILE,
        onSession: (session) => {
            if (mainWindow) mainWindow.webContents.send('opencode-session-imported', session);
        },
        onMissingDir: () => {
            if (mainWindow) mainWindow.webContents.send('opencode-missing-dir');
        },
    });
```

- [ ] **Step 4: Add preload entries to `src/preload.js`**

Add these lines inside the `contextBridge.exposeInMainWorld` object (after `getLearningSeconds`):
```js
    getOpencodeSessions: (date) => ipcRenderer.invoke('get-opencode-sessions', date),
    onOpenCodeSessionImported: (cb) => {
        ipcRenderer.removeAllListeners('opencode-session-imported');
        ipcRenderer.on('opencode-session-imported', (_, s) => cb(s));
    },
    onOpenCodeMissingDir: (cb) => {
        ipcRenderer.removeAllListeners('opencode-missing-dir');
        ipcRenderer.on('opencode-missing-dir', () => cb());
    },
```

Note: `removeAllListeners` before `on` prevents listener accumulation if the renderer re-registers callbacks on navigation.

- [ ] **Step 5: Start the app and verify no errors**

```bash
cd "/home/devanshu/TimeStream " && npm start -- --dev 2>&1 | head -30
```

Expected: App starts, no `Cannot find module` or `ipcMain` errors in console.

- [ ] **Step 6: Commit**

```bash
git -C "/home/devanshu/TimeStream " add src/main.js src/preload.js
git -C "/home/devanshu/TimeStream " commit -m "feat: wire OpenCode IPC handlers and start FileWatcher on app ready"
```

---

## Task 5: Dashboard styles (`renderer/styles/opencode.css`)

**Files:**
- Create: `renderer/styles/opencode.css`

- [ ] **Step 1: Create the stylesheet**

```css
/* ── OPENCODE DASHBOARD ─────────────────────────────────────── */
.oc-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
}

.oc-stats-bar {
    display: flex;
    gap: 1.5rem;
    font-size: 0.85rem;
    color: var(--text-muted, #888);
    margin-bottom: 1.5rem;
}

.oc-stats-bar strong {
    color: var(--text-primary, #fff);
}

.oc-date-nav {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.oc-date-nav button {
    background: none;
    border: 1px solid var(--border, #333);
    color: var(--text-primary, #fff);
    border-radius: 6px;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 0.8rem;
}

.oc-date-nav button:hover { background: var(--hover-bg, #222); }
.oc-date-nav button:disabled { opacity: 0.3; cursor: default; }

.oc-date-label {
    font-size: 0.9rem;
    font-weight: 600;
    min-width: 140px;
    text-align: center;
}

/* Session cards */
.oc-sessions-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.oc-session-card {
    background: var(--card-bg, #1a1a2e);
    border: 1px solid var(--border, #333);
    border-radius: 10px;
    padding: 1rem 1.25rem;
}

.oc-session-time {
    font-size: 0.75rem;
    color: var(--text-muted, #888);
    margin-bottom: 0.25rem;
}

.oc-session-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.6rem;
    color: var(--text-primary, #fff);
}

.oc-session-summary {
    font-size: 0.85rem;
    color: var(--text-secondary, #aaa);
    line-height: 1.5;
    margin-bottom: 0.75rem;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.oc-session-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.75rem;
}

.oc-tag {
    background: var(--tag-bg, #2a2a4a);
    color: var(--accent, #7c7cff);
    border-radius: 4px;
    padding: 2px 8px;
}

.oc-errors-badge {
    color: var(--success, #4caf50);
    font-weight: 600;
}

.oc-files {
    color: var(--text-muted, #888);
    font-style: italic;
}

/* Empty / missing dir state */
.oc-empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted, #888);
}

.oc-empty h3 { font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--text-primary, #fff); }
.oc-empty p  { font-size: 0.85rem; line-height: 1.6; }
.oc-empty code {
    display: inline-block;
    background: var(--card-bg, #1a1a2e);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.8rem;
    margin-top: 0.5rem;
}
```

- [ ] **Step 2: Commit**

```bash
git -C "/home/devanshu/TimeStream " add renderer/styles/opencode.css
git -C "/home/devanshu/TimeStream " commit -m "feat: add OpenCode dashboard styles"
```

---

## Task 6: Dashboard HTML (`renderer/index.html`)

**Files:**
- Modify: `renderer/index.html`

- [ ] **Step 1: Add stylesheet link in `<head>`**

Find the last `<link rel="stylesheet">` in `renderer/index.html` and add after it:
```html
<link rel="stylesheet" href="styles/opencode.css">
```

- [ ] **Step 2: Add sidebar navigation item**

Find the existing sidebar nav (look for `data-nav` links). Add a new nav item alongside the existing ones:
```html
<a class="nav-item" data-nav="opencode">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
    </svg>
    <span>Learnings</span>
</a>
```

- [ ] **Step 3: Add the `data-page="opencode"` section**

Find the last `</div>` that closes an existing `data-page` section and add after it:
```html
<div class="page" data-page="opencode">
    <div class="oc-header">
        <h2>What I Learned Today</h2>
        <div class="oc-date-nav">
            <button id="oc-prev-day">← Yesterday</button>
            <span class="oc-date-label" id="oc-date-label"></span>
            <button id="oc-next-day" disabled>Tomorrow →</button>
        </div>
    </div>

    <div class="oc-stats-bar" id="oc-stats-bar">
        <span><strong id="oc-total-sessions">0</strong> Sessions</span>
        <span><strong id="oc-total-errors">0</strong> Errors Fixed</span>
    </div>

    <div class="oc-sessions-list" id="oc-sessions-list">
        <!-- Cards injected by opencode.js -->
    </div>
</div>
```

- [ ] **Step 4: Add script tag before closing `</body>`**

Find the existing `<script src="js/app.js">` tag and add the new tag **after** it:
```html
<script src="js/app.js"></script>   <!-- existing — DO NOT move -->
<script src="js/opencode.js"></script>  <!-- add this after app.js -->
```

**Important:** `opencode.js` must load after `app.js` because it patches `window.navigate`, which `app.js` defines. Reversing the order silently breaks navigation.

- [ ] **Step 5: Commit**

```bash
git -C "/home/devanshu/TimeStream " add renderer/index.html
git -C "/home/devanshu/TimeStream " commit -m "feat: add OpenCode Learnings page to dashboard"
```

---

## Task 7: Dashboard Logic (`renderer/js/opencode.js`)

**Files:**
- Create: `renderer/js/opencode.js`

- [ ] **Step 1: Create `renderer/js/opencode.js`**

```js
(function () {
    'use strict';

    const MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

    let selectedDate = todayStr();

    function todayStr() {
        return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    }

    function formatDateLabel(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return `${MONTHS[m - 1]} ${d}, ${y}`;
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        const [h, min] = timeStr.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        return `${hour % 12 || 12}:${min} ${ampm}`;
    }

    function renderCard(session) {
        const tagsHTML = (session.tags || [])
            .map(t => `<span class="oc-tag">${t}</span>`)
            .join('');

        const filesText = (session.filesChanged || []).slice(0, 3).join(', ');

        return `
        <div class="oc-session-card">
            <div class="oc-session-time">${formatTime(session.startTime)}</div>
            <div class="oc-session-title">${escHtml(session.title)}</div>
            <div class="oc-session-summary">${escHtml(session.summary)}</div>
            <div class="oc-session-meta">
                ${tagsHTML}
                ${session.errorsFixed > 0
                    ? `<span class="oc-errors-badge">✓ ${session.errorsFixed} error${session.errorsFixed > 1 ? 's' : ''} fixed</span>`
                    : ''}
                ${filesText ? `<span class="oc-files">${escHtml(filesText)}</span>` : ''}
            </div>
        </div>`;
    }

    function escHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showEmpty(missing = false) {
        const list = document.getElementById('oc-sessions-list');
        list.innerHTML = missing
            ? `<div class="oc-empty">
                <h3>OpenCode not connected</h3>
                <p>Start using OpenCode CLI and sessions will appear here automatically.<br>
                Sessions are read from:<br><code>~/.opencode/sessions/</code></p>
               </div>`
            : `<div class="oc-empty">
                <h3>No sessions for this day</h3>
                <p>Use OpenCode CLI today to see your learnings here.</p>
               </div>`;
    }

    async function renderPage() {
        const sessions = await window.electronAPI.getOpencodeSessions(selectedDate);

        const label = document.getElementById('oc-date-label');
        if (label) label.textContent = formatDateLabel(selectedDate);

        const nextBtn = document.getElementById('oc-next-day');
        if (nextBtn) nextBtn.disabled = selectedDate >= todayStr();

        const totalEl = document.getElementById('oc-total-sessions');
        const errorsEl = document.getElementById('oc-total-errors');
        if (totalEl) totalEl.textContent = sessions.length;
        if (errorsEl) errorsEl.textContent = sessions.reduce((n, s) => n + (s.errorsFixed || 0), 0);

        const list = document.getElementById('oc-sessions-list');
        if (!list) return;

        if (!sessions.length) { showEmpty(false); return; }

        const sorted = [...sessions].sort((a, b) => a.startTime < b.startTime ? -1 : 1);
        list.innerHTML = sorted.map(renderCard).join('');
    }

    function initNavigation() {
        document.getElementById('oc-prev-day')?.addEventListener('click', () => {
            const d = new Date(selectedDate + 'T00:00:00');
            d.setDate(d.getDate() - 1);
            selectedDate = d.toLocaleDateString('en-CA');
            renderPage();
        });

        document.getElementById('oc-next-day')?.addEventListener('click', () => {
            const d = new Date(selectedDate + 'T00:00:00');
            d.setDate(d.getDate() + 1);
            const next = d.toLocaleDateString('en-CA');
            if (next <= todayStr()) { selectedDate = next; renderPage(); }
        });
    }

    function initLiveUpdates() {
        window.electronAPI.onOpenCodeSessionImported((session) => {
            if (session.date === selectedDate) renderPage();
        });

        window.electronAPI.onOpenCodeMissingDir(() => {
            if (document.querySelector('[data-page="opencode"]')?.classList.contains('active')) {
                showEmpty(true);
            }
        });
    }

    // Init when page becomes active
    document.addEventListener('DOMContentLoaded', () => {
        initNavigation();
        initLiveUpdates();
    });

    // Re-render when navigating to this page (hook into existing navigate() pattern)
    const _origNavigate = window.navigate;
    window.navigate = function (page) {
        if (typeof _origNavigate === 'function') _origNavigate(page);
        if (page === 'opencode') renderPage();
    };
})();
```

- [ ] **Step 2: Commit**

```bash
git -C "/home/devanshu/TimeStream " add renderer/js/opencode.js
git -C "/home/devanshu/TimeStream " commit -m "feat: add OpenCode dashboard renderer with live updates and date nav"
```

---

## Task 8: End-to-end verification

- [ ] **Step 1: Run all tests**

```bash
cd "/home/devanshu/TimeStream " && npm test
```

Expected: All tests pass, zero failures.

- [ ] **Step 2: Create a mock session file to test the watcher**

```bash
mkdir -p ~/.opencode/sessions
cat > ~/.opencode/sessions/test-session-001.json << 'EOF'
{
  "id": "test-session-001",
  "title": "Fix Cannot find module react error",
  "createdAt": "2026-03-17T10:00:00Z",
  "updatedAt": "2026-03-17T10:30:00Z",
  "messages": [
    { "role": "user", "content": "Error: Cannot find module 'react' in src/App.js", "createdAt": "2026-03-17T10:00:05Z" },
    { "role": "assistant", "content": "Run npm install react to install the missing package.", "createdAt": "2026-03-17T10:00:10Z" }
  ]
}
EOF
```

- [ ] **Step 3: Start app and verify session appears**

```bash
cd "/home/devanshu/TimeStream " && npm start -- --dev
```

Expected:
- Navigate to "Learnings" in sidebar
- Session card shows title "Fix Cannot find module react error"
- Summary shows "Run npm install react..."
- Tags include `javascript`, `npm`
- Errors Fixed: 1

- [ ] **Step 4: Verify acceptance criteria checklist**

Check off each item from the spec:
- [ ] FileWatcher detects new OpenCode session files automatically on app start
- [ ] Each session stored with title, summary, errors, tags, filesChanged
- [ ] Summary extracted from Claude's last response (no new API call)
- [ ] Duplicate sessions are never imported twice
- [ ] Dashboard shows all sessions for selected day
- [ ] Yesterday / Tomorrow navigation works
- [ ] Daily stats show total sessions + total errors fixed
- [ ] Partial/malformed JSON retried 3x before skipping
- [ ] "Connect OpenCode" prompt shown when `~/.opencode/sessions/` is missing
- [ ] New sessions appear live without page refresh

- [ ] **Step 5: Final commit**

```bash
git -C "/home/devanshu/TimeStream " add .
git -C "/home/devanshu/TimeStream " commit -m "feat: complete OpenCode session tracking - What I Learned Today"
```
