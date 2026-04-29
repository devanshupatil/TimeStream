# TimeStream App — Full Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

---

## Current Status — Where We Are Right Now

**Date:** 2026-04-27 (last checked)
**App status:** All 15 tasks are CODED. Every source file exists. Tests are failing due to a test environment mismatch — the tests were written for Vitest but the project runs on **Bun**, which has a different test API.

---

### File Completion Status

```
✅ package.json                              (Task 1)
✅ .gitignore                                (Task 1)
✅ vite.config.js                            (Task 1)
✅ tests/setup.js                            (Task 1)
✅ src/main/index.js                         (Task 2)
✅ src/preload/index.js                      (Task 3)
✅ src/renderer/index.html                   (Task 4)
✅ src/renderer/main.jsx                     (Task 4)
✅ src/renderer/App.jsx                      (Task 4)
✅ src/renderer/styles/global.css            (Task 4)
✅ src/main/trackers/claude.js               (Task 5)
✅ src/main/trackers/opencode.js             (Task 6)
✅ src/main/trackers/browser.js              (Task 7)
✅ src/main/ipc.js                           (Task 8)
✅ src/renderer/components/SessionCard.jsx   (Task 9)
✅ src/renderer/components/ActivityFeed.jsx  (Task 10)
✅ src/renderer/components/Dashboard.jsx     (Task 11)
✅ src/main/updater.js                       (Task 12)
✅ src/renderer/components/UpdateBanner.jsx  (Task 13)
✅ electron-builder.yml                      (Task 14)
✅ .github/workflows/release.yml             (Task 15)

✅ tests/fixtures/claude/session-001.json
✅ tests/fixtures/opencode/oc-session-001.json
✅ tests/fixtures/browser/History (SQLite DB)
✅ tests/fixtures/browser/create-fixture.js
✅ tests/main/index.test.js
✅ tests/main/preload.test.js
✅ tests/main/ipc.test.js
✅ tests/main/updater.test.js
✅ tests/main/trackers/claude.test.js
✅ tests/main/trackers/opencode.test.js
✅ tests/main/trackers/browser.test.js
✅ tests/renderer/App.test.jsx
✅ tests/renderer/SessionCard.test.jsx
✅ tests/renderer/ActivityFeed.test.jsx
✅ tests/renderer/Dashboard.test.jsx
✅ tests/renderer/UpdateBanner.test.jsx
```

---

### Test Results (last run: `bun test`)

```
7 pass  |  22 fail  |  1 error  — 29 tests across 12 files
```

**All failures are caused by 3 root issues — NOT broken app logic:**

---

### Root Issue 1 — `vi.stubGlobal` does not exist in Bun

Bun's test runner does not support `vi.stubGlobal()`. This crashes:
- `tests/renderer/App.test.jsx`
- `tests/renderer/Dashboard.test.jsx`
- `tests/renderer/UpdateBanner.test.jsx`

**Fix:** Replace `vi.stubGlobal('timestream', {...})` with direct global assignment:
```js
// Instead of:
vi.stubGlobal('timestream', { ... })

// Use:
globalThis.timestream = { ... }
```

---

### Root Issue 2 — `document is not defined` (no jsdom in Bun)

Bun's test runner does not automatically use jsdom. All React component tests crash with `document is not defined`:
- `tests/renderer/SessionCard.test.jsx`
- `tests/renderer/ActivityFeed.test.jsx`
- `tests/renderer/Dashboard.test.jsx`
- `tests/renderer/App.test.jsx`
- `tests/renderer/UpdateBanner.test.jsx`

**Fix:** Add `"test": { "environment": "jsdom" }` to `bunfig.toml`:
```toml
[test]
environment = "jsdom"
```

---

### Root Issue 3 — Mocks leaking between test files

`tests/main/ipc.test.js` uses `vi.mock()` to mock the tracker modules. These mocks persist into other test files in the same run. So `claude.test.js`, `opencode.test.js`, and `browser.test.js` all receive mock data instead of running real code:

- `readClaudeSessions('/nonexistent')` returns `[{ id: 'c1', type: 'claude' }]` instead of `[]`
- `readOpenCodeSessions('/nonexistent')` returns `[{ id: 'o1', type: 'opencode' }]` instead of `[]`
- `readBrowserHistory('/nonexistent')` returns `[{ id: 'b1', type: 'browser' }]` instead of `[]`

**Fix:** Replace `vi.mock()` in `ipc.test.js` with Bun's `mock.module()` which is properly scoped, or restructure the ipc test to not use module-level mocking.

---

### Root Issue 4 — `vi.mock('electron')` not working in Bun

`tests/main/index.test.js`, `tests/main/ipc.test.js`, `tests/main/updater.test.js` mock `electron` and `electron-updater` using `vi.mock()`. In Bun, this doesn't intercept the real module load — so `app.whenReady`, `ipcMain.handle`, `autoUpdater.on` come back as `undefined`.

The project already has `tests/__mocks__/electron.js` and `tests/__mocks__/electron-updater.js` — these need to be wired into Bun's mock system using `mock.module()` at the top of each test file.

---

## What To Do Right Now — The Fix List

The app code is complete and correct. The only remaining work is fixing the test environment for Bun.

### Fix 1 — Create `bunfig.toml` (enables jsdom for all renderer tests)

```toml
# bunfig.toml  (create at project root)
[test]
environment = "jsdom"
```

### Fix 2 — Replace `vi.mock()` with Bun's `mock.module()` in main process tests

In each of these files, replace `vi.mock('electron', () => ({...}))` with:
```js
import { mock } from 'bun:test'
mock.module('electron', () => ({ ... }))
```

### Fix 3 — Replace `vi.stubGlobal` with `globalThis` assignment in renderer tests

In `App.test.jsx`, `Dashboard.test.jsx`, `UpdateBanner.test.jsx`:
```js
// Before each test
globalThis.timestream = {
  getSessions: jest.fn().mockResolvedValue([]),
  onUpdateAvailable: jest.fn(),
  ...
}
```

### Fix 4 — Import from `bun:test` not `vitest`

Bun supports the `jest`-compatible API. Replace in all test files:
```js
// From:
import { describe, it, expect, vi } from 'vitest'
// To:
import { describe, it, expect, jest, mock } from 'bun:test'
// And replace all vi.fn() with jest.fn()
```

---

### Priority Order to Fix

| Priority | Fix | Affects |
|----------|-----|---------|
| 1 | Create `bunfig.toml` with jsdom | All 5 renderer tests |
| 2 | Replace `vi.stubGlobal` with `globalThis` | App, Dashboard, UpdateBanner tests |
| 3 | Replace `vi.mock` with `mock.module` from `bun:test` | ipc, index, updater tests |
| 4 | Fix mock leaking in tracker tests | claude, opencode, browser tests |

---

---

## What To Do Right Now — Ordered Action List

Follow this exact order. Each step depends on the one before it.

### Step 1 — Right Now: Set up the project (Task 1)
> **You cannot do anything else until this is done.**

```bash
cd /home/devanshu/TimeStream

# 1. Create package.json (copy from Task 1 in this plan)
# 2. Create .gitignore
# 3. Create vite.config.js
# 4. Create tests/setup.js
# 5. Run:
npm install
```

When `npm install` finishes without errors → move to Step 2.

---

### Step 2 — Create the folder structure (Task 2, beginning)

```bash
mkdir -p src/main/trackers
mkdir -p src/preload
mkdir -p src/renderer/components
mkdir -p src/renderer/styles
mkdir -p tests/main/trackers
mkdir -p tests/renderer
mkdir -p tests/fixtures/claude
mkdir -p tests/fixtures/opencode
mkdir -p tests/fixtures/browser
mkdir -p .github/workflows
```

---

### Step 3 — Build in this order (one task at a time)

| Order | Task | What you get when done |
|-------|------|------------------------|
| 1 | Task 1: Initialize project | `package.json`, deps installed |
| 2 | Task 2: Main process | `src/main/index.js` — app window logic |
| 3 | Task 3: Preload | `src/preload/index.js` — security bridge |
| 4 | Task 4: React entry | `src/renderer/` — app opens in Electron window |
| 5 | Task 5: Claude tracker | Reads your Claude CLI sessions |
| 6 | Task 6: OpenCode tracker | Reads your OpenCode sessions |
| 7 | Task 7: Browser tracker | Reads Chrome history |
| 8 | Task 8: IPC handler | Dashboard can request all session data |
| 9 | Task 9: SessionCard | Individual row in the timeline |
| 10 | Task 10: ActivityFeed | List of all session rows |
| 11 | Task 11: Dashboard | Main view — loads + displays all data |
| 12 | Task 12: Updater (main) | App checks GitHub for updates on startup |
| 13 | Task 13: UpdateBanner | "Update Available" banner appears in UI |
| 14 | Task 14: electron-builder | Can build `.AppImage` / `.exe` / `.dmg` |
| 15 | Task 15: GitHub Actions | Pushing a version tag auto-publishes release |

---

### Step 4 — First milestone: See the app running

After Tasks 1–4, run:
```bash
NODE_ENV=development npm run dev
```
You should see a dark Electron window that says **"Loading activity..."**
That means the foundation is working.

---

### Step 5 — Second milestone: See real data

After Tasks 5–8 (all trackers + IPC), restart the app:
```bash
NODE_ENV=development npm run dev
```
The dashboard should now show your actual Claude CLI sessions from `~/.claude/projects/`.

---

### Step 6 — Third milestone: Full UI working

