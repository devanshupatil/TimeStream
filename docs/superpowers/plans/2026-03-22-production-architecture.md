# TimeStream Production Architecture Plan

**Date:** 2026-03-22
**Status:** Planning
**Goal:** Build a production-ready TimeStream with background agent for 24/7 activity capture (local-only)

---

## Key Design Principle

> **"Don't store what already exists elsewhere"**

| Data Source | Storage Location | TimeStream Action |
|-------------|------------------|-------------------|
| OpenCode sessions | `~/.local/share/opencode/opencode.db` | **Query only** (no storage) |
| Claude CLI sessions | `~/.claude/projects/*/*.jsonl` | **Query only** (no storage) |
| Browser history | Platform-specific locations | **Store in SQLite** |
| YouTube videos | Browser history | **Store in SQLite** |
| Manual entries | None | **Store in SQLite** |

**Why?** Avoids data duplication, saves storage space, single source of truth.

---

## Current State Problem

```
┌─────────────────────────────────────────────────────────────┐
│                     TimeStream (Current)                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Electron App (main.js)                              │  │
│  │                                                      │  │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │  │
│  │  │ OpenCode   │  │ Claude CLI │  │   Renderer   │  │  │
│  │  │ Watcher    │  │  Watcher   │  │   (UI)       │  │  │
│  │  └────────────┘  └────────────┘  └──────────────┘  │  │
│  │         │                │               │         │  │
│  │         └────────────────┴───────────────┘         │  │
│  │                          │                          │  │
│  │                    JSON Files                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│              ✗ FAILS WHEN APP IS CLOSED                    │
└─────────────────────────────────────────────────────────────┘
```

**Problems:**
- No background service when app is closed
- No browser activity capture
- No system-level autostart
- Data only captured while app is running
- JSON files (not ideal for concurrent access)

---

## Production Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    USER'S SYSTEM                                      │
│                                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────────────┐  │
│  │                        TimeStream Agent (Background Service)                      │  │
│  │                                                                                │  │
│  │   ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐        │  │
│  │   │   OpenCode     │      │   Claude CLI    │      │    Browser      │        │  │
│  │   │   Reader       │      │   Reader        │      │   Collector     │        │  │
│  │   │   (Query)      │      │   (Query)       │      │   (Capture)     │        │  │
│  │   └────────┬────────┘      └────────┬────────┘      └────────┬────────┘        │  │
│  │            │                         │                         │               │  │
│  │            │                         │                         │               │  │
│  │            │                         │                         ▼               │  │
│  │            │                         │                 ┌───────────────┐        │  │
│  │            │                         │                 │   SQLite DB   │        │  │
│  │            │                         │                 │   (Browser    │        │  │
│  │            │                         │                 │   Activities  │        │  │
│  │            │                         │                 │   Only)       │        │  │
│  │            │                         │                 └───────────────┘        │  │
│  └────────────┼─────────────────────────┼─────────────────────────────────────────┘  │
│               │                         │                                              │
│               │                         │           ┌─────────────────────────────┐  │
│               │                         │           │   TimeStream App (GUI)      │  │
│               │                         │           │                             │  │
│               └─────────────────────────┴──────────▶│   Query all sources         │  │
│                                                       │   Display unified timeline  │  │
│                                                       └─────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                    ┌─────────────────────────────────────────────────────┐
                    │                   DATA SOURCES                        │
                    ├─────────────────────────────────────────────────────┤
                    │  ┌───────────────────┐  ┌────────────────────────┐  │
                    │  │   OpenCode DB     │  │   Claude CLI JSONL     │  │
                    │  │   (READ ONLY)     │  │   (READ ONLY)         │  │
                    │  │ ~/.local/share/   │  │ ~/.claude/projects/   │  │
                    │  │ opencode/        │  │                       │  │
                    │  └───────────────────┘  └────────────────────────┘  │
                    │                                                       │
                    │  ┌─────────────────────────────────────────────────┐  │
                    │  │              TimeStream SQLite DB                │  │
                    │  │              ~/.timestream/timestream.db       │  │
                    │  │                                                 │  │
                    │  │   • Browser activities (YouTube, GitHub)       │  │
                    │  │   • Manual entries                             │  │
                    │  │   • NOT: CLI sessions (already exist!)         │  │
                    │  └─────────────────────────────────────────────────┘  │
                    └─────────────────────────────────────────────────────┘
