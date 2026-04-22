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

// ── DOM functions (browser-only) ─────────────────────────────────

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

// ── Avatar ──────────────────────────────────────────────────────

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

// ── Display name ─────────────────────────────────────────────────

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

// ── Tracking sources ──────────────────────────────────────────────

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
        toggle.checked = prev;
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
      if (activeChips.length === 1 && activeChips[0] === chip) return; // min-1 constraint
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

// ── Privacy exclusions ────────────────────────────────────────────

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

// ── Clear History confirmation ────────────────────────────────────

function _initClearHistoryConfirm() {
  const btn = document.getElementById('btn-clear-history-app');
  if (!btn) return;
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

// ── Util ──────────────────────────────────────────────────────────

function _getNestedKey(obj, dotpath) {
  if (!obj) return null;
  return dotpath.split('.').reduce((acc, k) => (acc != null && k in acc ? acc[k] : null), obj);
}

// ── Export ────────────────────────────────────────────────────────

if (typeof module !== 'undefined') {
  module.exports = { sanitizeName, getDefaultBrowsers, addExclusion, removeExclusion, parseExclusions };
} else {
  window.TSSettings = { initSettings };
}
