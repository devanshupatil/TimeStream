# Settings Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add anime avatar profile header, per-source tracking toggles with browser chip selection, and a URL exclusion privacy list to the TimeStream settings page.

**Architecture:** Pure logic functions live in a new `renderer/js/settings.js` (not `app.js` as listed in the spec — a separate file is cleaner and follows the existing pattern of `claudecli.js`/`opencode.js`). HTML sections are inserted into the existing `#page-settings` div in `renderer/index.html`. IPC save/get handlers are added to `src/main.js` using the singleton `agentConfig` (exported from `src/agent/config/settings.js`, which already supports dot-path keys and has `getAll()` / `set()` methods). `src/preload.js` exposes the two new IPC methods via `contextBridge`.

**Tech Stack:** Electron 41, vanilla JS (no framework), Node built-in test runner (`node:test`), `better-sqlite3`, `agentConfig` singleton at `src/agent/config/settings.js`.

**Spec:** `docs/superpowers/specs/2026-04-23-settings-page-redesign.md`

**Test coverage note:** Pure functions are fully unit-tested. DOM-level behavior (modal, toggles, chips, exclusion list) is verified via the manual smoke test in Task 6 — no JSDOM is configured in this project, making DOM unit tests impractical without new tooling.

---

## File Map

| File | Action | Role |
|------|--------|------|
| `src/shared/constants.js` | Modify | Add `excludedDomains: []` to `DEFAULT_AGENT_CONFIG.collectors.browser` |
| `src/main.js` | Modify | Import `agentConfig`, add `save-settings` + `get-settings` IPC handlers |
| `src/preload.js` | Modify | Expose `saveSettings` and `getSettings` via `contextBridge` |
| `renderer/js/settings.js` | Create | All new settings logic: pure functions (unit-tested) + DOM init |
| `renderer/index.html` | Modify | Insert profile header, tracking sources, privacy HTML; add avatar modal + confirmation dialog |
| `tests/settings/settings.test.js` | Create | Unit tests for 5 pure settings functions |

---

## Task 1: Add `excludedDomains` to agent config defaults

**Files:**
- Modify: `src/shared/constants.js`

- [ ] **Step 1: Open `src/shared/constants.js` and find the `collectors.browser` object**

  It looks like this:
  ```js
  collectors: {
    browser: {
      enabled: true,
      browsers: ['chrome', 'firefox'],
      historyLimit: 100,
      pollIntervalMs: 60000,
    },
  },
  ```

- [ ] **Step 2: Add `excludedDomains: []` as the last key in that object**

  ```js
  collectors: {
    browser: {
      enabled: true,
      browsers: ['chrome', 'firefox'],
      historyLimit: 100,
      pollIntervalMs: 60000,
      excludedDomains: [],
    },
  },
  ```

- [ ] **Step 3: Verify no tests break**

  Run: `npm test`
  Expected: all existing tests pass (non-breaking addition — `agentConfig.get()` already uses fallback defaults for missing keys in existing config files)

- [ ] **Step 4: Commit**

  ```bash
  git add src/shared/constants.js
  git commit -m "feat: add excludedDomains default to agent browser config"
  ```

---

## Task 2: Add IPC handlers in `main.js` and `preload.js`

**Files:**
- Modify: `src/main.js`
- Modify: `src/preload.js`

- [ ] **Step 1: Verify `agentConfig` API before writing any code**

  Run: `node -e "const {agentConfig}=require('./src/agent/config/settings');agentConfig.load();console.log(typeof agentConfig.getAll, typeof agentConfig.set)"`
  Expected output: `function function`
  (Confirms `getAll()` and `set()` exist. `set()` already supports dot-path keys — it splits on `.` internally.)

- [ ] **Step 2: Import `agentConfig` at the top of `src/main.js`**

  After the existing `require` lines at the top of the file, add:
  ```js
  const { agentConfig } = require('./agent/config/settings');
  agentConfig.load();
  ```

- [ ] **Step 3: Add the two IPC handlers to `src/main.js`**

  Add after the last existing `ipcMain.handle` block (after `ipcMain.handle('get-opencode-sessions', ...)`):
  ```js
  ipcMain.handle('get-settings', () => {
    return agentConfig.getAll();
  });

  ipcMain.handle('save-settings', (_, { key, value }) => {
    agentConfig.set(key, value);
    return true;
  });
  ```

