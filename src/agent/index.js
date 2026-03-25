'use strict';

const { createLogger } = require('../shared/logger');
const { createDatabase } = require('./database/sqlite');
const { agentConfig } = require('./config/settings');
const { ProcessManager, CrashRecovery, setupSignalHandlers } = require('./processManager');
const {
  DATABASE_PATH,
  LOGS_DIR,
  isMac,
  isLinux,
  isWindows,
} = require('../shared/constants');

const logger = createLogger({ appName: 'timestream-agent', logDir: LOGS_DIR });

class TimeStreamAgent {
  constructor() {
    this.db = null;
    this.readers = new Map();
    this.collectors = new Map();
    this.eventQueue = null;
    this.processManager = new ProcessManager();
    this.crashRecovery = new CrashRecovery();
    this.isRunning = false;
  }

  async start() {
    logger.info('Starting TimeStream Agent', { 
      version: require('../../package.json').version,
      platform: process.platform,
      pid: process.pid 
    });

    if (this.processManager.isRunning()) {
      logger.error('Agent is already running');
      process.exit(1);
    }

    this.processManager.register();

    agentConfig.load();
    logger.info('Configuration loaded');

    try {
      this.db = createDatabase(DATABASE_PATH);
      logger.info('Database initialized', { path: DATABASE_PATH });
    } catch (err) {
      logger.error('Failed to initialize database', { error: err.message });
      throw err;
    }

    await this._initReaders();
    await this._initCollectors();
    await this._initEventQueue();

    this.isRunning = true;
    logger.info('Agent started successfully');

    this._startPeriodicTasks();
  }

  async _initReaders() {
    if (agentConfig.isEnabled('readers.opencode')) {
      try {
        const OpenCodeReader = require('./readers/opencode');
        const reader = new OpenCodeReader(agentConfig.get('readers.opencode'));
        this.readers.set('opencode', reader);
        logger.info('OpenCode reader initialized');
      } catch (err) {
        logger.error('Failed to initialize OpenCode reader', { error: err.message });
      }
    }

    if (agentConfig.isEnabled('readers.claudecli')) {
      try {
        const ClaudeReader = require('./readers/claudecli');
        const reader = new ClaudeReader(agentConfig.get('readers.claudecli'));
        this.readers.set('claudecli', reader);
        logger.info('Claude CLI reader initialized');
      } catch (err) {
        logger.error('Failed to initialize Claude CLI reader', { error: err.message });
      }
    }

    logger.info('Readers initialized', { count: this.readers.size });
  }

  async _initCollectors() {
    if (agentConfig.isEnabled('collectors.browser')) {
      try {
        const BrowserCollector = require('./collectors/browser');
        const collector = new BrowserCollector({
          db: this.db,
          config: agentConfig.get('collectors.browser'),
        });
        this.collectors.set('browser', collector);
        logger.info('Browser collector initialized');
      } catch (err) {
        logger.error('Failed to initialize browser collector', { error: err.message });
      }
    }

    logger.info('Collectors initialized', { count: this.collectors.size });
  }

  async _initEventQueue() {
    const EventQueue = require('./queue/eventQueue');
    this.eventQueue = new EventQueue({
      db: this.db,
      batchIntervalMs: agentConfig.get('queue.batchIntervalMs', 30000),
      maxQueueSize: agentConfig.get('queue.maxQueueSize', 1000),
    });
    await this.eventQueue.start();
    logger.info('Event queue started');
  }

  _startPeriodicTasks() {
    const backupInterval = agentConfig.get('database.backupIntervalMs', 3600000);
    
    setInterval(() => {
      try {
        this.db.vacuum();
        logger.debug('Database vacuumed');
      } catch (err) {
        logger.error('Failed to vacuum database', { error: err.message });
      }
    }, backupInterval);

    for (const [name, collector] of this.collectors) {
      const pollInterval = agentConfig.get(`collectors.${name}.pollIntervalMs`, 60000);
      
      setInterval(async () => {
        try {
          await collector.collect();
          logger.debug(`${name} collector ran`);
        } catch (err) {
          logger.error(`${name} collector error`, { error: err.message });
        }
      }, pollInterval);
    }

    logger.info('Periodic tasks started');
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping TimeStream Agent');
    this.isRunning = false;

    if (this.eventQueue) {
      try {
        await this.eventQueue.stop();
        logger.info('Event queue stopped');
      } catch (err) {
        logger.error('Error stopping event queue', { error: err.message });
      }
    }

    for (const [name, reader] of this.readers) {
      try {
        if (typeof reader.stop === 'function') {
          await reader.stop();
        }
      } catch (err) {
        logger.error(`Error stopping ${name} reader`, { error: err.message });
      }
    }

    for (const [name, collector] of this.collectors) {
      try {
        if (typeof collector.stop === 'function') {
          await collector.stop();
        }
      } catch (err) {
        logger.error(`Error stopping ${name} collector`, { error: err.message });
      }
    }

    if (this.db) {
      this.db.close();
    }

    this.processManager.unregister();
    logger.info('Agent stopped');
  }

  getStatus() {
    return {
      running: this.isRunning,
      pid: process.pid,
      platform: process.platform,
      readers: Array.from(this.readers.keys()),
      collectors: Array.from(this.collectors.keys()),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}

async function main() {
  const agent = new TimeStreamAgent();
  
  setupSignalHandlers(agent);

  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
TimeStream Agent

Usage: node index.js [options]

Options:
  --help, -h     Show this help
  --version, -v  Show version
  --status       Check if agent is running

Environment:
  TIMESTREAM_CONFIG  Path to config file
    `);
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(require('../../package.json').version);
    process.exit(0);
  }

  if (args.includes('--status')) {
    const pm = new ProcessManager();
    const info = pm.getInfo();
    if (info && pm.isRunning()) {
      console.log('Agent is running');
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.log('Agent is not running');
    }
    process.exit(0);
  }

  try {
    await agent.start();
    
    const { delay } = agent.crashRecovery.shouldRestart();
    if (delay > 0) {
      logger.info('Waiting before starting tasks', { delay });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    agent.crashRecovery.recordRestart(true);
    
  } catch (err) {
    agent.crashRecovery.recordRestart(false);
    
    const { should, delay } = agent.crashRecovery.shouldRestart();
    if (should) {
      logger.error('Agent error, will restart', { error: err.message, delay });
      await new Promise(resolve => setTimeout(resolve, delay));
      agent.processManager.restart(err.message);
    } else {
      logger.error('Agent failed to start', { error: err.message });
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { TimeStreamAgent };
