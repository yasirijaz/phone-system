import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';

// const serve = 'electron-serve';
import serve from 'electron-serve';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';

// __dirname is not defined in ES modules; recreate it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safely load CommonJS modules from ESM
const require = createRequire(import.meta.url);
const { autoUpdater } = require('electron-updater');
let Mainwindow
let isdev = true;
// Load environment variables early (supports dev via root .env)
// Try project root .env relative to this file; fall back to default resolution
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();


// Simple logger wrapper (avoid extra deps) and broadcast to renderer
function sendToRenderer(name,args) {
    console.log('[auto-updater]', args);
    try {
      const wins = BrowserWindow.getAllWindows();
      for (const w of wins) {
        w.webContents.send(name, args);
      }
    } catch (_) {
      // no-op if windows not ready
      console.log('hereee')
    }
}

ipcMain.on('check-for-updates', (event) => {
  autoUpdater.checkForUpdatesAndNotify();
  sendToRenderer('updatelog','Checking for updates...');
});

function setupAutoUpdater() {
  if (!app.isPackaged) {
    sendToRenderer('updatelog','Skipping auto-update in development');
    return;
  }


  // Event hooks for visibility
  autoUpdater.on('checking-for-update', () => sendToRenderer('updatelog','Checking for updates...'));
  autoUpdater.on('update-available', (info) => sendToRenderer('updatelog','Update available:'+ info +'&&'+ info.version));
  autoUpdater.on('update-not-available', () => sendToRenderer('updatelog','No updates available'));
  autoUpdater.on('error', (err) => sendToRenderer('updatelog','Updater error:'+ err));
  autoUpdater.on('download-progress', (p) => {
    const pct = (p && p.percent != null) ? p.percent.toFixed(1) : 'N/A';
    sendToRenderer('updatelog',`Download progress: ${pct}%`);
  });
  autoUpdater.on('update-downloaded', () => {
    sendToRenderer('updatelog','Update downloaded; quitting and installing...');
    // Install on next tick to avoid blocking the event loop
    setImmediate(() => autoUpdater.quitAndInstall());
  });

  // Start the update flow
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = Boolean(process.env.APP_ALLOW_PRERELEASE);

  // Use notify helper to show native notification (when supported)
  autoUpdater.checkForUpdatesAndNotify().catch((e) => sendToRenderer('updatelog','checkForUpdates failed:'+ e));
}

const appServe = app.isPackaged ? serve({
  directory: path.join(__dirname, "../out")
}) : null;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  if (app.isPackaged) {
    win.loadURL("https://phone.windshieldhub.com");
  } else {
    win.loadURL("http://localhost:3000");
    // win.loadURL("http://127.0.0.1:3000");
    win.webContents.openDevTools();
    win.webContents.on("did-fail-load", (e, code, desc) => {
      win.webContents.reloadIgnoringCache();
    });
  }
  Mainwindow = win;
}

function createAppMenu() {
  const template = [
    {
      label: 'About',
      submenu: [
        {
          label: 'Check Version',
          click: () => {
            const version = app.getVersion();
            dialog.showMessageBox({
              type: 'info',
              title: 'App Version',
              message: `Version: ${version}`,
              buttons: ['OK']
            });
          },
        },
        {
          label: 'Check for Updates',
          click: () => {
            try {
              // Trigger a manual update check
              autoUpdater.checkForUpdatesAndNotify();
              sendToRenderer('updatelog','Checking for updates...');
            } catch (e) {
              dialog.showErrorBox('Update Error', String(e));
            }
          },
        },
      ],
    },
  ];

  // In development, add a Debug menu with DevTools and Reload
  if (isdev) {
    template.push({
      label: 'Debug',
      submenu: [
        {
          label: 'Open DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.openDevTools({ mode: 'detach' });
          },
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            if (win) win.webContents.reloadIgnoringCache();
          },
        },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on("ready", () => {
    createWindow();
    createAppMenu();
    setupAutoUpdater();
});

let notificationWindow;

ipcMain.on('incoming-call', (event, callInfo) => {
  if (notificationWindow) {
    notificationWindow.close();
  }

  notificationWindow = new BrowserWindow({
    width: 300,
    height: 200,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const url = app.isPackaged
    ? `https://phone.windshieldhub.com/incoming-call-notification?from=${encodeURIComponent(callInfo.from)}&callerName=${encodeURIComponent(callInfo.callerName)}`
    : `http://localhost:3000/incoming-call-notification?from=${encodeURIComponent(callInfo.from)}&callerName=${encodeURIComponent(callInfo.callerName)}`;

  notificationWindow.loadURL(url);

  notificationWindow.on('closed', () => {
    notificationWindow = null;
  });
});

ipcMain.on('accept-call', () => {
  console.log(notificationWindow,'notificationWindow')
  if (Mainwindow) {
    Mainwindow.webContents.send('call-accepted');
  }
  if (notificationWindow) {
    notificationWindow.close();
  }
});

ipcMain.on('reject-call', () => {
  if (Mainwindow) {
    Mainwindow.webContents.send('call-rejected');
  }
  if (notificationWindow) {
    notificationWindow.close();
  }
});
