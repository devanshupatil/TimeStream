'use strict';

const { OpenCodeReader } = require('../../agent/readers/opencode');

class OpenCodeAppReader extends OpenCodeReader {
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

  _formatForApp(session) {
    return {
      id: session.sessionId,
      type: 'session',
      source: 'opencode',
      source_label: 'OpenCode',
      title: session.title,
      description: null,
      timestamp: new Date(session.createdAt).getTime(),
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: this._calculateDuration(session),
      url: null,
      category: 'coding',
      metadata: {
        toolsUsed: session.toolsUsed || [],
        errors: session.errors || [],
        gitBranch: session.gitBranch,
      },
      tags: ['opencode', ...(session.tags || [])],
    };
  }

  _calculateDuration(session) {
    if (session.durationSecs) return session.durationSecs;
    if (session.startTime && session.endTime) {
      const start = new Date(`1970-01-01T${session.startTime}`);
      const end = new Date(`1970-01-01T${session.endTime}`);
      return Math.round((end - start) / 1000);
    }
    return 0;
  }
}

module.exports = { OpenCodeAppReader };
