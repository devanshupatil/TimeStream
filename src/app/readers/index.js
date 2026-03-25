'use strict';

const { OpenCodeAppReader } = require('./opencode');
const { ClaudeAppReader } = require('./claudecli');
const { BrowserAppReader } = require('./browser');
const { createLogger } = require('../../shared/logger');
const { LOGS_DIR } = require('../../shared/constants');

const logger = createLogger({ appName: 'query-engine', logDir: LOGS_DIR });

class QueryEngine {
  constructor() {
    this.opencode = new OpenCodeAppReader();
    this.claudecli = new ClaudeAppReader();
    this.browser = new BrowserAppReader();
  }

  async getAllActivities(date) {
    const results = await Promise.allSettled([
      this._getOpenCodeSessions(date),
      this._getClaudeSessions(date),
      this._getBrowserActivities(date),
    ]);

    const activities = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        activities.push(...result.value);
      } else {
        logger.warn('Query failed', { error: result.reason?.message });
      }
    }

    activities.sort((a, b) => b.timestamp - a.timestamp);
    
    return activities;
  }

  async _getOpenCodeSessions(date) {
    try {
      if (!this.opencode.isAvailable()) {
        return [];
      }
      return this.opencode.getSessionsForApp(date);
    } catch (err) {
      logger.error('OpenCode query failed', { error: err.message });
      return [];
    }
  }

  async _getClaudeSessions(date) {
    try {
      if (!this.claudecli.isAvailable()) {
        return [];
      }
      return this.claudecli.getSessionsForApp(date);
    } catch (err) {
      logger.error('Claude CLI query failed', { error: err.message });
      return [];
    }
  }

  async _getBrowserActivities(date) {
    try {
      return this.browser.getActivitiesForApp(date);
    } catch (err) {
      logger.error('Browser activities query failed', { error: err.message });
      return [];
    }
  }

  async getActivitiesBySource(source, date) {
    const all = await this.getAllActivities(date);
    return all.filter(a => a.source === source);
  }

  async getRecentActivities(limit = 50) {
    const results = await Promise.allSettled([
      this.opencode.getRecentSessionsForApp(limit),
      this.claudecli.getRecentSessionsForApp(limit),
      this.browser.getRecentActivities(limit),
    ]);

    const activities = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        activities.push(...result.value);
      }
    }

    activities.sort((a, b) => b.timestamp - a.timestamp);
    return activities.slice(0, limit);
  }

  async search(query, limit = 50) {
    const browserResults = this.browser.searchActivities(query, limit);
    
    const allRecent = await this.getRecentActivities(limit * 2);
    const textResults = allRecent.filter(a => 
      a.title?.toLowerCase().includes(query.toLowerCase()) ||
      a.description?.toLowerCase().includes(query.toLowerCase())
    );

    const combined = [...textResults, ...browserResults];
    const seen = new Set();
    const unique = combined.filter(a => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });

    return unique.slice(0, limit);
  }

  async getStats(date) {
    const activities = await this.getAllActivities(date);
    
    const stats = {
      date,
      total: activities.length,
      bySource: {},
      byCategory: {},
      sessions: activities.filter(a => a.type === 'session').length,
      browserActivities: activities.filter(a => a.type === 'activity').length,
    };

    for (const activity of activities) {
      stats.bySource[activity.source] = (stats.bySource[activity.source] || 0) + 1;
      if (activity.category) {
        stats.byCategory[activity.category] = (stats.byCategory[activity.category] || 0) + 1;
      }
    }

    const browserStats = this.browser.getStats(date);
    for (const s of browserStats) {
      if (!stats.bySource[s.source]) {
        stats.bySource[s.source] = s.count;
      }
    }

    return stats;
  }

  getAvailableSources() {
    return {
      opencode: this.opencode.isAvailable(),
      claudecli: this.claudecli.isAvailable(),
      browser: true,
    };
  }

  cleanup() {
    this.opencode.disconnect?.();
    this.claudecli.disconnect?.();
    this.browser.disconnect?.();
  }
}

const queryEngine = new QueryEngine();

module.exports = { QueryEngine, queryEngine };