```

---

## Component Architecture

### 1. TimeStream Agent (Background Service)

**Purpose:** Runs 24/7, queries/collects all activity regardless of app state

**Location:** `src/agent/`

```
src/agent/
├── index.js              # Entry point, process management
├── readers/              # Query existing data sources (no storage)
│   ├── opencode.js       # Query OpenCode SQLite DB
│   └── claudecli.js      # Query Claude CLI JSONL files
├── collectors/           # Collect NEW data (write to SQLite)
│   └── browser.js        # Read browser history, store in SQLite
├── database/
│   └── sqlite.js         # SQLite operations for activities
├── queue/
│   └── eventQueue.js     # Event buffering & batching
└── config/
    └── settings.js       # Agent configuration
```

**Key Difference:**
- **Readers** → Query from source DBs/files (no duplication)
- **Collectors** → Capture new data and store in TimeStream DB

---

### 2. TimeStream SQLite Database

**Purpose:** Store activities that have NO existing source

**Location:** `~/.timestream/timestream.db`

**Schema:**
```sql
-- Activities table (browser history + manual entries only)
CREATE TABLE activities (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,               -- 'youtube', 'github', 'article', 'manual'
    source_label TEXT NOT NULL,         -- 'YouTube', 'GitHub', 'Article', 'Manual'
    title TEXT NOT NULL,
    url TEXT,
    description TEXT,
    category TEXT,                        -- 'learning', 'coding', 'research', 'communication'
    timestamp INTEGER NOT NULL,          -- Unix timestamp (ms)
    duration INTEGER,                    -- Duration in seconds (for videos)
    metadata TEXT,                       -- JSON: channel, repo, author, domain, etc.
    tags TEXT,                           -- JSON array of tags
    created_at INTEGER
);

CREATE INDEX idx_activities_timestamp ON activities(timestamp);
CREATE INDEX idx_activities_source ON activities(source);
CREATE INDEX idx_activities_category ON activities(category);

-- Settings and preferences
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- NO sessions table (CLI data already exists in source DBs!)
```

**What's NOT stored:**
- ❌ OpenCode sessions (exists in `~/.local/share/opencode/opencode.db`)
- ❌ Claude CLI sessions (exists in `~/.claude/projects/*/*.jsonl`)

---

### 3. TimeStream Desktop App (GUI)

**Purpose:** Query and display data from all sources

**Changes:**
- Remove watchers from main.js (agent handles reading)
- Query multiple sources:
  - OpenCode DB (direct)
  - Claude CLI JSONL (direct)
  - TimeStream SQLite (for browser activities)
- Unified timeline combining all sources

```
src/
├── main.js              # Simplified: queries data
├── preload.js           # Expose query functions
├── readers/             # Read from all sources
│   ├── opencode.js      # Query OpenCode DB
│   ├── claudecli.js     # Query Claude JSONL
│   └── browser.js       # Query TimeStream SQLite
└── renderer/
    └── index.html       # Dashboard UI
```

---

## Data Flow Diagrams

### Agent Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Agent Data Flow                                 │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    READERS (Query Only)                      │   │
│   │                                                               │   │
│   │   OpenCode DB ──────────────────────────────▶ Query session   │   │
│   │   ~/.local/share/opencode/                    data            │   │
│   │                                               │              │   │
│   │   Claude CLI JSONL ───────────────────────────▶ Query session  │   │
│   │   ~/.claude/projects/*/                      data            │   │
│   │                                                               │   │
│   │   (No storage! Data already exists in source locations)     │   │
│   └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                    COLLECTORS (Capture & Store)                │   │
│   │                                                               │   │
│   │   Browser History ─────────────▶ Extract new activities       │   │
│   │   (Platform-specific)              │                         │   │
│   │                                     ▼                         │   │
│   │                               Event Queue                     │   │
│   │                               (Batch every 30s)              │   │
│   │                                     │                        │   │
│   │                                     ▼                        │   │
│   │                            ┌─────────────────┐                │   │
│   │                            │  TimeStream     │                │   │
│   │                            │  SQLite DB      │                │   │
│   │                            │  ~/.timestream/ │                │   │
│   │                            └─────────────────┘                │   │
│   └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### App Data Query Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                       App Data Query Flow                             │
│                                                                      │
│   User opens app              App Process                             │
│   ─────────────              ───────────                             │
│                                                                      │
│   Query all sources ◀───────────────────────────────────────────┐   │
│          │                                                      │   │
│          ├── Query OpenCode DB ─────────────────────────────┐   │   │
│          │    (return sessions)                              │   │   │
│          │                                                    │   │   │
│          ├── Query Claude CLI JSONL ──────────────────────┐   │   │   │
│          │    (return sessions)                            │   │   │   │
│          │                                                  │   │   │
│          └── Query TimeStream SQLite ───────────────────┐   │   │   │
│               (return browser activities)                │   │   │   │
│                                                           │   │   │   │
│   Combine all ◀──────────────────────────────────────────┘   │   │   │
│        │                                                        │   │
│        ▼                                                        │   │
│   Render unified timeline ◀─────────────────────────────────────┘   │
│        │                                                           │
│        ▼                                                           │
│   User sees all activities ✅                                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## File Structure (Production)

