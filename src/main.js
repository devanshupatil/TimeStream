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

    if (req.method === 'POST' && req.url === '/api/activity') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const activities = Array.isArray(data.activities) ? data.activities : [data];

                // Persist to local file
                const currentData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                const updatedData = [...activities, ...currentData].slice(0, 1000); // Keep last 1000
                fs.writeFileSync(DATA_FILE, JSON.stringify(updatedData, null, 2));

                // Send to Renderer
                if (mainWindow) {
                    mainWindow.webContents.send('activity-received', activities);
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: activities.length }));
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

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