After Tasks 9–11, the dashboard should show a clean timeline with colour-coded cards for Claude, OpenCode, and browser sessions.

---

### Step 7 — Fourth milestone: Build the installer

After Task 14:
```bash
npm run build:linux
```
Expected: `release/TimeStream-1.0.0.AppImage` — this is the real distributable file.

---

### Step 8 — Final milestone: Auto-update live

After Task 15:
1. Create a GitHub repo named `TimeStream` under `devanshupatil`
2. Push the code:
   ```bash
   git remote add origin https://github.com/devanshupatil/TimeStream.git
   git push -u origin main
   ```
3. Ship the first release:
   ```bash
   npm version minor    # 1.0.0 → 1.1.0
   git push --tags
   ```
4. Watch GitHub Actions build and publish the installers
5. Install the app from the release page
6. Add a small feature, bump version again — the installed app will detect it automatically

---

### Known Issues / Things to Watch Out For

| Issue | Solution |
|-------|----------|
| `better-sqlite3` fails to install | Run `npm install --build-from-source better-sqlite3` |
| Electron window doesn't open in dev | Make sure Vite is running first (`npm run dev` uses `wait-on` to handle this) |
| Chrome history not showing | Chrome must have been opened at least once. Check the path in `browser.js` matches your system |
| Auto-update not triggering | You must be running a packaged build (not `npm run dev`). `electron-updater` is disabled in dev mode |
| GitHub Actions fails on Windows | `better-sqlite3` needs native compilation — the workflow handles this via `npm ci` |

---

## What Are We Building?

**TimeStream** is a desktop application for developers. It runs on your computer and silently tracks:
- Every session you have with **Claude CLI** (AI coding assistant)
- Every session you have with **OpenCode** (another AI coding tool)
- Your **browser history** (Chrome) — so you can see what sites you visited while coding

All of this is shown in a clean **dashboard** inside the app, so at the end of the day you can see exactly what you worked on and for how long.

The app is distributed as an **installer** (like any normal app — `.exe` on Windows, `.dmg` on Mac, `.AppImage` on Linux). Users just download and double-click. No source code is ever shared.

When you release a new version of the app, **every installed copy automatically detects the update** and shows a banner inside the app saying "Update Available". The user clicks one button and the app restarts with the new version installed.

---

## Why Electron?

**Electron** is a framework that lets you build desktop apps using web technologies (HTML, CSS, JavaScript / React). It is used by VS Code, Slack, Discord, Figma, and many other major apps.

**Why it's perfect for TimeStream:**
- It can read files from your computer (like browser history, session JSON files) — which a normal website cannot do
- It runs on Linux, Windows, and Mac from the same codebase
- You can package it as a native installer so users never see your source code
- It has a built-in auto-update system (`electron-updater`)

---

## How Electron Works (Important to Understand Before Coding)

Electron has **two separate processes** that run at the same time:

```
┌─────────────────────────────────────────────────────┐
│                  ELECTRON APP                       │
│                                                     │
│  ┌─────────────────┐      ┌──────────────────────┐  │
│  │   MAIN PROCESS  │      │  RENDERER PROCESS    │  │
│  │  (Node.js)      │◄────►│  (Browser / React)   │  │
│  │                 │  IPC │                      │  │
│  │ - Reads files   │      │ - Shows the UI       │  │
│  │ - Checks updates│      │ - Dashboard          │  │
│  │ - Accesses OS   │      │ - Update Banner      │  │
│  └─────────────────┘      └──────────────────────┘  │
│           ▲                          ▲               │
│           │      PRELOAD SCRIPT      │               │
│           └──────────────────────────┘               │
│         (bridge between the two — security layer)    │
└─────────────────────────────────────────────────────┘
```

- **Main Process** (`src/main/index.js`) — This is Node.js. It can read your hard drive, access the operating system, check for updates, and create the app window. Think of it as the "backend".

- **Renderer Process** (`src/renderer/`) — This is a web browser running React. It shows the UI. It CANNOT directly access your files (for security reasons). Think of it as the "frontend".

- **Preload Script** (`src/preload/index.js`) — This is a safety bridge. It exposes ONLY the specific functions the UI needs (like `getSessions`, `installUpdate`) to the renderer. The renderer cannot do anything the preload doesn't explicitly allow.

- **IPC (Inter-Process Communication)** — The way the main process and renderer process talk to each other. The renderer sends a message like `"get-sessions"`, the main process receives it, reads the files, and sends the data back.

---

## Technology Stack — What Each Tool Does

| Tool | What It Is | Why We Use It |
|------|-----------|---------------|
| **Electron 29** | Desktop app framework | Lets us build a native app with web tech |
| **React 18** | UI library | Makes building the dashboard easy with components |
| **Vite** | Build tool / dev server | Bundles the React code; very fast in development |
| **electron-builder** | Packaging tool | Turns our code into `.exe`, `.dmg`, `.AppImage` installers |
| **electron-updater** | Auto-update library | Checks GitHub for new versions and downloads them silently |
| **better-sqlite3** | SQLite reader | Reads Chrome's browser history file (it's a SQLite database) |
| **Vitest** | Test runner | Runs our automated tests (like Jest but faster) |
| **GitHub Actions** | CI/CD pipeline | Automatically builds installers and publishes them when we tag a release |

---

## Complete File Structure

Every file we will create, and exactly what each one is responsible for:

```
TimeStream/
│
├── package.json                    ← Project config: dependencies, npm scripts, electron-builder settings
├── vite.config.js                  ← Tells Vite where the renderer source is and where to output the build
├── electron-builder.yml            ← Tells electron-builder what to package and where to publish
│
├── .github/
│   └── workflows/
│       └── release.yml             ← GitHub Actions: runs on git tag push, builds + publishes installers
│
├── src/
│   ├── main/                       ← Everything that runs in the Node.js / main process
│   │   ├── index.js                ← App entry point: creates the window, starts the app
│   │   ├── updater.js              ← Checks GitHub Releases for new versions, sends events to renderer
│   │   ├── ipc.js                  ← Registers all IPC handlers (the "API" the renderer can call)
│   │   └── trackers/               ← One file per activity source
│   │       ├── claude.js           ← Reads ~/.claude/projects/**/*.json session files
│   │       ├── opencode.js         ← Reads ~/.opencode/sessions/**/*.json session files
│   │       └── browser.js          ← Copies + reads Chrome's SQLite History file
│   │
│   ├── preload/
│   │   └── index.js                ← Security bridge: exposes safe IPC functions to the renderer
│   │
│   └── renderer/                   ← Everything that runs in the browser / React
│       ├── index.html              ← HTML shell that React mounts into
│       ├── main.jsx                ← React entry: mounts <App /> into #root
│       ├── App.jsx                 ← Root component: holds UpdateBanner + Dashboard
│       ├── components/
│       │   ├── UpdateBanner.jsx    ← Purple bar at top: "Downloading v1.3..." / "Restart & Update"
│       │   ├── Dashboard.jsx       ← Main view: loads sessions from IPC, renders activity feed
│       │   ├── ActivityFeed.jsx    ← Scrollable list of all sessions sorted by time
│       │   └── SessionCard.jsx     ← Single row: shows type (claude/opencode/browser), time, duration
│       └── styles/
│           └── global.css          ← Dark theme CSS variables and base styles
│
├── tests/
│   ├── main/
│   │   ├── updater.test.js
│   │   ├── preload.test.js
│   │   ├── ipc.test.js
│   │   └── trackers/
│   │       ├── claude.test.js
│   │       ├── opencode.test.js
│   │       └── browser.test.js
│   └── renderer/
│       ├── App.test.jsx
│       ├── UpdateBanner.test.jsx
│       ├── Dashboard.test.jsx
│       ├── ActivityFeed.test.jsx
│       └── SessionCard.test.jsx
│
└── tests/fixtures/                 ← Fake data files used during testing (not real user data)
    ├── claude/
    │   └── session-001.json
    ├── opencode/
    │   └── oc-session-001.json
    └── browser/
        ├── History                 ← Fake SQLite database mimicking Chrome's history
        └── create-fixture.js       ← Script to generate the fake History file
```

---

## How the Auto-Update Flow Works (End to End)

This is the complete picture of what happens when you release a new version:

```
YOU (Developer)                    GITHUB                    USER'S INSTALLED APP
─────────────                      ──────                    ────────────────────

1. Add feature
2. Bump version:
   package.json "1.0.0" → "1.1.0"
3. npm version minor
   (creates git tag v1.1.0)
4. git push --tags
                   ──────────────►
                   5. GitHub Actions triggered
                      - Checks out code
                      - Runs npm test (must pass)
                      - Runs electron-builder
                        on Linux + Windows + Mac
                      - Creates:
                        TimeStream-1.1.0.AppImage
                        TimeStream-1.1.0.exe
                        TimeStream-1.1.0.dmg
                        latest.yml  ← version manifest
                      - Publishes all to
                        GitHub Releases page
                                          ──────────────►
                                          6. App starts up
                                          7. After 5 seconds:
                                             checks latest.yml
                                             on GitHub
                                          8. Sees version 1.1.0
                                             current is 1.0.0
                                          9. Shows purple banner:
                                             "Downloading 1.1.0..."
                                         10. Download completes
                                         11. Banner changes to:
                                             "Restart & Update"
                                         12. User clicks button
                                         13. App quits + installer
                                             runs silently
                                         14. App relaunches
                                             now on v1.1.0 ✓
```

---

## Prerequisites — Before You Start

Make sure these are installed on your machine:

