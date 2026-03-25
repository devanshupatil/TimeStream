'use strict';
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ERROR_PATTERNS = [
  /error:/i, /cannot find/i, /failed/i, /exception/i,
  /undefined is not/i, /syntaxerror/i, /typeerror/i,
  /referenceerror/i, /enoent/i, /permission denied/i,
  /module not found/i, /unexpected token/i,
];

const EXTENSION_TO_TAG = {
  '.js': 'javascript', '.ts': 'typescript', '.py': 'python',
  '.go': 'golang',     '.rs': 'rust',       '.css': 'css',
  '.html': 'html',     '.json': 'json',     '.md': 'markdown',
  '.sh': 'shell',
};

const KEYWORD_TAGS = [
  { pattern: /npm|node_modules|package\.json/i, tag: 'npm' },
  { pattern: /docker|dockerfile/i,              tag: 'docker' },
  { pattern: /git\s/i,                          tag: 'git' },
  { pattern: /jest|test|spec/i,                 tag: 'testing' },
  { pattern: /auth|jwt|token|session/i,         tag: 'auth' },
  { pattern: /react|jsx|tsx/i,                  tag: 'react' },
  { pattern: /typescript|\.ts\b/i,              tag: 'typescript' },
  { pattern: /electron/i,                       tag: 'electron' },
  { pattern: /mcp|claude|anthropic/i,           tag: 'ai' },
];