- [ ] **Step 4: Expose the methods in `src/preload.js`**

  Inside the `contextBridge.exposeInMainWorld('electronAPI', { ... })` object, add two entries at the end (before the closing `}`):
  ```js
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (payload) => ipcRenderer.invoke('save-settings', payload),
  ```

- [ ] **Step 5: Verify the app still starts cleanly**

  Run: `npm run dev`
  Expected: app opens, all existing pages work, no console errors. Open DevTools console and run:
  ```js
  window.electronAPI.getSettings().then(console.log)
  ```
  Expected: logs the full agent config object including `collectors.browser.excludedDomains: []`

- [ ] **Step 6: Commit**

  ```bash
  git add src/main.js src/preload.js
  git commit -m "feat: add save-settings and get-settings IPC handlers"
  ```

---

## Task 3: Create `renderer/js/settings.js` — pure functions + DOM logic

**Files:**
- Create: `renderer/js/settings.js`
- Create: `tests/settings/settings.test.js`

- [ ] **Step 1: Write the failing unit tests first**

  Create `tests/settings/settings.test.js`:
  ```js
  const { describe, it } = require('node:test');
  const assert = require('node:assert/strict');
  const {
    sanitizeName,
    getDefaultBrowsers,
    addExclusion,
    removeExclusion,
    parseExclusions,
  } = require('../../renderer/js/settings.js');

  describe('sanitizeName', () => {
    it('returns trimmed value when non-empty', () => {
      assert.equal(sanitizeName('  Alice  '), 'Alice');
    });
    it('returns "Developer" for empty string', () => {
      assert.equal(sanitizeName(''), 'Developer');
    });
    it('returns "Developer" for whitespace-only', () => {
      assert.equal(sanitizeName('   '), 'Developer');
    });
  });

  describe('getDefaultBrowsers', () => {
    it('returns saved array when non-empty', () => {
      assert.deepEqual(getDefaultBrowsers(['brave']), ['brave']);
    });
    it('returns default when null', () => {
      assert.deepEqual(getDefaultBrowsers(null), ['chrome', 'firefox']);
    });
    it('returns default when empty array', () => {
      assert.deepEqual(getDefaultBrowsers([]), ['chrome', 'firefox']);
    });
  });

  describe('addExclusion', () => {
    it('appends trimmed entry to list', () => {
      assert.deepEqual(addExclusion(['a.com'], '  b.com  '), ['a.com', 'b.com']);
    });
    it('returns null for whitespace-only entry', () => {
      assert.equal(addExclusion(['a.com'], '  '), null);
    });
    it('returns null for empty entry', () => {
      assert.equal(addExclusion([], ''), null);
    });
  });

  describe('removeExclusion', () => {
    it('removes item at index', () => {
      assert.deepEqual(removeExclusion(['a.com', 'b.com'], 0), ['b.com']);
    });
    it('removes last item', () => {
      assert.deepEqual(removeExclusion(['a.com'], 0), []);
    });
  });

  describe('parseExclusions', () => {
    it('parses valid JSON array', () => {
      assert.deepEqual(parseExclusions('["a.com","b.com"]'), ['a.com', 'b.com']);
    });
    it('returns empty array for null', () => {
      assert.deepEqual(parseExclusions(null), []);
    });
    it('returns empty array for invalid JSON', () => {
      assert.deepEqual(parseExclusions('not-json'), []);
    });
  });
  ```

- [ ] **Step 2: Run tests — confirm they FAIL**

  Run: `node --test tests/settings/settings.test.js`
  Expected: `Error: Cannot find module '../../renderer/js/settings.js'`

