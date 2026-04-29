// Run with: bun tests/fixtures/browser/create-fixture.js
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const dir = dirname(fileURLToPath(import.meta.url))
mkdirSync(dir, { recursive: true })

const db = new Database(join(dir, 'History'))
db.run(`CREATE TABLE IF NOT EXISTS urls (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    visit_count INTEGER DEFAULT 0,
    last_visit_time INTEGER DEFAULT 0
)`)
db.run(`DELETE FROM urls`)
db.run(`INSERT INTO urls (url, title, last_visit_time) VALUES
    ('https://github.com/devanshupatil/TimeStream', 'TimeStream - GitHub', 13300000000000000),
    ('https://vitejs.dev', 'Vite | Next Generation Frontend Tooling', 13299900000000000),
    ('https://www.electronjs.org/docs', 'Electron Documentation', 13299800000000000)`)
db.close()

console.log('Browser history fixture created at tests/fixtures/browser/History')
