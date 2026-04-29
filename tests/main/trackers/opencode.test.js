import { describe, it, expect } from 'bun:test'
import { readOpenCodeSessions } from '../../../src/main/trackers/opencode.js'
import path from 'path'

describe('opencode tracker', () => {
    it('returns empty array when directory does not exist', async () => {
        const result = await readOpenCodeSessions('/nonexistent')
        expect(result).toEqual([])
    })

    it('reads session files and adds type field', async () => {
        const fixtureDir = path.join(process.cwd(), 'tests/fixtures/opencode')
        const result = await readOpenCodeSessions(fixtureDir)
        expect(result.length).toBeGreaterThan(0)
        expect(result[0]).toHaveProperty('type', 'opencode')
        expect(result[0]).toHaveProperty('startTime')
    })
})
