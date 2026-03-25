'use strict';

const path = require('path');
const { createDatabase } = require('../../agent/database/sqlite');
const { DATABASE_PATH, LOGS_DIR } = require('../../shared/constants');
const { createLogger } = require('../../shared/logger');

const logger = createLogger({ appName: 'browser-reader', logDir: LOGS_DIR });

class BrowserAppReader {
  constructor(dbPath = DATABASE_PATH) {
    this.db = null;
    this.dbPath = dbPath;
  }

  connect() {
    if (this.db) return this;
    
    try {
      this.db = createDatabase(this.dbPath);
      return this;
    } catch (err) {
      logger.error('Failed to connect to database', { error: err.message });
      return null;
    }
  }

  disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  getActivitiesForApp(date) {
    if (!this.connect()) return [];

    try {
      const activities = this.db.getActivitiesByDate(date);
      return activities.map(a => this._formatForApp(a));
    } catch (err) {
      logger.error('Failed to get activities', { error: err.message });
      return [];
    }
  }

  getRecentActivities(limit = 100) {
    if (!this.connect()) return [];

    try {
      const activities = this.db.getRecentActivities(limit);
      return activities.map(a => this._formatForApp(a));
    } catch (err) {
      logger.error('Failed to get recent activities', { error: err.message });
      return [];
    }
  }

  searchActivities(query, limit = 50) {
    if (!this.connect()) return [];

    try {
      const activities = this.db.searchActivities(query, limit);
      return activities.map(a => this._formatForApp(a));
    } catch (err) {
      logger.error('Failed to search activities', { error: err.message });
      return [];
    }
  }

  _formatForApp(activity) {
    return {
      id: activity.id,
      type: 'activity',
      source: activity.source,
      source_label: activity.source_label,
      title: activity.title,
      description: activity.description,
      timestamp: activity.timestamp,
      date: new Date(activity.timestamp).toISOString().split('T')[0],
      startTime: new Date(activity.timestamp).toISOString().split('T')[1]?.slice(0, 8) || '00:00:00',
      endTime: null,
      duration: activity.duration,
      url: activity.url,
      category: activity.category,
      metadata: activity.metadata || {},
      tags: activity.tags || [],
    };
  }

  getStats(date) {
    if (!this.connect()) return [];

    try {
      return this.db.getStatsByDate(date);
    } catch (err) {
      logger.error('Failed to get stats', { error: err.message });
      return [];
    }
  }
}

module.exports = { BrowserAppReader };
