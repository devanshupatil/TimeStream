<div align="center">

<img src="renderer/icons/tray.png" alt="TimeStream Logo" width="80" height="80" />

# TimeStream

**Your developer productivity, tracked automatically.**

*A beautiful Electron app that silently records everything you learn, build, and explore — then surfaces it as actionable insights.*

[![Version](https://img.shields.io/badge/version-1.2.0-2bd4bd?style=flat-square)](package.json)
[![Platform](https://img.shields.io/badge/platform-Linux-0f172a?style=flat-square&logo=linux)](https://electronjs.org)
[![Electron](https://img.shields.io/badge/Electron-41-47848F?style=flat-square&logo=electron&logoColor=white)](https://electronjs.org)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](#license)

<br/>

![TimeStream Dashboard](https://raw.githubusercontent.com/devanshupatil/TimeStream/main/docs/preview.png)

</div>

---

## ✨ What is TimeStream?

TimeStream is a **passive developer productivity tracker** that runs quietly in your system tray, recording every meaningful thing you do throughout the day — YouTube tutorials you watched, GitHub repos you explored, AI prompts you fired off, and coding sessions you powered through — and weaves it all into a beautiful, searchable timeline.

No manual input. No timers to start/stop. Just open your laptop and TimeStream handles the rest.

---

## 🚀 Features

### 🧠 Smart Activity Detection
- **YouTube** — Classifies videos as *Learning* or *Entertainment* using a multi-signal AI (title keywords, channel reputation, description, hashtags). Only logs educational content.
- **GitHub** — Tracks repos, commits, PRs, and issues you browse.
- **Reddit** — Filters for 50+ tech/programming subreddits only.
- **AI Tools** — Captures conversations with ChatGPT, Claude, Perplexity, and Qwen, including the chat title.

### 📊 Analytics & Insights
- **Weekly / Monthly** bar chart of your activity volume
- **Category breakdown** — Coding, Learning, Research, DevOps, Other
- **Top Sources** ranked by activity count
- **Day streak** tracker — how many consecutive days have you been active?
- **Average daily learning time** from heartbeat data

### 🕐 Timeline View
- Chronological feed of everything you did on any given day
- Filter by category (All / Coding / Learning / Research / DevOps)
- Click any card to re-open the source URL in your browser

### 🔎 Full-Text Search
- Search across all historical activities by title, source, or category

### 🤖 AI Session Tracking (Learnings)
- Automatically imports **OpenCode** coding sessions from local SQLite databases
- Imports **Claude CLI** conversation sessions with full transcripts
- Shows session duration, project context, and message summaries

### 🔒 100% Local & Private
- All data is stored as JSON on your machine (`~/.config/timestream/`)
- No cloud. No telemetry. No accounts.

---

## 🖥️ Screenshots

| Dashboard | Timeline | Analytics |
|-----------|----------|-----------|
| Daily activity feed with sync | Hour-by-hour timeline | Live data charts |

| Learnings | Search | Sources |
|-----------|--------|---------|
| OpenCode + Claude sessions | Full-text activity search | Manage integrations |

---

## 🏗️ Architecture

```
TimeStream/
├── src/
│   ├── main.js              # Electron main process + HTTP server (port 3000)
│   ├── preload.js           # Secure IPC bridge (contextBridge)
│   ├── services/
│   │   ├── fileWatcher.js       # Watches OpenCode SQLite databases
│   │   └── claudeCliWatcher.js  # Watches Claude CLI JSONL sessions
│   ├── importers/
│   │   └── claudecli.js         # Parses Claude CLI conversation files
│   ├── app/
│   │   ├── api/query.js         # IPC query handlers
│   │   └── readers/             # OpenCode, GitHub, browser readers
│   └── shared/
│       └── constants.js
│
├── renderer/
│   ├── index.html           # Single-page app (Dashboard, Timeline, Analytics…)
│   ├── js/
│   │   ├── data.js          # TSData module — activity store + stats
│   │   └── opencode.js      # Learnings page renderer
│   └── styles/
│
├── chrome-extension/        # Manifest V3 Chrome extension
│   ├── content.js           # Site scraper + classifier
│   ├── background.js        # Service worker + sync queue
│   └── popup/               # Extension popup UI
│
└── firefox-extension/       # Firefox-compatible extension
```

### Data Flow

```
Browser (Chrome/Firefox Extension)
        │  POST /api/activity (localhost:3000)
        ▼
Electron Main Process (main.js)
        │  Deduplication + persistence
        ▼
activities.json  ◄──┐
learning-seconds.json        │
opencode-sessions.json   FileWatcher (chokidar)
claude-sessions.json     ClaudeCliWatcher
        │
        ▼
IPC (preload.js) → Renderer (index.html)
```

---

## 📦 Installation

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Chrome or Firefox | Latest |

### 1. Clone & Install

```bash
git clone https://github.com/devanshupatil/TimeStream.git
cd TimeStream
npm install
```

### 2. Rebuild Native Modules

```bash
npx @electron/rebuild
```

> Required for `better-sqlite3` to work with Electron's Node version.

### 3. Run in Development

```bash
npm run dev
```

### 4. Install the Browser Extension

**Chrome:**
1. Go to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load Unpacked** → select the `chrome-extension/` folder

**Firefox:**
1. Go to `about:debugging`
2. Click **This Firefox** → **Load Temporary Add-on**
3. Select `firefox-extension/manifest.json`

---

## 🔨 Build for Production

```bash
# AppImage (recommended for Linux)
npm run build:appimage

# Debian package
npm run build:deb

# Both
npm run build
```

Output is in the `dist/` directory.

---

## 🌐 What Gets Tracked?

| Source | Trigger | Category |
|--------|---------|----------|
| 🎬 YouTube | Watch a video for **3+ minutes** (learning content only) | Learning |
| 🐙 GitHub | Browse a repo, PR, commit, or issue | Coding |
| 🤖 ChatGPT | Chat session lasting **3+ minutes** | Learning |
| 🤖 Claude | Chat session lasting **3+ minutes** | Learning |
| 🔍 Perplexity | Search session lasting **3+ minutes** | Learning |
| 💬 Reddit | Browse a post in a **tech subreddit** | Learning |
| 💻 OpenCode | Coding session detected from local SQLite | Coding |
| 🧠 Claude CLI | CLI conversation parsed from JSONL logs | Learning |

### Smart YouTube Classification

TimeStream uses a **multi-signal scoring system** to decide if a YouTube video is educational before logging it:

| Signal | Points |
|--------|--------|
| Strong keyword in title (`tutorial`, `explained`, `how to`…) | +4 |
| Tech keywords in title (`react`, `docker`, `python`…) | +1.5 each, max +4 |
| Known educational channel (`Fireship`, `FreeCodeCamp`…) | +4 |
| Educational keywords in description | +0.5 each, max +2 |
| Tech hashtags | +0.5 each, max +1.5 |

**Score ≥ 3 → logged as Learning. Score < 3 → skipped.**

---

## ⚙️ Configuration

All data is stored in your Electron user data directory:

```
~/.config/timestream/
├── activities.json          # Browser activity history (max 1000 entries)
├── learning-seconds.json    # Daily learning time from heartbeat
├── opencode-sessions.json   # OpenCode coding sessions
└── claude-sessions.json     # Claude CLI sessions
```

The local HTTP server runs on **port 3000** and is only accessible from `localhost`.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop App | [Electron](https://electronjs.org) 41 |
| Database | JSON files + [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| File Watching | [chokidar](https://github.com/paulmillr/chokidar) 5 |
| Browser Extension | Manifest V3 (Chrome + Firefox) |
| Frontend | Vanilla HTML/CSS/JS + Tailwind CDN |
| Build | [electron-builder](https://www.electron.build) |

---

## 🧪 Running Tests

```bash
npm test
```

Tests live in the `tests/` directory and run with Node's built-in test runner.

---

## 🗺️ Roadmap

- [ ] **Heatmap calendar** — GitHub-style contribution graph of your learning days
- [ ] **Tags & Projects** — manually group activities into projects
- [ ] **Export** — CSV / Markdown weekly reports
- [ ] **VSCode extension** — track files edited per session
- [ ] **Pomodoro integration** — link focus sessions to activities
- [ ] **Weekly digest** — auto-generate a summary of what you learned this week

---

## 🤝 Contributing

Contributions are welcome! To get started:

```bash
# Fork the repo, then:
git clone https://github.com/<your-username>/TimeStream.git
cd TimeStream
npm install
npm run dev
```

Please open an issue before submitting a large PR so we can discuss the approach.

---

## 📄 License

MIT © [Devanshu Patil](https://github.com/devanshupatil)

---

<div align="center">

**Built with ☕ and curiosity.**

*Stop wondering what you did last Tuesday. TimeStream remembers.*

</div>
