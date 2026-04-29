// src/main/updater.js
const electronUpdater = require('electron-updater')
const { ipcMain } = require('electron')

function initUpdater(win) {
    const { autoUpdater } = electronUpdater
    // Disable default console logging from electron-updater
    // (we handle events ourselves and show UI instead of logs)
    autoUpdater.logger = null

    // When a new version is found and starts downloading:
    // Send the version info to the renderer so it can show the banner
    autoUpdater.on('update-available', (info) => {
        win.webContents.send('update-available', {
            version: info.version
        })
    })

    // When the new version has finished downloading:
    // Tell renderer to change banner from "Downloading..." to "Restart & Update"
    autoUpdater.on('update-downloaded', (info) => {
        win.webContents.send('update-downloaded', {
            version: info.version
        })
    })

    // When renderer sends 'install-update' (user clicked "Restart & Update"):
    // Quit the app and run the installer — app will relaunch on new version
    ipcMain.on('install-update', () => {
        autoUpdater.quitAndInstall(
            false,  // isSilent: false = show installer progress on Windows
            true    // isForceRunAfter: true = relaunch app after install
        )
    })

    // Wait 5 seconds before checking — gives the window time to fully load
    // so the banner can appear correctly after first render
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {
            // Silently ignore errors (e.g. no internet, GitHub down)
        })
    }, 5000)
}

module.exports = { initUpdater }
