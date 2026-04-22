const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    openExternal: (data) => ipcRenderer.send('open-external', data),
    getHistoricalData: () => ipcRenderer.invoke('get-historical-data'),
    onActivityReceived: (callback) => ipcRenderer.on('activity-received', (_, data) => callback(data)),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    getLearningSeconds: (date) => ipcRenderer.invoke('get-learning-seconds', date),
    getOpencodeSessions: (date) => ipcRenderer.invoke('get-opencode-sessions', date),
    onOpenCodeSessionImported: (cb) => {
        ipcRenderer.removeAllListeners('opencode-session-imported');
        ipcRenderer.on('opencode-session-imported', (_, s) => cb(s));
    },
    onOpenCodeMissingDir: (cb) => {
        ipcRenderer.removeAllListeners('opencode-missing-dir');
        ipcRenderer.on('opencode-missing-dir', () => cb());
    },
    getClaudeSessions: () => ipcRenderer.invoke('get-claude-sessions'),
    onClaudeSession: (cb) => {
        ipcRenderer.removeAllListeners('claude-session-updated');
        ipcRenderer.on('claude-session-updated', (_e, session) => cb(session));
    },
    platform: process.platform,

    getActivities: (date) => ipcRenderer.invoke('get-activities', date),
    getActivitiesBySource: (source, date) => ipcRenderer.invoke('get-activities-by-source', { source, date }),
    getRecentActivities: (limit) => ipcRenderer.invoke('get-recent-activities', limit),
    searchActivities: (query, limit) => ipcRenderer.invoke('search-activities', { query, limit }),
    getStats: (date) => ipcRenderer.invoke('get-stats', date),
    getSources: () => ipcRenderer.invoke('get-sources'),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (payload) => ipcRenderer.invoke('save-settings', payload),
});