```bash
# Check Node.js (need v18 or higher)
node --version

# Check npm
npm --version

# Check git
git --version
```

If Node.js is not installed: download from https://nodejs.org (choose LTS version)

---

## Phase 1: Project Foundation

This phase sets up the skeleton — the config files, the Electron window, the React UI shell, and the security bridge. No real features yet, just the bare minimum to see a window open.

---

### Task 1: Initialize the Project

**What we're doing:** Creating `package.json` (the project config file that lists all dependencies and scripts), `.gitignore` (tells git which files to ignore), and `vite.config.js` (tells Vite where our React source code lives).

**Why `package.json` matters:** It's the single source of truth for the project. It tells Node.js what packages to install, defines the `npm run dev` / `npm run build` commands, and contains the `electron-builder` settings for packaging.

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `vite.config.js`

- [ ] **Step 1: Create package.json**

Every field here is important — here's what each section does:

```json
{
  "name": "timestream",
  "version": "1.0.0",
  "description": "Developer activity tracker",
  "main": "src/main/index.js",
  "scripts": {
    "dev": "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build:renderer": "vite build",
    "build:dist": "npm run build:renderer && electron-builder",
    "build:linux": "npm run build:renderer && electron-builder --linux",
    "build:win": "npm run build:renderer && electron-builder --win",
    "build:mac": "npm run build:renderer && electron-builder --mac",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "build": {
    "appId": "com.devanshupatil.timestream",
    "productName": "TimeStream",
    "publish": {
      "provider": "github",
      "owner": "devanshupatil",
      "repo": "TimeStream"
    },
    "linux": { "target": ["AppImage", "deb"] },
    "win": { "target": "nsis" },
    "mac": { "target": "dmg" }
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "electron": "^29.0.0",
    "electron-builder": "^24.13.3",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "vitest": "^1.4.0",
    "@testing-library/react": "^15.0.0",
    "@testing-library/jest-dom": "^6.4.2",
    "jsdom": "^24.0.0",
    "wait-on": "^7.2.0"
  },
  "dependencies": {
    "electron-updater": "^6.1.8",
    "better-sqlite3": "^9.4.3",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

**Explanation of scripts:**
- `dev` — runs Vite (React dev server) AND Electron at the same time. `wait-on` makes Electron wait until Vite is ready before opening the window.
- `build:renderer` — compiles React into static HTML/JS/CSS files in `dist/renderer/`
- `build:dist` — builds React first, then packages the whole thing into an installer
- `build:linux/win/mac` — same but targets a specific platform
- `test` — runs all tests once; `test:watch` re-runs on file changes

**Explanation of "build" section:**
- `appId` — unique identifier for your app (reverse domain format, like a Java package name)
- `publish.provider: "github"` — tells electron-builder/electron-updater to use GitHub Releases for hosting updates
- `linux: AppImage + deb` — AppImage is a portable single-file format; deb is for Debian/Ubuntu

- [ ] **Step 2: Create .gitignore**

These folders/files should never be committed to git:

```
node_modules/
dist/
dist-electron/
release/
*.log
.DS_Store
```

- `node_modules/` — installed packages (huge, always reinstallable with `npm install`)
- `dist/` — compiled React output (regenerated by `npm run build`)
- `release/` — installer files (generated by electron-builder)

- [ ] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',          // where index.html lives
  build: {
    outDir: '../../dist/renderer' // where to output compiled files
  },
  server: { port: 5173 },        // dev server port (Electron connects to this)
  test: {
    environment: 'jsdom',        // simulate a browser for React component tests
    globals: true,
    setupFiles: ['./tests/setup.js']
  }
})
```

- [ ] **Step 4: Create tests/setup.js**

This file runs before every test and adds extra DOM matchers like `toBeInTheDocument()`:

```js
// tests/setup.js
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Install dependencies**

```bash
npm install
```

Expected output: Creates `node_modules/` folder. No errors. Takes 1-3 minutes.

- [ ] **Step 6: Verify install worked**

```bash
npx electron --version
```

Expected: prints something like `v29.0.0`

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore vite.config.js tests/setup.js
git commit -m "feat: initialize project scaffold"
```

---

### Task 2: Electron Main Process

**What we're doing:** Creating `src/main/index.js` — the entry point of the app. This file creates the application window, handles the app lifecycle (open, close, quit), and wires together the updater and IPC handlers.

**Why `show: false` then `ready-to-show`:** If we show the window immediately, users see a blank white flash before React loads. By using `show: false` and only showing on `ready-to-show`, the window appears instantly with content already rendered.

**Why `contextIsolation: true` and `nodeIntegration: false`:** This is Electron security best practice. `nodeIntegration: false` prevents the renderer (React) from directly calling Node.js APIs — which would be a security risk if any untrusted code ran in the renderer. `contextIsolation: true` means the preload script runs in an isolated context, not the same JS environment as the webpage.

**Files:**
- Create: `src/main/index.js`
- Create: `tests/main/index.test.js`

- [ ] **Step 1: Create the src/main directory**

```bash
mkdir -p src/main/trackers src/preload src/renderer/components src/renderer/styles
mkdir -p tests/main/trackers tests/renderer tests/fixtures/claude tests/fixtures/opencode tests/fixtures/browser
```

- [ ] **Step 2: Write the failing test**

```js
// tests/main/index.test.js
import { describe, it, expect, vi } from 'vitest'

// Mock electron — it's a native module that can't run in test environment
vi.mock('electron', () => ({
  app: { whenReady: vi.fn(() => Promise.resolve()), on: vi.fn(), quit: vi.fn() },
  BrowserWindow: vi.fn(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    once: vi.fn(),
    show: vi.fn(),
    webContents: { send: vi.fn() }
  }))
}))

vi.mock('../../src/main/updater.js', () => ({ initUpdater: vi.fn() }))
vi.mock('../../src/main/ipc.js', () => ({ registerIpcHandlers: vi.fn() }))

describe('main process', () => {
  it('exports a createWindow function', async () => {
    const mod = await import('../../src/main/index.js')
    expect(typeof mod.createWindow).toBe('function')
  })
})
```

- [ ] **Step 3: Run test — verify it fails**

```bash
npm test -- tests/main/index.test.js
```

Expected: FAIL — "Cannot find module '../../src/main/index.js'"

- [ ] **Step 4: Implement the main process**

```js
// src/main/index.js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { initUpdater } = require('./updater')
const { registerIpcHandlers } = require('./ipc')

// In development, NODE_ENV=development is set by our dev script
// In production (packaged app), it is undefined
const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,   // renderer cannot access Node.js directly
      nodeIntegration: false    // extra security — renderer is sandboxed
    },
    titleBarStyle: 'hiddenInset', // hides native title bar for a cleaner look
    show: false                   // don't show until content is ready
  })

  if (isDev) {
    // In dev: load from Vite dev server (supports hot reload)
    win.loadURL('http://localhost:5173')
  } else {
    // In production: load compiled HTML file bundled inside the app
    win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
  }

  // Show window only when React has finished painting — no white flash
  win.once('ready-to-show', () => win.show())

  return win
}

app.whenReady().then(() => {
  const win = createWindow()
  registerIpcHandlers()   // set up the IPC "API" the renderer can call
  initUpdater(win)        // start checking for updates
})

// On Windows/Linux: quit when all windows are closed
// On Mac: keep app running even with no windows (standard Mac behaviour)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// On Mac: re-create window when dock icon is clicked and no windows are open
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

module.exports = { createWindow }
```

- [ ] **Step 5: Run test — verify it passes**

```bash
npm test -- tests/main/index.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/index.js tests/main/index.test.js
git commit -m "feat: add electron main process with window creation"
```

---

### Task 3: Preload Script (Security Bridge)

**What we're doing:** Creating the preload script at `src/preload/index.js`. This is the most security-critical file in the app.

**Why this exists:** The renderer (React) needs to call functions that require Node.js access — like reading session files or triggering an update install. But we never want the renderer to have unlimited Node.js access. The preload script is a whitelist: it exposes ONLY the exact functions we choose, nothing else.

`contextBridge.exposeInMainWorld('timestream', {...})` creates a `window.timestream` object in the renderer with exactly the functions we define. The renderer can call `window.timestream.getSessions()` but cannot call `require('fs').readFileSync(...)` directly.

**Files:**
- Create: `src/preload/index.js`
- Test: `tests/main/preload.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/main/preload.test.js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

describe('preload', () => {
  it('exposes required API methods to the renderer', () => {
    const src = readFileSync('src/preload/index.js', 'utf8')
    // These are the only functions the renderer is allowed to call
    expect(src).toContain('getSessions')
    expect(src).toContain('onUpdateAvailable')
    expect(src).toContain('onUpdateDownloaded')
    expect(src).toContain('installUpdate')
    expect(src).toContain('offUpdate')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- tests/main/preload.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement the preload**

```js
// src/preload/index.js
const { contextBridge, ipcRenderer } = require('electron')

