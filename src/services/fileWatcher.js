'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const Database = require('better-sqlite3');
const { extractSession, saveSession } = require('../importers/opencode.js');

const OPENCODE_DB = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
const POLL_INTERVAL_MS = 3000;

function startWatcher({ storageFile, onSession, onMissingDir }) {
  if (!fs.existsSync(OPENCODE_DB)) {
    if (onMissingDir) onMissingDir();
    const retryTimer = setTimeout(() => startWatcher({ storageFile, onSession, onMissingDir }), 30000);
    if (retryTimer.unref) retryTimer.unref();
    return null;
  }

  const db = new Database(OPENCODE_DB, { readonly: true });
  // Start checking from the last 24 hours to catch recent disconnected sessions
  let lastCheckTime = Date.now() - 24 * 60 * 60 * 1000;

  const poll = () => {
    try {
      // Find sessions updated since our last check
      const query = db.prepare('SELECT * FROM session WHERE time_updated > ? ORDER BY time_updated ASC');
      // Use lastCheckTime directly since `time_updated` in sqlite is also epoch ms
      const changedSessions = query.all(lastCheckTime);

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
    } catch (err) {
      console.warn('[SQLite Watcher] Error polling OpenCode db:', err);
    }
  };

  const timer = setInterval(poll, POLL_INTERVAL_MS);
  return { close: () => { clearInterval(timer); db.close(); } };
}

module.exports = { startWatcher };