```
TimeStream/
├── src/
│   ├── agent/                     # Background agent (NEW)
│   │   ├── index.js               # Entry point
│   │   ├── readers/               # Query existing sources (no storage)
│   │   │   ├── opencode.js        # Query OpenCode SQLite DB
│   │   │   └── claudecli.js       # Query Claude CLI JSONL files
│   │   ├── collectors/            # Capture new data (write)
│   │   │   └── browser.js         # Read browser history → SQLite
│   │   ├── database/
│   │   │   └── sqlite.js          # SQLite operations
│   │   ├── queue/
│   │   │   └── eventQueue.js      # Event buffering
│   │   └── config/
│   │       └── settings.js         # Agent config
│   │
│   ├── app/                       # Desktop app (REFACTORED)
│   │   ├── main.js                # Simplified: queries data
│   │   ├── preload.js             # IPC bridge
│   │   └── readers/               # Read from all sources
│   │       ├── opencode.js        # Query OpenCode DB
│   │       ├── claudecli.js       # Query Claude JSONL
│   │       └── browser.js          # Query TimeStream SQLite
│   │
│   └── shared/                    # Shared code
│       ├── constants.js            # Paths and config
│       └── utils.js
│
├── renderer/                      # UI
│   ├── index.html
│   ├── js/
│   └── styles/
│
├── resources/
│   ├── macos/
│   │   └── com.timestream.agent.plist    # LaunchAgent
│   ├── windows/
│   │   └── timestream-agent.exe           # Windows Service
│   └── linux/
│       └── timestream-agent.service        # systemd unit
│
├── database/
│   └── migrations/                         # DB schema migrations
│
├── tests/
│   ├── agent/
│   └── app/
│
├── package.json
└── electron-builder.yml
```

---

## Implementation Phases

---

## Phase 1: Database & Agent Foundation

**Goal:** Set up SQLite database and basic agent structure

### Step 1.1: Create Shared Constants
- [ ] Create `src/shared/constants.js` with:
  - Database path: `~/.timestream/timestream.db`
  - Agent log path: `~/.timestream/logs/`
  - Config paths: `~/.timestream/agent.json`, `~/.timestream/app.json`
  - Platform detection (macOS/Linux/Windows)

### Step 1.2: Set Up SQLite Database
- [ ] Install `better-sqlite3` package
- [ ] Create `src/agent/database/sqlite.js`
- [ ] Implement database initialization:
  ```sql
  CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_label TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT,
      description TEXT,
      category TEXT,
      timestamp INTEGER NOT NULL,
      duration INTEGER,
      metadata TEXT,
      tags TEXT,
      created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
  CREATE INDEX IF NOT EXISTS idx_activities_source ON activities(source);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  ```
- [ ] Add WAL mode for better performance
- [ ] Create `src/agent/database/migrations.js` for schema versioning
- [ ] Write tests for database operations

### Step 1.3: Create Agent Entry Point
- [ ] Create `src/agent/index.js`
- [ ] Implement:
  - Agent initialization (check if already running)
  - Signal handling (SIGTERM, SIGINT)
  - Graceful shutdown
  - Error handling and logging
- [ ] Add command-line arguments (--config, --help, --version)

### Step 1.4: Implement Agent Logging
- [ ] Create `src/shared/logger.js`
- [ ] Features:
  - Log levels (debug, info, warn, error)
  - File rotation (daily)
  - Console output (dev mode)
  - JSON and plain text formats
- [ ] Log to `~/.timestream/logs/agent.log`

### Step 1.5: Create Agent Config System
- [ ] Create `src/agent/config/settings.js`
- [ ] Features:
  - Load from `~/.timestream/agent.json`
  - Create default config if not exists
  - Validate config schema
  - Hot reload on config change
