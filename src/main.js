const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { startWatcher } = require('./services/fileWatcher.js');
const { createClaudeCliWatcher } = require('./services/claudeCliWatcher');
const { getProjectDir, loadSessions } = require('./importers/claudecli');

let mainWindow;
const PORT = 3000;
const DATA_FILE = path.join(app.getPath('userData'), 'activities.json');
const LEARNING_FILE = path.join(app.getPath('userData'), 'learning-seconds.json');
const OPENCODE_FILE = path.join(app.getPath('userData'), 'opencode-sessions.json');
const CLAUDE_FILE = path.join(app.getPath('userData'), 'claude-sessions.json');

// Ensure data files exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}
if (!fs.existsSync(LEARNING_FILE)) {
    fs.writeFileSync(LEARNING_FILE, JSON.stringify({}));
}
if (!fs.existsSync(OPENCODE_FILE)) {
    fs.writeFileSync(OPENCODE_FILE, JSON.stringify([]));
}
if (!fs.existsSync(CLAUDE_FILE)) {
    fs.writeFileSync(CLAUDE_FILE, JSON.stringify([]));
}

function createWindow() {
    // Read primary display work area to fit the screen
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width,
        height,
        minWidth: Math.min(1024, Math.floor(width * 0.7)),
        minHeight: Math.min(768, Math.floor(height * 0.7)),
        frame: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#121121',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Maximize to fill screen on launch
    mainWindow.maximize();

    // Open DevTools in dev mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── DATA PERSISTENCE HELPERS ────────────────────────────────
let isWriting = false;
const writeQueue = [];

async function saveActivities(activities) {
    return new Promise((resolve) => {
        writeQueue.push({ activities, resolve });
        processWriteQueue();
    });
}

async function processWriteQueue() {
    if (isWriting || writeQueue.length === 0) return;
    isWriting = true;

    const { activities, resolve } = writeQueue.shift();
    try {
        let currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

        // 1. Sort incoming activities by time (latest first)
        activities.sort((a, b) => new Date(b.timestamp || b.time) - new Date(a.timestamp || a.time));

        // 2. De-duplicate batch against itself
        const uniqueIncoming = [];
        const seenInBatch = new Set();
        activities.forEach(act => {
            const actDate = act.timestamp || act.time;
            if (!actDate) return;
            const date = new Date(actDate).toISOString().split('T')[0];
            const key = (act.dedupKey || act.url) + '|' + date;
            if (!seenInBatch.has(key)) {
                uniqueIncoming.push(act);
                seenInBatch.add(key);
            }
        });

        // 3. Filter existing data against the unique incoming set
        uniqueIncoming.forEach(newAct => {
            const newRawDate = newAct.timestamp || newAct.time;
            const newDate = new Date(newRawDate).toISOString().split('T')[0];

            currentData = currentData.filter(oldAct => {
                const oldRawDate = oldAct.timestamp || oldAct.time;
                if (!oldRawDate) return true;

                const oldDate = new Date(oldRawDate).toISOString().split('T')[0];
                const isSameDay = oldDate === newDate;

                // De-duplicate by dedupKey if available, otherwise by URL
                let isSameActivity = false;
                if (newAct.dedupKey && oldAct.dedupKey) {
                    isSameActivity = oldAct.dedupKey === newAct.dedupKey;
                } else {
                    isSameActivity = oldAct.url === newAct.url;
                }

                return !(isSameActivity && isSameDay);
            });
        });

        const updatedData = [...uniqueIncoming, ...currentData].slice(0, 1000);
        fs.writeFileSync(DATA_FILE, JSON.stringify(updatedData, null, 2));
        resolve(true);
    } catch (err) {
        console.error('Persistence error:', err);
        resolve(false);
    } finally {
        isWriting = false;
        processWriteQueue();
    }
}

// ── HTTP SERVER (DATA RECEIVER) ─────────────────────────────
const server = http.createServer((req, res) => {
    // Enable CORS for Chrome Extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // GET endpoint for debugging/renderer
    if (req.method === 'GET' && req.url === '/api/activity') {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: 'Read error' }));
        }
        return;
    }

    if (req.method === 'POST' && req.url === '/api/activity') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let activities = [];

                if (Array.isArray(data.activities)) {
                    activities = data.activities;
                } else if (data.source) { // Single activity object
                    activities = [data];
                }

                // Handle learning seconds if present
                if (data.learningSeconds && typeof data.learningSeconds === 'object') {
                    try {
                        const lsData = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                        for (const [date, seconds] of Object.entries(data.learningSeconds)) {
                            lsData[date] = Math.max(lsData[date] || 0, seconds);
                        }
                        fs.writeFileSync(LEARNING_FILE, JSON.stringify(lsData, null, 2));
                    } catch (err) {
                        console.error('Learning seconds persistence error:', err);
                    }
                }

                if (activities.length === 0 && !data.learningSeconds) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No data provided' }));
                    return;
                }

                let success = true;
                if (activities.length > 0) {
                    // Add missing timestamps
                    activities = activities.map(a => ({
                        ...a,
                        timestamp: a.timestamp || new Date().toISOString()
                    }));

                    // Persist with synchronization
                    success = await saveActivities(activities);

                    // Send to Renderer
                    if (mainWindow) {
                        mainWindow.webContents.send('activity-received', activities);
                    }
                }

                res.writeHead(success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success, count: activities.length }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

