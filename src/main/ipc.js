// src/main/ipc.js
const { ipcMain } = require('electron')
const { readClaudeSessions } = require('./trackers/claude')
const { readOpenCodeSessions } = require('./trackers/opencode')
const { readBrowserHistory } = require('./trackers/browser')

function registerIpcHandlers() {
    // 'get-sessions' is the channel name.
    // When the renderer calls window.timestream.getSessions(),
    // the preload calls ipcRenderer.invoke('get-sessions'),
    // which triggers this handler in the main process.
    ipcMain.handle('get-sessions', async () => {
        // Run all three trackers at the same time (parallel, not sequential)
        const [claudeSessions, opencodeSessions, browserSessions] = await Promise.all([
            readClaudeSessions(),
            readOpenCodeSessions(),
            readBrowserHistory()
        ])

        // Merge all sessions into one array
        const allSessions = [...claudeSessions, ...opencodeSessions, ...browserSessions]

        // Sort newest first so the dashboard shows recent activity at the top
        return allSessions.sort(
            (a, b) => new Date(b.startTime) - new Date(a.startTime)
        )
    })
}

module.exports = { registerIpcHandlers }