// contextBridge creates window.timestream in the renderer
// ipcRenderer sends/receives messages to/from the main process
contextBridge.exposeInMainWorld('timestream', {

  // Ask main process for all sessions — returns a Promise<Session[]>
  getSessions: () => ipcRenderer.invoke('get-sessions'),

  // Listen for "update is available" event from main process
  // cb = callback function the UI passes in, called when update is found
  onUpdateAvailable: (cb) =>
    ipcRenderer.on('update-available', (_, info) => cb(info)),

  // Listen for "update has finished downloading" event
  onUpdateDownloaded: (cb) =>
    ipcRenderer.on('update-downloaded', (_, info) => cb(info)),

  // Tell main process to quit and install the downloaded update
  installUpdate: () => ipcRenderer.send('install-update'),

  // Clean up event listeners when component unmounts
  offUpdate: () => {
    ipcRenderer.removeAllListeners('update-available')
    ipcRenderer.removeAllListeners('update-downloaded')
  }
})
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test -- tests/main/preload.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/preload/index.js tests/main/preload.test.js
git commit -m "feat: add preload context bridge with IPC API"
```

---

### Task 4: React Renderer Entry

**What we're doing:** Creating the four files that form the React app's entry point and root layout. This is the "shell" — no real data yet, just the structure.

**How React + Vite + Electron connect:**
1. In dev: Vite runs a web server at `http://localhost:5173`. Electron opens this URL in the BrowserWindow. Hot reload works — change a React file, see it update instantly without restarting Electron.
2. In production: `npm run build:renderer` compiles all React files into static `dist/renderer/index.html`. Electron loads this file directly from disk.

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.jsx`
- Create: `src/renderer/App.jsx`
- Create: `src/renderer/styles/global.css`
- Test: `tests/renderer/App.test.jsx`

- [ ] **Step 1: Create index.html**

This is the HTML page that Electron/Vite loads. React will inject itself into `<div id="root">`.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- Blocks all external resource loading for security -->
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'" />
    <title>TimeStream</title>
    <link rel="stylesheet" href="./styles/global.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create main.jsx**

This is the React entry point — it mounts the `<App />` component into the `#root` div:

```jsx
// src/renderer/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

`React.StrictMode` enables extra warnings during development to catch potential bugs early.

- [ ] **Step 3: Create App.jsx**

The root component. It is simply a vertical layout containing the update banner at the top and the dashboard below:

```jsx
// src/renderer/App.jsx
import React from 'react'
import UpdateBanner from './components/UpdateBanner.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  return (
    <div className="app">
      <UpdateBanner />   {/* shows only when an update is available */}
      <Dashboard />      {/* always shown — the main activity view */}
    </div>
  )
}
```

- [ ] **Step 4: Create global.css**

Dark theme with CSS custom properties (variables) so colours are easy to change later:

```css
/* src/renderer/styles/global.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg:          #0f1117;   /* darkest background */
  --surface:     #1a1d2e;   /* card / panel background */
  --accent:      #6c63ff;   /* purple — brand colour, used for update banner */
  --text:        #e2e8f0;   /* primary text */
  --text-muted:  #64748b;   /* secondary / metadata text */
  --success:     #10b981;   /* green — used for opencode sessions */
  --warning:     #f59e0b;   /* amber — used for browser sessions */
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

body {
  background: var(--bg);
  color: var(--text);
  height: 100vh;
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* Update Banner */
.update-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  gap: 12px;
  flex-shrink: 0;
}

.update-banner button {
  background: #fff;
  color: var(--accent);
  border: none;
  border-radius: 4px;
  padding: 4px 14px;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
}

.update-banner button:hover {
  opacity: 0.9;
}

/* Dashboard */
.dashboard {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  padding: 24px;
  gap: 16px;
}

.dashboard-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.dashboard-header h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.session-count {
  font-size: 13px;
  color: var(--text-muted);
}

/* Activity Feed */
.activity-feed {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
}

.empty-state {
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
  padding: 48px 0;
}

.loading {
  color: var(--text-muted);
  font-size: 14px;
  padding: 24px;
}

/* Session Card */
.session-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border-radius: 8px;
  padding: 10px 14px;
  border-left: 3px solid transparent;
}

.session-type {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  min-width: 72px;
}

.session-time {
  font-size: 13px;
  color: var(--text-muted);
  min-width: 50px;
}

.session-title {
  font-size: 13px;
  color: var(--text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-duration {
  font-size: 12px;
  color: var(--text-muted);
  margin-left: auto;
}
```

- [ ] **Step 5: Write smoke test**

```jsx
// tests/renderer/App.test.jsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from '../../src/renderer/App.jsx'

// Mock window.timestream — the preload creates this in real Electron,
// but in tests there is no Electron so we fake it
vi.stubGlobal('timestream', {
  getSessions: vi.fn().mockResolvedValue([]),
  onUpdateAvailable: vi.fn(),
  onUpdateDownloaded: vi.fn(),
  offUpdate: vi.fn()
})

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />)
    expect(container).toBeTruthy()
  })
})
```

- [ ] **Step 6: Run test — verify it passes**

```bash
npm test -- tests/renderer/App.test.jsx
```

Expected: PASS

- [ ] **Step 7: Verify the app opens in development mode**

```bash
npm run dev
```

Expected: A dark Electron window opens showing "Loading activity..." (Dashboard will be built in Phase 3).

- [ ] **Step 8: Commit**

```bash
git add src/renderer/ tests/renderer/App.test.jsx tests/setup.js
git commit -m "feat: add React renderer entry, root layout, and dark theme CSS"
```

---

## Phase 2: Activity Trackers

This phase builds the three data sources. Each tracker is an independent module that reads one source of activity data and returns a normalized array of session objects.

**All sessions share this shape:**
```js
{
  id: string,          // unique identifier
  type: 'claude' | 'opencode' | 'browser',
  startTime: string,   // ISO 8601 date string e.g. "2026-04-27T10:00:00Z"
  endTime?: string,    // optional — browser history has no end time
  title?: string,      // optional — browser has page title
  url?: string         // optional — browser only
}
```

This consistent shape means the Dashboard and SessionCard components don't need to know which tracker produced a session — they all look the same.

---

### Task 5: Claude CLI Session Tracker

**What we're doing:** Claude CLI (the tool you're using right now) saves session data as JSON files in `~/.claude/projects/`. Each file represents one conversation session. We read all these files and return them as session objects.

**Where Claude saves files:** `~/.claude/projects/<project-name>/<session-id>.json`

**Files:**
- Create: `src/main/trackers/claude.js`
- Test: `tests/main/trackers/claude.test.js`

- [ ] **Step 1: Create the fixture file**

This is a fake session file used during testing — we never read real user data in tests:

```bash
mkdir -p tests/fixtures/claude
```

Create `tests/fixtures/claude/session-001.json`:

```json
{
  "id": "session-001",
  "startTime": "2026-04-27T10:00:00Z",
  "endTime": "2026-04-27T11:30:00Z",
  "messages": 42,
  "project": "TimeStream"
}
```

- [ ] **Step 2: Write the failing test**

```js
// tests/main/trackers/claude.test.js
import { describe, it, expect } from 'vitest'
import { readClaudeSessions } from '../../../src/main/trackers/claude.js'
import path from 'path'

describe('claude tracker', () => {
  it('returns empty array when directory does not exist', async () => {
    // If user has never used Claude CLI, the directory won't exist
    // The tracker must handle this gracefully — not crash
    const result = await readClaudeSessions('/nonexistent/path/that/does/not/exist')
    expect(result).toEqual([])
  })

  it('reads and parses JSON session files from a directory', async () => {
    const fixtureDir = path.join(process.cwd(), 'tests/fixtures/claude')
    const result = await readClaudeSessions(fixtureDir)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('id')
    expect(result[0]).toHaveProperty('startTime')
    expect(result[0]).toHaveProperty('type', 'claude')  // tracker adds this field
  })

  it('skips files that are not valid JSON', async () => {
    // If a file is corrupted or half-written, the tracker must skip it
    const result = await readClaudeSessions('/nonexistent')
    expect(Array.isArray(result)).toBe(true)
  })
})
```

- [ ] **Step 3: Run test — verify it fails**

```bash
npm test -- tests/main/trackers/claude.test.js
```

Expected: FAIL — "Cannot find module '../../../src/main/trackers/claude.js'"

- [ ] **Step 4: Implement the tracker**

```js
// src/main/trackers/claude.js
const fs = require('fs/promises')
const path = require('path')
const os = require('os')

// Default location where Claude CLI saves sessions
const DEFAULT_SESSIONS_DIR = path.join(os.homedir(), '.claude', 'projects')

async function readClaudeSessions(dir = DEFAULT_SESSIONS_DIR) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const jsonFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json'))

    const sessions = await Promise.all(
      jsonFiles.map(async (entry) => {
        try {
          const raw = await fs.readFile(path.join(dir, entry.name), 'utf8')
          const data = JSON.parse(raw)
          // Add 'type' and 'source' fields so the dashboard knows where this came from
          return { ...data, type: 'claude', source: entry.name }
        } catch {
          // Skip files that can't be read or parsed — don't crash the whole tracker
          return null
        }
      })
    )

    // Remove nulls (skipped files) and return clean array
    return sessions.filter(Boolean)
  } catch {
    // Directory doesn't exist or can't be read — return empty array, don't crash
    return []
  }
}

module.exports = { readClaudeSessions }
```

- [ ] **Step 5: Run test — verify it passes**

```bash
npm test -- tests/main/trackers/claude.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/trackers/claude.js tests/main/trackers/claude.test.js tests/fixtures/claude/
git commit -m "feat: add Claude CLI session tracker"
```

---

### Task 6: OpenCode Session Tracker

**What we're doing:** Same pattern as Claude tracker but for OpenCode. OpenCode saves sessions in `~/.opencode/sessions/` as JSON files.

**Files:**
- Create: `src/main/trackers/opencode.js`
- Test: `tests/main/trackers/opencode.test.js`

- [ ] **Step 1: Create the fixture file**

```bash
mkdir -p tests/fixtures/opencode
```

Create `tests/fixtures/opencode/oc-session-001.json`:

```json
{
  "id": "oc-001",
  "startTime": "2026-04-27T09:00:00Z",
  "endTime": "2026-04-27T09:45:00Z",
  "project": "TimeStream"
}
```

- [ ] **Step 2: Write the failing test**

```js
// tests/main/trackers/opencode.test.js
import { describe, it, expect } from 'vitest'
import { readOpenCodeSessions } from '../../../src/main/trackers/opencode.js'
import path from 'path'