// ── IPC HANDLERS ─────────────────────────────────────────────
ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

// Handler for loading historical data
ipcMain.handle('get-historical-data', () => {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
});

// Open external links in specified or default browser
ipcMain.on('open-external', (_, data) => {
    const url = typeof data === 'string' ? data : data?.url;
    const browser = typeof data === 'string' ? undefined : data?.browser?.toLowerCase();

    if (!url) return;

    if (!browser) {
        shell.openExternal(url);
        return;
    }

    const { exec } = require('child_process');
    const safeUrl = url.replace(/"/g, '\\"');

    if (browser.includes('firefox')) {
        exec(`firefox "${safeUrl}"`, (err) => {
            if (err) shell.openExternal(url);
        });
    } else if (browser.includes('chrome')) {
        exec(`google-chrome "${safeUrl}"`, (err) => {
            if (err) shell.openExternal(url);
        });
    } else if (browser.includes('brave')) {
        exec(`brave-browser "${safeUrl}"`, (err) => {
            if (err) shell.openExternal(url);
        });
    } else {
        shell.openExternal(url);
    }
});

// Clear historical data
ipcMain.handle('clear-history', () => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
        fs.writeFileSync(LEARNING_FILE, JSON.stringify({}));
        return { success: true };
    } catch (err) {
        console.error('Clear history error:', err);
        return { success: false, error: err.message };
    }
});

// Get learning seconds for a specific date or all dates
ipcMain.handle('get-learning-seconds', (_, date) => {
    try {
        const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
        if (date) return data[date] || 0;
        return data;
    } catch (err) {
        return date ? 0 : {};
    }
});

// Get Claude CLI sessions
ipcMain.handle('get-claude-sessions', async () => {
    return loadSessions(CLAUDE_FILE);
});

// Get OpenCode sessions, optionally filtered by date (YYYY-MM-DD)
ipcMain.handle('get-opencode-sessions', (_, date) => {
    try {
        const sessions = JSON.parse(fs.readFileSync(OPENCODE_FILE, 'utf8'));
        if (date) return sessions.filter(s => s.date === date);
        return sessions;
    } catch {
        return [];
    }
});

app.whenReady().then(() => {
    createWindow();

    startWatcher({
        storageFile: OPENCODE_FILE,
        onSession: (session) => {
            if (mainWindow) mainWindow.webContents.send('opencode-session-imported', session);
        },
        onMissingDir: () => {
            if (mainWindow) mainWindow.webContents.send('opencode-missing-dir');
        },
    });

    // ── Claude CLI Watcher ─────────────────────────────────────────
    const claudeWatchDir = getProjectDir(path.join(__dirname, '..'));
    const claudeWatcher = createClaudeCliWatcher({
        watchDir:    claudeWatchDir,
        storageFile: CLAUDE_FILE,
        onSession:   (session) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('claude-session-updated', session);
            }
        },
    });
    claudeWatcher.start();

    app.on('before-quit', () => claudeWatcher.stop());

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
