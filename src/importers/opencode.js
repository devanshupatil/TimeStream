'use strict';
const fs = require('fs');
const path = require('path');

const ERROR_PATTERNS = [
  /error:/i, /cannot find/i, /failed/i, /exception/i,
  /undefined is not/i, /syntaxerror/i, /typeerror/i,
  /referenceerror/i, /enoent/i, /permission denied/i,
  /module not found/i, /unexpected token/i,
];

const EXTENSION_TO_TAG = {
  '.js': 'javascript', '.ts': 'typescript', '.py': 'python',
  '.go': 'golang', '.rs': 'rust', '.css': 'css', '.html': 'html',
  '.json': 'json', '.md': 'markdown', '.sh': 'shell',
};

const KEYWORD_TAGS = [
  { pattern: /npm|node_modules|package\.json|cannot find module/i, tag: 'npm' },
  { pattern: /docker|dockerfile/i, tag: 'docker' },
  { pattern: /git\s/i, tag: 'git' },
  { pattern: /jest|test|spec/i, tag: 'testing' },
  { pattern: /auth|jwt|token|session/i, tag: 'auth' },
  { pattern: /express|fastify|koa/i, tag: 'express' },
  { pattern: /react|jsx|tsx/i, tag: 'react' },
  { pattern: /typescript|\.ts\b/i, tag: 'typescript' },
];

function extractErrors(messages) {
  const errors = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;
    const matched = ERROR_PATTERNS.find(p => p.test(msg.content));
    if (!matched) continue;
    const nextIsAssistant = messages[i + 1] && messages[i + 1].role === 'assistant';
    errors.push({ message: msg.content.slice(0, 120), fixed: nextIsAssistant });
  }
  return errors;
}

function extractTags(errors, filesChanged) {
  const tags = new Set();
  filesChanged.forEach(f => {
    const ext = path.extname(f).toLowerCase();
    if (EXTENSION_TO_TAG[ext]) tags.add(EXTENSION_TO_TAG[ext]);
  });
  const allText = errors.map(e => e.message).join(' ');
  KEYWORD_TAGS.forEach(({ pattern, tag }) => {
    if (pattern.test(allText)) tags.add(tag);
  });
  return [...tags];
}

function extractFiles(messages) {
  const FILE_RE = /(?:^|\s)([\w./\\-]+\.\w{1,5})/g;
  const found = new Set();
  messages.forEach(msg => {
    let m;
    while ((m = FILE_RE.exec(msg.content)) !== null) {
      const f = m[1].trim();
      if (f.length > 3) found.add(f);
    }
  });
  return [...found];
}

function extractSession(raw, filePath, fileMtime) {
  const messages = Array.isArray(raw.messages) ? raw.messages : [];

  let title = raw.title;
  if (!title) {
    const firstUser = messages.find(m => m.role === 'user');
    title = firstUser ? firstUser.content.slice(0, 60) : 'Untitled Session';
  }

  const mtimeISO = new Date(fileMtime).toISOString();
  const createdAt = raw.createdAt || mtimeISO;
  const updatedAt = raw.updatedAt || mtimeISO;

  const assistantMsgs = messages.filter(m => m.role === 'assistant');
  const summary = assistantMsgs.length > 0
    ? assistantMsgs[assistantMsgs.length - 1].content
    : (messages[0] ? messages[0].content : '');

  const errors = extractErrors(messages);
  const filesChanged = extractFiles(messages);
  const tags = extractTags(errors, filesChanged);

  return {
    sessionId: raw.id || path.basename(filePath, '.json'),
    date: createdAt.split('T')[0],
    startTime: createdAt.split('T')[1]?.slice(0, 8) || '00:00:00',
    endTime: updatedAt.split('T')[1]?.slice(0, 8) || '00:00:00',
    title,
    summary,
    errors,
    errorsFixed: errors.filter(e => e.fixed).length,
    tags,
    filesChanged,
    source: 'opencode',
  };
}

function isDuplicate(sessionId, storedSessions) {
  return storedSessions.some(s => s.sessionId === sessionId);
}

function loadSessions(storageFile) {
  try {
    return JSON.parse(fs.readFileSync(storageFile, 'utf8'));
  } catch {
    return [];
  }
}

function saveSession(session, storageFile) {
  const sessions = loadSessions(storageFile);
  if (isDuplicate(session.sessionId, sessions)) return false;
  sessions.push(session);
  fs.writeFileSync(storageFile, JSON.stringify(sessions, null, 2));
  return true;
}

module.exports = { extractSession, isDuplicate, extractErrors, extractTags, extractFiles, saveSession, loadSessions };