- [ ] **Step 3: Create `renderer/js/settings.js`**

  ```js
  'use strict';

  // ── Pure functions (exported for unit testing) ──────────────────

  const DEFAULT_BROWSERS = ['chrome', 'firefox'];

  function sanitizeName(name) {
    const trimmed = (name || '').trim();
    return trimmed.length > 0 ? trimmed : 'Developer';
  }

  function getDefaultBrowsers(browsers) {
    if (!Array.isArray(browsers) || browsers.length === 0) return [...DEFAULT_BROWSERS];
    return browsers;
  }

  function addExclusion(list, entry) {
    const trimmed = (entry || '').trim();
    if (!trimmed) return null;
    return [...list, trimmed];
  }

  function removeExclusion(list, index) {
    return list.filter((_, i) => i !== index);
  }

  function parseExclusions(json) {
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // ── DOM functions (browser-only, not exported) ──────────────────

  const AVATARS = ['🦊', '🐉', '🌸', '⚔️', '🔮', '🌙', '⚡', '🎭'];
  const LS_AVATAR = 'ts-avatar';
  const LS_NAME = 'ts-display-name';
  const LS_EXCLUSIONS = 'ts-url-exclusions';

  function initSettings() {
    _initAvatar();
    _initName();
    _initTrackingSources();
    _initPrivacy();
    _initClearHistoryConfirm();
  }

  // ── Avatar ──

  function _initAvatar() {
    const saved = localStorage.getItem(LS_AVATAR) || '🦊';
    _setAvatarDisplay(saved);

    document.getElementById('settings-avatar-btn')
      ?.addEventListener('click', _openAvatarModal);
    document.getElementById('avatar-modal-backdrop')
      ?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) _closeAvatarModal(false);
      });
    document.getElementById('avatar-modal-cancel')
      ?.addEventListener('click', () => _closeAvatarModal(false));
    document.getElementById('avatar-modal-save')
      ?.addEventListener('click', () => _closeAvatarModal(true));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('avatar-modal-backdrop')?.style.display === 'flex') {
        _closeAvatarModal(false);
      }
    });

    const grid = document.getElementById('avatar-grid');
    if (!grid) return;
    AVATARS.forEach((emoji) => {
      const btn = document.createElement('div');
      btn.className = 'av-option';
      btn.textContent = emoji;
      btn.dataset.emoji = emoji;
      if (emoji === saved) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        grid.querySelectorAll('.av-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      grid.appendChild(btn);
    });
  }

  function _openAvatarModal() {
    document.getElementById('avatar-modal-backdrop').style.display = 'flex';
  }

  function _closeAvatarModal(save) {
    const modal = document.getElementById('avatar-modal-backdrop');
    if (!modal) return;
    if (save) {
      const selected = document.querySelector('#avatar-grid .av-option.selected');
      if (selected) {
        const emoji = selected.dataset.emoji;
        localStorage.setItem(LS_AVATAR, emoji);
        _setAvatarDisplay(emoji);
      }
    }
    modal.style.display = 'none';
  }

  function _setAvatarDisplay(emoji) {
    const el = document.getElementById('settings-avatar-display');
    if (el) el.textContent = emoji;
  }

  // ── Display name ──

  function _initName() {
    const input = document.getElementById('settings-display-name');
    if (!input) return;
    input.value = localStorage.getItem(LS_NAME) || 'Developer';
    const save = () => {
      const clean = sanitizeName(input.value);
      input.value = clean;
      localStorage.setItem(LS_NAME, clean);
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); input.blur(); }
    });
  }

  // ── Tracking sources ──

  async function _initTrackingSources() {
    let config = null;
    try { config = await window.electronAPI?.getSettings(); } catch { /* use defaults */ }

    const toggleMap = {
      'toggle-browser':   'collectors.browser.enabled',
      'toggle-claudecli': 'readers.claudecli.enabled',
      'toggle-opencode':  'readers.opencode.enabled',
    };

    Object.entries(toggleMap).forEach(([id, key]) => {
      const toggle = document.getElementById(id);
      if (!toggle) return;
      const saved = _getNestedKey(config, key);
      toggle.checked = saved !== null ? saved : true;
      toggle.addEventListener('change', async () => {
        const prev = !toggle.checked;
        try {
          await window.electronAPI?.saveSettings({ key, value: toggle.checked });
          if (id === 'toggle-browser') _updateBrowserChipsVisibility(toggle.checked);
        } catch {
          console.error('saveSettings failed for', key);
          toggle.checked = prev; // revert on IPC failure
        }
      });
    });

    const savedBrowsers = getDefaultBrowsers(_getNestedKey(config, 'collectors.browser.browsers'));
    _initBrowserChips(savedBrowsers);
    _updateBrowserChipsVisibility(document.getElementById('toggle-browser')?.checked ?? true);
  }

  function _initBrowserChips(activeBrowsers) {
    const container = document.getElementById('browser-chips');
    if (!container) return;
    container.querySelectorAll('.browser-chip').forEach(chip => {
      const browser = chip.dataset.browser;
      if (activeBrowsers.includes(browser)) chip.classList.add('active');
      chip.addEventListener('click', async () => {
        const activeChips = [...container.querySelectorAll('.browser-chip.active')];
        // min-1 constraint: ignore click if this is the only active chip
        if (activeChips.length === 1 && activeChips[0] === chip) return;
        chip.classList.toggle('active');
        const current = [...container.querySelectorAll('.browser-chip.active')].map(c => c.dataset.browser);
        try {
          await window.electronAPI?.saveSettings({ key: 'collectors.browser.browsers', value: current });
        } catch {
          console.error('saveSettings failed for browser chips');
          chip.classList.toggle('active'); // revert
        }
      });
    });
  }

  function _updateBrowserChipsVisibility(show) {
    const el = document.getElementById('browser-chips-row');
    if (el) el.style.display = show ? 'block' : 'none';
  }

  // ── Privacy exclusions ──

  function _initPrivacy() {
    let exclusions = parseExclusions(localStorage.getItem(LS_EXCLUSIONS));

    async function loadFallback() {
      if (exclusions.length === 0) {
        try {
          const config = await window.electronAPI?.getSettings();
          const fromConfig = config?.collectors?.browser?.excludedDomains;
          if (Array.isArray(fromConfig) && fromConfig.length > 0) exclusions = fromConfig;
        } catch { /* keep empty */ }
      }
      render();
    }

    function render() {
      _renderExclusions(exclusions, removeAt);
    }

    function removeAt(idx) {
      exclusions = removeExclusion(exclusions, idx);
      _saveExclusions(exclusions);
      render();
    }

    function addFromInput() {
      const input = document.getElementById('exclusion-input');
      const result = addExclusion(exclusions, input?.value || '');
      if (!result) return;
      exclusions = result;
      if (input) input.value = '';
      _saveExclusions(exclusions);
      render();
    }

    loadFallback();

    document.getElementById('exclusion-add-btn')?.addEventListener('click', addFromInput);
    document.getElementById('exclusion-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addFromInput();
    });
  }

  function _renderExclusions(list, onRemove) {
    const container = document.getElementById('exclusion-list');
    if (!container) return;
    if (list.length === 0) {
      container.innerHTML = `<p style="color:var(--text-secondary);font-size:13px">No exclusions yet — all URLs are tracked</p>`;
      return;
    }
    container.innerHTML = list.map((domain, i) => `
      <div class="exclusion-item" data-index="${i}">
        <span class="exclusion-domain">${domain}</span>
        <button class="exclusion-remove" data-index="${i}">×</button>
      </div>
    `).join('');
    container.querySelectorAll('.exclusion-remove').forEach(btn => {
      btn.addEventListener('click', () => onRemove(parseInt(btn.dataset.index, 10)));
    });
  }

  async function _saveExclusions(list) {
    localStorage.setItem(LS_EXCLUSIONS, JSON.stringify(list));
    try {
      await window.electronAPI?.saveSettings({ key: 'collectors.browser.excludedDomains', value: list });
    } catch {
      console.error('saveSettings failed for excludedDomains');
    }
  }

  // ── Clear History confirmation ──

  function _initClearHistoryConfirm() {
    const btn = document.getElementById('btn-clear-history-app');
    if (!btn) return;
    // intercept before any existing listener
    btn.addEventListener('click', (e) => {
      e.stopImmediatePropagation();
      document.getElementById('clear-history-dialog').style.display = 'flex';
    }, { capture: true });
    document.getElementById('clear-history-cancel')?.addEventListener('click', () => {
      document.getElementById('clear-history-dialog').style.display = 'none';
    });
    document.getElementById('clear-history-confirm')?.addEventListener('click', async () => {
      document.getElementById('clear-history-dialog').style.display = 'none';
      await window.electronAPI?.clearHistory();
    });
  }

  // ── Util ──

  function _getNestedKey(obj, dotpath) {
    if (!obj) return null;
    return dotpath.split('.').reduce((acc, k) => (acc != null && k in acc ? acc[k] : null), obj);
  }

  // ── Export (Node = unit tests; browser = window.TSSettings) ──────

  if (typeof module !== 'undefined') {
    module.exports = { sanitizeName, getDefaultBrowsers, addExclusion, removeExclusion, parseExclusions };
  } else {
    window.TSSettings = { initSettings };
  }
  ```

