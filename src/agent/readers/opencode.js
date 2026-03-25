'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../../shared/logger');
const { OPENCODE_DB_PATH, LOGS_DIR } = require('../../shared/constants');

const logger = createLogger({ appName: 'opencode-reader', logDir: LOGS_DIR });

class OpenCodeReader {
  constructor(config = {}) {
    this.dbPath = config.dbPath || OPENCODE_DB_PATH;
    this.db = null;
    this.pollIntervalMs = config.pollIntervalMs || 5000;
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000;
    this.lastPollTime = 0;
  }

  connect() {
    if (!fs.existsSync(this.dbPath)) {
      logger.warn('OpenCode database not found', { path: this.dbPath });
      return false;
    }

    try {
      this.db = new Database(this.dbPath, { readonly: true });
      logger.info('Connected to OpenCode database', { path: this.dbPath });
      return true;
    } catch (err) {
      logger.error('Failed to connect to OpenCode database', { error: err.message });
      return false;
    }
  }

  disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Disconnected from OpenCode database');
    }
  }

  isAvailable() {
    return fs.existsSync(this.dbPath);
  }

  _getCacheKey(date) {
    return `sessions:${date}`;
  }

  _isCacheValid(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.time < this.cacheTTL;
  }

  getSessions(date) {
    const cacheKey = this._getCacheKey(date);
    
    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    if (!this.db) {
      if (!this.connect()) {
        return [];
      }
    }

    try {
      const startOfDay = new Date(date + 'T00:00:00.000Z').getTime();
      const endOfDay = new Date(date + 'T23:59:59.999Z').getTime();

      const query = this.db.prepare(`
        SELECT * FROM session 
        WHERE time_created >= ? AND time_created <= ?
        ORDER BY time_created DESC
      `);

      const sessions = query.all(startOfDay, endOfDay).map(sess => this._parseSession(sess));

      this.cache.set(cacheKey, { data: sessions, time: Date.now() });
      
      return sessions;
    } catch (err) {
      logger.error('Failed to get sessions', { error: err.message, date });
      return [];
    }
  }

  getSession(id) {
    if (!this.db) {
      if (!this.connect()) {
        return null;
      }
    }

    try {
      const query = this.db.prepare('SELECT * FROM session WHERE id = ?');
      const sess = query.get(id);
      return sess ? this._parseSession(sess) : null;
    } catch (err) {
      logger.error('Failed to get session', { error: err.message, id });
      return null;
    }
  }

  getRecentSessions(count = 10) {
    if (!this.db) {
      if (!this.connect()) {
        return [];
      }
    }

    try {
      const query = this.db.prepare(`
        SELECT * FROM session 
        ORDER BY time_created DESC 
        LIMIT ?
      `);

      return query.all(count).map(sess => this._parseSession(sess));
    } catch (err) {
      logger.error('Failed to get recent sessions', { error: err.message });
      return [];
    }
  }

  _parseSession(row) {
    return {
      sessionId: row.id,
      title: row.title || 'Untitled Session',
      createdAt: new Date(row.time_created).toISOString(),
      updatedAt: new Date(row.time_updated).toISOString(),
      date: new Date(row.time_created).toISOString().split('T')[0],
      startTime: new Date(row.time_created).toISOString().split('T')[1]?.slice(0, 8) || '00:00:00',
      endTime: new Date(row.time_updated).toISOString().split('T')[1]?.slice(0, 8) || '00:00:00',
      source: 'opencode',
      source_label: 'OpenCode',
      messages: [],
      tags: ['opencode'],
    };
  }

  clearCache() {
    this.cache.clear();
  }

  stop() {
    this.disconnect();
    this.clearCache();
  }
}

module.exports = { OpenCodeReader };