describe('opencode tracker', () => {
  it('returns empty array when directory does not exist', async () => {
    const result = await readOpenCodeSessions('/nonexistent')
    expect(result).toEqual([])
  })

  it('reads session files and adds type field', async () => {
    const fixtureDir = path.join(process.cwd(), 'tests/fixtures/opencode')
    const result = await readOpenCodeSessions(fixtureDir)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('type', 'opencode')
    expect(result[0]).toHaveProperty('startTime')
  })
})
```

- [ ] **Step 3: Run test — verify it fails**

```bash
npm test -- tests/main/trackers/opencode.test.js
```

Expected: FAIL

- [ ] **Step 4: Implement the tracker**

```js
// src/main/trackers/opencode.js
const fs = require('fs/promises')
const path = require('path')
const os = require('os')

const DEFAULT_DIR = path.join(os.homedir(), '.opencode', 'sessions')

async function readOpenCodeSessions(dir = DEFAULT_DIR) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = entries.filter(e => e.isFile() && e.name.endsWith('.json'))

    const sessions = await Promise.all(
      files.map(async (entry) => {
        try {
          const raw = await fs.readFile(path.join(dir, entry.name), 'utf8')
          const data = JSON.parse(raw)
          return { ...data, type: 'opencode', source: entry.name }
        } catch {
          return null
        }
      })
    )

    return sessions.filter(Boolean)
  } catch {
    return []
  }
}

module.exports = { readOpenCodeSessions }
```

- [ ] **Step 5: Run test — verify it passes**

```bash
npm test -- tests/main/trackers/opencode.test.js
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/trackers/opencode.js tests/main/trackers/opencode.test.js tests/fixtures/opencode/
git commit -m "feat: add OpenCode session tracker"
```

---

### Task 7: Browser History Tracker

**What we're doing:** Reading Chrome's browser history. Chrome stores your entire browsing history in a SQLite database file at a known location. We read the last 100 URLs and return them as sessions.

**Why we copy the file first:** Chrome keeps its `History` database file open and locked while it is running. If we try to open the locked file directly with SQLite, we get an error. The solution is to first copy the file to a temporary location (which is never locked), read from the copy, then delete it.

**Chrome's time format:** Chrome stores timestamps as microseconds since January 1, 1601 (not Unix epoch which is January 1, 1970). We need to convert this: subtract the offset between 1601 and 1970, divide by 1000 to get milliseconds.

**Files:**
- Create: `src/main/trackers/browser.js`
- Test: `tests/main/trackers/browser.test.js`
- Create: `tests/fixtures/browser/create-fixture.js` (script to generate fake History DB)

- [ ] **Step 1: Install better-sqlite3**

`better-sqlite3` is a Node.js library that reads SQLite database files synchronously:

```bash
npm install better-sqlite3
```

- [ ] **Step 2: Create the fixture database generator**

Create `tests/fixtures/browser/create-fixture.js`:

```js
// Run this once to generate the fake Chrome history database for tests:
// node tests/fixtures/browser/create-fixture.js
const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

const dir = path.join(__dirname)
fs.mkdirSync(dir, { recursive: true })

// Recreate Chrome's exact table structure
const db = new Database(path.join(dir, 'History'))
db.exec(`
  CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    visit_count INTEGER DEFAULT 0,
    last_visit_time INTEGER DEFAULT 0
  );
  INSERT INTO urls (url, title, last_visit_time)
  VALUES
    ('https://github.com/devanshupatil/TimeStream', 'TimeStream - GitHub', 13300000000000000),
    ('https://vitejs.dev', 'Vite | Next Generation Frontend Tooling', 13299900000000000),
    ('https://www.electronjs.org/docs', 'Electron Documentation', 13299800000000000);
`)
db.close()
console.log('Browser history fixture created at tests/fixtures/browser/History')
```

- [ ] **Step 3: Generate the fixture**

```bash
node tests/fixtures/browser/create-fixture.js
```

Expected: `tests/fixtures/browser/History` file created.

- [ ] **Step 4: Write the failing test**

```js
// tests/main/trackers/browser.test.js
import { describe, it, expect } from 'vitest'
import { readBrowserHistory } from '../../../src/main/trackers/browser.js'
import path from 'path'

describe('browser tracker', () => {
  it('returns empty array when history file does not exist', async () => {
    // Handles the case where Chrome is not installed
    const result = await readBrowserHistory('/nonexistent/path/History')
    expect(result).toEqual([])
  })

  it('reads URLs from a valid Chrome history database', async () => {
    const fixturePath = path.join(process.cwd(), 'tests/fixtures/browser/History')
    const result = await readBrowserHistory(fixturePath)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('type', 'browser')
    expect(result[0]).toHaveProperty('url')
    expect(result[0]).toHaveProperty('title')
    expect(result[0]).toHaveProperty('startTime')
    expect(result[0]).toHaveProperty('id')
  })

  it('returns sessions sorted newest first', async () => {
    const fixturePath = path.join(process.cwd(), 'tests/fixtures/browser/History')
    const result = await readBrowserHistory(fixturePath)
    if (result.length > 1) {
      const first = new Date(result[0].startTime)
      const second = new Date(result[1].startTime)
      expect(first >= second).toBe(true)
    }
  })
})
```

- [ ] **Step 5: Run test — verify it fails**

```bash
npm test -- tests/main/trackers/browser.test.js
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 6: Implement the browser tracker**

```js
// src/main/trackers/browser.js
const Database = require('better-sqlite3')
const fs = require('fs')
const os = require('os')
const path = require('path')

// Chrome uses a different epoch than Unix.
// This is the offset in MICROSECONDS between 1601-01-01 and 1970-01-01.
// We use BigInt because this number is too large for a regular JS number.
const CHROME_EPOCH_OFFSET_MICROSECONDS = 11644473600000000n

// Convert Chrome's timestamp (microseconds since 1601) to an ISO date string
function chromeTimeToISO(chromeTime) {
  // Step 1: subtract the 1601→1970 offset to get microseconds since Unix epoch
  // Step 2: divide by 1000 to get milliseconds
  // Step 3: create a Date object and convert to ISO string
  const milliseconds = (BigInt(chromeTime) - CHROME_EPOCH_OFFSET_MICROSECONDS) / 1000n
  return new Date(Number(milliseconds)).toISOString()
}

// Returns the Chrome history file path for the current operating system
function getDefaultHistoryPath() {
  const home = os.homedir()
  switch (process.platform) {
    case 'linux':
      return path.join(home, '.config/google-chrome/Default/History')
    case 'darwin':
      return path.join(home, 'Library/Application Support/Google/Chrome/Default/History')
    case 'win32':
      return path.join(home, 'AppData/Local/Google/Chrome/User Data/Default/History')
    default:
      return null
  }
}

async function readBrowserHistory(historyPath = getDefaultHistoryPath(), limit = 100) {
  // If Chrome isn't installed, or we got a null path, return empty
  if (!historyPath || !fs.existsSync(historyPath)) return []

  // Chrome locks the History file while it is running.
  // We MUST copy it to a temp location before we can open it with SQLite.
  const tmpPath = path.join(os.tmpdir(), `timestream-history-${Date.now()}.db`)

  try {
    fs.copyFileSync(historyPath, tmpPath)

    const db = new Database(tmpPath, { readonly: true })

    // Query the 'urls' table for the most recently visited pages
    const rows = db.prepare(`
      SELECT url, title, last_visit_time
      FROM urls
      WHERE last_visit_time > 0
      ORDER BY last_visit_time DESC
      LIMIT ?
    `).all(limit)

    db.close()
    fs.unlinkSync(tmpPath)   // delete the temporary copy

    return rows.map((row, index) => ({
      id: `browser-${row.last_visit_time}-${index}`,
      type: 'browser',
      url: row.url,
      title: row.title || row.url,   // fallback to URL if title is empty
      startTime: chromeTimeToISO(row.last_visit_time)
      // no endTime — browser history only records last visit time
    }))

  } catch (error) {
    // Clean up temp file if something went wrong
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
    return []
  }
}

module.exports = { readBrowserHistory }
```

- [ ] **Step 7: Run test — verify it passes**

```bash
npm test -- tests/main/trackers/browser.test.js
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/main/trackers/browser.js tests/main/trackers/browser.test.js tests/fixtures/browser/
git commit -m "feat: add browser history tracker reading Chrome SQLite database"
```

---

### Task 8: IPC Handler — Aggregate All Sessions

**What we're doing:** Creating the IPC handler that the renderer calls when it needs data. It runs all three trackers in parallel, merges the results, sorts by time (newest first), and returns the combined array.

**Why parallel (`Promise.all`):** Running trackers one after another would be slow. Claude tracker + OpenCode tracker + Browser tracker could each take 100ms → total 300ms. Running them in parallel means total time = slowest tracker (maybe 100ms). The user sees the dashboard faster.

