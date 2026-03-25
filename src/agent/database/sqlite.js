'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../../shared/logger');

const logger = createLogger({ appName: 'timestream-db' });

const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_label TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT,
    description TEXT,
    category TEXT,
    timestamp INTEGER NOT NULL,
    duration INTEGER,
    metadata TEXT,
    tags TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp);
CREATE INDEX IF NOT EXISTS idx_activities_source ON activities(source);
CREATE INDEX IF NOT EXISTS idx_activities_category ON activities(category);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(date(timestamp / 1000, 'unixepoch'));

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
`;

class TimeStreamDB {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this._ensureDir();
  }

  _ensureDir() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  open() {
    if (this.db) return this;

    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      
      this._initSchema();
      
      logger.info('Database opened', { path: this.dbPath });
      return this;
    } catch (err) {
      logger.error('Failed to open database', { path: this.dbPath, error: err.message });
      throw err;
    }
  }

  _initSchema() {
    this.db.exec(SCHEMA);
    
    const versionRow = this.db.prepare('SELECT version FROM schema_version LIMIT 1').get();
    const currentVersion = versionRow ? versionRow.version : 0;
    
    if (currentVersion < SCHEMA_VERSION) {
      logger.info('Running database migrations', { from: currentVersion, to: SCHEMA_VERSION });
      this._runMigrations(currentVersion);
    }
  }

  _runMigrations(fromVersion) {
    if (fromVersion < 1) {
      this.db.prepare('INSERT OR REPLACE INTO schema_version (version) VALUES (?)').run(SCHEMA_VERSION);
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Database closed');
    }
  }

  insertActivity(activity) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO activities 
      (id, source, source_label, title, url, description, category, timestamp, duration, metadata, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    return stmt.run(
      activity.id,
      activity.source,
      activity.source_label,
      activity.title,
      activity.url || null,
      activity.description || null,
      activity.category || null,
      activity.timestamp,
      activity.duration || null,
      activity.metadata ? JSON.stringify(activity.metadata) : null,
      activity.tags ? JSON.stringify(activity.tags) : null,
      activity.created_at || now,
      now
    );
  }

  insertActivities(activities) {
    const insertMany = this.db.transaction((items) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO activities 
        (id, source, source_label, title, url, description, category, timestamp, duration, metadata, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const activity of items) {
        const now = Date.now();
        stmt.run(
          activity.id,
          activity.source,
          activity.source_label,
          activity.title,
          activity.url || null,
          activity.description || null,
          activity.category || null,
          activity.timestamp,
          activity.duration || null,
          activity.metadata ? JSON.stringify(activity.metadata) : null,
          activity.tags ? JSON.stringify(activity.tags) : null,
          activity.created_at || now,
          now
        );
      }
    });

    return insertMany(activities);
  }

  getActivitiesByDate(dateStr) {
    const stmt = this.db.prepare(`
      SELECT * FROM activities 
      WHERE date(timestamp / 1000, 'unixepoch') = ?
      ORDER BY timestamp DESC
    `);
    return stmt.all(dateStr).map(this._parseActivity);
  }

  getActivitiesBySource(source, dateStr = null) {
    let sql = 'SELECT * FROM activities WHERE source = ?';
    const params = [source];

    if (dateStr) {
      sql += " AND date(timestamp / 1000, 'unixepoch') = ?";
      params.push(dateStr);
    }

    sql += ' ORDER BY timestamp DESC';
    return this.db.prepare(sql).all(...params).map(this._parseActivity);
  }

  getRecentActivities(limit = 100) {
    const stmt = this.db.prepare('SELECT * FROM activities ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit).map(this._parseActivity);
  }

  getActivityById(id) {
    const stmt = this.db.prepare('SELECT * FROM activities WHERE id = ?');
    const row = stmt.get(id);
    return row ? this._parseActivity(row) : null;
  }

  activityExists(url, windowMs = 300000) {
    if (!url) return false;
    
    const cutoff = Date.now() - windowMs;
    const stmt = this.db.prepare(`
      SELECT id FROM activities 
      WHERE url = ? AND timestamp > ?
      LIMIT 1
    `);
    return !!stmt.get(url, cutoff);
  }

  searchActivities(query, limit = 50) {
    const stmt = this.db.prepare(`
      SELECT * FROM activities 
      WHERE title LIKE ? OR url LIKE ? OR description LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    const pattern = `%${query}%`;
    return stmt.all(pattern, pattern, pattern, limit).map(this._parseActivity);
  }

  getStatsByDate(dateStr) {
    const stmt = this.db.prepare(`
      SELECT 
        source,
        source_label,
        COUNT(*) as count,
        SUM(duration) as total_duration
      FROM activities 
      WHERE date(timestamp / 1000, 'unixepoch') = ?
      GROUP BY source
    `);
    return stmt.all(dateStr);
  }

  deleteActivity(id) {
    const stmt = this.db.prepare('DELETE FROM activities WHERE id = ?');
    return stmt.run(id);
  }

  _parseActivity(row) {
    if (!row) return null;
    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
      tags: row.tags ? JSON.parse(row.tags) : null,
    };
  }

  getSetting(key, defaultValue = null) {
    const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const row = stmt.get(key);
    return row ? JSON.parse(row.value) : defaultValue;
  }

  setSetting(key, value) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    return stmt.run(key, JSON.stringify(value));
  }

  vacuum() {
    this.db.exec('VACUUM');
    logger.info('Database vacuumed');
  }

  backup(backupPath) {
    this.db.backup(backupPath);
    logger.info('Database backed up', { to: backupPath });
  }
}

function createDatabase(dbPath) {
  const db = new TimeStreamDB(dbPath);
  return db.open();
}

module.exports = { TimeStreamDB, createDatabase };
