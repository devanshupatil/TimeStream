const fs = require('fs')
const os = require('os')
const path = require('path')

// Chrome uses a different epoch than Unix.
// Offset in MICROSECONDS between 1601-01-01 and 1970-01-01.
const CHROME_EPOCH_OFFSET_MICROSECONDS = 11644473600000000n

function chromeTimeToISO(chromeTime) {
    const milliseconds = (BigInt(chromeTime) - CHROME_EPOCH_OFFSET_MICROSECONDS) / 1000n
    return new Date(Number(milliseconds)).toISOString()
}

function getDefaultHistoryPath() {
    const home = os.homedir()
    switch (process.platform) {
        case 'linux':
            return path.join(home, '.config/google-chrome/Default/History')
        case 'darwin':
            return path.join(home, 'Library/Application Support/Google/Chrome/Default/History')
        case 'win32':
            return path.join(home, 'AppData/Local/Google/Chrome/User Data/Default/History')
        default:
            return null
    }
}

async function readBrowserHistory(historyPath = getDefaultHistoryPath(), limit = 100) {
    if (!historyPath || !fs.existsSync(historyPath)) return []

    // Chrome locks the History file while running — copy to temp first
    const tmpPath = path.join(os.tmpdir(), `timestream-history-${Date.now()}.db`)

    try {
        fs.copyFileSync(historyPath, tmpPath)

        // bun:sqlite in Bun runtime (tests/dev), better-sqlite3 in packaged Electron (Node.js)
        let rows
        try {
            const { Database } = await import('bun:sqlite')
            const db = new Database(tmpPath, { readonly: true })
            rows = db.query(`
                SELECT url, title, last_visit_time
                FROM urls
                WHERE last_visit_time > 0
                ORDER BY last_visit_time DESC
                LIMIT ${limit}
            `).all()
            db.close()
        } catch {
            const Database = require('better-sqlite3')
            const db = new Database(tmpPath, { readonly: true })
            rows = db.prepare(`
                SELECT url, title, last_visit_time
                FROM urls
                WHERE last_visit_time > 0
                ORDER BY last_visit_time DESC
                LIMIT ${limit}
            `).all()
            db.close()
        }
        fs.unlinkSync(tmpPath)

        return rows.map((row, index) => ({
            id: `browser-${row.last_visit_time}-${index}`,
            type: 'browser',
            url: row.url,
            title: row.title || row.url,
            startTime: chromeTimeToISO(row.last_visit_time)
        }))

    } catch {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)
        return []
    }
}

module.exports = { readBrowserHistory }
