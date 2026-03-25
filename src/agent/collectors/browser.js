'use strict';

const { createLogger } = require('../../shared/logger');
const { URL_PATTERNS, CATEGORIES, LOGS_DIR } = require('../../shared/constants');
const { BROWSER_HISTORY_PATHS, PLATFORM } = require('../../shared/constants');
const path = require('path');
const fs = require('fs');

const logger = createLogger({ appName: 'browser-collector', logDir: LOGS_DIR });

class BrowserCollector {
  constructor(options = {}) {
    this.db = options.db;
    this.config = options.config || {};
    this.historyLimit = this.config.historyLimit || 100;
    this.browsers = this.config.browsers || ['chrome', 'firefox'];
    this.dedupWindowMs = options.dedupWindowMs || 300000;
    this.collectors = new Map();
    this._initCollectors();
  }

  _initCollectors() {
    if (this.browsers.includes('chrome')) {
      this.collectors.set('chrome', new ChromeCollector());
    }
    if (this.browsers.includes('firefox')) {
      this.collectors.set('firefox', new FirefoxCollector());
    }
  }

  async collect() {
    const activities = [];

    for (const [name, collector] of this.collectors) {
      if (!collector.isAvailable()) {
        logger.debug(`${name} not available`);
        continue;
      }

      try {
        const history = await collector.getHistory(this.historyLimit);
        
        for (const item of history) {
          if (this.db.activityExists(item.url, this.dedupWindowMs)) {
            continue;
          }

          const activity = this._createActivity(item);
          if (activity) {
            activities.push(activity);
          }
        }

        logger.debug(`${name} collected`, { count: history.length, stored: activities.length });
      } catch (err) {
        logger.error(`${name} collection error`, { error: err.message });
      }
    }

    if (activities.length > 0 && this.db) {
      this.db.insertActivities(activities);
    }

    return activities;
  }

  _createActivity(item) {
    const metadata = this._parseUrl(item.url);
    
    return {
      id: `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source: metadata.platform || 'browser',
      source_label: metadata.platformLabel || 'Browser',
      title: item.title || item.url,
      url: item.url,
      description: null,
      category: this._categorize(metadata),
      timestamp: item.timestamp,
      duration: null,
      metadata,
      tags: this._extractTags(metadata),
      created_at: Date.now(),
    };
  }

  _parseUrl(url) {
    const result = { url, platform: 'other', platformLabel: 'Other' };

    for (const [platform, pattern] of Object.entries(URL_PATTERNS)) {
      if (pattern.test(url)) {
        result.platform = platform;
        result.platformLabel = this._getPlatformLabel(platform);
        
        if (platform === 'youtube') {
          const match = url.match(/(?:v=|youtu\.be\/)([^&\?]+)/);
          if (match) result.videoId = match[1];
        }
        
        if (platform === 'github') {
          const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
          if (match) {
            result.owner = match[1];
            result.repo = match[2];
          }
        }
        
        break;
      }
    }

    return result;
  }

  _getPlatformLabel(platform) {
    const labels = {
      youtube: 'YouTube',
      github: 'GitHub',
      gitlab: 'GitLab',
      bitbucket: 'Bitbucket',
      stackoverflow: 'Stack Overflow',
      medium: 'Medium',
      devto: 'Dev.to',
      reddit: 'Reddit',
      hackernews: 'Hacker News',
      twitter: 'Twitter',
      linkedin: 'LinkedIn',
      docs_react: 'React Docs',
      docs_vue: 'Vue Docs',
      docs_angular: 'Angular Docs',
      docs_node: 'Node.js Docs',
      docs_mdn: 'MDN',
    };
    return labels[platform] || 'Other';
  }

  _categorize(metadata) {
    const platform = metadata.platform;
    
    if (CATEGORIES.learning.includes(platform)) return 'learning';
    if (CATEGORIES.coding.includes(platform)) return 'coding';
    if (CATEGORIES.research.includes(platform)) return 'research';
    if (CATEGORIES.social.includes(platform)) return 'social';
    
    return 'other';
  }

  _extractTags(metadata) {
    const tags = [metadata.platform];
    
    if (metadata.owner) tags.push(metadata.owner);
    if (metadata.repo) tags.push(metadata.repo);
    
    return tags;
  }

  async stop() {
    logger.info('Browser collector stopped');
  }
}

class ChromeCollector {
  constructor() {
    this.historyPath = BROWSER_HISTORY_PATHS[PLATFORM]?.chrome;
  }

  isAvailable() {
    if (!this.historyPath) return false;
    return fs.existsSync(this.historyPath);
  }

  async getHistory(limit = 100) {
    if (!this.isAvailable()) {
      return [];
    }

    const Database = require('better-sqlite3');
    const items = [];

    try {
      const db = new Database(this.historyPath, { readonly: true });
      
      const query = db.prepare(`
        SELECT url, title, last_visit_time 
        FROM urls 
        ORDER BY last_visit_time DESC 
        LIMIT ?
      `);

      const rows = query.all(limit);
      
      for (const row of rows) {
        if (!row.url || !row.url.startsWith('http')) continue;
        
        items.push({
          url: row.url,
          title: row.title,
          timestamp: this._chromeTimeToUnix(row.last_visit_time),
        });
      }

      db.close();
    } catch (err) {
      logger.error('Chrome history read error', { error: err.message });
    }

    return items;
  }

  _chromeTimeToUnix(microseconds) {
    return Math.floor((microseconds / 1000000) - 11644473600);
  }
}

class FirefoxCollector {
  constructor() {
    this.profilePath = this._findProfile();
  }

  _findProfile() {
    const basePath = BROWSER_HISTORY_PATHS[PLATFORM]?.firefox;
    if (!basePath) return null;

    if (fs.existsSync(basePath)) {
      try {
        const entries = fs.readdirSync(basePath, { withFileTypes: true });
        const profile = entries.find(e => e.isDirectory() && e.name.endsWith('.default'));
        if (profile) {
          return path.join(basePath, profile.name, 'places.sqlite');
        }
      } catch (err) {
        // ignore
      }
    }
    return null;
  }

  isAvailable() {
    return !!this.profilePath && fs.existsSync(this.profilePath);
  }

  async getHistory(limit = 100) {
    if (!this.isAvailable()) {
      return [];
    }

    const Database = require('better-sqlite3');
    const items = [];

    try {
      const db = new Database(this.profilePath, { readonly: true });
      
      const query = db.prepare(`
        SELECT h.url, p.title, h.visit_date
        FROM moz_historyvisits h
        JOIN moz_places p ON h.place_id = p.id
        ORDER BY h.visit_date DESC
        LIMIT ?
      `);

      const rows = query.all(limit);
      
      for (const row of rows) {
        if (!row.url || !row.url.startsWith('http')) continue;
        
        items.push({
          url: row.url,
          title: row.title,
          timestamp: Math.floor(row.visit_date / 1000),
        });
      }

      db.close();
    } catch (err) {
      logger.error('Firefox history read error', { error: err.message });
    }

    return items;
  }
}

module.exports = { BrowserCollector };
