'use strict';
const fs = require('fs');
const chokidar = require('chokidar');
const { parseSessionFile, extractSession, loadSessions, saveSession } = require('../importers/claudecli');

/**
 * Creates a file watcher for a Claude CLI project sessions directory.
 * @param {object} opts
 * @param {string}   opts.watchDir    - Path to ~/.claude/projects/{slug}/
 * @param {string}   opts.storageFile - Path to claude-sessions.json
 * @param {function} opts.onSession   - Called with extracted session on new/updated file
 * @param {number}  [opts.debounceMs] - Debounce delay in ms (default: 1500)
 */
function createClaudeCliWatcher({ watchDir, storageFile, onSession, debounceMs = 1500 }) {
  let watcher = null;
  const debounceMap = new Map();

  function processFile(filePath) {
    if (!filePath.endsWith('.jsonl')) return;

    // Skip automated/observer sessions by path
    if (filePath.includes('claude-mem') || filePath.includes('observer')) return;

    // Debounce per file — JSONL files are written incrementally
    if (debounceMap.has(filePath)) clearTimeout(debounceMap.get(filePath));

    debounceMap.set(filePath, setTimeout(() => {
      debounceMap.delete(filePath);
      try {
        const entries = parseSessionFile(filePath);
        if (!entries.length) return;

        // Only include sessions with real user<->assistant conversation
        const hasUserMsg = entries.some(e => e.type === 'user' && !e.isSidechain);
        const hasAssistantMsg = entries.some(e => e.type === 'assistant' && !e.isSidechain);
        if (!hasUserMsg || !hasAssistantMsg) return;

        const fileMtime = fs.statSync(filePath).mtimeMs;
        const session = extractSession(entries, filePath, fileMtime);
        if (!session) return;

        // Skip automated/observer sessions by title
        const t = (session.title || '').toLowerCase();
        if (t.includes('claude-mem') || t.includes('memory agent')) return;

        saveSession(session, storageFile);
        onSession(session);
      } catch (err) {
        console.error('ClaudeCliWatcher: error processing', filePath, err);
      }
    }, debounceMs));
  }

  return {
    start() {
      watcher = chokidar.watch(watchDir, {
        persistent: true,
        ignoreInitial: false,
        awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
      });
      watcher.on('add', processFile);
      watcher.on('change', processFile);
      watcher.on('error', err => console.error('ClaudeCliWatcher error:', err));
    },
    stop() {
      debounceMap.forEach(t => clearTimeout(t));
      debounceMap.clear();
      if (watcher) { watcher.close(); watcher = null; }
    },
  };
}

module.exports = { createClaudeCliWatcher };
