import { describe, it, expect } from 'bun:test'
import { readFileSync } from 'fs'

describe('preload', () => {
    it('exposes required API methods to the renderer', () => {
        const src = readFileSync('src/preload/index.js', 'utf8')
        expect(src).toContain('getSessions')
        expect(src).toContain('onUpdateAvailable')
        expect(src).toContain('onUpdateDownloaded')
        expect(src).toContain('installUpdate')
        expect(src).toContain('offUpdate')
    })
})
