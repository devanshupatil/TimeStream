import { describe, it, expect, jest, beforeEach } from 'bun:test'
import { ipcMain } from 'electron'

// ipcMain comes from the global electron mock (tests/setup.js)
// We do NOT mock the tracker modules here — that would leak into tracker tests.
// This test only verifies that the correct IPC channel is registered.

beforeEach(() => jest.clearAllMocks())

describe('IPC handlers', () => {
    it('registers the get-sessions handler with ipcMain', async () => {
        const { registerIpcHandlers } = await import('../../src/main/ipc.js')
        registerIpcHandlers()
        const channels = ipcMain.handle.mock.calls.map(call => call[0])
        expect(channels).toContain('get-sessions')
    })
})