- [ ] **Step 4: Run tests — confirm they all PASS**

  Run: `node --test tests/settings/settings.test.js`
  Expected: 12 passing assertions, 0 failures

- [ ] **Step 5: Commit**

  ```bash
  git add renderer/js/settings.js tests/settings/settings.test.js
  git commit -m "feat: add settings pure functions with unit tests"
  ```

---

## Task 4: Add Profile Header HTML to `renderer/index.html`

**Files:**
- Modify: `renderer/index.html`

- [ ] **Step 1: Find the insertion point**

  Run: `grep -n 'max-width:700px\|APPEARANCE MODE' renderer/index.html`
  Expected lines:
  - `1082: <div style="max-width:700px">`
  - `~1147: <!-- ── APPEARANCE MODE ──`

  The profile header goes on the line **immediately after** `<div style="max-width:700px">`.

- [ ] **Step 2: Insert the profile header HTML**

  Insert after the `<div style="max-width:700px">` line:
  ```html
  <!-- ── PROFILE HEADER ── -->
  <div style="background:linear-gradient(135deg,var(--card-bg) 0%,#0f1f35 100%);border:1px solid var(--border);border-radius:16px;padding:24px;display:flex;align-items:center;gap:20px;margin-bottom:32px">
    <div style="position:relative;cursor:pointer;flex-shrink:0" id="settings-avatar-btn" title="Click to change avatar">
      <div id="settings-avatar-display" style="width:72px;height:72px;border-radius:50%;border:3px solid var(--accent);background:var(--card-bg);display:flex;align-items:center;justify-content:center;font-size:36px;box-shadow:0 0 0 4px rgba(43,212,189,0.15)">🦊</div>
      <div style="position:absolute;bottom:2px;right:2px;width:22px;height:22px;background:var(--accent);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#0a0f1e;font-weight:700;border:2px solid var(--bg)">✏</div>
    </div>
    <div style="flex:1">
      <input id="settings-display-name" maxlength="32" placeholder="Your name"
        style="font-size:20px;font-weight:800;color:var(--text-primary);background:transparent;border:none;outline:none;width:100%;letter-spacing:-0.01em"/>
      <p style="font-size:12px;color:var(--text-secondary);margin-top:4px">Click your avatar to change it</p>
      <span style="background:rgba(43,212,189,0.12);color:var(--accent);font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;display:inline-block;margin-top:8px">Developer</span>
    </div>
  </div>

  <!-- ── AVATAR MODAL ── -->
  <div id="avatar-modal-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)">
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:24px;width:340px;max-width:95vw">
      <h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:4px">Choose your avatar</h3>
      <p style="font-size:12px;color:var(--text-secondary);margin-bottom:16px">Pick an anime character that represents you</p>
      <div id="avatar-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="avatar-modal-cancel" style="background:transparent;color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        <button id="avatar-modal-save" style="background:var(--accent);color:#0a0f1e;border:none;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer">Save</button>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 3: Add avatar grid CSS to the `<style>` block**

  Find the existing `<style>` block and add:
  ```css
  .av-option {
    width: 100%; aspect-ratio: 1; border-radius: 50%;
    border: 2px solid var(--border); display: flex;
    align-items: center; justify-content: center;
    font-size: 28px; cursor: pointer; transition: all .15s;
    background: var(--card-bg);
  }
  .av-option:hover { border-color: var(--accent); transform: scale(1.05); }
  .av-option.selected { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(43,212,189,0.25); }
  ```

- [ ] **Step 4: Verify the profile header renders**

  Run: `npm run dev`, navigate to Settings
  - Profile card shows 🦊 avatar with edit badge and an empty name input
  - Avatar button and modal are present (not interactive yet — JS wired in Task 6)

- [ ] **Step 5: Commit**

  ```bash
  git add renderer/index.html
  git commit -m "feat: add profile header and avatar modal HTML"
  ```

---

## Task 5: Add Tracking Sources + Privacy + Confirmation Dialog HTML

**Files:**
- Modify: `renderer/index.html`

- [ ] **Step 1: Find the insertion point**

  Run: `grep -n 'DATA EXPORT' renderer/index.html`
  Expected: `~1341: <!-- ── DATA EXPORT ──`

  The new sections go **immediately before** this comment.

- [ ] **Step 2: Insert Tracking Sources + Privacy sections**

  ```html
  <!-- ── TRACKING SOURCES ── -->
  <div style="margin-bottom:32px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary)">Tracking Sources</span>
      <div style="flex:1;height:1px;background:var(--border)"></div>
    </div>
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <!-- Browser History -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;gap:16px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:34px;height:34px;border-radius:8px;background:rgba(59,130,246,0.15);display:flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="font-size:18px;color:#60a5fa">language</span>
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text-primary)">Browser History</div>
            <div style="font-size:12px;color:var(--text-secondary)">Track visited pages and reading time</div>
          </div>
        </div>
        <label style="position:relative;display:flex;width:44px;height:26px;cursor:pointer;flex-shrink:0">
          <input type="checkbox" id="toggle-browser" style="opacity:0;width:0;height:0;position:absolute">
          <span class="toggleswitch"></span>
        </label>
      </div>
      <!-- Browser chips sub-row -->
      <div id="browser-chips-row" style="border-top:1px solid var(--border)">
        <div id="browser-chips" style="display:flex;gap:8px;flex-wrap:wrap;padding:12px 18px">
          <div class="browser-chip" data-browser="chrome">Chrome</div>
          <div class="browser-chip" data-browser="firefox">Firefox</div>
          <div class="browser-chip" data-browser="brave">Brave</div>
          <div class="browser-chip" data-browser="chromium">Chromium</div>
        </div>
      </div>
      <!-- Claude CLI -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;gap:16px;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:34px;height:34px;border-radius:8px;background:rgba(43,212,189,0.12);display:flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="font-size:18px;color:var(--accent)">psychology</span>
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text-primary)">Claude CLI Sessions</div>
            <div style="font-size:12px;color:var(--text-secondary)">Track coding sessions from Claude Code</div>
          </div>
        </div>
        <label style="position:relative;display:flex;width:44px;height:26px;cursor:pointer;flex-shrink:0">
          <input type="checkbox" id="toggle-claudecli" style="opacity:0;width:0;height:0;position:absolute">
          <span class="toggleswitch"></span>
        </label>
      </div>
      <!-- OpenCode -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;gap:16px;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:34px;height:34px;border-radius:8px;background:rgba(168,85,247,0.12);display:flex;align-items:center;justify-content:center">
            <span class="material-symbols-outlined" style="font-size:18px;color:#c084fc">memory</span>
          </div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--text-primary)">OpenCode Sessions</div>
            <div style="font-size:12px;color:var(--text-secondary)">Track AI coding assistant activity</div>
          </div>
        </div>
        <label style="position:relative;display:flex;width:44px;height:26px;cursor:pointer;flex-shrink:0">
          <input type="checkbox" id="toggle-opencode" style="opacity:0;width:0;height:0;position:absolute">
          <span class="toggleswitch"></span>
        </label>
      </div>
    </div>
  </div>

  <!-- ── PRIVACY ── -->
  <div style="margin-bottom:32px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <span style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--text-secondary)">Privacy</span>
      <div style="flex:1;height:1px;background:var(--border)"></div>
    </div>
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px 18px">
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">Excluded domains — URLs matching these are never tracked</p>
      <div id="exclusion-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        <p style="color:var(--text-secondary);font-size:13px">No exclusions yet — all URLs are tracked</p>
      </div>
      <div style="display:flex;gap:8px">
        <input id="exclusion-input" type="text" placeholder="e.g. reddit.com or *.private.io"
          style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text-primary);font-size:13px;outline:none"/>
        <button id="exclusion-add-btn"
          style="background:var(--accent);color:#0a0f1e;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer">+ Add</button>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 3: Add browser chip + exclusion CSS to the `<style>` block**

  ```css
  .browser-chip {
    padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
    cursor: pointer; border: 1px solid var(--border); color: var(--text-secondary);
    background: transparent; transition: all .15s; user-select: none;
  }
  .browser-chip.active { background: rgba(43,212,189,0.12); color: var(--accent); border-color: var(--accent); }
  .exclusion-item {
    display: flex; align-items: center; justify-content: space-between;
    background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px;
  }
  .exclusion-domain { font-size: 13px; color: #94a3b8; font-family: monospace; }
  .exclusion-remove { color: #f87171; font-size: 18px; cursor: pointer; background: none; border: none; line-height: 1; padding: 0 4px; }
  ```

