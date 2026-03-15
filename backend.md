# Detailed Prompt: Chrome Extension + CI/CD Pipeline for TimeStream

---

## Project Context

You are building an automated developer activity tracking system called **TimeStream**. TimeStream is an Electron desktop application that displays a developer's daily learning and work activities in a searchable timeline. The Chrome Extension will serve as the primary data collection agent, capturing browser-based activities (YouTube videos, GitHub activity, articles read, etc.) and sending them to the TimeStream backend for display in the timeline.

---

## Goal

Build a production-ready Chrome Extension (Manifest V3) that tracks user browser activity and integrates it with a CI/CD pipeline using GitHub Actions for automated testing, building, and publishing.

---

## Current TimeStream Project

The TimeStream Electron app exists at `/home/devanshu/TimeStream` with:
- `package.json` - Electron 28 + electron-builder
- `src/main.js` - Electron main process
- `src/preload.js` - IPC bridge
- `renderer/` - Frontend UI (HTML/CSS/JS with Tailwind)
- `TimeStream.md` - Full specification document
- Already has mock data for activities like GitHub commits, YouTube videos, VS Code sessions

---

## Requirements

### Part A: Chrome Extension Development

#### A1. Extension Architecture

Create a Chrome Extension with the following structure:

```
chrome-extension/
├── manifest.json              # Manifest V3 configuration
├── background.js              # Service worker for data collection
├── content.js                 # Content script for page activity
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.js              # Popup logic
│   └── styles.css            # Popup styling
├── utils/
│   ├── activityTracker.js    # Activity detection logic
│   ├── dataFormatter.js      # Data formatting utilities
│   └── storage.js            # Local storage management
├── services/
│   └── api.js                # Communication with TimeStream backend
├── icons/                     # Extension icons (16, 48, 128px)
└── _locales/                 # Internationalization (en, etc.)
```

#### A2. manifest.json Requirements

- **Manifest Version**: 3 (required)
- **Name**: "TimeStream Activity Tracker"
- **Version**: 1.0.0
- **Permissions**:
  - `storage` - Store user preferences
  - `activeTab` - Access current tab info
  - `scripting` - Execute content scripts
  - `tabs` - Get tab information
  - `webRequest` - Monitor network requests (if needed)
- **Host Permissions**:
  - `https://github.com/*` - Track GitHub activity
  - `https://youtube.com/*` - Track YouTube viewing
  - `https://www.youtube.com/*` - Track YouTube viewing
  - `https://*/*` - General browsing activity (optional, user-granted)
- **Background**: Service worker (not persistent background page)
- **Action**: Popup for extension controls
- **Content Scripts**: Inject on specified domains

#### A3. Activity Tracking Features

The extension must track these activity types:

**YouTube Tracking:**
- Video title
- Video URL
- Channel name
- Watch duration (if detectable)
- Timestamp of when video was opened

**GitHub Tracking:**
- Repository name
- Commit messages (viewing)
- Pull request titles/numbers
- Issues viewed
- Code reviews opened

**General Browser Activity:**
- Articles read (medium.com, dev.to, documentation sites)
- Search queries (from URL patterns)
- Time spent on domains

#### A4. Data Format

All activities must be sent in this JSON format:

```json
{
  "id": "uuid-v4",
  "source": "youtube" | "github" | "browser" | "article",
  "sourceLabel": "YouTube" | "GitHub" | "Web Browser" | "Article",
  "title": "Video/Page/Commit Title",
  "url": "https://...",
  "timestamp": "2026-03-15T10:30:00Z",
  "category": "Learning" | "Coding" | "Research" | "Communication",
  "metadata": {
    "channel": "Channel Name",
    "repo": "owner/repo",
    "author": "username",
    "domain": "example.com"
  }
}
```

#### A5. Popup UI Features

- Dashboard showing today's tracked activities count
- Quick toggle to enable/disable tracking
- Link to open TimeStream desktop app
- Sync status indicator
- Settings access:
  - Choose which sources to track (YouTube, GitHub, etc.)
  - Set sync interval
  - Configure backend API URL
  - Export/clear data option

#### A6. Backend Communication

- Store activities locally using `chrome.storage.local`
- Sync to backend API (configurable URL)
- Support offline mode - queue activities when offline
- Batch sync every 5 minutes (configurable)
- Manual sync button in popup

#### A7. Edge Cases & Error Handling

