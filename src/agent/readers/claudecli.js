'use strict';

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../../shared/logger');
const { CLAUDE_PROJECTS_DIR, LOGS_DIR } = require('../../shared/constants');

const logger = createLogger({ appName: 'claudecli-reader', logDir: LOGS_DIR });

function cwdToSlug(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, '-');
}

class ClaudeReader {
  constructor(config = {}) {
    this.projectsDir = config.projectsDir || CLAUDE_PROJECTS_DIR;
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000;
  }

  isAvailable() {
    return fs.existsSync(this.projectsDir);
  }

  getProjects() {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      const entries = fs.readdirSync(this.projectsDir, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory())
        .map(e => ({
          slug: e.name,
          path: path.join(this.projectsDir, e.name),
        }));
    } catch (err) {
      logger.error('Failed to get projects', { error: err.message });
      return [];
    }
  }

  _getCacheKey(date, projectSlug = null) {
    return projectSlug ? `sessions:${projectSlug}:${date}` : `sessions:all:${date}`;
  }

  _isCacheValid(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.time < this.cacheTTL;
  }

  getSessions(date, projectSlug = null) {
    const cacheKey = this._getCacheKey(date, projectSlug);
    
    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (!this.isAvailable()) {
      return [];
    }

    const sessions = [];
    const projects = projectSlug 
      ? [{ slug: projectSlug, path: path.join(this.projectsDir, projectSlug) }]
      : this.getProjects();

    for (const project of projects) {
      try {
        const files = fs.readdirSync(project.path)
          .filter(f => f.endsWith('.jsonl'));

        for (const file of files) {
          const filePath = path.join(project.path, file);
          const session = this._parseJsonlFile(filePath, date);
          if (session) {
            sessions.push(session);
          }
        }
      } catch (err) {
        logger.warn('Failed to read project', { project: project.slug, error: err.message });
      }
    }

    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    this.cache.set(cacheKey, { data: sessions, time: Date.now() });

    return sessions;
  }

  getSession(id) {
    if (!this.isAvailable()) {
      return null;
    }

    const projects = this.getProjects();

    for (const project of projects) {
      try {
        const filePath = path.join(project.path, `${id}.jsonl`);
        if (fs.existsSync(filePath)) {
          return this._parseJsonlFile(filePath);
        }
      } catch (err) {
        // continue
      }
    }

    return null;
  }

  _parseJsonlFile(filePath, dateFilter = null) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(l => l.trim());

      const entries = lines
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      if (entries.length === 0) {
        return null;
      }

      const firstEntry = entries[0];
      const lastEntry = entries[entries.length - 1];

      const timestamps = entries
        .map(e => e.timestamp)
        .filter(Boolean)
        .sort();

      const startTime = timestamps[0];
      const endTime = timestamps[timestamps.length - 1];
      const date = startTime ? startTime.split('T')[0] : null;

      if (dateFilter && date !== dateFilter) {
        return null;
      }

      const title = this._extractTitle(entries);
      const toolsUsed = this._extractToolsUsed(entries);
      const errors = this._extractErrors(entries);
      const sessionId = firstEntry.sessionId || path.basename(filePath, '.jsonl');

      return {
        sessionId,
        title,
        createdAt: startTime,
        updatedAt: endTime,
        date,
        startTime: startTime ? startTime.split('T')[1]?.slice(0, 8) || '00:00:00' : '00:00:00',
        endTime: endTime ? endTime.split('T')[1]?.slice(0, 8) || '00:00:00' : '00:00:00',
        durationSecs: Math.round((new Date(endTime) - new Date(startTime)) / 1000),
        source: 'claudecli',
        source_label: 'Claude CLI',
        toolsUsed,
        errors,
        tags: this._extractTags(toolsUsed, errors),
        filesChanged: this._extractFilesChanged(entries),
        gitBranch: firstEntry.gitBranch || 'unknown',
        cwd: firstEntry.cwd || '',
        isSidechain: entries.some(e => e.isSidechain),
      };
    } catch (err) {
      logger.error('Failed to parse JSONL file', { file: filePath, error: err.message });
      return null;
    }
  }

  _extractTitle(entries) {
    const firstUser = entries.find(e => e.type === 'user' && !e.isSidechain);
    if (!firstUser) return 'Untitled Session';

    const content = firstUser.message?.content;
    if (typeof content === 'string') return content.slice(0, 80);
    if (Array.isArray(content)) {
      const text = content.find(c => c.type === 'text');
      return text ? text.text.slice(0, 80) : 'Untitled Session';
    }
    return 'Untitled Session';
  }

  _extractToolsUsed(entries) {
    const tools = new Set();
    entries
      .filter(e => e.type === 'assistant')
      .forEach(e => {
        const content = e.message?.content;
        if (Array.isArray(content)) {
          content.filter(c => c.type === 'tool_use').forEach(c => tools.add(c.name));
        }
      });
    return [...tools];
  }

  _extractErrors(entries) {
    const errors = [];
    const ERROR_PATTERNS = [
      /error:/i, /cannot find/i, /failed/i, /exception/i,
      /undefined is not/i, /syntaxerror/i, /typeerror/i,
    ];

    entries
      .filter(e => e.type === 'user' && !e.isSidechain)
      .forEach((entry, idx) => {
        const content = entry.message?.content;
        if (typeof content !== 'string') return;
        if (ERROR_PATTERNS.some(p => p.test(content))) {
          const nextIsAssistant = entries[idx + 1]?.type === 'assistant';
          errors.push({ message: content.slice(0, 120), fixed: nextIsAssistant });
        }
      });

    return errors;
  }

  _extractTags(toolsUsed, errors) {
    const tags = new Set();

    if (toolsUsed.includes('Edit')) tags.add('coding');
    if (toolsUsed.includes('Bash')) tags.add('terminal');
    if (errors.length > 0) tags.add('debugging');
    
    return [...tags];
  }

  _extractFilesChanged(entries) {
    const files = new Set();
    entries
      .filter(e => e.type === 'file-history-snapshot')
      .forEach(e => {
        Object.keys(e.snapshot?.trackedFileBackups || {}).forEach(f => files.add(f));
      });
    return [...files];
  }

  clearCache() {
    this.cache.clear();
  }

  stop() {
    this.clearCache();
  }
}

module.exports = { ClaudeReader };