- [ ] **Step 4: Add the Clear History confirmation dialog before `</body>`**

  ```html
  <!-- ── CLEAR HISTORY CONFIRMATION ── -->
  <div id="clear-history-dialog" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px)">
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:28px;width:380px;max-width:95vw">
      <h3 style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:12px">Clear all history?</h3>
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:24px;line-height:1.6">This will permanently delete all tracked activity. This cannot be undone.</p>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button id="clear-history-cancel" style="background:transparent;color:var(--text-secondary);border:1px solid var(--border);border-radius:8px;padding:10px 18px;font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
        <button id="clear-history-confirm" style="background:transparent;color:#f87171;border:1px solid rgba(248,113,113,0.4);border-radius:8px;padding:10px 18px;font-size:13px;font-weight:700;cursor:pointer">Clear All</button>
      </div>
    </div>
  </div>
  ```

- [ ] **Step 5: Quick visual check**

  Run: `npm run dev`, navigate to Settings
  - Tracking Sources card shows 3 rows + browser chips
  - Privacy section shows exclusion input
  - Nothing is interactive yet

- [ ] **Step 6: Commit**

  ```bash
  git add renderer/index.html
  git commit -m "feat: add tracking sources, privacy, and confirmation dialog HTML"
  ```

---

## Task 6: Wire `settings.js` and run full smoke test