- Handle API failures gracefully (retry with exponential backoff)
- Handle offline scenarios (queue and sync later)
- Handle storage quota limits
- Handle permission denied scenarios
- Handle page load failures for content scripts
- Validate data before sending to backend

---

### Part B: CI/CD Pipeline Development

#### B1. GitHub Actions Workflows

Create these workflow files:

**`.github/workflows/ci.yml`** - Continuous Integration:
```yaml
# Runs on every push and PR
# 1. Lint JavaScript/JSON
# 2. Validate manifest.json
# 3. Build extension bundle
# 4. Run basic tests (if any)
# 5. Package into ZIP
# 6. Upload artifacts
```

**`.github/workflows/release.yml`** - Automated Release:
```yaml
# Runs on version tags (v1.0.0, v1.0.1, etc.)
# 1. Build extension
# 2. Create GitHub Release with ZIP
# 3. Optionally publish to Chrome Web Store
```

**`.github/workflows/publish-chrome.yml`** - Manual Chrome Web Store Publish:
```yaml
# Manual trigger (workflow_dispatch)
# 1. Build extension
# 2. Upload to Chrome Web Store
# 3. Publish to test track
```

#### B2. CI Pipeline Requirements

The CI pipeline must:
- Run on `ubuntu-latest`
- Support Node.js 20 LTS
- Use caching for npm dependencies
- Validate manifest.json schema
- Check for common issues (missing icons, invalid permissions)
- Run ESLint on JavaScript files
- Generate a working ZIP file for manual testing
- Upload the ZIP as a GitHub artifact

#### B3. Release Pipeline Requirements

- Semantic versioning using git tags
- Automatic version extraction from `manifest.json`
- Create GitHub Release with:
  - Release notes (auto-generated from commits)
  - ZIP artifact for download
- Optional: Publish to Chrome Web Store (test track first)

#### B4. GitHub Secrets Required

Document these required secrets:
- `CHROME_EXTENSION_ID` - From Chrome Web Store dashboard
- `CHROME_CLIENT_ID` - From Google Cloud Console
- `CHROME_REFRESH_TOKEN` - From Google Cloud Console (for API access)

---

### Part C: Documentation

Create a README.md in the chrome-extension folder with:
1. Installation instructions
2. Configuration guide
3. Development setup
4. Building for production
5. Publishing to Chrome Web Store
6. Troubleshooting common issues

---

## Technical Constraints

1. **Manifest V3 Only** - Must use Manifest V3 (V2 is deprecated)
2. **No Remote Code** - All JS must be bundled (no eval/remote scripts)
3. **Service Worker** - Background scripts must use service worker (not persistent background page)
4. **Privacy-Focused** - No analytics, no tracking outside of user activity
5. **Offline-First** - Extension must work without constant internet connection

---

## Acceptance Criteria

### Chrome Extension

- [ ] Extension loads without errors in Chrome
- [ ] Popup opens and displays current status
- [ ] YouTube videos are detected and logged
- [ ] GitHub pages are detected and logged
- [ ] Data is stored locally in chrome.storage
- [ ] Data syncs to configurable backend endpoint
- [ ] User can toggle tracking on/off
- [ ] User can configure which sources to track
- [ ] Extension handles offline mode gracefully
- [ ] Icons display correctly at all sizes

### CI/CD Pipeline

- [ ] CI workflow runs on every push to main
- [ ] CI workflow runs on every PR
- [ ] Linting passes without errors
- [ ] Manifest validation passes
- [ ] ZIP file is generated and uploaded as artifact
- [ ] Release workflow triggers on version tags
- [ ] GitHub Release is created with ZIP
- [ ] All workflows have proper status badges

---

## Deliverables

1. Complete Chrome Extension source code in `/home/devanshu/TimeStream/chrome-extension/`
2. GitHub Actions workflows in `/home/devanshu/TimeStream/.github/workflows/`
3. Documentation in `/home/devanshu/TimeStream/chrome-extension/README.md`
4. Updated main project README linking to extension

---

## Example API Endpoint (for testing)

The extension should send data to:
```
POST http://localhost:3000/api/activity
Content-Type: application/json

{
  "source": "youtube",
  "title": "Docker Tutorial",
  "url": "https://youtube.com/watch?v=...",
  "timestamp": "2026-03-15T10:30:00Z",
  "category": "Learning"
}
```

---

Build the Chrome Extension and CI/CD pipeline following these requirements. Ensure all code is production-ready, well-documented, and follows best practices for Chrome Extension development (Manifest V3) and GitHub Actions automation.
