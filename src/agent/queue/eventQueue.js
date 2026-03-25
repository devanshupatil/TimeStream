'use strict';

const { createLogger } = require('../../shared/logger');
const { LOGS_DIR } = require('../../shared/constants');

const logger = createLogger({ appName: 'event-queue', logDir: LOGS_DIR });

class EventQueue {
  constructor(options = {}) {
    this.db = options.db;
    this.batchIntervalMs = options.batchIntervalMs || 30000;
    this.maxQueueSize = options.maxQueueSize || 1000;
    this.dedupWindowMs = options.dedupWindowMs || 300000;
    
    this.queue = [];
    this.timer = null;
    this.isRunning = false;
    this.flushOnStop = true;
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.timer = setInterval(() => this.flush(), this.batchIntervalMs);
    logger.info('Event queue started', { batchInterval: this.batchIntervalMs });
  }

  async stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.flushOnStop) {
      logger.info('Flushing queue before stop');
      await this.flush();
    }

    logger.info('Event queue stopped');
  }

  enqueue(activity) {
    if (this.queue.length >= this.maxQueueSize) {
      logger.warn('Queue full, flushing early');
      this.flush();
    }

    if (this.db.activityExists(activity.url, this.dedupWindowMs)) {
      logger.debug('Skipping duplicate activity', { url: activity.url });
      return false;
    }

    activity.id = activity.id || `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activity.created_at = activity.created_at || Date.now();
    
    this.queue.push(activity);
    logger.debug('Activity queued', { id: activity.id, queueSize: this.queue.length });
    
    return true;
  }

  enqueueMany(activities) {
    let added = 0;
    for (const activity of activities) {
      if (this.enqueue(activity)) {
        added++;
      }
    }
    return added;
  }

  async flush() {
    if (this.queue.length === 0) {
      return { count: 0 };
    }

    const activities = [...this.queue];
    this.queue = [];

    try {
      if (this.db) {
        this.db.insertActivities(activities);
        logger.info('Flushed activities to database', { count: activities.length });
        return { count: activities.length };
      } else {
        logger.warn('No database available, activities lost', { count: activities.length });
        return { count: 0 };
      }
    } catch (err) {
      logger.error('Failed to flush activities', { error: err.message, count: activities.length });
      this.queue = [...activities, ...this.queue];
      throw err;
    }
  }

  getSize() {
    return this.queue.length;
  }

  clear() {
    const count = this.queue.length;
    this.queue = [];
    logger.info('Queue cleared', { count });
    return count;
  }
}

module.exports = { EventQueue };
