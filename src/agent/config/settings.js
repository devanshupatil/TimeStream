'use strict';

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_AGENT_CONFIG,
  AGENT_CONFIG_PATH,
  LOGS_DIR,
} = require('../../shared/constants');
const { createLogger } = require('../../shared/logger');

class AgentConfig {
  constructor(configPath = AGENT_CONFIG_PATH) {
    this.configPath = configPath;
    this.config = null;
    this.logger = createLogger({ appName: 'timestream-agent', logDir: LOGS_DIR });
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.config = { ...DEFAULT_AGENT_CONFIG, ...JSON.parse(data) };
        this.logger.info('Config loaded', { path: this.configPath });
      } else {
        this.config = { ...DEFAULT_AGENT_CONFIG };
        this.save();
        this.logger.info('Default config created', { path: this.configPath });
      }
    } catch (err) {
      this.logger.error('Failed to load config, using defaults', { error: err.message });
      this.config = { ...DEFAULT_AGENT_CONFIG };
    }

    return this.config;
  }

  save() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      this.logger.info('Config saved', { path: this.configPath });
    } catch (err) {
      this.logger.error('Failed to save config', { error: err.message });
    }
  }

  get(key, defaultValue = null) {
    if (!this.config) this.load();
    
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  set(key, value) {
    if (!this.config) this.load();
    
    const keys = key.split('.');
    let obj = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj) || typeof obj[k] !== 'object') {
        obj[k] = {};
      }
      obj = obj[k];
    }
    
    obj[keys[keys.length - 1]] = value;
    this.save();
  }

  isEnabled(component) {
    return this.get(`${component}.enabled`, false);
  }

  getAll() {
    if (!this.config) this.load();
    return this.config;
  }

  reload() {
    this.config = null;
    return this.load();
  }
}

const agentConfig = new AgentConfig();

module.exports = { AgentConfig, agentConfig };