function cwdToSlug(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

function getProjectDir(cwd) {
  return path.join(os.homedir(), '.claude', 'projects', cwdToSlug(cwd));
}

function parseSessionFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.trim().split('\n')
      .filter(line => line.trim())
      .map(line => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function extractTitle(entries) {
  const first = entries.find(e => e.type === 'user' && !e.isSidechain);
  if (!first) return 'Untitled Session';
  const content = first.message?.content;
  if (typeof content === 'string') return content.slice(0, 80);
  if (Array.isArray(content)) {
    const text = content.find(c => c.type === 'text');
    return text ? text.text.slice(0, 80) : 'Untitled Session';
  }
  return 'Untitled Session';
}

function extractDuration(entries) {
  const ts = entries.map(e => e.timestamp).filter(Boolean).sort();
  if (ts.length < 2) return 0;
  return Math.round((new Date(ts[ts.length - 1]) - new Date(ts[0])) / 1000);
}

function extractFilesChanged(entries) {
  const files = new Set();
  entries.filter(e => e.type === 'file-history-snapshot').forEach(e => {
    Object.keys(e.snapshot?.trackedFileBackups || {}).forEach(f => files.add(f));
  });
  return [...files];
}

function extractToolsUsed(entries) {
  const tools = new Set();
  entries.filter(e => e.type === 'assistant').forEach(e => {
    const content = e.message?.content;
    if (Array.isArray(content))
      content.filter(c => c.type === 'tool_use').forEach(c => tools.add(c.name));
  });
  return [...tools];
}

function extractTokenUsage(entries) {
  let input = 0, output = 0;
  entries.filter(e => e.type === 'assistant').forEach(e => {
    const u = e.message?.usage;
    if (u) {
      input  += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0);
      output += u.output_tokens || 0;
    }
  });
  return { input, output, total: input + output };
}

function extractErrors(entries) {
  const errors = [];
  entries.filter(e => e.type === 'user' && !e.isSidechain).forEach(entry => {
    const content = entry.message?.content;
    if (typeof content !== 'string') return; // guard: array content
    if (!ERROR_PATTERNS.some(p => p.test(content))) return;
    const idx = entries.indexOf(entry);
    const nextIsAssistant = entries[idx + 1]?.type === 'assistant';
    errors.push({ message: content.slice(0, 120), fixed: nextIsAssistant });
  });
  return errors;
}

function extractTags(errors, filesChanged, toolsUsed) {
  const tags = new Set();
  filesChanged.forEach(f => {
    const ext = path.extname(f).toLowerCase();
    if (EXTENSION_TO_TAG[ext]) tags.add(EXTENSION_TO_TAG[ext]);
  });
  const allText = errors.map(e => e.message).join(' ') + ' ' + toolsUsed.join(' ');
  KEYWORD_TAGS.forEach(({ pattern, tag }) => { if (pattern.test(allText)) tags.add(tag); });
  return [...tags];
}

function extractMessages(entries) {
  const messages = [];
  for (const e of entries) {
    if (e.isSidechain) continue;
    if (e.type === 'user') {
      const content = e.message?.content;
      let text = '';
      if (typeof content === 'string') text = content.trim();
      else if (Array.isArray(content))
        text = content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      if (text) messages.push({ role: 'user', content: text.slice(0, 4000) });
    } else if (e.type === 'assistant') {
      const content = e.message?.content;
      let text = '';
      if (Array.isArray(content))
        text = content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      else if (typeof content === 'string') text = content.trim();
      if (text) messages.push({ role: 'assistant', content: text.slice(0, 4000) });
    }
  }
  return messages.slice(0, 60);
}

function extractSession(entries, filePath, fileMtime) {
  if (!entries.length) return null;
  const first = entries[0];
  const sessionId = first.sessionId || path.basename(filePath, '.jsonl');
  const filesChanged = extractFilesChanged(entries);
  const toolsUsed    = extractToolsUsed(entries);
  const errors       = extractErrors(entries);
  const ts = entries.map(e => e.timestamp).filter(Boolean).sort();
  const startTs = ts[0] || new Date(fileMtime).toISOString();
  const endTs   = ts[ts.length - 1] || startTs;

  return {
    sessionId,
    date:         startTs.split('T')[0],
    startTime:    startTs.split('T')[1]?.slice(0, 8) || '00:00:00',
    endTime:      endTs.split('T')[1]?.slice(0, 8)   || '00:00:00',
    durationSecs: extractDuration(entries),
    title:        extractTitle(entries),
    errors,
    errorsFixed:  errors.filter(e => e.fixed).length,
    tags:         extractTags(errors, filesChanged, toolsUsed),
    filesChanged,
    toolsUsed,
    tokenUsage:   extractTokenUsage(entries),
    messages:     extractMessages(entries),
    messageCount: entries.filter(e => (e.type === 'user' || e.type === 'assistant') && !e.isSidechain).length,
    model:        entries.find(e => e.type === 'assistant')?.message?.model || 'unknown',
    gitBranch:    first.gitBranch || 'unknown',
    cwd:          first.cwd || '',
    source:       'claudecli',
  };
}

function isDuplicate(sessionId, storedSessions) {
  return storedSessions.some(s => s.sessionId === sessionId);
}

function loadSessions(storageFile) {
  try { return JSON.parse(fs.readFileSync(storageFile, 'utf8')); } catch { return []; }
}

function saveSession(session, storageFile) {
  const sessions = loadSessions(storageFile);
  const idx = sessions.findIndex(s => s.sessionId === session.sessionId);
  if (idx >= 0) sessions[idx] = session; else sessions.push(session);
  fs.writeFileSync(storageFile, JSON.stringify(sessions, null, 2));
  return true;
}

function scanLast24h(projectsDir) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const sessions = [];
  let projectDirs;
  try {
    projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => path.join(projectsDir, d.name));
  } catch {
    return sessions;
  }
  for (const dir of projectDirs) {
    let files;
    try {
      files = fs.readdirSync(dir).filter(f => f.endsWith('.jsonl'));
    } catch {
      continue;
    }
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) continue;
        const entries = parseSessionFile(filePath);
        if (!entries.length) continue;
        const session = extractSession(entries, filePath, stat.mtimeMs);
        if (session) sessions.push(session);
      } catch {
        // skip unreadable files
      }
    }
  }
  return sessions;
}

module.exports = {
  cwdToSlug, getProjectDir, parseSessionFile,
  extractTitle, extractDuration, extractFilesChanged,
  extractToolsUsed, extractTokenUsage, extractErrors,
  extractMessages, extractTags, extractSession, isDuplicate,
  loadSessions, saveSession, scanLast24h,
};
