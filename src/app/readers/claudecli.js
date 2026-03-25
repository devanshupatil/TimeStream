'use strict';

const { ClaudeReader } = require('../../agent/readers/claudecli');

class ClaudeAppReader extends ClaudeReader {
  constructor(config = {}) {
    super(config);
  }

  getSessionsForApp(date) {
    const sessions = this.getSessions(date);
    return sessions.map(s => this._formatForApp(s));
  }

  getRecentSessionsForApp(count = 10) {
    const sessions = this.getRecentSessions(count);
    return sessions.map(s => this._formatForApp(s));
  }

  getRecentSessions(count = 10) {
    if (!this.isAvailable()) {
      return [];
    }

    const projects = this.getProjects();
    const sessions = [];

    for (const project of projects) {
      try {
        const files = require('fs').readdirSync(project.path)
          .filter(f => f.endsWith('.jsonl'))
          .slice(-50);

        for (const file of files) {
          const filePath = require('path').join(project.path, file);
          const session = this._parseJsonlFile(filePath);
          if (session && !session.isSidechain) {
            sessions.push(session);
          }
        }
      } catch (err) {
        // continue
      }
    }

    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return sessions.slice(0, count);
  }

  _formatForApp(session) {
    return {
      id: session.sessionId,
      type: 'session',
      source: 'claudecli',
      source_label: 'Claude CLI',
      title: session.title,
      description: null,
      timestamp: new Date(session.createdAt).getTime(),
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.durationSecs || 0,
      url: null,
      category: 'coding',
      metadata: {
        toolsUsed: session.toolsUsed || [],
        errors: session.errors || [],
        gitBranch: session.gitBranch,
        cwd: session.cwd,
        filesChanged: session.filesChanged || [],
      },
      tags: ['claudecli', ...(session.tags || [])],
    };
  }
}

module.exports = { ClaudeAppReader };
