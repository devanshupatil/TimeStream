const { jest } = require('bun:test')

const mockApp = {
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'TimeStream')
}

const mockIpcMain = { handle: jest.fn(), on: jest.fn() }

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

module.exports = {
    app: mockApp,
    ipcMain: mockIpcMain,
    BrowserWindow: MockBrowserWindow
}
