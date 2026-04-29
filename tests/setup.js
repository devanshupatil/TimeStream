import { GlobalRegistrator } from '@happy-dom/global-registrator'
GlobalRegistrator.register()

import '@testing-library/jest-dom'
import { mock, jest, afterEach } from 'bun:test'

// Clear rendered content between tests without destroying the global document reference.
// cleanup() from @testing-library/react tears down the document entirely, which causes
// "global document has to be available" errors in subsequent tests in the same file.
afterEach(() => {
    if (typeof document !== 'undefined') {
        document.body.innerHTML = ''
    }
})

// Globally mock native Electron modules before any test file loads them.
// Both electron and electron-updater cannot run outside an Electron process.
// These mocks are shared across all test files via the preload mechanism.

mock.module('electron', () => {
    function MockBrowserWindow() {
        return {
            loadURL: jest.fn(),
            loadFile: jest.fn(),
            once: jest.fn(),
            show: jest.fn(),
            webContents: { send: jest.fn() }
        }
    }
    MockBrowserWindow.getAllWindows = jest.fn(() => [])

    return {
        app: {
            whenReady: jest.fn(() => Promise.resolve()),
            on: jest.fn(),
            quit: jest.fn()
        },
        ipcMain: { handle: jest.fn(), on: jest.fn() },
        ipcRenderer: {
            invoke: jest.fn(),
            on: jest.fn(),
            send: jest.fn(),
            removeAllListeners: jest.fn()
        },
        contextBridge: { exposeInMainWorld: jest.fn() },
        BrowserWindow: MockBrowserWindow
    }
})

mock.module('electron-updater', () => ({
    autoUpdater: {
        checkForUpdates: jest.fn(() => Promise.resolve(null)),
        on: jest.fn(),
        quitAndInstall: jest.fn(),
        logger: null,
        autoDownload: true
    }
}))