**Files:**
- Modify: `renderer/index.html`

- [ ] **Step 1: Add the script tag**

  Find the block of script tags near the bottom of `index.html` (where `data.js`, `claudecli.js`, `opencode.js` are loaded). Add:
  ```html
  <script src="js/settings.js"></script>
  ```

- [ ] **Step 2: Find and update the `init()` function**

  Run: `grep -n 'async function init\|function init' renderer/index.html`
  Find the `async function init()` body in the inline `<script>`. Add `window.TSSettings?.initSettings();` as the **first line inside the function body**:

  ```js
  async function init() {
      window.TSSettings?.initSettings();   // ← add this
      setAccent('#2bd4bd', '#1fbba4');
      const savedMode = localStorage.getItem('ts-mode') || 'dark';
      applyMode(savedMode);
      // ... rest of existing init code unchanged ...
  }
  ```

- [ ] **Step 3: Full smoke test — work through each interaction**

  Run: `npm run dev`, go to Settings:

  - [ ] Profile card is visible at the top with 🦊 avatar
  - [ ] Name input shows "Developer"
  - [ ] Clicking the avatar opens the picker modal with 8 emoji options
  - [ ] Selecting 🐉 and clicking Save → avatar changes to 🐉, persists on refresh
  - [ ] Clicking Cancel or pressing Escape closes modal without changing avatar
  - [ ] Clicking avatar backdrop closes modal without changing avatar
  - [ ] Clearing name input and pressing Tab → reverts to "Developer"
  - [ ] All three source toggles start ON
  - [ ] Toggling Browser History OFF hides the browser chips row
  - [ ] Toggling Browser History ON shows the browser chips row
  - [ ] Chrome and Firefox chips are active by default; Brave and Chromium are inactive
  - [ ] Clicking an active chip deactivates it (unless it's the last active one)
  - [ ] Clicking the last active chip is ignored (stays active)
  - [ ] DevTools Console: `window.electronAPI.getSettings().then(s => console.log(s.collectors.browser))` → shows updated `browsers` array after chip changes
  - [ ] Adding "reddit.com" to exclusions → item appears in list with × button
  - [ ] Clicking × removes the item; empty state text reappears
  - [ ] DevTools → Application → localStorage: `ts-avatar`, `ts-display-name`, `ts-url-exclusions` all update correctly
  - [ ] Clicking "Clear History" opens confirmation dialog
  - [ ] Clicking "Cancel" closes dialog, no data deleted
  - [ ] Clicking "Clear All" closes dialog and clears activity data

- [ ] **Step 4: Commit**

  ```bash
  git add renderer/index.html
  git commit -m "feat: wire settings.js — settings page fully functional"
  ```

---

## Task 7: Full test suite

- [ ] **Step 1: Run all tests**

  Run: `npm test`
  Expected: all existing tests + 12 new settings unit tests pass

- [ ] **Step 2: Commit any fixes if needed**

  ```bash
  git add -p
  git commit -m "fix: address issues found during full test run"
  ```
