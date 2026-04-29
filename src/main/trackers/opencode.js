// src/main/trackers/opencode.js
const fs = require('fs/promises')
const path = require('path')
const os = require('os')

const DEFAULT_DIR = path.join(os.homedir(), '.opencode', 'sessions')

async function readOpenCodeSessions(dir = DEFAULT_DIR) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        const files = entries.filter(e => e.isFile() && e.name.endsWith('.json'))

        const sessions = await Promise.all(
            files.map(async (entry) => {
                try {
                    const raw = await fs.readFile(path.join(dir, entry.name), 'utf8')
                    const data = JSON.parse(raw)
                    return { ...data, type: 'opencode', source: entry.name }
                } catch {
                    return null
                }
            })
        )

        return sessions.filter(Boolean)
    } catch {
        return []
    }
}

module.exports = { readOpenCodeSessions }
