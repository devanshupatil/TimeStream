// src/main/trackers/claude.js
const fs = require('fs/promises')
const path = require('path')
const os = require('os')

// Default location where Claude CLI saves sessions
const DEFAULT_SESSIONS_DIR = path.join(os.homedir(), '.claude', 'projects')

async function readClaudeSessions(dir = DEFAULT_SESSIONS_DIR) {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        const jsonFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json'))

        const sessions = await Promise.all(
            jsonFiles.map(async (entry) => {
                try {
                    const raw = await fs.readFile(path.join(dir, entry.name), 'utf8')
                    const data = JSON.parse(raw)
                    // Add 'type' and 'source' fields so the dashboard knows where this came from
                    return { ...data, type: 'claude', source: entry.name }
                } catch {
                    // Skip files that can't be read or parsed — don't crash the whole tracker
                    return null
                }
            })
        )

        // Remove nulls (skipped files) and return clean array
        return sessions.filter(Boolean)
    } catch {
        // Directory doesn't exist or can't be read — return empty array, don't crash
        return []
    }
}

module.exports = { readClaudeSessions }
