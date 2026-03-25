# TimeStream Update Plan

**Date:** 2026-03-22
**Goal:** Update TimeStream to production-ready architecture with background agent

---

## Phase 1: Database & Agent Foundation

### Step 1.1: Create Shared Constants ✅
- [x] Create `src/shared/constants.js` with:
  - Database path: `~/.timestream/timestream.db`
  - Agent log path: `~/.timestream/logs/`
  - Config paths: `~/.timestream/agent.json`, `~/.timestream/app.json`
  - Platform detection (macOS/Linux/Windows)

### Step 1.2: Set Up SQLite Database ✅
- [x] Install `better-sqlite3` package
- [x] Create `src/agent/database/sqlite.js`
- [x] Implement database initialization
- [x] Add WAL mode for better performance
- [x] Write tests for database operations

### Step 1.3: Create Agent Entry Point ✅
- [x] Create `src/agent/index.js`
- [x] Implement agent initialization and lifecycle
- [x] Add command-line arguments (--config, --help, --version)

### Step 1.4: Implement Agent Logging ✅
- [x] Create `src/shared/logger.js`
- [x] Log levels, file rotation, console output

### Step 1.5: Create Agent Config System ✅
- [x] Create `src/agent/config/settings.js`
- [x] Load/save config, hot reload

### Step 1.6: Create OS Autostart Files ✅
- [x] `resources/macos/com.timestream.agent.plist` (LaunchAgent)
- [x] `resources/linux/timestream-agent.service` (systemd)
- [x] `resources/windows/timestream-agent.xml` (Windows Task Scheduler)

### Step 1.7: Create Agent Process Manager ✅
- [x] Create `src/agent/processManager.js`
- [x] PID file, crash recovery, signal handling

---

## Phase 2: CLI Readers (Query-Only) ✅

### Step 2.1: Create OpenCode Reader ✅
- [x] Create `src/agent/readers/opencode.js`
- [x] Query OpenCode SQLite DB, cache results

### Step 2.2: Create Claude CLI Reader ✅
- [x] Create `src/agent/readers/claudecli.js`
- [x] Parse JSONL files, skip sidechains

### Step 2.3: Create App-Side Readers ✅
- [x] `src/app/readers/opencode.js`
- [x] `src/app/readers/claudecli.js`
- [x] `src/app/readers/browser.js`
- [x] `src/app/readers/index.js`

### Step 2.4: Create Unified Reader Interface ✅
- [x] `src/app/api/query.js` - Query Engine with IPC handlers
- [x] Query all sources, merge, sort, filter

---

## Phase 3: Browser Collector ✅

### Step 3.1-3.5: Browser Collector + URL Parser + Categorizer ✅
- [x] `src/agent/collectors/browser.js` (includes Chrome, Firefox collectors)
- [x] URL metadata extraction in browser.js
- [x] Activity categorization

### Step 3.6: Create Event Queue ✅
- [x] `src/agent/queue/eventQueue.js`
- [x] Batch writes, flush on shutdown, deduplication

### Step 3.7-3.8: Deduplication ✅
- [x] Integrated in browser collector and event queue

---

## Phase 4: App Refactor ✅

### Step 4.1: Keep Old Watchers (Backward Compatible) ✅
- [x] Kept existing watchers for now (can be removed later)

### Step 4.2-4.3: Unified Query API ✅
- [x] `src/app/api/query.js` with IPC handlers
- [x] Register handlers in main.js

### Step 4.4: Update Preload Script ✅
- [x] Added new API functions alongside existing ones:
  - `getActivities(date)`
  - `getSources()`
  - `getStats(date)`
  - etc.

### Step 4.5: Update Renderer Dashboard
- [ ] Update `renderer/index.html` and dashboard
- [ ] Use unified query API

### Step 4.6: Add System Tray ✅
- [x] Integrated in `src/main.js`
- [x] Open, Hide, Quit menu

### Step 4.7: Test App Integration
- [ ] Test all integrations

---

## Phase 5: Installation & Distribution