**Files:**
- Create: `src/main/ipc.js`
- Test: `tests/main/ipc.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/main/ipc.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies — in unit tests we don't actually read files
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() }
}))

vi.mock('../../../src/main/trackers/claude.js', () => ({
  readClaudeSessions: vi.fn().mockResolvedValue([
    { id: 'c1', type: 'claude', startTime: '2026-04-27T10:00:00Z' }
  ])
}))

vi.mock('../../../src/main/trackers/opencode.js', () => ({
  readOpenCodeSessions: vi.fn().mockResolvedValue([
    { id: 'o1', type: 'opencode', startTime: '2026-04-27T09:00:00Z' }
  ])
}))

vi.mock('../../../src/main/trackers/browser.js', () => ({
  readBrowserHistory: vi.fn().mockResolvedValue([
    { id: 'b1', type: 'browser', startTime: '2026-04-27T08:00:00Z', url: 'https://github.com', title: 'GitHub' }
  ])
}))

describe('IPC handlers', () => {
  it('registers the get-sessions handler with ipcMain', async () => {
    const { ipcMain } = await import('electron')
    await import('../../../src/main/ipc.js')
    const registeredChannels = ipcMain.handle.mock.calls.map(call => call[0])
    expect(registeredChannels).toContain('get-sessions')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- tests/main/ipc.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement the IPC handler**

```js
// src/main/ipc.js
const { ipcMain } = require('electron')
const { readClaudeSessions } = require('./trackers/claude')
const { readOpenCodeSessions } = require('./trackers/opencode')
const { readBrowserHistory } = require('./trackers/browser')

function registerIpcHandlers() {
  // 'get-sessions' is the channel name.
  // When the renderer calls window.timestream.getSessions(),
  // the preload calls ipcRenderer.invoke('get-sessions'),
  // which triggers this handler in the main process.
  ipcMain.handle('get-sessions', async () => {
    // Run all three trackers at the same time (parallel, not sequential)
    const [claudeSessions, opencodeSessions, browserSessions] = await Promise.all([
      readClaudeSessions(),
      readOpenCodeSessions(),
      readBrowserHistory()
    ])

    // Merge all sessions into one array
    const allSessions = [...claudeSessions, ...opencodeSessions, ...browserSessions]

    // Sort newest first so the dashboard shows recent activity at the top
    return allSessions.sort(
      (a, b) => new Date(b.startTime) - new Date(a.startTime)
    )
  })
}

module.exports = { registerIpcHandlers }
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test -- tests/main/ipc.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc.js tests/main/ipc.test.js
git commit -m "feat: add IPC handler that aggregates all three session trackers in parallel"
```

---

## Phase 3: Dashboard UI

This phase builds the React components that display the session data. The data flow is:

```
window.timestream.getSessions()   ← Dashboard calls this on mount
         ↓
    IPC message sent to main process
         ↓
    main reads files, returns array
         ↓
    Dashboard receives array, calls setSessions()
         ↓
    React re-renders, passes sessions to ActivityFeed
         ↓
    ActivityFeed maps sessions → SessionCard for each one
         ↓
    User sees their activity timeline
```

---

### Task 9: SessionCard Component

**What we're doing:** A single row in the activity timeline. It shows the session type (with a colour-coded left border), the start time, and the duration if available. Browser sessions show the page title instead of duration.

**Colour coding:**
- Purple (`#6c63ff`) — Claude CLI sessions
- Green (`#10b981`) — OpenCode sessions
- Amber (`#f59e0b`) — Browser sessions

**Files:**
- Create: `src/renderer/components/SessionCard.jsx`
- Test: `tests/renderer/SessionCard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/renderer/SessionCard.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SessionCard from '../../src/renderer/components/SessionCard.jsx'

describe('SessionCard', () => {
  it('renders the session type label', () => {
    render(<SessionCard session={{
      id: '1', type: 'claude',
      startTime: '2026-04-27T10:00:00Z',
      endTime: '2026-04-27T11:30:00Z'
    }} />)
    expect(screen.getByText(/claude/i)).toBeInTheDocument()
  })

  it('shows the start time', () => {
    render(<SessionCard session={{
      id: '1', type: 'claude',
      startTime: '2026-04-27T10:00:00Z'
    }} />)
    // Time should be visible in some format containing the hour
    const timeText = document.body.textContent
    expect(timeText).toBeTruthy()
  })

  it('shows page title for browser sessions instead of duration', () => {
    render(<SessionCard session={{
      id: 'b1', type: 'browser',
      startTime: '2026-04-27T10:00:00Z',
      title: 'GitHub',
      url: 'https://github.com'
    }} />)
    expect(screen.getByText('GitHub')).toBeInTheDocument()
  })

  it('shows duration in minutes when endTime is provided', () => {
    render(<SessionCard session={{
      id: '1', type: 'claude',
      startTime: '2026-04-27T10:00:00Z',
      endTime: '2026-04-27T10:30:00Z'  // 30 minutes later
    }} />)
    expect(screen.getByText('30m')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- tests/renderer/SessionCard.test.jsx
```

Expected: FAIL

- [ ] **Step 3: Implement SessionCard**

```jsx
// src/renderer/components/SessionCard.jsx
import React from 'react'

const TYPE_COLORS = {
  claude:   '#6c63ff',   // purple
  opencode: '#10b981',   // green
  browser:  '#f59e0b'    // amber
}

export default function SessionCard({ session }) {
  const { type, startTime, endTime, title, url } = session

  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : null

  // Calculate duration in minutes if we have both start and end times
  const durationMinutes = end ? Math.round((end - start) / 60000) : null

  // Format time as "10:00 AM" (user's local timezone)
  const formattedTime = start.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div
      className="session-card"
      style={{ borderLeftColor: TYPE_COLORS[type] || '#64748b' }}
    >
      <span className="session-type">{type}</span>
      <span className="session-time">{formattedTime}</span>

      {/* Browser sessions show page title; others show duration */}
      {type === 'browser' && title ? (
        <span className="session-title" title={url}>{title}</span>
      ) : durationMinutes !== null ? (
        <span className="session-duration">{durationMinutes}m</span>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test -- tests/renderer/SessionCard.test.jsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/SessionCard.jsx tests/renderer/SessionCard.test.jsx
git commit -m "feat: add SessionCard component with type colour coding and duration display"
```

---

### Task 10: ActivityFeed Component

**What we're doing:** A scrollable list that renders a `SessionCard` for each session. Shows a friendly "No activity" message when the list is empty.

**Files:**
- Create: `src/renderer/components/ActivityFeed.jsx`
- Test: `tests/renderer/ActivityFeed.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/renderer/ActivityFeed.test.jsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ActivityFeed from '../../src/renderer/components/ActivityFeed.jsx'

const mockSessions = [
  { id: '1', type: 'claude',   startTime: '2026-04-27T10:00:00Z' },
  { id: '2', type: 'opencode', startTime: '2026-04-27T09:00:00Z' },
  { id: '3', type: 'browser',  startTime: '2026-04-27T08:00:00Z', title: 'GitHub', url: 'https://github.com' }
]

describe('ActivityFeed', () => {
  it('renders a SessionCard for each session', () => {
    render(<ActivityFeed sessions={mockSessions} />)
    expect(screen.getByText('claude')).toBeInTheDocument()
    expect(screen.getByText('opencode')).toBeInTheDocument()
    expect(screen.getByText('browser')).toBeInTheDocument()
  })

  it('shows empty state message when sessions array is empty', () => {
    render(<ActivityFeed sessions={[]} />)
    expect(screen.getByText(/no activity/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- tests/renderer/ActivityFeed.test.jsx
```

Expected: FAIL

- [ ] **Step 3: Implement ActivityFeed**

```jsx
// src/renderer/components/ActivityFeed.jsx
import React from 'react'
import SessionCard from './SessionCard.jsx'

export default function ActivityFeed({ sessions }) {
  if (!sessions || sessions.length === 0) {
    return (
      <div className="empty-state">
        No activity recorded yet. Start a Claude or OpenCode session, or open Chrome.
      </div>
    )
  }

  return (
    <div className="activity-feed">
      {sessions.map(session => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test -- tests/renderer/ActivityFeed.test.jsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/ActivityFeed.jsx tests/renderer/ActivityFeed.test.jsx
git commit -m "feat: add ActivityFeed component with empty state"
```

---

### Task 11: Dashboard Component

**What we're doing:** The main view. On mount it calls `window.timestream.getSessions()` (which goes through IPC to the main process), waits for the response, and then renders the `ActivityFeed` with the data.

**Why `useState(null)` not `useState([])`:** We use `null` to distinguish "data not loaded yet" from "data loaded but empty". This lets us show a loading spinner while waiting, and the empty state after loading. If we used `[]`, we couldn't tell the difference.

**Files:**
- Create: `src/renderer/components/Dashboard.jsx`
- Test: `tests/renderer/Dashboard.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/renderer/Dashboard.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Dashboard from '../../src/renderer/components/Dashboard.jsx'

beforeEach(() => {
  vi.stubGlobal('timestream', {
    getSessions: vi.fn().mockResolvedValue([
      { id: '1', type: 'claude', startTime: '2026-04-27T10:00:00Z' }
    ])
  })
})

describe('Dashboard', () => {
  it('shows loading state while sessions are being fetched', () => {
    render(<Dashboard />)
    // Before the Promise resolves, loading text should be visible
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows sessions after data loads', async () => {
    render(<Dashboard />)
    // Wait for the Promise to resolve and React to re-render
    await waitFor(() =>
      expect(screen.getByText(/claude/i)).toBeInTheDocument()
    )
  })

  it('shows session count in header', async () => {
    render(<Dashboard />)
    await waitFor(() =>
      expect(screen.getByText(/1 session/i)).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- tests/renderer/Dashboard.test.jsx
```

