# Settings Page Redesign — Design Spec
**Date:** 2026-04-23  
**Status:** Approved by user

---

## Overview

Enhance the TimeStream settings page with four additions:
1. Anime avatar profile header (with modal picker)
2. Tracking sources section (per-source toggles + browser selection)
3. Privacy section (URL/domain exclusion list)
4. Editable display name

The existing sections (Appearance, Startup, Data) are preserved as-is. The page remains a single scrollable layout.

---

## Page Structure (top to bottom)

```
Settings
├── Profile Header          ← NEW
├── Appearance              (existing)
├── Startup                 (existing)
├── Tracking Sources        ← NEW
├── Privacy                 ← NEW
└── Data                    (existing, + confirmation on Clear History)
```

---

## 1. Profile Header

A card at the very top of `#page-settings`, above all other sections.

**Layout:** Horizontal flex — avatar on the left, info on the right.

**Avatar:**
- 72×72px circle, 3px accent-colored border, soft glow ring
- Displays the currently selected anime emoji
- Has a small edit badge (✏) in the bottom-right corner
- Clicking the avatar opens the Avatar Picker Modal

**Avatar Picker Modal:**
- Overlay backdrop with blur
- 4×2 grid of 8 selectable anime avatars: 🦊 🐉 🌸 ⚔️ 🔮 🌙 ⚡ 🎭
- Selected avatar gets accent border + glow ring
- Dismissed by: Cancel button, clicking the backdrop, or pressing Escape
- Save button: applies selection, closes modal, persists to `localStorage[ts-avatar]`
- Cancel / Escape / backdrop click: closes modal without changing the current avatar
- Default avatar on first load (no localStorage value): 🦊
- Accessibility: full keyboard/ARIA support is **out of scope** for this iteration

**Display name:**
- Editable `<input>` next to the avatar, `maxlength="32"`
- On load: value from `localStorage[ts-display-name]`, fallback `"Developer"`
- Save logic (triggered on blur or Enter key press):
  1. Trim whitespace from the value
  2. If result is empty string → set input value to `"Developer"` and save `"Developer"`
  3. Otherwise → save the trimmed value
- Static decorative pill labelled `"Developer"` below the name input — always this text, never changes, not tied to the name field. It is a fixed role label for the solo-developer use case.

---

## 2. Appearance (unchanged)

Dark/Light theme cards — no changes.

---

## 3. Startup (unchanged)

Two toggles: Launch at startup · Start minimized — no changes.

---

## 4. Tracking Sources (new section)

**Section label:** "Tracking Sources"

Three toggle rows:

| Row | Icon bg | Label | Description | agentConfig key | Default |
|-----|---------|-------|-------------|-----------------|---------|
| Browser History | Blue | Browser History | Track visited pages and reading time | `collectors.browser.enabled` | `true` |
| Claude CLI | Teal | Claude CLI Sessions | Track coding sessions from Claude Code | `readers.claudecli.enabled` | `true` |
| OpenCode | Purple | OpenCode Sessions | Track AI coding assistant activity | `readers.opencode.enabled` | `true` |

**Browser chip sub-row:**
- Renders immediately below the Browser History row
- Visible only when Browser History toggle is ON; `display:none` when OFF
- Four chips: Chrome · Firefox · Brave · Chromium
- Maps to `collectors.browser.browsers` array (values: `'chrome'`, `'firefox'`, `'brave'`, `'chromium'`)
- Multiple chips can be active simultaneously
- **Minimum one chip must remain selected** — if the user tries to deselect the last active chip, the action is ignored (chip stays selected)
- Default (when `getSettings()` returns a missing or empty array for this key): Chrome + Firefox active
- Subsequent loads with a non-empty saved array: reflect that array

**IPC contract — `saveSettings` and `getSettings`:**
- `window.electronAPI.saveSettings({ key: string, value: any })` — single key-value pair per call; `value` may be boolean, string, or array
- `window.electronAPI.getSettings()` → returns the full agentConfig object (result of `agentConfig.getAll()`)
- Both methods are exposed via `contextBridge` in `preload.js`
- Main process: `ipcMain.handle('save-settings', (_, { key, value }) => agentConfig.set(key, value))` and `ipcMain.handle('get-settings', () => agentConfig.getAll())`

