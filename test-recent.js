const fs = require('fs');
const path = require('path');

const cutoffMs = Date.now() - 5 * 24 * 60 * 60 * 1000;
const cutoffDate = new Date(cutoffMs);
console.log('Searching for files modified since:', cutoffDate.toISOString());

function checkDb(p) {
    if (!fs.existsSync(p)) return;
    const mtime = fs.statSync(p).mtime;
    console.log(`DB ${p} last modified: ${mtime.toISOString()}`);
}

['/home/devanshu/.local/share/opencode/opencode.db',
    '/home/devanshu/snap/code/228/.local/share/opencode/opencode.db',
    '/home/devanshu/snap/code/227/.local/share/opencode/opencode.db'].forEach(checkDb);

console.log('\nScanning ~/.claude/projects for recent jsonl...');
const projectDirs = fs.readdirSync('/home/devanshu/.claude/projects', { withFileTypes: true });
let recentClaudeFiles = 0;
for (const d of projectDirs) {
    if (!d.isDirectory()) continue;
    const pDir = path.join('/home/devanshu/.claude/projects', d.name);
    try {
        const files = fs.readdirSync(pDir);
        for (const f of files) {
            if (!f.endsWith('.jsonl')) continue;
            const fp = path.join(pDir, f);
            const mtime = fs.statSync(fp).mtime;
            if (mtime > cutoffDate) {
                console.log(`Recent Claude file: ${fp} (${mtime.toISOString()})`);
                recentClaudeFiles++;
            }
        }
    } catch (e) { }
}
if (recentClaudeFiles === 0) console.log('No Claude files modified in the last 5 days in projects/ folders.');

try {
    const sessionsDir = '/home/devanshu/.claude/sessions';
    if (fs.existsSync(sessionsDir)) {
        console.log('\nScanning ~/.claude/sessions ...');
        const sessFiles = fs.readdirSync(sessionsDir);
        for (const f of sessFiles) {
            const fp = path.join(sessionsDir, f);
            const mtime = fs.statSync(fp).mtime;
            if (mtime > cutoffDate) {
                console.log(`Recent Claude session: ${fp} (${mtime.toISOString()})`);
            }
        }
    }
} catch (e) { }