- [ ] Create default config file template

### Step 1.6: Create OS Autostart Files
- [ ] Create `resources/macos/com.timestream.agent.plist` (LaunchAgent)
- [ ] Create `resources/linux/timestream-agent.service` (systemd)
- [ ] Create `resources/windows/timestream-agent.xml` (Windows Task Scheduler)
- [ ] Document installation commands for each platform

### Step 1.7: Create Agent Process Manager
- [ ] Create `src/agent/processManager.js`
- [ ] Features:
  - Check if agent is already running (PID file)
  - Restart on crash with exponential backoff
  - Max restart attempts before giving up
  - Resource monitoring (CPU, memory)

---

## Phase 2: CLI Readers (Query-Only)

**Goal:** Query CLI sessions WITHOUT storing copies

### Step 2.1: Create OpenCode Reader
- [ ] Create `src/agent/readers/opencode.js`
- [ ] Features:
  - Connect to `~/.local/share/opencode/opencode.db` (read-only)
  - Query sessions by date range
  - Extract: sessionId, title, messages, createdAt, updatedAt
  - Handle missing database gracefully
  - Cache recent queries (5 minute TTL)
- [ ] Export functions:
  ```javascript
  getSessions(date)      // Get sessions for specific date
  getSession(id)        // Get single session by ID
  getRecentSessions(n)  // Get N most recent sessions
  ```

### Step 2.2: Create Claude CLI Reader
- [ ] Create `src/agent/readers/claudecli.js`
- [ ] Features:
  - Scan `~/.claude/projects/*/*.jsonl`
  - Parse JSONL files line-by-line
  - Extract: sessionId, title, messages, timestamp, tools
  - Skip sidechain sessions
  - Cache recent queries (5 minute TTL)
- [ ] Export functions:
  ```javascript
  getSessions(date)      // Get sessions for specific date
  getSession(id)         // Get single session by ID
  getProjects()          // List all Claude projects
  ```

### Step 2.3: Create App-Side Readers
- [ ] Create `src/app/readers/opencode.js` (copy of agent reader)
- [ ] Create `src/app/readers/claudecli.js` (copy of agent reader)
- [ ] Create `src/app/readers/browser.js` (query TimeStream SQLite)
- [ ] Create `src/app/readers/index.js` (unified export)

### Step 2.4: Create Unified Reader Interface
- [ ] Create `src/shared/queryEngine.js`
- [ ] Features:
  - Query all sources in parallel
  - Merge results into unified format
  - Sort by timestamp
  - Deduplicate (if any)
  - Filter by date, source, category
- [ ] API:
  ```javascript
  getAllActivities(date)      // Get all activities for date
  getActivitiesBySource(src)  // Filter by source
  searchActivities(query)     // Search by title/url
  ```

### Step 2.5: Test CLI Readers
- [ ] Write unit tests for OpenCode reader
- [ ] Write unit tests for Claude CLI reader
- [ ] Test with real data
- [ ] Verify NO data is stored in TimeStream DB
- [ ] Measure query performance

---

## Phase 3: Browser Collector

**Goal:** Capture browser activity and store in SQLite

### Step 3.1: Create Browser Collector Base
- [ ] Create `src/agent/collectors/browser.js`
- [ ] Create base class/interface:
  ```javascript
  class BrowserCollector {
    constructor(browser) { }
    async getHistory(since) { }    // Get history since timestamp
    async getMostRecent() { }       // Get most recent N items
    isAvailable() { }               // Check if browser is installed
  }
  ```

### Step 3.2: Create Chrome Collector
- [ ] Create `src/agent/collectors/chrome.js`
- [ ] Implement:
  - Find Chrome history DB path (platform-specific)
  - Open SQLite database (read-only)
  - Query `urls` table
  - Extract: url, title, last_visit_time
  - Convert Chrome timestamps to Unix
- [ ] Handle locked database (Chrome running)

### Step 3.3: Create Firefox Collector
- [ ] Create `src/agent/collectors/firefox.js`
- [ ] Implement:
  - Find Firefox profile directory
  - Read `places.sqlite`
  - Query `moz_places` and `moz_historyvisits`
  - Handle multiple profiles
  - Extract: url, title, visit_date

