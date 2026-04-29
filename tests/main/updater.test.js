import { describe, it, expect, jest, beforeEach, afterEach } from 'bun:test'
import { autoUpdater } from 'electron-updater'
import { initUpdater } from '../../src/main/updater.js'

// autoUpdater comes from the global electron-updater mock (tests/setup.js)
// The same mock instance is used inside updater.js when it requires('electron-updater')
// so we can inspect its calls directly here.

const fakeWindow = { webContents: { send: jest.fn() } }

beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
})

afterEach(() => {
    jest.useRealTimers()
})

describe('updater', () => {
    it('exports an initUpdater function', () => {
        expect(typeof initUpdater).toBe('function')
    })

    it('registers update-available event on autoUpdater', () => {
        initUpdater(fakeWindow)
        const events = autoUpdater.on.mock.calls.map(c => c[0])
        expect(events).toContain('update-available')
    })

    it('registers update-downloaded event on autoUpdater', () => {
        initUpdater(fakeWindow)
        const events = autoUpdater.on.mock.calls.map(c => c[0])
        expect(events).toContain('update-downloaded')
    })

    it('calls checkForUpdates after 5 second delay', () => {
        initUpdater(fakeWindow)
        expect(autoUpdater.checkForUpdates).not.toHaveBeenCalled()
        jest.advanceTimersByTime(5000)
        expect(autoUpdater.checkForUpdates).toHaveBeenCalled()
    })
})
