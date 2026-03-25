'use strict';

const path = require('path');
const os = require('os');

const PLATFORM = process.platform;
const isMac = PLATFORM === 'darwin';
const isLinux = PLATFORM === 'linux';
const isWindows = PLATFORM === 'win32';

const TIMESTREAM_DIR = path.join(os.homedir(), '.timestream');
const LOGS_DIR = path.join(TIMESTREAM_DIR, 'logs');
const DATABASE_PATH = path.join(TIMESTREAM_DIR, 'timestream.db');
const AGENT_CONFIG_PATH = path.join(TIMESTREAM_DIR, 'agent.json');
const APP_CONFIG_PATH = path.join(TIMESTREAM_DIR, 'app.json');
const PID_FILE_PATH = path.join(TIMESTREAM_DIR, 'agent.pid');

const OPENCODE_DB_PATH = path.join(os.homedir(), '.local', 'share', 'opencode', 'opencode.db');
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

const BROWSER_HISTORY_PATHS = {
  darwin: {
    chrome: path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'History'),
    firefox: path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles'),
    safari: path.join(os.homedir(), 'Library', 'Safari', 'History.db'),
  },
  linux: {
    chrome: path.join(os.homedir(), '.config', 'google-chrome', 'Default', 'History'),
    chromium: path.join(os.homedir(), '.config', 'chromium', 'Default', 'History'),
    firefox: path.join(os.homedir(), '.mozilla', 'firefox'),
    brave: path.join(os.homedir(), '.config', 'BraveSoftware', 'Brave-Browser', 'Default', 'History'),
  },
  win32: {
    chrome: path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'History'),
    firefox: path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles'),
    edge: path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'History'),
  },
};

const CATEGORIES = {
  learning: ['youtube', 'medium', 'dev.to', 'stackoverflow', 'documentation'],
  coding: ['github', 'gitlab', 'bitbucket', 'stackoverflow'],
  research: ['arxiv', 'hacker news', 'reddit'],
  social: ['twitter', 'mastodon', 'linkedin'],
};

const URL_PATTERNS = {
  youtube: /youtube\.com|youtu\.be/,
  github: /github\.com/,
  gitlab: /gitlab\.com/,
  bitbucket: /bitbucket\.org/,
  stackoverflow: /stackoverflow\.com/,
  medium: /medium\.com/,
  devto: /dev\.to/,
  reddit: /reddit\.com|old\.reddit\.com/,
  hackernews: /news\.ycombinator\.com/,
  twitter: /twitter\.com|x\.com/,
  linkedin: /linkedin\.com/,
  docs_react: /reactjs\.org|react\.dev/,
  docs_vue: /vuejs\.org|vuejs\.com/,
  docs_angular: /angular\.io/,
  docs_node: /nodejs\.org/,
  docs_mdn: /developer\.mozilla\.org/,
};

const DEFAULT_AGENT_CONFIG = {
  enabled: true,
  readFromEnv: true,
  readers: {
    opencode: {
      enabled: true,
      dbPath: OPENCODE_DB_PATH,
      pollIntervalMs: 5000,
    },
    claudecli: {
      enabled: true,
      projectsDir: CLAUDE_PROJECTS_DIR,
    },
  },
  collectors: {
    browser: {
      enabled: true,
      browsers: ['chrome', 'firefox'],
      historyLimit: 100,
      pollIntervalMs: 60000,
    },
  },
  database: {
    path: DATABASE_PATH,
    backupIntervalMs: 3600000,
  },
  queue: {
    batchIntervalMs: 30000,
    maxQueueSize: 1000,
    dedupWindowMs: 300000,
  },
  logging: {
    level: 'info',
    maxLogFiles: 7,
  },
};

const DEFAULT_APP_CONFIG = {
  theme: 'dark',
  startMinimized: false,
  showInTray: true,
  launchAtStartup: true,
  sources: {
    opencode: true,
    claudecli: true,
    browser: true,
  },
};

module.exports = {
  PLATFORM,
  isMac,
  isLinux,
  isWindows,
  TIMESTREAM_DIR,
  LOGS_DIR,
  DATABASE_PATH,
  AGENT_CONFIG_PATH,
  APP_CONFIG_PATH,
  PID_FILE_PATH,
  OPENCODE_DB_PATH,
  CLAUDE_PROJECTS_DIR,
  BROWSER_HISTORY_PATHS,
  CATEGORIES,
  URL_PATTERNS,
  DEFAULT_AGENT_CONFIG,
  DEFAULT_APP_CONFIG,
};
