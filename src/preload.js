const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    openExternal: (url) => ipcRenderer.send('open-external', url),
    getHistoricalData: () => ipcRenderer.invoke('get-historical-data'),
    onActivityReceived: (callback) => ipcRenderer.on('activity-received', (_, data) => callback(data)),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    platform: process.platform,
});
