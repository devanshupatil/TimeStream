// src/main/index.js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { initUpdater } = require('./updater')
const { registerIpcHandlers } = require('./ipc')

// In development, NODE_ENV=development is set by our dev script
// In production (packaged app), it is undefined
const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
    const win = new BrowserWindow({
        width: 1100,
        height: 720,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            contextIsolation: true,   // renderer cannot access Node.js directly
            nodeIntegration: false    // extra security — renderer is sandboxed
        },
        titleBarStyle: 'hiddenInset', // hides native title bar for a cleaner look
        show: false                   // don't show until content is ready
    })

    if (isDev) {
        // In dev: load from Vite dev server (supports hot reload)
        win.loadURL('http://localhost:5173')
    } else {
        // In production: load compiled HTML file bundled inside the app
        win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'))
    }

    // Show window only when React has finished painting — no white flash
    win.once('ready-to-show', () => win.show())

    return win
}

app.whenReady().then(() => {
    const win = createWindow()
    registerIpcHandlers()   // set up the IPC "API" the renderer can call
    initUpdater(win)        // start checking for updates
})

// On Windows/Linux: quit when all windows are closed
// On Mac: keep app running even with no windows (standard Mac behaviour)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

// On Mac: re-create window when dock icon is clicked and no windows are open
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

module.exports = { createWindow }
