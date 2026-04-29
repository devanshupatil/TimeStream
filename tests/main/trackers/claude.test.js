import { describe, it, expect } from 'bun:test'
import { readClaudeSessions } from '../../../src/main/trackers/claude.js'
import path from 'path'

describe('claude tracker', () => {
    it('returns empty array when directory does not exist', async () => {
        const result = await readClaudeSessions('/nonexistent/path/that/does/not/exist')
        expect(result).toEqual([])
    })

    it('reads and parses JSON session files from a directory', async () => {
        const fixtureDir = path.join(process.cwd(), 'tests/fixtures/claude')
        const result = await readClaudeSessions(fixtureDir)
        expect(result.length).toBeGreaterThan(0)
        expect(result[0]).toHaveProperty('id')
        expect(result[0]).toHaveProperty('startTime')
        expect(result[0]).toHaveProperty('type', 'claude')
    })

    it('returns an array even when path does not exist', async () => {
        const result = await readClaudeSessions('/nonexistent')
        expect(Array.isArray(result)).toBe(true)
    })
})
