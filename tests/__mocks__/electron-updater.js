const { jest } = require('bun:test')

const mockAutoUpdater = {
    checkForUpdates: jest.fn().mockResolvedValue(null),
    on: jest.fn(),
    quitAndInstall: jest.fn(),
    logger: null,
    autoDownload: true
}

module.exports = { autoUpdater: mockAutoUpdater }