### Step 5.1: Set Up Electron Builder
- [ ] Update `package.json`:
  - Add `electron-builder` config
  - Set app name, version, icon
  - Configure for macOS, Windows, Linux
- [ ] Create `electron-builder.yml`:
  - App IDs
  - File associations
  - Code signing (optional)

### Step 5.2: Create macOS Package
- [ ] Create `resources/macos/` files:
  - App icon (1024x1024, 512, 256, 128, 64, 32, 16)
  - DMG background image
  - LaunchAgent plist
- [ ] Configure DMG installer:
  - Install app to `/Applications`
  - Copy LaunchAgent to `~/Library/LaunchAgents/`
  - Create uninstaller

### Step 5.3: Create Windows Package
- [ ] Create `resources/windows/` files:
  - App icon (256x256, 48, 32, 16)
  - NSIS installer script
- [ ] Configure NSIS installer:
  - Install to Program Files
  - Create Start Menu shortcut
  - Register Windows Task Scheduler for autostart
  - Create uninstaller with cleanup

### Step 5.4: Create Linux Package
- [ ] Create `resources/linux/` files:
  - App icon (512, 256, 128, 64, 48, 32, 16, 24)
  - .desktop file
  - AppStream metadata
  - systemd user unit
- [ ] Configure AppImage:
  - Bundle agent binary
  - Desktop integration
- [ ] Configure deb/rpm:
  - Proper file placement
  - systemd unit installation

### Step 5.5: Create Agent Binary
- [ ] Configure electron to build agent binary
- [ ] Bundle agent for all platforms:
  - macOS: `TimeStream Agent.app`
  - Windows: `timestream-agent.exe`
  - Linux: `timestream-agent`
- [ ] Test agent standalone execution

### Step 5.6: Create First-Run Setup
- [ ] Create `src/app/setup.js`
- [ ] Features:
  - Welcome screen
  - Choose autostart preference
  - Choose data sources to track
  - Show browser extension setup
  - Create config files
- [ ] Trigger on first launch only

### Step 5.7: Test Installation
- [ ] Test clean macOS installation
- [ ] Test clean Windows installation (VM)
- [ ] Test clean Linux installation
- [ ] Verify agent starts on boot
- [ ] Verify uninstaller removes all files
- [ ] Test upgrade from previous version

---

## Success Criteria

### Phase 1: Database & Agent Foundation
- [ ] SQLite database created at `~/.timestream/timestream.db`
- [ ] Agent starts and logs to `~/.timestream/logs/agent.log`
- [ ] Agent autostart files created for all platforms
- [ ] Agent can be started/stopped independently

### Phase 2: CLI Readers (Query-Only)
- [ ] OpenCode sessions queryable from `~/.local/share/opencode/opencode.db`
- [ ] Claude CLI sessions queryable from `~/.claude/projects/*/*.jsonl`
- [ ] No CLI session data stored in TimeStream DB
- [ ] Readers return data in < 100ms

### Phase 3: Browser Collector
- [ ] Chrome history readable (macOS/Linux)
- [ ] Firefox history readable (all platforms)
- [ ] YouTube URLs detected and categorized
- [ ] GitHub URLs detected and categorized
- [ ] Browser activities stored in TimeStream SQLite
- [ ] Event queue batches every 30 seconds

### Phase 4: App Refactor
- [ ] Old watchers removed from app
- [ ] Unified query API returns all sources
- [ ] Timeline shows OpenCode + Claude CLI + Browser activities
- [ ] System tray icon works
- [ ] App uses < 100MB RAM

### Phase 5: Installation & Distribution
- [ ] macOS DMG installs correctly
- [ ] Windows installer works
- [ ] Linux AppImage runs
- [ ] Agent autostarts on boot
- [ ] Uninstall removes all components

### Overall
- [ ] Works when app is closed (agent running)
- [ ] No data duplication
- [ ] < 2% CPU usage when idle
- [ ] < 50MB additional RAM usage (agent)

---

*Last Updated: March 22, 2026*
