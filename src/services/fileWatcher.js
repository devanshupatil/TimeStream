'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
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
  // eslint-disable-next-line global-require
  const chokidar = require('chokidar');
  if (!fs.existsSync(OPENCODE_SESSIONS_DIR)) {
    if (onMissingDir) onMissingDir();
    const retryTimer = setTimeout(() => startWatcher({ storageFile, onSession, onMissingDir }), MISSING_DIR_RETRY_MS);
    if (retryTimer.unref) retryTimer.unref();
    return null;
  }

  const debounceMap = new Map();

  async function processFile(filePath) {
    if (!filePath.endsWith('.json')) return;
    try {
      const raw = await parseWithRetry(
        () => fs.promises.readFile(filePath, 'utf8')
      );
      const mtime = (await fs.promises.stat(filePath)).mtimeMs;
      const session = extractSession(raw, filePath, mtime);
      const saved = saveSession(session, storageFile);
      if (saved && onSession) onSession(session);
    } catch (err) {
      console.warn(`[FileWatcher] Skipping ${path.basename(filePath)}: ${err.message}`);
    }
  }

  function getHandler(filePath) {
    if (!debounceMap.has(filePath)) {
      debounceMap.set(filePath, debounce(processFile, DEBOUNCE_MS));
    }
    return debounceMap.get(filePath);
  }

  const watcher = chokidar.watch(OPENCODE_SESSIONS_DIR, {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  watcher.on('add',    fp => getHandler(fp)(fp));
  watcher.on('change', fp => getHandler(fp)(fp));
  watcher.on('unlink', fp => debounceMap.delete(fp));  // cleanup
  watcher.on('error',  err => console.error('[FileWatcher] Error:', err));

  return watcher;
}

module.exports = { startWatcher, debounce, parseWithRetry };
