'use strict';

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(process.env.HOME || process.env.USERPROFILE, '.timestream', 'logs');
    this.level = options.level || 'info';
    this.maxLogFiles = options.maxLogFiles || 7;
    this.appName = options.appName || 'timestream';
    
    this._ensureLogDir();
    this._currentDate = this._getDateStr();
    this._logStream = null;
  }

  _ensureLogDir() {
    try {
      fs.mkdirSync(this.logDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') {
        console.error('Failed to create log directory:', err);
      }
    }
  }

  _getDateStr() {
    return new Date().toISOString().split('T')[0];
  }

  _getLogFile() {
    return path.join(this.logDir, `${this.appName}-${this._currentDate}.log`);
  }

  _openStream() {
    if (!this._logStream || this._currentDate !== this._getDateStr()) {
      if (this._logStream) {
        this._logStream.end();
      }
      this._currentDate = this._getDateStr();
      const logFile = this._getLogFile();
      
      try {
        this._logStream = fs.createWriteStream(logFile, { flags: 'a' });
      } catch (err) {
        console.error('Failed to open log stream:', err);
        this._logStream = null;
      }
    }
  }

  _shouldLog(level) {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logLine += ` ${JSON.stringify(meta)}`;
    }
    
    return logLine;
  }

  _write(level, message, meta = {}) {
    if (!this._shouldLog(level)) return;
    
    const logLine = this._formatMessage(level, message, meta) + '\n';
    
    this._openStream();
    
    if (this._logStream) {
      this._logStream.write(logLine);
    }
    
    if (level === 'error' || level === 'warn' || process.env.NODE_ENV === 'development') {
      console.log(logLine.trim());
    }
  }

  debug(message, meta = {}) {
    this._write('debug', message, meta);
  }

  info(message, meta = {}) {
    this._write('info', message, meta);
  }

  warn(message, meta = {}) {
    this._write('warn', message, meta);
  }

  error(message, meta = {}) {
    this._write('error', message, meta);
  }

  rotate() {
    if (this._logStream) {
      this._logStream.end();
      this._logStream = null;
    }

    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith(this.appName) && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          time: fs.statSync(path.join(this.logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

      const toDelete = files.slice(this.maxLogFiles);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
      }
    } catch (err) {
      console.error('Failed to rotate logs:', err);
    }
  }

  close() {
    if (this._logStream) {
      this._logStream.end();
      this._logStream = null;
    }
  }
}

const createLogger = (options) => new Logger(options);

module.exports = { Logger, createLogger, LOG_LEVELS };
