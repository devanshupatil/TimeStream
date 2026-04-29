import { describe, it, expect } from 'bun:test'

// electron and electron-updater are globally mocked by tests/setup.js
// so importing index.js works without any additional mock.module() calls

describe('main process', () => {
    it('exports a createWindow function', async () => {
        const mod = await import('../../src/main/index.js')
        expect(typeof mod.createWindow).toBe('function')
    })
})