### Step 3.4: Create URL Metadata Extractor
- [ ] Create `src/shared/urlParser.js`
- [ ] Extract metadata from URLs:
  ```
  youtube.com/watch → { platform: 'youtube', videoId, channel }
  github.com/user/repo → { platform: 'github', owner, repo }
  medium.com/article → { platform: 'medium', article }
  ```
- [ ] Create patterns for:
  - YouTube
  - GitHub
  - Stack Overflow
  - Medium
  - Dev.to
  - Reddit
  - Hacker News
  - Documentation sites (React, Vue, Node, etc.)

### Step 3.5: Create Activity Categorizer
- [ ] Create `src/shared/categorizer.js`
- [ ] Categorize based on:
  - Platform (YouTube → Learning, GitHub → Coding)
  - URL patterns
  - Keywords in title
- [ ] Categories:
  - `learning` (YouTube, articles, docs)
  - `coding` (GitHub, Stack Overflow)
  - `research` (Medium, Hacker News)
  - `social` (Reddit, Twitter)
  - `other`

### Step 3.6: Create Event Queue
- [ ] Create `src/agent/queue/eventQueue.js`
- [ ] Features:
  - Buffer activities in memory
  - Batch write to SQLite every 30 seconds
  - Flush on shutdown
  - Deduplicate (same URL within 5 minutes)
  - Max queue size (1000 items)

### Step 3.7: Create Deduplication Logic
- [ ] Create `src/agent/collectors/dedup.js`
- [ ] Features:
  - Check URL in TimeStream DB
  - Skip if URL visited within 5 minutes
  - Skip if exact same title + URL
  - Configurable dedup window

### Step 3.8: Test Browser Collector
- [ ] Test Chrome history reading
- [ ] Test Firefox history reading
- [ ] Test URL metadata extraction
- [ ] Test activity categorization
- [ ] Test event queue batching
- [ ] Test deduplication
- [ ] Verify data stored in TimeStream SQLite

---

## Phase 4: App Refactor

**Goal:** Simplify app to query from all sources

### Step 4.1: Remove Existing Watchers
- [ ] Remove `src/services/fileWatcher.js` (OpenCode watcher)
- [ ] Remove `src/services/claudeCliWatcher.js`
- [ ] Remove from `src/main.js`:
  - `startWatcher()` call
  - `createClaudeCliWatcher()` call
  - Old IPC handlers for sessions

### Step 4.2: Create Unified Query API
- [ ] Create `src/app/api/query.js`
- [ ] Functions:
  ```javascript
  getDayActivities(date)       // Get all for specific date
  getWeekActivities(weekStart) // Get week
  getActivitiesBySource(source) // Filter
  getRecentSessions(n)         // Get N recent
  search(query)                // Search all
  ```
- [ ] Aggregate from:
  - OpenCode DB (via reader)
  - Claude CLI JSONL (via reader)
  - TimeStream SQLite (browser activities)

### Step 4.3: Update IPC Handlers
- [ ] Update `src/main.js` IPC handlers:
  - Remove: `get-opencode-sessions`
  - Remove: `get-claude-sessions`
  - Add: `get-activities` (unified)
  - Add: `get-sources` (list available sources)
  - Add: `get-stats` (daily/weekly summary)

### Step 4.4: Update Preload Script
- [ ] Update `src/preload.js`:
  - Remove: `getOpencodeSessions()`
  - Remove: `onOpenCodeSessionImported()`
  - Remove: `onClaudeSession()`
  - Add: `getActivities(date)`
  - Add: `getSources()`
  - Add: `getStats(date)`

### Step 4.5: Update Renderer Dashboard
- [ ] Update `renderer/index.html`:
  - Update date navigation
  - Add source filter buttons
  - Update stats display
- [ ] Update `renderer/js/opencode.js`:
  - Rename to `renderer/js/dashboard.js`
  - Query unified API
  - Display all sources
  - Update session card component

### Step 4.6: Add System Tray
- [ ] Add `src/app/tray.js`
- [ ] Features:
  - Tray icon (macOS/Linux/Windows)
  - Menu: Open, Preferences, Quit
  - Click to open app
  - Badge for new activities
- [ ] Update `src/main.js` to use tray

### Step 4.7: Test App Integration
- [ ] Test OpenCode sessions display
- [ ] Test Claude CLI sessions display
- [ ] Test browser activities display
- [ ] Test date navigation
- [ ] Test search functionality
- [ ] Verify unified timeline
- [ ] Test tray functionality

---

## Phase 5: Installation & Distribution

**Goal:** Package for production deployment

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

## Configuration

