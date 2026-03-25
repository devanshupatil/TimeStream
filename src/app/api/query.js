'use strict';

const { ipcMain } = require('electron');
const { queryEngine } = require('../readers');
const { createLogger } = require('../../shared/logger');
const { LOGS_DIR } = require('../../shared/constants');

const logger = createLogger({ appName: 'query-api', logDir: LOGS_DIR });

function registerQueryHandlers() {
  ipcMain.handle('get-activities', async (event, date) => {
    try {
      return await queryEngine.getAllActivities(date);
    } catch (err) {
      logger.error('get-activities failed', { error: err.message });
      return [];
    }
  });

  ipcMain.handle('get-activities-by-source', async (event, { source, date }) => {
    try {
      return await queryEngine.getActivitiesBySource(source, date);
    } catch (err) {
      logger.error('get-activities-by-source failed', { error: err.message });
      return [];
    }
  });

  ipcMain.handle('get-recent-activities', async (event, limit = 50) => {
    try {
      return await queryEngine.getRecentActivities(limit);
    } catch (err) {
      logger.error('get-recent-activities failed', { error: err.message });
      return [];
    }
  });

  ipcMain.handle('search-activities', async (event, { query, limit = 50 }) => {
    try {
      return await queryEngine.search(query, limit);
    } catch (err) {
      logger.error('search-activities failed', { error: err.message });
      return [];
    }
  });

  ipcMain.handle('get-stats', async (event, date) => {
    try {
      return await queryEngine.getStats(date);
    } catch (err) {
      logger.error('get-stats failed', { error: err.message });
      return null;
    }
  });

  ipcMain.handle('get-sources', async () => {
    return queryEngine.getAvailableSources();
  });

  logger.info('Query handlers registered');
}

function unregisterQueryHandlers() {
  const channels = [
    'get-activities',
    'get-activities-by-source',
    'get-recent-activities',
    'search-activities',
    'get-stats',
    'get-sources',
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }

  queryEngine.cleanup();
  logger.info('Query handlers unregistered');
}

module.exports = { registerQueryHandlers, unregisterQueryHandlers };
