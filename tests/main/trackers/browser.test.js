import { describe, it, expect } from 'bun:test'
import { readBrowserHistory } from '../../../src/main/trackers/browser.js'
import path from 'path'

describe('browser tracker', () => {
    it('returns empty array when history file does not exist', async () => {
        const result = await readBrowserHistory('/nonexistent/path/History')
        expect(result).toEqual([])
    })

    it('reads URLs from a valid Chrome history database', async () => {
        const fixturePath = path.join(process.cwd(), 'tests/fixtures/browser/History')
        const result = await readBrowserHistory(fixturePath)
        expect(Array.isArray(result)).toBe(true)
        expect(result.length).toBeGreaterThan(0)
        expect(result[0]).toHaveProperty('type', 'browser')
        expect(result[0]).toHaveProperty('url')
        expect(result[0]).toHaveProperty('title')
        expect(result[0]).toHaveProperty('startTime')
        expect(result[0]).toHaveProperty('id')
    })

    it('returns sessions sorted newest first', async () => {
        const fixturePath = path.join(process.cwd(), 'tests/fixtures/browser/History')
        const result = await readBrowserHistory(fixturePath)
        if (result.length > 1) {
            const first = new Date(result[0].startTime)
            const second = new Date(result[1].startTime)
            expect(first >= second).toBe(true)
        }
    })
})