### Agent Configuration

**Location:** `~/.timestream/agent.json`

```json
{
  "enabled": true,
  "readers": {
    "opencode": {
      "enabled": true,
      "dbPath": "~/.local/share/opencode/opencode.db"
    },
    "claudecli": {
      "enabled": true,
      "projectsDir": "~/.claude/projects"
    }
  },
  "collectors": {
    "browser": {
      "enabled": true,
      "browsers": ["chrome", "firefox", "safari"],
      "historyLimit": 100,
      "pollIntervalMs": 60000
    }
  },
  "database": {
    "path": "~/.timestream/timestream.db",
    "backupIntervalMs": 3600000
  }
}
```

### App Configuration

**Location:** `~/.timestream/app.json`

```json
{
  "theme": "dark",
  "startMinimized": false,
  "showInTray": true,
  "launchAtStartup": true,
  "sources": {
    "opencode": true,
    "claudecli": true,
    "browser": true
  }
}
```

---

## OS Integration

### macOS

```xml
<!-- ~/Library/LaunchAgents/com.timestream.agent.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "...">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.timestream.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/TimeStream.app/Contents/MacOS/agent</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>~/.timestream/logs/agent.log</string>
    <key>StandardErrorPath</key>
    <string>~/.timestream/logs/agent.error.log</string>
</dict>
</plist>
```

### Linux (systemd)

```ini
# ~/.config/systemd/user/timestream-agent.service
[Unit]
Description=TimeStream Activity Tracker Agent
After=network.target

[Service]
Type=simple
ExecStart=/opt/timestream/agent
Restart=always
RestartSec=5
StandardOutput=append:~/.timestream/logs/agent.log
StandardError=append:~/.timestream/logs/agent.error.log

[Install]
WantedBy=default.target
```

### Windows

Via NSIS installer, install as Windows Service using `node-windows` or NSSM.

---

## Comparison: Current vs Production

| Aspect | Current | Production |
|--------|---------|------------|
| **App Running** | ✅ Works | ✅ Works |
| **App Closed** | ❌ No capture | ✅ Agent captures |
| **Data Storage** | JSON files | SQLite database |
| **Browser Tracking** | ❌ None | ✅ Yes |
| **Auto-start** | ❌ Manual | ✅ System-level |
| **CLI Sessions** | Stored (duplicate) | **Query only (no dup)** |
| **Data Sources** | 2 (OpenCode, Claude) | **3 (OpenCode, Claude, Browser)** |
| **Storage Size** | Growing duplicates | **Minimal (no duplicates)** |

---

## Storage Comparison

| Approach | Storage Location | Size Impact |
|----------|------------------|-------------|
| **Current** | JSON copies of CLI sessions | ❌ Growing duplicates |
| **Production** | Query source DBs directly | ✅ No duplicates |
| **Browser** | Stored in TimeStream SQLite | ✅ Single copy |

**Example:**
- OpenCode creates 100 sessions (500KB in OpenCode DB)
- TimeStream (current) copies them (500KB extra) = 1MB total
- TimeStream (production) queries directly = 500KB total

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Source DB deleted | High | Graceful degradation, show "no data" |
| Agent crashes loop | High | Implement exponential backoff |
| Database corruption | High | Regular backups + WAL mode |
| Browser access blocked | Medium | Graceful degradation, manual entry option |
| Uninstall leaves agent | Medium | Proper uninstaller cleanup |

---

## Testing Strategy

### Unit Tests
- Database operations (activities table)
- Browser metadata extraction
- URL categorization (YouTube, GitHub, etc.)

### Integration Tests
- Agent → Database flow (browser activities only)
- App → All sources flow
- CLI readers (query without storage)

### E2E Tests
- Clean install flow
- Agent autostart verification
- Browser activity capture
- App displays all sources

### Platform Tests
- macOS: LaunchAgent install/uninstall
- Windows: Service install/uninstall
- Linux: systemd unit enable/disable

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

## References

- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Electron Background Tasks](https://www.electronjs.org/docs/latest/background-notices)
- [node-windows](https://github.com/coreybutler/node-windows)
- [LaunchAgents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchAgents.html)
- [systemd User Units](https://wiki.archlinux.org/title/Systemd/User)
- [Chrome History DB](https://chromium.googlesource.com/chromium/src/+/main/components/history/README.md)

---

*Last Updated: March 22, 2026*
*Version: 2.0.0 (Production - Local Only)*