Expected: FAIL

- [ ] **Step 3: Implement Dashboard**

```jsx
// src/renderer/components/Dashboard.jsx
import React, { useEffect, useState } from 'react'
import ActivityFeed from './ActivityFeed.jsx'

export default function Dashboard() {
  // null = loading, [] = loaded but empty, [...] = loaded with data
  const [sessions, setSessions] = useState(null)

  useEffect(() => {
    // On component mount: ask main process for all sessions via IPC
    window.timestream.getSessions().then(data => {
      setSessions(data)
    })
  }, [])  // [] means run only once on mount, not on every re-render

  if (sessions === null) {
    return <div className="loading">Loading activity...</div>
  }

  const sessionWord = sessions.length === 1 ? 'session' : 'sessions'

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>TimeStream</h1>
        <span className="session-count">
          {sessions.length} {sessionWord} tracked
        </span>
      </header>
      <ActivityFeed sessions={sessions} />
    </main>
  )
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test -- tests/renderer/Dashboard.test.jsx
```

Expected: PASS

- [ ] **Step 5: Run full test suite to make sure nothing is broken**

```bash
npm test
```

Expected: ALL tests pass

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/Dashboard.jsx tests/renderer/Dashboard.test.jsx
git commit -m "feat: add Dashboard component — loads sessions via IPC and renders activity feed"
```

---

## Phase 4: Auto-Update

This phase adds the update-checking logic. It has two parts:
1. **Main process** (`updater.js`) — runs `electron-updater` which contacts GitHub, compares versions, downloads silently
2. **Renderer** (`UpdateBanner.jsx`) — listens for update events and shows the banner

---

### Task 12: Updater — Main Process

**What we're doing:** Setting up `electron-updater` in the main process. It will:
1. Wait 5 seconds after the app starts (so the window has time to fully load)
2. Silently check GitHub Releases for a `latest.yml` file
3. Compare the version in `latest.yml` with the current app version in `package.json`
4. If a newer version exists: start downloading it in the background, send `update-available` event to renderer
5. When download finishes: send `update-downloaded` event to renderer
6. If user clicks "Restart & Update": call `quitAndInstall()` which restarts the app and runs the installer

**How electron-updater knows where to check:** It reads the `publish` config from `package.json` (the `owner` and `repo` fields) and constructs the GitHub Releases API URL automatically.

**Files:**
- Create: `src/main/updater.js`
- Test: `tests/main/updater.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/main/updater.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdates: vi.fn().mockResolvedValue(null),
    on: vi.fn(),
    quitAndInstall: vi.fn(),
    logger: null,
    autoDownload: true
  }
}))

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn() }
}))

const fakeWindow = { webContents: { send: vi.fn() } }

describe('updater', () => {
  beforeEach(() => {
    vi.useFakeTimers()  // control setTimeout in tests
  })

  it('exports an initUpdater function', async () => {
    const { initUpdater } = await import('../../src/main/updater.js')
    expect(typeof initUpdater).toBe('function')
  })

  it('registers update-available event on autoUpdater', async () => {
    const { autoUpdater } = await import('electron-updater')
    const { initUpdater } = await import('../../src/main/updater.js')
    initUpdater(fakeWindow)
    const registeredEvents = autoUpdater.on.mock.calls.map(c => c[0])
    expect(registeredEvents).toContain('update-available')
  })

  it('registers update-downloaded event on autoUpdater', async () => {
    const { autoUpdater } = await import('electron-updater')
    const { initUpdater } = await import('../../src/main/updater.js')
    initUpdater(fakeWindow)
    const registeredEvents = autoUpdater.on.mock.calls.map(c => c[0])
    expect(registeredEvents).toContain('update-downloaded')
  })

  it('calls checkForUpdates after 5 second delay', async () => {
    const { autoUpdater } = await import('electron-updater')
    const { initUpdater } = await import('../../src/main/updater.js')
    initUpdater(fakeWindow)
    // Before 5 seconds: not called yet
    expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    // Advance timer by 5 seconds
    vi.advanceTimersByTime(5000)
    expect(autoUpdater.checkForUpdates).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- tests/main/updater.test.js
```

Expected: FAIL

- [ ] **Step 3: Implement the updater**

```js
// src/main/updater.js
const { autoUpdater } = require('electron-updater')
const { ipcMain } = require('electron')

function initUpdater(win) {
  // Disable default console logging from electron-updater
  // (we handle events ourselves and show UI instead of logs)
  autoUpdater.logger = null

  // When a new version is found and starts downloading:
  // Send the version info to the renderer so it can show the banner
  autoUpdater.on('update-available', (info) => {
    win.webContents.send('update-available', {
      version: info.version
    })
  })

  // When the new version has finished downloading:
  // Tell renderer to change banner from "Downloading..." to "Restart & Update"
  autoUpdater.on('update-downloaded', (info) => {
    win.webContents.send('update-downloaded', {
      version: info.version
    })
  })

  // When renderer sends 'install-update' (user clicked "Restart & Update"):
  // Quit the app and run the installer — app will relaunch on new version
  ipcMain.on('install-update', () => {
    autoUpdater.quitAndInstall(
      false,  // isSilent: false = show installer progress on Windows
      true    // isForceRunAfter: true = relaunch app after install
    )
  })

  // Wait 5 seconds before checking — gives the window time to fully load
  // so the banner can appear correctly after first render
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Silently ignore errors (e.g. no internet, GitHub down)
    })
  }, 5000)
}

module.exports = { initUpdater }
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test -- tests/main/updater.test.js
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/updater.js tests/main/updater.test.js
git commit -m "feat: add auto-updater — checks GitHub Releases on startup, notifies renderer"
```

---

### Task 13: UpdateBanner UI Component

**What we're doing:** The purple banner that appears at the top of the app when an update is available. It has two states:

1. **Downloading** (shown when `update-available` fires): `"Downloading update v1.1.0..."`
2. **Ready** (shown when `update-downloaded` fires): `"v1.1.0 downloaded — restart to install"` + a **"Restart & Update"** button

When the user clicks the button, it calls `window.timestream.installUpdate()` which sends `install-update` through IPC to the main process, which calls `autoUpdater.quitAndInstall()`.

**Why `useEffect` cleanup (`offUpdate`):** If the component unmounts (which it wouldn't normally, but as good practice), we remove the IPC event listeners to prevent memory leaks.

**Files:**
- Create: `src/renderer/components/UpdateBanner.jsx`
- Test: `tests/renderer/UpdateBanner.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// tests/renderer/UpdateBanner.test.jsx
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UpdateBanner from '../../src/renderer/components/UpdateBanner.jsx'

let onAvailableCb = null
let onDownloadedCb = null

beforeEach(() => {
  onAvailableCb = null
  onDownloadedCb = null

  vi.stubGlobal('timestream', {
    onUpdateAvailable: vi.fn(cb => { onAvailableCb = cb }),
    onUpdateDownloaded: vi.fn(cb => { onDownloadedCb = cb }),
    installUpdate: vi.fn(),
    offUpdate: vi.fn()
  })
})

