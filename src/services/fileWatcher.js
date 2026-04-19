'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const { extractSession, saveSession } = require('../importers/opencode.js');

const OPENCODE_DB = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
const SNAP_CODE_CURRENT_DB = path.join(os.homedir(), 'snap', 'code', 'current', '.local', 'share', 'opencode', 'opencode.db');
const POLL_INTERVAL_MS = 3000;

function getAllDBs() {
  const paths = [
    OPENCODE_DB,
    SNAP_CODE_CURRENT_DB
  ];
  try {
    const snapCodeDir = path.join(os.homedir(), 'snap', 'code');
    if (fs.existsSync(snapCodeDir)) {
      const dirs = fs.readdirSync(snapCodeDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory() && !isNaN(parseInt(d.name))) {
          paths.push(path.join(snapCodeDir, d.name, '.local', 'share', 'opencode', 'opencode.db'));
        }
      }
    }
  } catch (err) { }
  return [...new Set(paths)].filter(p => fs.existsSync(p));
}

function startWatcher({ storageFile, onSession, onMissingDir }) {
  const dbPaths = getAllDBs();
  if (dbPaths.length === 0) {
    if (onMissingDir) onMissingDir();
    const retryTimer = setTimeout(() => startWatcher({ storageFile, onSession, onMissingDir }), 30000);
    if (retryTimer.unref) retryTimer.unref();
    return null;
  }

  const dbs = dbPaths.map(p => new Database(p, { readonly: true }));
  // First run: get last 30 days of sessions, then switch to incremental mode
  let lastCheckTime = Date.now() - (30 * 86400000); // 30 days in ms
  let firstRun = true;

  const poll = () => {
    try {
      // After first run, switch to checking only recent changes (5 seconds ago)
      if (firstRun) {
        firstRun = false;
        lastCheckTime = Date.now() - 5000;
      }

      // Check all databases for new sessions
      for (const db of dbs) {
        // Find sessions created OR updated since our last check
        const query = db.prepare('SELECT * FROM session WHERE time_created > ? OR time_updated > ? ORDER BY time_updated ASC');
        const changedSessions = query.all(lastCheckTime, lastCheckTime);

        for (const sess of changedSessions) {
          // Find messages
          const messages = db.prepare('SELECT * FROM message WHERE session_id = ? ORDER BY time_created ASC').all(sess.id);

          const finalMessages = [];

          for (const msg of messages) {
            const msgMeta = JSON.parse(msg.data);
            const parts = db.prepare('SELECT * FROM part WHERE message_id = ? ORDER BY time_created ASC').all(msg.id);

            let content = '';
            for (const ptr of parts) {
              const ptData = JSON.parse(ptr.data);
              if (ptData.type === 'text' && ptData.text) {
                content += ptData.text + '\n\n';
              }
            }

            finalMessages.push({
              role: msgMeta.role,
              content: content.trim(),
              createdAt: new Date(msg.time_created).toISOString()
            });
          }

          const rawJson = {
            id: sess.id,
            title: sess.title,
            createdAt: new Date(sess.time_created).toISOString(),
            updatedAt: new Date(sess.time_updated).toISOString(),
            messages: finalMessages
          };

          const parsedSession = extractSession(rawJson, 'sqlite_db', sess.time_updated);
          const saved = saveSession(parsedSession, storageFile);

          if (saved && onSession) {
            onSession(parsedSession);
          }

          lastCheckTime = Math.max(lastCheckTime, sess.time_updated);
        }
      }
    } catch (err) {
      console.warn('[SQLite Watcher] Error polling OpenCode db:', err);
    }
  };

  const timer = setInterval(poll, POLL_INTERVAL_MS);
  return { close: () => { clearInterval(timer); dbs.forEach(d => d.close()); } };
}

module.exports = { startWatcher };
