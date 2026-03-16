const { app, BrowserWindow, ipcMain, shell, screen } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
const PORT = 3000;
const DATA_FILE = path.join(app.getPath('userData'), 'activities.json');

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
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

        // De-duplicate: For each new activity, remove any existing entry for the same URL on the same day
        activities.forEach(newAct => {
            const newRawDate = newAct.timestamp || newAct.time;
            if (!newRawDate) return;
            const newDate = new Date(newRawDate).toISOString().split('T')[0];

            currentData = currentData.filter(oldAct => {
                const oldRawDate = oldAct.timestamp || oldAct.time;
                if (!oldRawDate) return true;

                const oldDate = new Date(oldRawDate).toISOString().split('T')[0];
                const isSameUrl = oldAct.url === newAct.url;
                const isSameDay = oldDate === newDate;
                return !(isSameUrl && isSameDay);
            });
        });

        const updatedData = [...activities, ...currentData].slice(0, 1000);
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

                if (activities.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'No activities provided' }));
                    return;
                }

                // Add missing timestamps
                activities = activities.map(a => ({
                    ...a,
                    timestamp: a.timestamp || new Date().toISOString()
                }));

                // Persist with synchronization
                const success = await saveActivities(activities);

                // Send to Renderer
                if (mainWindow) {
                    mainWindow.webContents.send('activity-received', activities);
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

// Open external links in default browser
ipcMain.on('open-external', (_, url) => {
    shell.openExternal(url);
});

// Clear historical data
ipcMain.handle('clear-history', () => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify([]));
        return { success: true };
    } catch (err) {
        console.error('Clear history error:', err);
        return { success: false, error: err.message };
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
