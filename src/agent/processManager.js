'use strict';

const fs = require('fs');
const { PID_FILE_PATH, TIMESTREAM_DIR } = require('../shared/constants');
const { createLogger } = require('../shared/logger');

const logger = createLogger({ appName: 'timestream-process' });

class ProcessManager {
  constructor(pidFile = PID_FILE_PATH) {
    this.pidFile = pidFile;
    this.pid = process.pid;
  }

  isRunning() {
    try {
      if (!fs.existsSync(this.pidFile)) {
        return false;
      }

      const pidData = JSON.parse(fs.readFileSync(this.pidFile, 'utf8'));
      
      if (pidData.platform === process.platform) {
        try {
          process.kill(pidData.pid, 0);
          return pidData.pid !== this.pid;
        } catch (err) {
          if (err.code === 'EPERM') {
            return true;
          }
          return false;
        }
      }
      
      return false;
    } catch (err) {
      return false;
    }
  }

  register() {
    try {
      if (!fs.existsSync(TIMESTREAM_DIR)) {
        fs.mkdirSync(TIMESTREAM_DIR, { recursive: true });
      }

      const pidData = {
        pid: this.pid,
        platform: process.platform,
        startTime: Date.now(),
        version: require('../../../package.json').version,
      };

      fs.writeFileSync(this.pidFile, JSON.stringify(pidData, null, 2));
      logger.info('Process registered', { pid: this.pid, pidFile: this.pidFile });
      return true;
    } catch (err) {
      logger.error('Failed to register process', { error: err.message });
      return false;
    }
  }

  unregister() {
    try {
      if (fs.existsSync(this.pidFile)) {
        fs.unlinkSync(this.pidFile);
        logger.info('Process unregistered', { pidFile: this.pidFile });
      }
      return true;
    } catch (err) {
      logger.error('Failed to unregister process', { error: err.message });
      return false;
    }
  }

  getInfo() {
    try {
      if (!fs.existsSync(this.pidFile)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(this.pidFile, 'utf8'));
    } catch (err) {
      return null;
    }
  }

  restart(reason = 'unknown') {
    logger.info('Restart requested', { reason });
    
    const { spawn } = require('child_process');
    const path = require('path');
    
    const agentPath = path.join(__dirname, 'index.js');
    const child = spawn(process.argv[0], [agentPath], {
      detached: true,
      stdio: 'ignore',
    });
    
    child.unref();
    
    logger.info('Restarting agent', { newPid: child.pid });
    process.exit(0);
  }
}

class CrashRecovery {
  constructor(maxRetries = 5, baseDelayMs = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.restartCount = 0;
    this.lastRestartTime = 0;
  }

  shouldRestart() {
    const now = Date.now();
    
    if (this.restartCount >= this.maxRetries) {
      if (now - this.lastRestartTime > 60000) {
        this.restartCount = 0;
      } else {
        logger.error('Max restart retries exceeded', { 
          count: this.restartCount, 
          lastRestart: new Date(this.lastRestartTime).toISOString() 
        });
        return { should: false, delay: 0 };
      }
    }

    const delay = Math.min(this.baseDelayMs * Math.pow(2, this.restartCount), 30000);
    
    return { should: true, delay };
  }

  recordRestart(success = true) {
    if (success) {
      this.restartCount = 0;
    } else {
      this.restartCount++;
      this.lastRestartTime = Date.now();
    }
  }

  getBackoffDelay() {
    const { delay } = this.shouldRestart();
    return delay;
  }
}

function setupSignalHandlers(agent) {
  const signals = ['SIGTERM', 'SIGINT', 'SIGQUIT', 'SIGHUP'];

  for (const sig of signals) {
    process.on(sig, async () => {
      logger.info(`Received ${sig}, shutting down gracefully`);
      try {
        await agent.stop();
        process.exit(0);
      } catch (err) {
        logger.error('Error during shutdown', { error: err.message });
        process.exit(1);
      }
    });
  }

  process.on('uncaughtException', async (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    try {
      await agent.stop();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });
}

module.exports = { ProcessManager, CrashRecovery, setupSignalHandlers };