**Persistence for Tracking Sources:**
- On toggle change: call `electronAPI.saveSettings({ key: dotpath, value: bool })`
- On IPC failure: visually revert the toggle to its previous state + `console.error`
- On browser chip change: call `electronAPI.saveSettings({ key: 'collectors.browser.browsers', value: currentActiveChips })`
- On load: call `getSettings()` → read the four keys → set UI. If a key is missing or null, apply the default from the table above

---

## 5. Privacy (new section)

**Section label:** "Privacy"

A card containing an exclusion list and an add-rule input.

**Exclusion list:**
- Each entry is a domain/pattern string (no format validation — substring match used by the browser collector at collection time)
- Displayed in monospace font
- A `×` button removes the entry immediately and triggers a save
- Empty state: dim placeholder text `"No exclusions yet — all URLs are tracked"`

**Add rule:**
- Text input, placeholder: `e.g. reddit.com or *.private.io`
- Triggered by clicking "+ Add" button or pressing Enter in the input
- Logic: trim whitespace → if empty, do nothing → otherwise append to list and save

**Persistence:**
- `localStorage[ts-url-exclusions]` (JSON-stringified array) is the **source of truth** for the renderer
- On add/remove: update `localStorage[ts-url-exclusions]` immediately, then call `electronAPI.saveSettings({ key: 'collectors.browser.excludedDomains', value: [...] })` to keep the agent in sync
- On load: read `localStorage[ts-url-exclusions]`. If empty or missing, check `getSettings().collectors?.browser?.excludedDomains` as a fallback. If both are absent, start with `[]`
- The agent config copy is a synchronized mirror; the renderer does not read it on load except as the fallback above

---

## 6. Data (existing + one change)

Export CSV · Export JSON — unchanged.

**Clear History:**
- Now shows a confirmation dialog before proceeding
- Dialog message: `"This will permanently delete all tracked activity. This cannot be undone."`
- Buttons: `"Cancel"` (dismiss, no action) · `"Clear All"` (red, proceeds with deletion)
- **Scope of deletion:** clears only the SQLite activity database (all rows). Does NOT clear localStorage, agentConfig, or session files.

---

## Data Flow Summary

```
On page load:
  getSettings()                   → populate source toggles + browser chips
  localStorage[ts-avatar]         → set avatar emoji (default 🦊)
  localStorage[ts-display-name]   → set name input (default "Developer")
  localStorage[ts-url-exclusions] → populate exclusion list
    └─ fallback: getSettings().collectors?.browser?.excludedDomains ?? []

On user action:
  avatar change     → localStorage[ts-avatar]
  name change       → localStorage[ts-display-name]  (trim → empty-check → save)
  toggle change     → electronAPI.saveSettings({ key, value })
                      └─ on IPC fail: revert toggle + console.error
  browser chips     → electronAPI.saveSettings({ key: 'collectors.browser.browsers', value: [...] })
  exclusion add/rm  → localStorage[ts-url-exclusions]
                    + electronAPI.saveSettings({ key: 'collectors.browser.excludedDomains', value: [...] })
```

---

## Files to Change

| File | Change |
|------|--------|
| `renderer/index.html` | Add profile header HTML, tracking sources section, privacy section |
| `renderer/js/app.js` | JS: modal (open/close/save/cancel/escape/backdrop), name save (trim+revert), toggle handlers with IPC rollback, browser chips (min-one constraint), exclusion list add/remove |
| `src/preload.js` | Expose `saveSettings({ key, value })` and `getSettings()` via `contextBridge` if not already |
| `src/main.js` | IPC handlers for `save-settings` and `get-settings` if not already present |
| `src/shared/constants.js` | Add `excludedDomains: []` inside `collectors.browser` in `DEFAULT_AGENT_CONFIG`. `agentConfig.get()` already handles missing keys via its fallback — no migration needed for existing config files |

---

## Out of Scope

- Custom avatar image upload
- Avatar/modal keyboard accessibility (ARIA, focus trap, tab order)
- Per-domain granular tracking
- Notification preferences
- Poll interval controls
- Data retention period setting
- Save-success toasts or notifications
- Clearing localStorage / agentConfig on "Clear History"