describe('UpdateBanner', () => {
  it('renders nothing when no update is available', () => {
    const { container } = render(<UpdateBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows downloading message when update-available fires', () => {
    render(<UpdateBanner />)
    act(() => { onAvailableCb?.({ version: '1.1.0' }) })
    expect(screen.getByText(/downloading update v1.1.0/i)).toBeInTheDocument()
  })

  it('shows restart button when update-downloaded fires', () => {
    render(<UpdateBanner />)
    act(() => { onAvailableCb?.({ version: '1.1.0' }) })
    act(() => { onDownloadedCb?.({ version: '1.1.0' }) })
    expect(screen.getByRole('button', { name: /restart/i })).toBeInTheDocument()
  })

  it('calls installUpdate when restart button is clicked', async () => {
    render(<UpdateBanner />)
    act(() => { onAvailableCb?.({ version: '1.1.0' }) })
    act(() => { onDownloadedCb?.({ version: '1.1.0' }) })
    await userEvent.click(screen.getByRole('button', { name: /restart/i }))
    expect(window.timestream.installUpdate).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Install userEvent (needed for click simulation)**

```bash
npm install --save-dev @testing-library/user-event
```

- [ ] **Step 3: Run test — verify it fails**

```bash
npm test -- tests/renderer/UpdateBanner.test.jsx
```

Expected: FAIL

- [ ] **Step 4: Implement UpdateBanner**

```jsx
// src/renderer/components/UpdateBanner.jsx
import React, { useState, useEffect } from 'react'

export default function UpdateBanner() {
  // null = no update | { version, downloaded: false } = downloading | { version, downloaded: true } = ready
  const [updateInfo, setUpdateInfo] = useState(null)

  useEffect(() => {
    // Register listeners for update events sent from main process via IPC
    window.timestream.onUpdateAvailable((info) => {
      setUpdateInfo({ version: info.version, downloaded: false })
    })

    window.timestream.onUpdateDownloaded((info) => {
      setUpdateInfo({ version: info.version, downloaded: true })
    })

    // Cleanup: remove listeners when component unmounts
    return () => window.timestream.offUpdate()
  }, [])

  // Hide banner completely when no update is in progress
  if (!updateInfo) return null

  return (
    <div className="update-banner" role="status">
      {updateInfo.downloaded ? (
        <>
          <span>
            v{updateInfo.version} is ready — restart to install
          </span>
          <button onClick={() => window.timestream.installUpdate()}>
            Restart &amp; Update
          </button>
        </>
      ) : (
        <span>Downloading update v{updateInfo.version}...</span>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run test — verify it passes**

```bash
npm test -- tests/renderer/UpdateBanner.test.jsx
```

Expected: PASS

- [ ] **Step 6: Run the full test suite one final time**

```bash
npm test
```

Expected: ALL tests pass. Count should be 20+ tests.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/UpdateBanner.jsx tests/renderer/UpdateBanner.test.jsx package.json package-lock.json
git commit -m "feat: add UpdateBanner — shows update progress and restart button"
```

---

## Phase 5: Packaging & Distribution

This phase turns the source code into a real installer that anyone can download and run. The user's machine never sees our source files — they only get a compiled binary.

**What electron-builder does:** It takes all the files listed in the `files` array of the config, bundles them with a copy of the Electron runtime (Chromium + Node.js), and wraps the whole thing in an OS-native installer format.

**What's included in the installer:**
- The Electron runtime (Chromium + Node.js) — user does not need to install Node.js separately
- `src/main/` — your main process code
- `src/preload/` — your preload script
- `dist/renderer/` — the compiled React app (HTML/JS/CSS)
- `node_modules/` — only production dependencies (electron-updater, better-sqlite3, react)

**What's NOT included:** source JSX files, test files, dev dependencies, .git folder

---

### Task 14: electron-builder Config

**Files:**
- Create: `electron-builder.yml`

- [ ] **Step 1: Create electron-builder.yml**

This file controls everything about packaging and publishing:

```yaml
# electron-builder.yml

# Unique ID for your app — used by OS to identify the app across updates
appId: com.devanshupatil.timestream

# Name shown to users (in taskbar, app menu, installer)
productName: TimeStream

copyright: Copyright © 2026 Devanshu Prakash Patil

directories:
  output: release    # all built installers go into the release/ folder

# Which files to bundle into the installer
files:
  - src/main/**       # main process code
  - src/preload/**    # preload bridge
  - dist/renderer/**  # compiled React (must run build:renderer first)
  - package.json      # electron-updater reads version from here

# Where to publish releases — electron-updater will also check this URL for updates
publish:
  provider: github
  owner: devanshupatil
  repo: TimeStream

# Linux: two formats
# AppImage = portable, runs on any Linux without installing
# deb = Debian/Ubuntu package manager format
linux:
  target:
    - target: AppImage
    - target: deb
  category: Development   # where it appears in app menus

# Windows: NSIS = standard Windows installer with wizard
win:
  target:
    - target: nsis
      arch: [x64]   # 64-bit only (covers 99% of Windows machines)

# macOS: DMG = drag-to-Applications disk image (standard Mac distribution)
mac:
  target:
    - target: dmg

# NSIS installer options (Windows)
nsis:
  oneClick: false                          # show installer wizard, don't just silently install
  allowToChangeInstallationDirectory: true # user can pick where to install
  createDesktopShortcut: true              # add icon to desktop
  createStartMenuShortcut: true            # add to Start Menu
```

- [ ] **Step 2: Update scripts in package.json**

The build scripts should already be in package.json from Task 1. Verify they match:

```json
"scripts": {
  "dev":           "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
  "build:renderer": "vite build",
  "build:dist":    "npm run build:renderer && electron-builder",
  "build:linux":   "npm run build:renderer && electron-builder --linux",
  "build:win":     "npm run build:renderer && electron-builder --win",
  "build:mac":     "npm run build:renderer && electron-builder --mac",
  "test":          "vitest run",
  "test:watch":    "vitest"
}
```

- [ ] **Step 3: Do a test build for Linux**

```bash
npm run build:linux
```

Expected output (takes 2-5 minutes):
```
  • electron-builder  version=24.x
  • loaded configuration  file=electron-builder.yml
  • description is missed in the package.json  appPackageFile=...
  • packaging       platform=linux arch=x64
  • building        target=AppImage
  • building        target=deb
  • built           path=release/TimeStream-1.0.0.AppImage
  • built           path=release/TimeStream-1.0.0-amd64.deb
```

- [ ] **Step 4: Verify the AppImage runs**

```bash
chmod +x release/TimeStream-1.0.0.AppImage
./release/TimeStream-1.0.0.AppImage
```

Expected: The app opens normally, same as in development.

- [ ] **Step 5: Commit**

```bash
git add electron-builder.yml
git commit -m "feat: add electron-builder packaging config for Linux, Windows, and macOS"
```

---

### Task 15: GitHub Actions Release Pipeline

**What we're doing:** Creating a CI/CD pipeline that automatically builds and publishes installers every time you push a version tag to GitHub.

**How it works:**
1. You run `npm version minor` → bumps `1.0.0` to `1.1.0` + creates git tag `v1.1.0`
2. You run `git push --tags` → GitHub sees the new `v1.1.0` tag
3. GitHub Actions triggers the workflow
4. Three jobs run in parallel — one on Ubuntu, one on Windows, one on macOS
5. Each job: installs Node.js → runs tests → builds the installer → uploads to GitHub Releases
6. GitHub Releases now has:
   - `TimeStream-1.1.0.AppImage` (from Ubuntu job)
   - `TimeStream-1.1.0-amd64.deb` (from Ubuntu job)
   - `TimeStream-1.1.0.exe` (from Windows job)
   - `TimeStream-1.1.0.dmg` (from macOS job)
   - `latest.yml` (manifest file that `electron-updater` checks on each installed app's startup)

**Note on `GH_TOKEN`:** `secrets.GITHUB_TOKEN` is automatically provided by GitHub Actions — you don't need to create this manually. It's used to authenticate when uploading release assets.

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create the workflows directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create the release workflow**

```yaml
# .github/workflows/release.yml
name: Build & Release

# Trigger: only when a tag starting with 'v' is pushed
# e.g. v1.0.0, v1.1.0, v2.0.0-beta
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    # Build on all three platforms in parallel
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    steps:
      # Step 1: Download the source code
      - name: Checkout repository
        uses: actions/checkout@v4

      # Step 2: Install Node.js 20 (LTS)
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'   # cache node_modules between runs for speed

      # Step 3: Install all dependencies exactly as in lockfile
      - name: Install dependencies
        run: npm ci

      # Step 4: Run the test suite — if tests fail, don't publish
      - name: Run tests
        run: npm test

      # Step 5: Build the React app and package into installer,
      # then upload installer to GitHub Releases
      # GH_TOKEN is automatically provided — no manual setup needed
      - name: Build and publish installer
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run build:dist -- --publish always
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions release pipeline — builds installers on all 3 platforms on tag push"
```

---

## How to Ship Updates — Step by Step

Once the app is live, this is the exact process every time you add a feature and want users to get the update:

```bash
# Step 1: Finish your feature, make sure all tests pass
npm test

# Step 2: Decide what kind of change this is:
#   patch (1.0.0 → 1.0.1) = bug fix
#   minor (1.0.0 → 1.1.0) = new feature, backwards compatible
#   major (1.0.0 → 2.0.0) = breaking change
npm version minor    # or patch / major

# This command does three things automatically:
#   1. Updates "version" in package.json
#   2. Creates a git commit: "1.1.0"
#   3. Creates a git tag: "v1.1.0"

# Step 3: Push the code AND the tag to GitHub
git push origin main --tags

# Step 4: Watch GitHub Actions build the installers
# Go to: https://github.com/devanshupatil/TimeStream/actions
# Three jobs run in parallel (Ubuntu / Windows / Mac) — takes ~10 minutes

# Step 5: When all jobs are green, the release is live
# Go to: https://github.com/devanshupatil/TimeStream/releases
# You'll see the new release with all installer files attached

# Step 6: Every installed copy of the app will detect the update
# on their next startup (after 5 second delay) and show the banner
```

---

## Testing the Update Flow Locally (Without GitHub)

You can test the complete update flow without publishing to GitHub:

```bash
# Terminal 1: run a simple local update server
npm install -g serve
mkdir -p /tmp/ts-update-server
npm run build:linux
cp release/latest.yml /tmp/ts-update-server/
cp release/*.AppImage /tmp/ts-update-server/
serve /tmp/ts-update-server -p 8080

# In electron-builder.yml, temporarily change:
# publish:
#   provider: generic
#   url: http://localhost:8080

# Then build v1.0.0, install it, bump to v1.1.0, build again,
# copy to server — the running v1.0.0 app will detect v1.1.0 and show the banner
```

---

## What Users Experience (Summary Table)

| User Action | What Happens |
|-------------|-------------|
| Downloads app for first time | Gets `.AppImage` / `.exe` / `.dmg` from GitHub Releases. Double-click to install. |
| Opens app | Dark dashboard loads showing all tracked sessions |
| App runs silently | After 5 seconds: checks `latest.yml` on GitHub for a new version |
| New version exists | Purple banner appears: "Downloading update v1.1.0..." |
| Download finishes | Banner changes to: "v1.1.0 is ready — restart to install" + button |
| Clicks "Restart & Update" | App quits, installer runs automatically, app relaunches on v1.1.0 |
| No new version | Nothing shown. App works as normal. |
| Chrome history visible | Browser sessions appear in the timeline with page titles |
| Claude session tracked | Each conversation appears as a purple-bordered card |
| OpenCode session tracked | Each session appears as a green-bordered card |
