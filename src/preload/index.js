// src/preload/index.js
const { contextBridge, ipcRenderer } = require('electron')

// contextBridge creates window.timestream in the renderer
// ipcRenderer sends/receives messages to/from the main process
contextBridge.exposeInMainWorld('timestream', {

    // Ask main process for all sessions — returns a Promise<Session[]>
    getSessions: () => ipcRenderer.invoke('get-sessions'),

    // Listen for "update is available" event from main process
    // cb = callback function the UI passes in, called when update is found
    onUpdateAvailable: (cb) =>
        ipcRenderer.on('update-available', (_, info) => cb(info)),

    // Listen for "update has finished downloading" event
    onUpdateDownloaded: (cb) =>
        ipcRenderer.on('update-downloaded', (_, info) => cb(info)),

    // Tell main process to quit and install the downloaded update
    installUpdate: () => ipcRenderer.send('install-update'),

    // Clean up event listeners when component unmounts
    offUpdate: () => {
        ipcRenderer.removeAllListeners('update-available')
        ipcRenderer.removeAllListeners('update-downloaded')
    }
})
